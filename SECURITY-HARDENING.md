# Security hardening — audit and what changed

Last updated: 2026-09-13.

| Check | Command | Result |
|---|---|---|
| Live security posture | `npm run security:check` | 19 checks, passing |
| Bring a database up to date | `npm run security:harden` | idempotent |
| Vault encryption | `npm run vault:check` | 13 assertions, passing |
| Route coverage | `npm run rbac:coverage` | **0 uncovered** |
| Dependencies | `npm audit --omit=dev` | **0 vulnerabilities** |

---

## 1. First, the honest answer about "encrypt everything"

The request was to encrypt **all** data going into Supabase. Taken literally
that would make the site worse and safer only on paper, so here is the
reasoning rather than a silent decision.

**Most of this database is published on the internet.** Collection names,
brand logos, exhibition titles, blog posts, the words on the home page — the
website's entire job is to show them to strangers. Encrypting them would mean:

- a decrypt on every page load, for every row
- no sorting, no indexing, no `ILIKE` search
- and protection of **nothing**, because the plaintext is already public

So the line is drawn at data that is **not public and identifies a person or a
deal**. That is the data a leaked database dump actually harms somebody with.

| Encrypted at rest | Left readable, and why |
|---|---|
| Enquiry name, email, phone, company, message | Collection/brand/exhibition/blog/page content — **published on the website** |
| Exhibition lead name, company, phone, email, interest, notes | Lead rating, stage, dates — the report groups by them and they name nobody |
| Vault notes (title, body, fields, even the *kind*) | Money and gold weights — **`Decimal` columns the report sums**; ciphertext cannot be added up |
| Passwords (bcrypt), sign-in codes (bcrypt), refresh tokens (SHA-256) | Ids, timestamps, foreign keys, status columns |

Money and weight deserve a note. They **are** commercially sensitive, and they
are deliberately not encrypted: they are `Decimal` columns precisely so the
totals are exact, and turning them into ciphertext would throw that away. They
are protected by access control instead — their own permission
(`exhibitionOps`), which is separate from the one that edits website copy.

---

## 2. What the audit found

Measured against the live database and environment, not read off the source.

### Already sound — no change needed

- `helmet` with a real CSP, HSTS, `trust proxy`, CORS allowlist
- Rate limits on auth, contact, and the API generally
- Cookies `httpOnly` + `secure` in production + `sameSite`
- Passwords bcrypt; sign-in codes bcrypt; refresh tokens SHA-256
- **0 dependency vulnerabilities**
- **`anon` and `authenticated` hold no privileges on any table** — the Supabase
  publishable key reaches nothing through PostgREST

### Fixed

| # | Finding | What was done |
|---|---|---|
| 1 | **Enquiry contact details in plaintext.** Names, emails, phone numbers and messages sat readable in `inquiries`. | Encrypted per column, AES-256-GCM. |
| 2 | **Exhibition leads would be the same.** Buyer names and phone numbers. | Encrypted per column. |
| 3 | **RLS off on all 42 tables.** *Not exploitable today* — the browser-facing roles have no grants. But one dashboard click (enabling Realtime, "expose this table") adds them, and with RLS off the table would then be world-readable to anyone holding the publishable key, which is public by design. | Enabled on all 42. The app connects as `postgres`, which has `BYPASSRLS`, so nothing changed for it. |
| 4 | **A refresh-token hash still in bcrypt format.** A leftover from before the SHA-256 fix. Not a hole — but a SHA-256 comparison can never match it, so that session could never refresh and would sign out at a moment nobody could explain. | Cleared; those accounts sign in again once. |
| 5 | **Sign-in codes could print to a production log.** The dev fallback that logs the OTP was guarded on "no mail provider configured", not on the environment. A production deploy that lost its mail key would have started printing live codes into a log several people and every log shipper can read. | Now also guarded on `NODE_ENV`; in production it fails loudly instead. |
| 6 | **Encryption keys were only checked lazily.** A missing key stayed silent until somebody opened the vault or submitted an enquiry — by which time the deploy looked successful. | Checked at boot in production: present, 32 bytes, and **different from each other**. |

