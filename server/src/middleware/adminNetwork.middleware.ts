import type { NextFunction, Request, RequestHandler, Response } from "express";

// Loads .env before the list below is read at start-up.
import "../config/env.js";
import { logSecurityEvent } from "../utils/securityLog.js";

/**
 * Keeps the admin panel, and every part of the API that is not the public
 * website's, reachable only from the addresses on a list.
 *
 * WHERE THE LIST COMES FROM — two places, added together:
 *
 *   1. The host's environment, ADMIN_ALLOWED_IPS (e.g. "203.0.113.24"). This is
 *      the permanent baseline. The admin screen can show it but cannot change or
 *      remove it, which is what makes it the way back in after a mistake.
 *   2. The list edited in Admin > Admin access (saved in the database, read
 *      every minute and the moment it is changed).
 *
 * The protection is active when the two lists together are not empty and it has
 * not been switched off. ADMIN_IP_GUARD=off in the environment switches it off
 * whatever the database says — the last-resort way back in.
 *
 * WHY IT EXISTS
 *
 * The admin sign-in is protected by a password and an emailed code. That stops
 * a stranger from getting in, but it leaves the sign-in page itself open to the
 * whole internet for guessing, scanning and probing. With this on, anyone not on
 * the list is told that the panel does not exist — the page and every private
 * API call answer "not found" before any of the application's own code runs.
 *
 * DENY BY DEFAULT
 *
 * It does not keep a list of admin routes to block (a route forgotten from that
 * list would stay open). It keeps a short list of what the PUBLIC website needs
 * — reading pages, sending the contact form, the visitor ping — and everything
 * else on /api, and the whole of /admin, is refused to anyone off the list. A
 * route added tomorrow is private until somebody deliberately adds it below.
 *
 * WHAT IT CANNOT DO
 *
 * It decides on the address the server sees (req.ip). That is the real visitor
 * address only when `trust proxy` counts the right number of proxies in front of
 * the app (TRUST_PROXY_HOPS, see app.ts): too few and everyone appears to be the
 * proxy; too many and a visitor could write their own X-Forwarded-For and walk
 * in. `npm run security:check` tests exactly that case.
 *
 * MODES
 *
 *   report   log who WOULD be refused, refuse nobody
 *   enforce  refuse them
 *
 * ADMIN_IP_MODE in the environment overrides the mode saved in the database.
 */

// ---- What the public website may reach ---------------------------------------

type Rule = { method: "GET" | "POST"; pattern: RegExp };

/** Paths are relative to /api/v1. */
export const PUBLIC_RULES: Rule[] = [
  { method: "GET", pattern: /^\/$/ },
  { method: "GET", pattern: /^\/(sitemap\.xml|robots\.txt|llms\.txt)$/ },
  { method: "GET", pattern: /^\/metadata\/[^/]+$/ },
  { method: "GET", pattern: /^\/page-content\/public\/[a-z-]+(\/layout)?$/i },
  { method: "GET", pattern: /^\/settings\/public$/ },
  { method: "GET", pattern: /^\/blog\/public(\/[^/]+)?$/ },
  { method: "GET", pattern: /^\/brands(\/[^/]+)?$/ },
  { method: "GET", pattern: /^\/collections(\/[^/]+)?$/ },
  { method: "GET", pattern: /^\/team$/ },
  { method: "GET", pattern: /^\/exhibitions(\/search)?$/ },
  { method: "GET", pattern: /^\/exhibitions\/[^/]+(\/gallery)?$/ },
  { method: "POST", pattern: /^\/inquiries\/contact$/ },
  { method: "POST", pattern: /^\/blog\/public\/[^/]+\/comments$/ },
  { method: "POST", pattern: /^\/visitors\/ping$/ },
];

/** The two calls the page makes just to learn "am I signed in?". A stranger gets the ordinary answer. */
const SESSION_PROBES = new Set(["/auth/me", "/auth/refresh"]);

// ---- Addresses -----------------------------------------------------------------

export type AddressRule =
  | { kind: "v4"; network: number; mask: number }
  | { kind: "v6"; text: string };

function ipv4ToNumber(text: string): number | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** `::ffff:1.2.3.4` is how Node writes an IPv4 address on a dual-stack socket. */
export function normalizeIp(raw: string | undefined | null): string {
  let ip = String(raw ?? "").trim().toLowerCase();
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  ip = ip.replace(/%.*$/, "");
  if (ip.startsWith("::ffff:") && ipv4ToNumber(ip.slice(7)) !== null) ip = ip.slice(7);
  return ip;
}

