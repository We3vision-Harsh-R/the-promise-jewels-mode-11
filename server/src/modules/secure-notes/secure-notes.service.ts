import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { open, seal, vaultIsConfigured } from "../../utils/secureBox.js";
import { notePayloadSchema, type NotePayload } from "./secure-notes.types.js";

/**
 * The vault.
 *
 * **Every function here is scoped to one owner, and there is no way to ask for
 * somebody else's entries.** Not "no screen for it" — no code path. The owner
 * id is taken from the signed-in account and written into the `where` of every
 * query, so a crafted request cannot widen it.
 *
 * That includes the Master role, and this is the one place in the panel where
 * Master is not a skeleton key. Everywhere else Master means "may do anything"
 * because everything else is *company* data — collections, brands, the
 * website's words. A vault is not company data. It is one person's passwords,
 * and a permission that could open somebody else's is not a vault, it is a
 * filing cabinet with a sign on it.
 *
 * The permission (`notes:*`) therefore controls whether an account has a vault
 * AT ALL, never whose vault it sees.
 *
 * The sealing itself is in utils/secureBox.ts, which also says plainly what
 * this does and does not protect against.
 */

export interface VaultEntry {
  id: string;
  payload: NotePayload;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Anything that cannot be opened is reported as damaged rather than thrown.
 *
 * One unreadable row must not take the whole vault down with it — the other
 * forty entries are still perfectly good, and a person locked out of all of
 * them because of one bad row is worse off than one who can see the rest and
 * knows which one broke.
 */
export interface DamagedEntry {
  id: string;
  pinned: boolean;
  updatedAt: Date;
  damaged: true;
}

function assertConfigured() {
  if (!vaultIsConfigured()) {
    throw new ApiError(
      503,
      "The vault is not set up on this server yet: NOTES_ENCRYPTION_KEY is " +
        "missing. Until it is set, notes cannot be read or saved.",
    );
  }
}

function decode(row: {
  id: string;
  ownerId: string;
  payload: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}): VaultEntry | DamagedEntry {
  try {
    // The owner id is the AAD, so a row moved to another account by someone
    // with write access to the table fails here rather than opening.
    const parsed = notePayloadSchema.parse(JSON.parse(open(row.payload, row.ownerId)));

    return {
      id: row.id,
      payload: parsed,
      pinned: row.pinned,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    logger.error(`Vault entry ${row.id} could not be opened: ${(error as Error).message}`);
    return { id: row.id, pinned: row.pinned, updatedAt: row.updatedAt, damaged: true };
  }
}

const SELECT = {
  id: true,
  ownerId: true,
  payload: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Everything this owner has, pinned first, then most recently changed.
 *
 * The whole vault comes back in one request and is searched in the browser.
 * That is the right shape here: the entries are already decrypted to be shown
 * at all, a vault holds tens of rows rather than millions, and searching on
 * the server would mean either sending the query up (which describes what is
 * being looked for) or keeping a searchable copy of the titles (which is the
 * one thing the sealed payload exists to prevent).
 */
export async function listFor(ownerId: string): Promise<Array<VaultEntry | DamagedEntry>> {
  assertConfigured();

  const rows = await prisma.secureNote.findMany({
    where: { ownerId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: SELECT,
  });

  return rows.map(decode);
}

export async function createFor(
  ownerId: string,
  input: { payload: NotePayload; pinned: boolean },
): Promise<VaultEntry | DamagedEntry> {
  assertConfigured();

  const row = await prisma.secureNote.create({
    data: {
      ownerId,
      payload: seal(JSON.stringify(input.payload), ownerId),
      pinned: input.pinned,
    },
    select: SELECT,
  });

  return decode(row);
}

/**
 * Updates one entry.
 *
 * `updateMany` with the owner in the where clause, not `update` by id: an
 * update that matches nothing changes nothing and reports 0, where a
 * find-then-update leaves a gap between the check and the write. It also means
 * the answer to "does this entry exist" and "is it yours" is the same answer,
 * so the API cannot be used to discover another account's entry ids.
 */
export async function updateFor(
  ownerId: string,
  id: string,
  input: { payload: NotePayload; pinned: boolean },
): Promise<VaultEntry | DamagedEntry> {
  assertConfigured();

  const result = await prisma.secureNote.updateMany({
    where: { id, ownerId },
    data: {
      payload: seal(JSON.stringify(input.payload), ownerId),
      pinned: input.pinned,
    },
  });

  if (result.count === 0) throw new ApiError(404, "That note does not exist.");

  const row = await prisma.secureNote.findFirstOrThrow({
    where: { id, ownerId },
    select: SELECT,
  });

  return decode(row);
}

export async function removeFor(ownerId: string, id: string): Promise<void> {
  const result = await prisma.secureNote.deleteMany({ where: { id, ownerId } });
  if (result.count === 0) throw new ApiError(404, "That note does not exist.");
}
