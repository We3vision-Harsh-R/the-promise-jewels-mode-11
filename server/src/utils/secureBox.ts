import crypto from "node:crypto";

/**
 * Authenticated encryption for the vault.
 *
 * The threat this is built against is a **database dump**: a leaked Supabase
 * credential, a stolen backup, a screenshot of the table editor. Against that
 * it is complete — the rows carry base64 and nothing else, and nothing in the
 * database can turn them back into words.
 *
 * It is NOT end-to-end. The key lives in this server's environment, so this
 * server can decrypt, and anyone holding both the database AND the environment
 * can decrypt. Saying so plainly matters, because the alternative — deriving
 * the key from a passphrase the server never sees — means a forgotten
 * passphrase destroys every note with no way back. For an owner keeping their
 * own passwords in their own panel, silent total loss is the worse failure.
 *
 * AES-256-GCM, not AES-CBC. GCM authenticates as well as encrypts: a
 * ciphertext altered by someone with write access to the table fails to open
 * rather than decrypting to something. CBC would hand back garbage, or worse,
 * attacker-chosen plaintext.
 */

const ALGORITHM = "aes-256-gcm";

/** 96 bits. The size GCM is specified for — longer gets hashed, shorter is weaker. */
const IV_BYTES = 12;

/** Marks the scheme, so a future v2 can be introduced without guessing. */
const VERSION = "v1";

let cachedKey: Buffer | null = null;

/**
 * The key, read once.
 *
 * Read lazily rather than at import time so a deployment missing the variable
 * still boots and serves the website — the vault is the only thing that stops
 * working, and it stops with a message that says exactly what to do.
 */
function key(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.NOTES_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "NOTES_ENCRYPTION_KEY is not set, so the vault cannot be opened or " +
        "written to. Generate one with:  " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"  " +
        "and put it in the server environment. Keep a copy somewhere safe: " +
        "lose it and every note becomes unreadable.",
    );
  }

  const bytes = Buffer.from(raw, "base64");

  if (bytes.length !== 32) {
    throw new Error(
      `NOTES_ENCRYPTION_KEY must be 32 bytes of base64 (got ${bytes.length}). ` +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }

  cachedKey = bytes;
  return cachedKey;
}

/** True when the vault can actually be used. Lets a screen say so kindly. */
export function vaultIsConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/**
 * Seals a string.
 *
 * @param plaintext what to hide
 * @param aad       Additional Authenticated Data: not encrypted, but bound to
 *                  the ciphertext. The owner's id goes here, so a row copied
 *                  from one account to another by someone with write access to
 *                  the table fails to open rather than quietly revealing one
 *                  person's notes to another.
 */
export function seal(plaintext: string, aad: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);

  cipher.setAAD(Buffer.from(aad, "utf8"));

  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(".");
}

/** Opens a sealed string. Throws if it was altered, or sealed for someone else. */
export function open(sealed: string, aad: string): string {
  const parts = sealed.split(".");

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("This entry is not in a format this build can read.");
  }

  const [, ivB64, tagB64, bodyB64] = parts;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivB64, "base64"),
  );

  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  // `final()` is what verifies the tag, so it is what throws on tampering,
  // on the wrong owner, and on the wrong key. All three are the same answer:
  // this did not come from us, do not use it.
  return Buffer.concat([
    decipher.update(Buffer.from(bodyB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