export function parseAllowList(raw: string | undefined): { rules: AddressRule[]; invalid: string[] } {
  const rules: AddressRule[] = [];
  const invalid: string[] = [];

  for (const entry of (raw ?? "").split(",").map((item) => item.trim()).filter(Boolean)) {
    const [address, bits] = entry.split("/");
    const ip = normalizeIp(address);
    const asNumber = ipv4ToNumber(ip);

    if (asNumber !== null) {
      const length = bits === undefined ? 32 : Number(bits);
      // /0 would be "the whole internet": refused, since writing it is always a
      // mistake and never what the person meant.
      if (!Number.isInteger(length) || length < 1 || length > 32) {
        invalid.push(entry);
        continue;
      }
      const mask = length === 32 ? 0xffffffff : (0xffffffff << (32 - length)) >>> 0;
      rules.push({ kind: "v4", network: (asNumber & mask) >>> 0, mask });
    } else if (ip.includes(":") && /^[0-9a-f:]+$/.test(ip) && bits === undefined) {
      rules.push({ kind: "v6", text: ip });
    } else {
      invalid.push(entry);
    }
  }

  return { rules, invalid };
}

export function matches(rules: AddressRule[], rawIp: string | undefined): boolean {
  const ip = normalizeIp(rawIp);
  const asNumber = ipv4ToNumber(ip);

  return rules.some((rule) =>
    rule.kind === "v4"
      ? asNumber !== null && ((asNumber & rule.mask) >>> 0) === rule.network
      : rule.text === ip,
  );
}

export function isLoopback(rawIp: string | undefined): boolean {
  const ip = normalizeIp(rawIp);
  return ip === "::1" || ip.startsWith("127.");
}

/**
 * An address on a private network, or the machine itself. If the server sees one
 * of these for a real visitor, the proxy in front of it is hiding the visitor's
 * real address and no list of addresses can tell people apart.
 */
