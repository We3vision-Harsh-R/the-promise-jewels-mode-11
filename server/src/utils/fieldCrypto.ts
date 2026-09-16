import crypto from "node:crypto";

/**
 * Authenticated encryption for individual database columns.
 *
 * The vault (utils/secureBox.ts) seals a whole note as one blob. This seals
 * ONE FIELD at a time, so a table can keep its shape — its ids, timestamps,
 * foreign keys and status columns stay readable and queryable — while the
 * personal data inside it does not.
 *
 * WHAT IS ENCRYPTED, AND WHAT DELIBERATELY IS NOT
 *
 * Encrypting everything sounds safer and is not. A collection's name, a
 * brand's logo, a blog post, the words on the home page — all of that is
 * PUBLISHED ON THE INTERNET. Encrypting it would cost a decrypt on every page
 * load, make it impossible to sort or index, and protect nothing that is not
 * already public.
 *
 * So the line is drawn at data that is **not public and identifies a person or
 * a deal**: the contact details somebody types into the enquiry form, and the
 * buyers met at a stall. A database dump then carries no names, no phone
 * numbers and no messages.
 *
 * SEPARATE KEY FROM THE VAULT
 *
 * DATA_ENCRYPTION_KEY, not NOTES_ENCRYPTION_KEY. They protect different things
 * for different people — one is the owner's own passwords, the other is
 * customers' contact details — and one key compromised should not be both.
 *
 * MIXED TABLES ARE EXPECTED
 *
 * Rows written before this existed are plaintext. `decryptField` returns
 * anything that is not in this format unchanged, so a half-migrated table
 * reads correctly throughout. `npm run security:encrypt` converts the rest.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/** Marks the scheme and makes plaintext identifiable at a glance. */
const PREFIX = "enc1";

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.DATA_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "DATA_ENCRYPTION_KEY is not set, so personal data cannot be encrypted " +
        "or read back. Generate one with:  " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"  " +
        "and put it in the server environment. Keep a copy somewhere safe.",
    );
  }

  const bytes = Buffer.from(raw, "base64");

  if (bytes.length !== 32) {
    throw new Error(
      `DATA_ENCRYPTION_KEY must be 32 bytes of base64 (got ${bytes.length}).`,
    );
  }

  cachedKey = bytes;
  return cachedKey;
}

/** True when the key is present and usable. Lets a boot check say so. */
export function fieldCryptoReady(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** Recognises this module's own output, so plaintext can be passed through. */
export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}.`);
}

/**
 * Encrypts one field.
 *
 * @param aad Additional Authenticated Data — bound to the ciphertext without
 *            being hidden by it. The row's table and id go here, so a value
 *            copied from one row to another by somebody with write access to
 *            the database fails to open rather than silently moving one
 *            person's phone number onto another person's record.
 */
export function encryptField(value: string | null | undefined, aad: string): string | null {
  // Only null in gives null out. An empty string is encrypted like any other
  // value — collapsing "" to null here would break every NOT NULL column that
  // legitimately holds one, and would make "they left it blank" and "there is
  // no such field" the same fact.
  if (value === null || value === undefined) return null;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return [
    PREFIX,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(".");
}

/**
 * Decrypts one field.
 *
 * Anything that is not this module's output comes back untouched — that is
 * what lets a table hold old plaintext rows and new encrypted ones at the same
 * time, which every migration needs to survive.
 *
 * A value that IS ours but fails to open is a real problem (wrong key, altered
 * row, moved between records) and throws rather than being returned as-is: a
 * silent fallback there would hand back ciphertext as if it were a name.
 */
export function decryptField(value: string | null | undefined, aad: string): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return value;

  const [, ivB64, tagB64, bodyB64] = value.split(".");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivB64, "base64"),
  );

  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(bodyB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * The same, but never throws.
 *
 * For list screens, where one damaged row must not take the whole page down.
 * The caller gets a marker it can render instead of a value.
 */
export function decryptFieldSafe(
  value: string | null | undefined,
  aad: string,
): string | null {
  try {
    return decryptField(value, aad);
  } catch {
    return "[unreadable]";
  }
}

/** The AAD for a row: which table, which record. */
export function rowAad(table: string, id: string): string {
  return `${table}:${id}`;
}
