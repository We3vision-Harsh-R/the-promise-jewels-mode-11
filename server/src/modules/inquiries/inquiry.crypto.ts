import { decryptFieldSafe, encryptField, rowAad } from "../../utils/fieldCrypto.js";

/**
 * The enquiry form's personal data, encrypted at rest.
 *
 * A contact enquiry is somebody's name, email, phone and a message they typed
 * into a public form. It is not published anywhere, it identifies a real
 * person, and a database dump carrying a few thousand of them is exactly the
 * kind of file that should be worthless to whoever ends up with it.
 *
 * WHAT THIS COSTS, STATED PLAINLY
 *
 * Searching moves out of SQL and into Node. `WHERE name ILIKE '%shah%'` cannot
 * run against ciphertext, so the repository loads the rows this account may
 * see, decrypts them, and filters in memory.
 *
 * That is fine at this scale and it will not be fine forever. A contact form
 * on a jewellery site collects hundreds to a few thousand enquiries over
 * years, and filtering a few thousand decrypted rows takes single-digit
 * milliseconds. **Past roughly 50,000 rows this should be revisited** — the
 * answer then is a blind index (an HMAC of the lowercased email and phone,
 * stored alongside) which restores exact-match lookup in SQL without ever
 * storing the value. Partial search would still have to go.
 *
 * The alternative — leaving names and phone numbers in plain columns so that
 * ILIKE keeps working — trades every customer's privacy for a query
 * convenience, and it is the wrong way round.
 */

/** The columns that carry personal data. Everything else stays queryable. */
const SECRET_FIELDS = ["name", "email", "phone", "company", "message"] as const;

type SecretField = (typeof SECRET_FIELDS)[number];
type Row = Record<string, unknown> & { id: string };

const TABLE = "inquiries";

/**
 * Encrypts the personal fields of a new enquiry.
 *
 * The id is part of the AAD, so it has to exist before the values can be
 * sealed — which is why the row's id is generated here rather than by the
 * database. A row copied to a different id then fails to open instead of
 * quietly presenting one person's details under another's record.
 */
export function encryptForCreate<T extends Record<string, unknown>>(
  id: string,
  data: T,
): T {
  const aad = rowAad(TABLE, id);
  const out: Record<string, unknown> = { ...data };

  for (const field of SECRET_FIELDS) {
    if (field in out) {
      out[field] = encryptField(out[field] as string | null | undefined, aad);
    }
  }

  return out as T;
}

/**
 * Decrypts one row for use.
 *
 * Uses the forgiving variant: one damaged row renders as `[unreadable]` rather
 * than taking the whole inbox down with it. Plaintext rows written before this
 * existed pass through untouched — see fieldCrypto.decryptField.
 */
export function decryptRow<T extends Row>(row: T): T {
  const aad = rowAad(TABLE, row.id);
  const out: Record<string, unknown> = { ...row };

  for (const field of SECRET_FIELDS) {
    if (field in out) {
      out[field] = decryptFieldSafe(out[field] as string | null | undefined, aad);
    }
  }

  return out as T;
}

/** Does a decrypted row match what was typed in the search box? */
export function rowMatches(row: Row, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  return (["name", "email", "phone", "company"] as SecretField[]).some((field) => {
    const value = row[field];
    return typeof value === "string" && value.toLowerCase().includes(needle);
  });
}

export { SECRET_FIELDS };