export function isPrivateAddress(rawIp: string | undefined): boolean {
  const ip = normalizeIp(rawIp);
  const n = ipv4ToNumber(ip);

  if (n === null) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip === "";

  const a = Math.floor(n / 2 ** 24);
  const b = Math.floor(n / 2 ** 16) % 256;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

// ---- The list in the database ----------------------------------------------------

export interface DynamicState {
  /** True once the database has been read (or reading has been given up on). */
  loaded: boolean;
  enabled: boolean;
  mode: string;
  rules: AddressRule[];
}

let dynamic: DynamicState = { loaded: false, enabled: false, mode: "report", rules: [] };
let firstLoad: Promise<void> | null = null;

export function setDynamicState(next: Partial<DynamicState>): void {
  dynamic = { ...dynamic, ...next };
}

export function getDynamicState(): DynamicState {
  return dynamic;
}

/** Registered at start-up so the first requests wait for the list instead of racing it. */
export function registerFirstLoad(promise: Promise<void>): void {
  firstLoad = promise;
}

function baselineRules() {
  return parseAllowList(process.env.ADMIN_ALLOWED_IPS);
}

export interface Effective {
  /** The protection applies to requests. */
  active: boolean;
  /** …and refuses them (rather than only logging). */
  enforce: boolean;
  /** Everything that is allowed in. */
  rules: AddressRule[];
  /** Switched off from the environment, whatever the database says. */
  guardOff: boolean;
  baselineCount: number;
  databaseCount: number;
}

export function effective(): Effective {
  const baseline = baselineRules().rules;
  const fromDatabase = dynamic.enabled ? dynamic.rules : [];
  const guardOff = (process.env.ADMIN_IP_GUARD ?? "").toLowerCase() === "off";
  const rules = [...baseline, ...fromDatabase];

  const mode = (process.env.ADMIN_IP_MODE ?? (dynamic.enabled ? dynamic.mode : "enforce")).toLowerCase();

  return {
    active: !guardOff && rules.length > 0,
    enforce: mode !== "report",
    rules,
    guardOff,
    baselineCount: baseline.length,
    databaseCount: fromDatabase.length,
  };
}

// ---- Deciding ------------------------------------------------------------------

export type Verdict = "allow" | "page" | "probe" | "api";

/**
 * What to do with a request from an address that is NOT on the list.
 *   allow  — it is something the public website needs
 *   page   — the admin pages: answer "not found"
 *   probe  — a "who am I" call: answer the ordinary 401
 *   api    — any other private API call: answer "not found"
 */
export function classify(method: string, path: string): Verdict {
  const upper = method.toUpperCase();
  const verb = upper === "HEAD" || upper === "OPTIONS" ? "GET" : upper;

  if (path === "/admin" || path.startsWith("/admin/")) return "page";

  if (path === "/api/health") return "allow";

  if (path.startsWith("/api/")) {
    if (!path.startsWith("/api/v1")) return "api";
    const relative = path.slice("/api/v1".length) || "/";

    if (PUBLIC_RULES.some((rule) => rule.method === verb && rule.pattern.test(relative))) return "allow";
    if (SESSION_PROBES.has(relative)) return "probe";
    return "api";
  }

  // The public website itself: pages, scripts, pictures, fonts.
  return "allow";
}

// One log line per address per minute, so a scan does not become a flood.
const lastLogged = new Map<string, number>();

function shouldLog(ip: string): boolean {
  const now = Date.now();
  if (lastLogged.size > 2000) lastLogged.clear();
  if (now - (lastLogged.get(ip) ?? 0) < 60_000) return false;
  lastLogged.set(ip, now);
  return true;
}

function respond(req: Request, res: Response, next: NextFunction, rules: AddressRule[], enforce: boolean, allowLoopback: boolean): void {
  if (matches(rules, req.ip)) return next();
  if (allowLoopback && isLoopback(req.ip)) return next();

  const verdict = classify(req.method, req.path);
  if (verdict === "allow") return next();

  const ip = normalizeIp(req.ip);
  if (shouldLog(ip)) {
    logSecurityEvent(enforce ? "admin.blocked" : "admin.would_block", {
      ip,
      method: req.method,
      path: req.path.slice(0, 120),
    });
  }

  if (!enforce) return next();

  res.setHeader("Cache-Control", "no-store");

  if (verdict === "probe") {
    res.status(401).json({ success: false, message: "Unauthorized", errors: null });
    return;
  }

  if (verdict === "api") {
    res.status(404).json({ success: false, message: "Not found.", errors: null });
    return;
  }

  // A page. Same answer as for an address that does not exist, nothing more.
  res.status(404).type("html").send("<!doctype html><title>Not found</title><h1>Not found</h1>");
}

export interface AdminNetworkOptions {
  /** The comma-separated list. */
  allowed?: string;
  /** "enforce" refuses, "report" only logs. */
  mode?: string;
  /** Loopback is the server talking to itself (cache refresh, local development). */
  allowLoopback?: boolean;
}

/**
 * A guard with a FIXED list. The application itself uses `adminNetwork` below,
 * which reads the live lists; this is what the security check uses to prove the
 * behaviour with addresses of its own choosing.
 */
export function createAdminNetwork(options: AdminNetworkOptions = {}): RequestHandler {
  const { rules } = parseAllowList(options.allowed);
  const enforce = (options.mode ?? "enforce").toLowerCase() !== "report";
  const allowLoopback = options.allowLoopback ?? true;

  // Nothing listed: the panel is open, exactly as before this existed.
  if (rules.length === 0) return (_req, _res, next) => next();

  return (req, res, next) => respond(req, res, next, rules, enforce, allowLoopback);
}

/** The one the application uses: environment list + database list, as they are right now. */
export const adminNetwork: RequestHandler = async (req, res, next) => {
  // Before the database has been read, wait for it — but never for long, and
  // never when the environment list alone already decides.
  if (!dynamic.loaded && firstLoad && baselineRules().rules.length === 0) {
    await Promise.race([firstLoad, new Promise((resolve) => setTimeout(resolve, 6000))]);
  }

  const current = effective();
  if (!current.active) return next();

  respond(req, res, next, current.rules, current.enforce, true);
};

/** Said at start-up so the state of the protection is never a guess. */
export function describeAdminNetwork(): {
  configured: boolean;
  enforced: boolean;
  entries: number;
  baseline: number;
  database: number;
  guardOff: boolean;
  invalid: string[];
} {
  const current = effective();
  return {
    configured: current.active,
    enforced: current.enforce,
    entries: current.rules.length,
    baseline: current.baselineCount,
    database: current.databaseCount,
    guardOff: current.guardOff,
    invalid: baselineRules().invalid,
  };
}
