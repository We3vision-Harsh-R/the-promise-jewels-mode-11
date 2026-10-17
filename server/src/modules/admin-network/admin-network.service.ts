import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { logSecurityEvent } from "../../utils/securityLog.js";
import {
  type AddressRule,
  effective,
  isLoopback,
  isPrivateAddress,
  matches,
  normalizeIp,
  parseAllowList,
  registerFirstLoad,
  setDynamicState,
} from "../../middleware/adminNetwork.middleware.js";

/**
 * The list of addresses that may open the admin panel, edited from the panel.
 *
 * What this adds to the guard in middleware/adminNetwork.middleware.ts is
 * somewhere to CHANGE the list without redeploying — and the care that needs,
 * because a list edited from the very panel it protects can lock its editor out.
 * So the three ways of doing that are each refused here, with a reason:
 *
 *   - removing the address you are using,
 *   - turning the protection on (or to "enforce") when your own address is not
 *     on the list,
 *   - turning it on while the server cannot tell visitors apart (it sees a
 *     private address for you), which would make the list meaningless.
 *
 * The host's ADMIN_ALLOWED_IPS is a permanent baseline this screen cannot touch,
 * and ADMIN_IP_GUARD=off in the host's settings switches everything off.
 */

const SETTINGS_ID = "default";
const MAX_RULES = 25;
const REFRESH_MS = 60_000;

// ---- Reading the list into the guard -----------------------------------------

export async function refreshAdminNetwork(): Promise<void> {
  try {
    const [settings, rows] = await Promise.all([
      prisma.adminAccessSettings.findUnique({ where: { id: SETTINGS_ID } }),
      prisma.adminAccessRule.findMany({ select: { address: true } }),
    ]);

    const parsed = parseAllowList(rows.map((row) => row.address).join(","));

    setDynamicState({
      loaded: true,
      enabled: settings?.enabled ?? false,
      mode: settings?.mode ?? "report",
      rules: parsed.rules,
    });
  } catch (error) {
    // Keep whatever was known before: a database that is briefly unreachable
    // must neither open the panel nor lock people out. On the very first read
    // there is nothing known, so the guard rests on the environment list alone.
    setDynamicState({ loaded: true });
    logger.warn(`[admin-network] could not read the saved list: ${(error as Error).message}`);
  }
}

let started = false;

export function startAdminNetworkRefresh(): void {
  if (started) return;
  started = true;

  // Registered first so the earliest requests wait for the list instead of racing it.
  registerFirstLoad(refreshAdminNetwork());

  setInterval(() => void refreshAdminNetwork(), REFRESH_MS).unref();
}

// ---- Pure rules about not locking yourself out -----------------------------------

/**
 * Would the person at `requesterIp` be refused if the lists were as given?
 * Exported so the security check can prove it without a database.
 */
export function wouldLockOut(input: {
  requesterIp: string | undefined;
  baseline: AddressRule[];
  saved: AddressRule[];
  enabled: boolean;
  enforce: boolean;
  guardOff?: boolean;
}): boolean {
  const rules = [...input.baseline, ...(input.enabled ? input.saved : [])];

  if (input.guardOff || rules.length === 0 || !input.enforce) return false;
  if (isLoopback(input.requesterIp)) return false;
  return !matches(rules, input.requesterIp);
}

/** One address or one range, in the form it will be stored. */
export function cleanAddress(raw: string): { address: string } | { error: string } {
  const text = raw.trim();

  if (!text || text.includes(",") || /\s/.test(text)) {
    return { error: "Enter one address, or one range like 203.0.113.0/24." };
  }

  const { rules, invalid } = parseAllowList(text);
  if (rules.length !== 1 || invalid.length) {
    return { error: "That is not a valid address. Use something like 203.0.113.24 or 203.0.113.0/24." };
  }

  const [address, bits] = text.split("/");
  const ip = normalizeIp(address);

  if (isPrivateAddress(ip)) {
    return {
      error:
        "That is a private address. Visitors reach the website from the internet, so a private address can never match one of them.",
    };
  }

  if (bits !== undefined && /^\d+$/.test(bits) && Number(bits) < 16 && !ip.includes(":")) {
    return { error: "That range is far too wide (more than 65,000 addresses). Use /16 or narrower." };
  }

  return { address: bits === undefined ? ip : `${ip}/${bits}` };
}

// ---- What the screen reads -------------------------------------------------------

async function currentSettings() {
  return (await prisma.adminAccessSettings.findUnique({ where: { id: SETTINGS_ID } })) ?? {
    id: SETTINGS_ID,
    enabled: false,
    mode: "report",
    updatedBy: null,
    updatedAt: new Date(0),
  };
}

