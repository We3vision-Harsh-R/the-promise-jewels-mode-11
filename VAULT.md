# The Vault — private notes and passwords

**Status: built and verified end to end.** Admin > System > Vault.

Last updated: 2026-09-10.

| Check | Command | Result |
|---|---|---|
| Encryption | `npm run vault:check` | 13 assertions, passing |
| Route coverage | `npm run rbac:coverage` | 69 guarded, 28 public, **0 uncovered** |
| Live enforcement | `npm run rbac:e2e` | 21 assertions, passing |
| Server types | `npx tsc -p server/tsconfig.json --noEmit` | clean |

---

## 1. What it is

Somewhere for the owner to keep the passwords and notes they currently keep in
their head: net banking logins, card PINs, GST portal credentials, the things
that get re-typed and re-asked. One screen, one entry per thing, searchable.

Four kinds — **Note**, **Login**, **Card**, **Bank account** — which differ
only in the fields they start with, because nobody should have to invent
"Customer ID" from a blank form.

Each entry has a title, an optional website, a body, tags, and any number of
named fields. A field marked **secret** is masked in the list with a reveal
and a copy button beside it; one that is not is shown in full. That split is
the point: an account number you read out loud belongs on screen, a CVV does
not.

---

## 2. What the database holds

**One sealed blob per entry, and nothing else readable.**

```
id       ff82de3a-5573-4312-95a9-f1c0f9cd7371
ownerId  f9df91b0-ee1c-4dc4-90cd-1cb22dae4ebe
pinned   true
payload  v1.rsgc2q0/JR7Oe8Hd.ZAFF3rGe3XVKv9RHm5Lueg==.fZpoAJC28ZY76s10Ye…
```

That is a real row from the live table, with a bank login in it.

The title, the body, the URL, the tags, the field names, the field values —
and **which kind of entry it is** — are all inside the blob. The only things
in the clear are what the database itself needs to do its job: who owns the
row, when it changed, and whether it is pinned.

That is stricter than hiding the password alone, deliberately. A column of
readable titles is a map of what the vault holds: *"HDFC net banking", "GST
portal", "Tally licence"* tells an attacker where to spend their time even if
every password stays sealed. A column saying `kind = login` counts the
passwords for them.

Searching and filtering therefore happen **in the browser**, over entries
already decrypted to be displayed. A vault holds tens of rows, not millions,
and the alternative — a searchable copy of the titles on the server — is the
one thing the sealed payload exists to prevent.

---

## 3. The encryption

`server/src/utils/secureBox.ts`. **AES-256-GCM**, one random 96-bit IV per
seal, key from `NOTES_ENCRYPTION_KEY`.

**GCM, not CBC**, because GCM authenticates as well as encrypts: a ciphertext
altered by somebody with write access to the table fails to open rather than
decrypting to something. CBC would hand back garbage — or, given effort,
attacker-chosen plaintext.

**The owner's id is the Additional Authenticated Data.** It is not encrypted,
but it is bound to the ciphertext, so a row copied from one account to another
by somebody with write access to the table **fails to open** instead of
quietly revealing one person's notes to another. `npm run vault:check` asserts
exactly this.

**Every seal is different.** Two accounts using the same password produce
different rows, so the table cannot be read for repeats.

### What this protects against, and what it does not

**Protects against a database dump** — a leaked Supabase credential, a stolen
backup, a screenshot of the table editor. Against that it is complete: the
rows are base64 and nothing in the database turns them back into words.

**It is not end-to-end.** The key lives in the server's environment, so the
server can decrypt, and anyone holding *both* the database *and* the
environment can decrypt.

That is a deliberate trade, not an oversight. The alternative is deriving the
key from a passphrase the server never sees — stronger, and a forgotten
passphrase then destroys every note with no way back. For an owner keeping
their own passwords in their own panel, silent total loss is the worse
failure.

---

## 4. Who can read whose

**Nobody can read anybody else's. Including Master.**

Not "there is no screen for it" — there is no code path. The owner id is taken
from the signed-in session in `ownerOf(req)` and written into the `where` of
every query. **No route parameter, query string or body field anywhere in the
module names an account**, so a crafted request cannot widen it.

Updates and deletes use `updateMany` / `deleteMany` with the owner in the
where clause rather than `update` by id. A write that matches nothing changes
nothing and reports 0 — which also means "does this entry exist" and "is it
yours" are the same answer, so the API cannot be used to discover another
account's entry ids.

This is the **one place in the panel where Master is not a skeleton key**.
Everywhere else Master means "may do anything" because everything else is
*company* data — collections, brands, the website's words. A vault is one
person's passwords. A permission that could open somebody else's is not a
vault, it is a filing cabinet with a sign on it.

The `notes` permission therefore decides whether an account **has** a vault,
never **whose** it sees. Granting somebody `notes:view` gives them their own
empty one.

---

## 5. The key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set it as `NOTES_ENCRYPTION_KEY` in the server environment. One per
environment — production must not reuse the development key.

> **Keep a copy somewhere safe and offline.** There is no recovery. Lose the
> key and every note sealed with it is unreadable forever, backups included.
> Changing it has the same effect as losing it.

Without the key the site runs normally; only the vault refuses, and the screen
says why rather than failing silently. The key is read lazily for that reason
— a deployment that forgets it still serves the website.

**On Hostinger:** add `NOTES_ENCRYPTION_KEY` alongside the other environment
variables. Until it is set, System > Vault shows the "not set up yet" notice.

---

## 6. File map

| File | What it is |
|---|---|
| `server/src/utils/secureBox.ts` | `seal` / `open`. The whole of the cryptography. |
| `server/src/modules/secure-notes/secure-notes.types.ts` | What an entry holds, and the kinds. |
| `server/src/modules/secure-notes/secure-notes.service.ts` | Owner-scoped reads and writes. |
| `server/src/modules/secure-notes/secure-notes.controller.ts` | `ownerOf(req)` — the session, and nothing else. |
| `server/src/modules/secure-notes/secure-notes.routes.ts` | `/api/v1/vault`, every route guarded. |
| `server/src/modules/secure-notes/secure-notes.selftest.ts` | `npm run vault:check`. |
| `src/features/vault/vault.api.js` | The client calls. No account id in any of them. |
| `src/features/vault/pages/VaultPage.jsx` | The screen. |

Table: `secure_notes`, declared in `server/prisma/schema.prisma`.

---

## 7. Verified

Against a running server and in the browser:

- An entry created through the UI comes back correctly; **the row in Postgres
  contains no readable word from it** — checked with a raw SQL read against
  the real table for `HDFC`, `4111`, `CVV`, `password`, `title`, `kind` and
  others: none present.
- Per-field reveal works: revealing a card number leaves the CVV masked.
- Choosing a kind seeds that kind's fields without discarding typed values.
- Tampering: a flipped byte, a swapped auth tag, a truncated value and an
  unknown format are all refused.
- A row re-pointed at another owner **fails to open**.
- Anonymous → 401. A role without `notes` → 403. Master → its own vault only.

---

## 8. Not built

- **A master passphrase / auto-lock.** The vault is as open as the admin
  session is. A second passphrase, and locking it after some minutes idle,
  would be the next real improvement.
- **An audit trail.** Nothing records who opened what and when.
- **Sharing an entry with another account.** Deliberately absent — see §4.
- **Attachments.** Text only.
- **Key rotation.** Changing `NOTES_ENCRYPTION_KEY` orphans every existing
  entry. A rotation would need to read every row with the old key and rewrite
  it with the new one; the `v1.` prefix on each payload is there so that can
  be added without guessing.