### Still outstanding — needs you, not code

- **`.env.bak-prod-api` is in git history.** It is deleted from the working
  tree, but `git log --all` still lists it. **Every credential that file ever
  held should be treated as exposed and rotated**: the database password, both
  JWT secrets, the Supabase secret key, and the mail password. Deleting the
  file does not remove it from history — that needs a history rewrite, or
  simply rotating everything, which is the safer habit anyway.

---

## 3. How the field encryption works

`server/src/utils/fieldCrypto.ts`. AES-256-GCM, random 96-bit IV per value,
key from `DATA_ENCRYPTION_KEY`.

**A separate key from the vault.** `NOTES_ENCRYPTION_KEY` protects the owner's
own passwords; `DATA_ENCRYPTION_KEY` protects customers' contact details. One
key for both would mean one leak is both, so `security:check` fails if they
are ever set to the same value.

**The row is bound to its ciphertext.** The table name and row id are the AAD,
so a value copied from one row to another by somebody with write access fails
to open rather than quietly presenting one person's phone number under
another's name. `security:check` asserts this every run.

**Mixed tables are expected.** `decryptField` returns anything that is not its
own output unchanged, so a table holding both old plaintext rows and new
encrypted ones reads correctly throughout a migration. Values it *does* own
but cannot open throw, because silently returning ciphertext as if it were a
name would be worse.

### What it costs

Searching enquiries moved out of SQL into Node — `WHERE name ILIKE '%…%'`
cannot run against ciphertext. The repository loads, decrypts, then filters
and pages in memory.

That is fine here and it will not be fine forever. **Past roughly 50,000
enquiries this should be revisited**; the answer then is a blind index (an HMAC
of the lowercased email and phone) which restores exact-match lookup without
storing the value. Partial search would have to go.

---

## 4. Keys you must set in production

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| Variable | Protects |
|---|---|
| `NOTES_ENCRYPTION_KEY` | The vault |
| `DATA_ENCRYPTION_KEY` | Enquiries and exhibition leads |

One of each, **per environment**, and **different from each other**. The server
refuses to boot in production without both.

> **Keep copies somewhere safe and offline.** There is no recovery. Lose a key
> and everything encrypted with it is unreadable for good, backups included.

---

## 5. Going to production

In order:

1. Rotate everything that was in `.env.bak-prod-api` (see §2).
2. Set every variable in `.env.example` on the host — including the two
   encryption keys and `&connection_limit=1&pool_timeout=20` on the pooled
   `DATABASE_URL`.
3. Deploy, then run **`npm run security:harden`** once against production. It
   encrypts anything written before this existed and enables RLS. Safe to run
   repeatedly.
4. Run **`npm run security:check`**. It must print `ALL PASSED`.
5. Keep step 4 in the deploy pipeline — it exits non-zero, so it can gate a
   release.

---

## 6. What `security:check` verifies

Against the live database and environment:

**Keys** — both present, 32 bytes, different; encryption round-trips; a value
moved to another row is refused.

**Personal data** — every enquiry, every lead and every vault entry is
encrypted, naming the count if any are not.

**Credentials** — all passwords bcrypt, no legacy bcrypt refresh hashes, no
plaintext sign-in codes.

**Database** — RLS on every table, and whether the PostgREST roles have gained
any grants (a warning, because that is the day RLS starts mattering).

**Environment** — the pooled connection limit, both JWT secrets long enough and
different from one another.

---

## 7. Not done

- **A blind index for enquiry search.** Not needed at this volume — §3 says
  when it will be.
- **Encrypting money and gold weights.** Deliberate — §1.
- **Key rotation.** Changing a key orphans everything sealed with it. The
  `enc1.` / `v1.` prefixes exist so a rotation can be added later without
  guessing which scheme a value used.
- **An audit trail.** Nothing records who read which enquiry or lead.
- **MFA beyond the emailed code**, and the emailed code is off by default (see
  the OTP notes in `brain.md`).