export async function getOverview(requesterIp: string | undefined) {
  const [settings, rules] = await Promise.all([
    currentSettings(),
    prisma.adminAccessRule.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const baselineText = (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const current = effective();
  const yourAddress = normalizeIp(requesterIp);

  return {
    enabled: settings.enabled,
    mode: settings.mode,
    /** Set in the host's settings; these cannot be removed here. */
    baseline: baselineText,
    modeFromHost: process.env.ADMIN_IP_MODE ? process.env.ADMIN_IP_MODE.toLowerCase() : null,
    guardOff: current.guardOff,
    /** The protection is applying to requests right now. */
    active: current.active,
    enforcing: current.active && current.enforce,
    rules: rules.map((rule) => ({
      id: rule.id,
      address: rule.address,
      label: rule.label,
      createdAt: rule.createdAt,
    })),
    maxRules: MAX_RULES,
    yourAddress,
    /** The server sees a private address for you: the proxy settings are wrong, and no list can work. */
    yourAddressIsPrivate: isPrivateAddress(requesterIp),
    yourAddressIsListed:
      matches(
        [...parseAllowList(baselineText.join(",")).rules, ...parseAllowList(rules.map((r) => r.address).join(",")).rules],
        requesterIp,
      ),
  };
}

// ---- Changing it -------------------------------------------------------------------

function baselineRules(): AddressRule[] {
  return parseAllowList(process.env.ADMIN_ALLOWED_IPS).rules;
}

async function savedRules(excludingId?: string): Promise<AddressRule[]> {
  const rows = await prisma.adminAccessRule.findMany({ select: { id: true, address: true } });
  return parseAllowList(rows.filter((row) => row.id !== excludingId).map((row) => row.address).join(",")).rules;
}

export async function addRule(input: { address: string; label: string }, userId: string) {
  const cleaned = cleanAddress(input.address);
  if ("error" in cleaned) throw new ApiError(400, cleaned.error);

  if ((await prisma.adminAccessRule.count()) >= MAX_RULES) {
    throw new ApiError(409, `The list is limited to ${MAX_RULES} entries. Remove one you no longer need.`);
  }

  try {
    const rule = await prisma.adminAccessRule.create({
      data: { address: cleaned.address, label: input.label.trim(), createdBy: userId },
    });

    logSecurityEvent("admin.network.changed", { by: userId, action: "add", address: rule.address });
    await refreshAdminNetwork();
    return rule;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new ApiError(409, "That address is already on the list.");
    }
    throw error;
  }
}

export async function removeRule(id: string, userId: string, requesterIp: string | undefined) {
  const rule = await prisma.adminAccessRule.findUnique({ where: { id } });
  if (!rule) throw new ApiError(404, "That entry was not found.");

  const settings = await currentSettings();
  const current = effective();

  if (
    wouldLockOut({
      requesterIp,
      baseline: baselineRules(),
      saved: await savedRules(id),
      enabled: settings.enabled,
      enforce: current.enforce,
      guardOff: current.guardOff,
    })
  ) {
    throw new ApiError(
      409,
      "That is the address you are using right now. Removing it would lock you out of the admin panel. Add the address you will use instead first, or ask someone on the list to remove it.",
    );
  }

  await prisma.adminAccessRule.delete({ where: { id } });
  logSecurityEvent("admin.network.changed", { by: userId, action: "remove", address: rule.address });
  await refreshAdminNetwork();
  return { id };
}

export async function saveSettings(
  input: { enabled?: boolean; mode?: "report" | "enforce" },
  userId: string,
  requesterIp: string | undefined,
) {
  const before = await currentSettings();
  const enabled = input.enabled ?? before.enabled;
  const mode = input.mode ?? before.mode;

  if (enabled) {
    const saved = await savedRules();
    const baseline = baselineRules();

    if (saved.length + baseline.length === 0) {
      throw new ApiError(409, "Add at least one address before turning the protection on.");
    }

    // The proxy is hiding the real address: everyone looks the same, so a list
    // cannot tell the office from a stranger.
    if (isPrivateAddress(requesterIp) && !isLoopback(requesterIp)) {
      throw new ApiError(
        409,
        `The website sees your address as ${normalizeIp(requesterIp)}, which is a private address. The proxy in front of the website is hiding visitors' real addresses (check TRUST_PROXY_HOPS), so a list of addresses cannot work yet.`,
      );
    }

    if (
      wouldLockOut({
        requesterIp,
        baseline,
        saved,
        enabled,
        enforce: mode === "enforce",
        guardOff: effective().guardOff,
      })
    ) {
      throw new ApiError(
        409,
        `The address you are using (${normalizeIp(requesterIp)}) is not on the list, so turning this on would lock you out. Add it first (the "Add my current address" button), or use report-only mode.`,
      );
    }
  }

  const row = await prisma.adminAccessSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { enabled, mode, updatedBy: userId },
    create: { id: SETTINGS_ID, enabled, mode, updatedBy: userId },
  });

  logSecurityEvent("admin.network.changed", { by: userId, action: "settings", enabled, mode });
  await refreshAdminNetwork();
  return row;
}
