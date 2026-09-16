# SECURITY.md — Promise Jewels

**What security exists in this project, where it lives, what it protects against, and what
you will actually notice because of it.**

Last updated: 2026-09-07 · Applies to the codebase as it stands today.
**No secret values appear in this file.**

> **Fourth pass, 2026-09-07 — read §10c first.** Four controls this document described as
> done were missing from the source when it was re-checked against the code. They have been
> re-implemented. If you are treating this file as a description of the running system,
> §10c is the part that says where it was wrong.

---

## How to read this document

Every control below is written in four parts:

| Part | Meaning |
|---|---|
| **What it is** | the mechanism, in plain terms |
| **Where** | the exact file, so you can read the code |
| **Protects against** | the attack it stops |
| **Effect you will notice** | what changes for a real admin or visitor — including the annoying parts |

The last column is the one people skip and then get surprised by. Read it.

---

## 0. The one-minute summary

| | |
|---|---|
| **Controls added** | 27 |
| **Critical issues fixed** | 3 |
| **High issues fixed** | 9 |
| **Files created** | 8 (`csrf`, `authorize`, `fileSecurity` middleware; `rateLimit`, `tokenHash`, `securityLog`, `sanitizeSvg` utils) |
| **Still needs you** | Rotate 4 secrets · amend 1 commit · run `db:push` on deploy · set `NODE_ENV` |
| **Biggest behaviour change** | **Everyone must sign in again once.** Sign-in requires an emailed code, so mail must be working. |

---

## 1. The three most serious things that were fixed

These were not theoretical. Each one was verified before and after.

### 1.1 Any website could read and control the admin panel

**What was wrong.** CORS was configured as `origin: true` with `credentials: true`. That tells
the `cors` package to *reflect whatever origin asks* and to allow cookies with it. Combined
with `SameSite=None` cookies, this meant: while an admin was signed in, **any page they
visited** — an ad frame, a phishing link, a compromised script — could call the API with their
session and **read the response**.

Everything the admin could do, that page could do: read every enquiry, rewrite the site's
content and contact details, delete brands, collections and blog posts.

**Now.** `server/src/config/cors.ts` holds an explicit allow-list built from `SITE_URL`,
`FRONTEND_URL` and optional `CORS_EXTRA_ORIGINS`. Anything else gets no CORS headers, so the
browser refuses to hand the response to the calling page. Loopback addresses are stripped in
production, and the opaque `null` origin (what a sandboxed iframe sends) is refused outright.

**Proof.** `Origin: https://evil.example` → no `Access-Control-Allow-Origin` header.
`Origin: null` → refused. `Origin: http://localhost:5173` → refused in production.

---

### 1.2 Forged requests — no CSRF protection at all

**What was wrong.** Cookies authenticate this API, and a browser attaches a cookie to a
request *whatever page caused it*. CORS does not help: it blocks the attacker from **reading**
the reply, but the request is still **sent** and the write still **happens**. Nothing checked
where a state-changing request came from.

**Now.** `server/src/middleware/csrf.middleware.ts` checks the `Origin` (falling back to
`Referer`) on every non-GET request under `/api`. Page JavaScript cannot forge either header.
Cookies also moved to `SameSite=Lax`, so the browser will not attach them cross-site in the
first place — **two independent defences**, because the SameSite one is unavailable if the
site and API are ever split across domains.

**Two endpoints are deliberately exempt** — the public contact form and the blog comment box.
Both are meant to be posted to by any visitor and neither does anything privileged: they write
a row that an admin must then read or approve.

**Proof.** Cross-site `POST /api/v1/blog` → `403`. Same-origin `POST` → `401` (auth, not CSRF).
Contact form cross-origin → `400` (validation, i.e. it got through as intended).

---

### 1.3 Live production secrets committed to git

**What was wrong.** `.env.bak-prod-api` was tracked by git and contains working values for the
database connection, the Supabase secret key, both JWT signing secrets and the mail key.
Separately, `server/prisma/seed.ts` contained the **production admin password as a plaintext
string**, present since the first commit.

Together: anyone with a copy of the repository had full database access, full storage access,
the ability to forge a valid admin session for any account without a password, **and** a
working first factor for the login form.

**Now.** `.gitignore` covers every `.env*` variant except `.env.example`; the backup file is
untracked but kept on disk. `seed.ts` reads `SEED_ADMIN_PASSWORD` from the environment and
**refuses to run without it** — no default, because a default is how the literal got there.

**⚠️ This one is not finished. See §9 — the values must be rotated, and the commit still
contains the file.**

---

## 2. Authentication

### 2.1 Two-step sign-in

**What it is.** Password, then a six-digit code emailed to the account.
**Where.** `server/src/modules/auth/`

**Effect you will notice.** Signing in takes two steps and needs a working inbox. **If mail
delivery is broken, nobody can sign in** — there is no bypass. Check mail before you deploy.

### 2.2 One-time codes are now unguessable

**What was wrong.** Codes came from `Math.random()` — a fast, *non-cryptographic* generator
whose internal state can be recovered from a handful of observed outputs. This value is the
only second factor on login and the *only* thing guarding a password reset.

**Now.** `crypto.randomInt` (OS entropy, no modulo bias) — `server/src/utils/otp.ts`.

**Protects against.** Predicting an admin's login or reset code.
**Effect you will notice.** None. Codes look the same.

### 2.3 Codes can no longer be brute-forced

**What it is.** Wrong attempts are counted on the user row. After **5** wrong codes the code is
**destroyed**, and the response says so rather than repeating "invalid".
**Where.** `auth.service.ts` (`verifyUserOtp`), `MAX_OTP_ATTEMPTS` in `utils/otp.ts`.

**One subtlety that mattered.** `/auth/reset-password` originally re-implemented the OTP check
inline and **skipped this counter entirely** — so the lockout guarded login while the
*password-reset* route, the one that rewrites a password without needing the old one, could be
guessed at indefinitely. Both routes now share one helper.

**Effect you will notice.** Mistype the code five times and you must request a new one.

### 2.4 Sign-in tells an attacker nothing

**What it is.** Unknown email, wrong password and disabled account all return the **same 401
with the same message**. The password comparison runs even when the email does not exist, so
both paths take the same time.
**Where.** `auth.service.ts` (`login`, `DUMMY_HASH`).

**Protects against.** Account enumeration — using the login form to discover which addresses
are real admins, then attacking those.
**Effect you will notice.** A disabled account no longer gets a distinct "your account is
disabled" message; it looks like a wrong password. That is intentional.

### 2.5 Sessions can actually be revoked now

**What was wrong — and this one was subtle.** Refresh tokens were stored as a **bcrypt hash**.
bcrypt silently ignores everything after the first **72 bytes**, and the first 72 bytes of a
JWT are the fixed header plus the start of the payload — **identical for every token ever
issued to the same user**.

So the stored value did not identify a *token*, only roughly a *user*. I proved it against
this project's own libraries: hashing one refresh token and comparing a **different** one for
the same user returns `true`.

The consequence: rotation evicted nothing, and a stolen refresh token stayed usable for its
full **7 days** no matter how many times the real user signed in again.

**Now.** SHA-256 over the whole token, compared in constant time —
`server/src/utils/tokenHash.ts`. A token that verifies but is **not** the one on record is
treated as reuse and **drops the entire session**.

**Effect you will notice.** If you somehow present an old refresh token, you are signed out
rather than refused — that is the reuse detection doing its job.

### 2.6 Tokens are pinned

**What it is.** HS256 fixed on both signing and verification, plus a checked issuer and
audience — `server/src/utils/jwt.ts`.
**Protects against.** Algorithm-confusion attacks; a token minted elsewhere being accepted here.

### 2.7 Where tokens live

| | |
|---|---|
| Storage | **HttpOnly cookies only** — never `localStorage`, `sessionStorage` or a URL |
| Flags | `HttpOnly` · `Secure` (production) · `SameSite=Lax` · `path=/` |
| Access token | 15 minutes |
| Refresh token | 7 days, rotated on every use |

**Protects against.** Token theft by any script running on the page (JavaScript cannot read an
HttpOnly cookie).

### 2.8 Password rules

Hashed with bcrypt (cost ≥10, enforced in production). New passwords: 8–72 characters — 72
because that is where bcrypt stops reading, so a longer one is not stronger, just misleading.
**The login form deliberately accepts up to 200** so that an older, longer passphrase is never
rejected at validation before it even gets compared.

### 2.9 A password reset ends every session

Resetting clears the password, the OTP **and every refresh token**. A reset is what someone
does when they think an account is compromised; leaving the attacker signed in through it
would defeat the point.

---

## 3. Authorization

> **2026-09-10 — RBAC is now the live authorization control.** A permission
> system with its own catalogue, tables, middleware and tests governs every API
> route: **52 guarded, 27 deliberately public with a written reason, 0
> uncovered.** See **RBAC.md**.
>
> Three commands keep it honest, and all three pass:
> `npm run rbac:check` (16 assertions on the logic), `npm run rbac:coverage`
> (proves no route is unguarded — exits non-zero otherwise, so it can gate a
> deploy), and `npm run rbac:e2e` (13 assertions proving a limited role really
> gets 403 from a running server, and the same account as Master really gets
> 200).
>
> The old `UserRole` enum and `requireAdmin` still sit on some routes alongside
> the permission guard. They are belt-and-braces now rather than the control —
> the permission check is what decides. Every account currently holds the
> master role, so nothing is more permissive than it was.
>
> Two routes are deliberately reachable by any signed-in account:
> `GET /api/v1/rbac/me`, because "what may I do" has to be answerable by an
> account that may do nothing, and `PUT /api/v1/settings/password`, because
> requiring `settings:edit` to change your OWN password would stop a viewer
> ever rotating it.
>
> What RBAC does **not** yet cover: the sidebar and the routes still offer
> every screen. `RequirePermission` is written and tested but not applied, so a
> role without `collections:view` sees the link and a failed screen rather than
> no link. That is a presentation gap, not an exposure — the API refuses
> regardless.



**What it is.** A `role` column (`ADMIN` / `EDITOR` / `VIEWER`) plus `requireAdmin` on the
destructive routes — `server/src/middleware/authorize.middleware.ts`.

**How it behaves.** The role is read **from the database on every request**, never from the
token, so revoking someone takes effect immediately rather than when their token expires.
Unknown or missing role → denied.

**Currently applied to:** deleting a blog post, deleting a comment, deleting a brand, deleting
a brand image, changing site settings.

**Effect you will notice.** **None today** — every existing account is `ADMIN`. What changed is
that the mechanism now exists, so you can create an editor account that writes posts but
cannot delete records.

**Still open:** collection/exhibition deletes and SEO writes are `requireAuth` only. No impact
while everyone is an admin; worth closing before adding a non-admin account.

> **The frontend guard is not security.** `RequireAuth` in `src/app/routes/RequireAuth.jsx`
> only decides what to *render*. Every rule is enforced again on the server. Never rely on the
> client.

---

## 4. Rate limiting — the exact numbers

**Where.** `server/src/config/rateLimit.ts`, plus one in `blog.routes.ts`.

| Limiter | Applies to | Allowance | Why this number |
|---|---|---|---|
| `authLimiter` | login, verify-otp, reset-password | **10 per 15 min** per IP | A person mistypes twice, not twenty. Successful requests are not counted, so getting it right early costs you nothing. |
| `otpRequestLimiter` | forgot-password | **5 per 15 min** per IP | See the note below |
| `contactLimiter` | public contact form | **5 per 10 min** per IP | It is an unauthenticated database write |
| comment limiter | blog comments | **5 per 10 min** per IP | Same reasoning |
| `uploadLimiter` | media uploads | **30 per min** per IP | Each buffers up to 5 MB |
| `apiLimiter` | everything under `/api` | **300 per min** per IP | A page load makes ~6 calls, so no real session notices |

**The forgot-password trap.** `authLimiter` uses `skipSuccessfulRequests`, which counts only
responses that **failed** — and forgot-password deliberately always returns 200 (so it cannot
be used to test which addresses exist). The limiter therefore **never counted it at all**.
Unlimited: each call sent a real email through the paid provider *and* overwrote the target's
stored code, so it was both a mail-bomb at the admin's inbox and a way to keep a legitimate
password reset permanently out of reach. It now has its own limiter that counts every request.

**Effect you will notice.** If you are testing sign-in repeatedly you *will* hit the limit and
see *"Too many attempts. Please wait a minute and try again."* That is the control working.
Wait 15 minutes or test from a different address.

**One caveat.** Limits are per IP. Everyone behind one office NAT shares a bucket.
`trust proxy: 1` is set in production so the real client address is used behind the host's
proxy — exactly one hop is trusted, because trusting all of them would let a client set its
own address and walk straight past the limiter.

---

## 5. File uploads

**Where.** `server/src/middleware/upload.middleware.ts` + `fileSecurity.middleware.ts`

| Control | Value |
|---|---|
| Accepted types | JPG · PNG · WEBP · SVG |
| Max file size | **5 MB** |
| Max files per request | 12 |
| Max fields / parts | 40 / 60 |
| Where files are held | Memory only — **nothing is written to the server's disk** |
| Stored filename | Server-generated: `sections/<uuid>-<cleaned-name>` |

### 5.1 The declared type is not trusted

**What was wrong.** The only check was the `Content-Type` the *uploader* typed into the
request. That is a claim, not a fact — a hostile client simply lies.

**Now.** `fileSecurity.middleware.ts` reads the file's **own leading bytes** (JPEG/PNG/WEBP
signatures, structural detection for SVG) and **rejects any file whose real content disagrees
with its declared type**.

**Effect you will notice.** A file renamed from `.png` to `.jpg` will be rejected with *"That
file's contents do not match the type it was sent as."* Re-export it properly.

### 5.2 SVGs are scrubbed — and this had to be fixed twice

An SVG is a *document*, not a picture. It can carry `<script>`, inline event handlers, external
references and SMIL animation that rewrites attributes after load. The site draws them as a CSS
mask or an `<img>` where none of that runs — **but the file also gets a public storage URL of
its own, and opening that directly does execute what is inside.**

Three defects were found and fixed:

1. **Only the media route scrubbed.** Brands, collections and exhibitions called storage
   directly and never went near the scrubber. Fixed by moving scrubbing into middleware that
   every upload route runs, which **replaces `file.buffer`** so no module can store the
   original even by forgetting.
2. **The scrubber was namespace-blind.** `<script>` was caught; `<s:script>` sailed through.
   Now namespace-aware.
3. **It over-stripped.** Deleting every `<style>` block and `style=` attribute removed the
   fills from any icon exported by Illustrator or Figma — the upload "succeeded" and the icon
   rendered black or invisible. Style is now **filtered**, not deleted: declarations survive
   unless the value can fetch or execute something.

**Tested:** 14 payloads (plain and namespaced scripts, event handlers, entity-encoded
`javascript:` URLs, SMIL `<set>`/`<animate>`, external `<use>`/`<image>`, `url()` in CSS,
`@import`, CDATA, `foreignObject`) — **all stripped**. Illustrator and Figma icons — **styling
preserved**. Malformed input no longer crashes the request.

---

## 6. Content and injection

| Threat | Status | Where |
|---|---|---|
| **SQL injection** | **Not present.** Prisma's typed API everywhere. The one raw query is a `Prisma.sql` tagged template with bound `Date` parameters. | `dashboard.repository.ts` |
| **XSS — blog posts** | HTML is **sanitised on write**, so the stored column is already safe and every reader can trust it. Allow-list of tags, attributes and CSS properties; `<iframe>` only from 11 named embed hosts. | `blog.sanitize.ts` |
| **XSS — comments** | Stored as **plain text**; all markup stripped on the way in, escaped again by React on the way out. | `blog.service.ts` |
| **XSS — the CMS** | **The CMS stores no HTML.** Colours are hex-only (they reach a `style` attribute); image paths must be `/path` or `https://` (they reach `src`). | `page-content.service.ts` |
| **Mass assignment** | Zod validation **strips every key the schema does not declare** before anything reaches Prisma. Two SEO routes had this commented out — re-enabled. | `validation.middleware.ts` |
| **XML injection** | `sitemap.xml` values are escaped. | `sitemap.generator.ts` |
| **Spreadsheet formula injection** | Contact-form text is neutralised before the XLSX export — a `=HYPERLINK(...)` in a "name" field would otherwise execute **on the admin's own machine** when they open the file. | `inquiry.service.ts` |
| **Path traversal** | **Structurally impossible** — nothing is written to disk and storage keys are server-generated. | — |
| **SSRF** | **No surface** — the only outbound call is one hard-coded URL. | `mail.service.ts` |
| **Open redirect** | **None** — no `res.redirect` anywhere. | — |
| **Command injection** | **None** — no `child_process` anywhere. | — |

**One note on the formula fix.** The first version prefixed anything starting with `+` or `-`
with an apostrophe — which corrupted **every `+91…` phone number** in the export. It now only
neutralises what is genuinely a formula (`=`, `@`, or `+`/`-` followed by a non-number), and
uses a tab rather than a visible apostrophe.

---

## 7. Browser and transport security

**Where.** `server/src/app.ts`

| Header | Value | What it stops |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self'` (**no** `unsafe-inline`, **no** `unsafe-eval`); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `img-src` self + Supabase; `frame-src` the 11 embed hosts | Injected scripts, clickjacking, data exfiltration to other origins |
| `Strict-Transport-Security` | 2 years, includeSubDomains, preload | Downgrade to plain HTTP |
| `X-Frame-Options` | `DENY` | Clickjacking, for browsers that only read this header |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing a file into something executable |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | An admin URL leaking to another site |
| `Permissions-Policy` | camera, microphone, geolocation, payment, USB, sensors all `()` | A compromised dependency quietly asking for hardware |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cross-window attacks |
| `X-Powered-By` | **removed** | Free reconnaissance |

**`frame-src` and the blog sanitiser share one list.** `app.ts` imports `EMBED_HOSTS` from
`blog.sanitize.ts`, so the hosts the sanitiser accepts and the hosts the browser will render
**cannot drift apart**.

**Body size limits:** JSON 1 MB, form-encoded 100 KB. The default was 100 KB, which was both a
security default worth stating and — as it happened — **too small for a long blog post**, which
would have failed with a bare 413 on save.

---

## 8. Errors, logging and configuration

### 8.1 Errors say less

**Where.** `server/src/middleware/error.middleware.ts`

The rule: **the client gets a sentence it can act on, the server log gets everything.**
Prisma errors are translated by code (`P2002` → "That already exists.") rather than relayed —
their messages quote the failing query, the table, the column and sometimes the value.
Unrecognised errors return a generic 500 with a short **reference** that also appears in the
log, so "I saw an error" can be traced without ever showing anyone the detail.

The 404 handler no longer echoes the requested path back.

### 8.2 Security events are recorded

**Where.** `server/src/utils/securityLog.ts`

Failed sign-ins, disabled-account attempts, OTP failures and lockouts, rejected refresh tokens,
blocked cross-site requests, authorization denials and rejected uploads are logged as one
greppable JSON line each.

**Email addresses are masked** (`bh***@example.com`) — enough to correlate an attack, not
enough to harvest. **Nothing sensitive is ever logged**: no passwords, no OTPs, no tokens, no
cookies.

**Related fix:** one-time codes used to be printed to stdout whenever the mail key was missing —
a condition that can absolutely happen in production. Production now **refuses to proceed**
rather than degrading to something insecure.

### 8.3 Configuration is checked at boot

**Where.** `server/src/config/env.ts` — `assertProductionConfig()`

In production the app **refuses to start** if a JWT secret is under 32 characters, if the two
JWT secrets are identical, or if bcrypt rounds are below 10. A server that starts with a
guessable secret is worse than one that does not start, because nobody finds out until
afterwards.

The check runs at *import* time, before `app.ts` assembles the middleware chain and before
the port is bound, so a misconfigured server never reaches the point of accepting a request.
It is production-only: local development runs on short throwaway secrets on purpose, and
failing the boot there would only teach people to weaken the check.

**This was missing when re-checked on 2026-09-07** — see §10c.3 — and has been re-implemented
and verified in both directions: weak values refuse the boot and name the offending variable
(never its value), real values pass.

**What it cannot catch.** It only runs *when* `NODE_ENV === "production"`. A deploy that
forgets to set `NODE_ENV` at all skips this check along with the CSP, the `Secure` cookie
flag and proxy trust — see §9.4, which is still required of you.

### 8.4 Mock mode can no longer ship by accident

`src/services/api/client.js` defaulted `VITE_USE_MOCK` to **true**. A build that simply forgot
to set it shipped **an admin login that accepts any credentials**. Every mock flag now defaults
to **false**.

Vite inlines these values at build time, which is what makes the default the whole question:
the mistake is not visible at runtime, only in a bundle that is already live.

**This had reverted to `'true'` when re-checked on 2026-09-07** — see §10c.2.

---

## 9. ⚠️ What still needs you

These cannot be fixed from the code. **Do these before the next deploy.**

### 9.1 Rotate four secrets — required

They exist in a file that was committed and in a folder that has been copied between
directories. Moving a secret out of git does **not** make the old value safe.

1. **Database password** — Supabase → Settings → Database
2. **Supabase secret key** — Supabase → Settings → API
3. **Both JWT secrets** — generate with `openssl rand -base64 48` (they must differ)
4. **Resend API key**

### 9.2 Remove the secret from git history — required

The file is untracked now, but **commit `05bc537` still contains it**. That commit is the tip
and has **not been pushed**, so:

```bash
git commit --amend --no-edit
```

**Do not push before doing this.**

### 9.3 Change the seeded admin password — required

The old value is in git history as a plaintext string. Change it, and set
`SEED_ADMIN_PASSWORD` in the environment before any future seeding.

### 9.4 Set `NODE_ENV=production` on the host — required

**Every** hardening branch is gated on that exact string. A deploy that omits it silently loses
the CSP, the `Secure` cookie flag, proxy trust and the boot-time secret checks — and nothing
warns you.

### 9.5 Run `pnpm db:push` on deploy — required

The `users.role` and `users.otpAttempts` columns were added. Neither `build` nor `start` runs
the schema push, so a fresh environment will start fine and then fail on every authenticated
request. A missing column now logs **"SCHEMA DRIFT"** instead of a random 500, so at least it
is diagnosable.

### 9.6 Verify mail before deploying — required

The token changes invalidate every existing session, and **sign-in requires an emailed code**.
If mail is broken at that moment, nobody can get back in.

### 9.7 Supabase dashboard work — recommended

I have no dashboard access, so these are yours:

- **Enable RLS** on the tables as defence in depth. Be clear-eyed about what it buys: this app
  reaches Postgres through **Prisma on a direct owner connection**, so **RLS does not constrain
  it**. It would contain a leaked *anon* key, not a leaked `DATABASE_URL`.
- **Check the storage bucket policies** are public-**read** only, not public-write.

---

## 10. Known remaining risks

Re-verified against the source on 2026-09-07.

| Risk | Severity | Note |
|---|---|---|
| RLS gives no containment for this app | Medium | Architectural — Prisma connects as owner. Mitigated by middleware, not by the database. |
| **No automated tests** | **High** | Re-rated from Medium. This is no longer hypothetical: the fourth pass (§10c) found four controls silently absent from the code that this document said were present. Nothing detected that, and nothing would have. Every other row here is a smaller problem than this one. |
| `NODE_ENV` defaults to `development` | Low | A deploy that omits it degrades open — see §9.4. The new boot check in §8.3 does **not** cover this, because it only runs when `NODE_ENV` is already `production`. |
| No pre-rendering for crawlers | Low | Social preview cards and non-JS crawlers see the empty SPA shell. Not a security issue; recorded because it is often mistaken for one. |

**Rows removed on re-verification** — each was checked against the source and found already
closed, not merely assumed:

| Old row | What the source shows |
|---|---|
| `requireAdmin` not on every destructive route | It is on all of them. See BRAIN.md §19 for the file-and-line list |
| `xlsx@0.18.5` abandoned upstream | The project installs **0.20.3** from the SheetJS CDN tarball, ahead of npm's final 0.18.5 |
| SEO settings form has 9 fields with no columns | The form renders exactly the six fields the model has |

---

## 10b. Third audit pass — what a fresh sweep found

The repository was rolled back twice on disk between audits, so this pass
treated nothing as already done and re-checked every control from the source
rather than from the previous report. Most held. Five things did not.

### 10b.1 Four destructive routes had authentication but no authorization

`requireAuth` proves *who* is calling. It says nothing about what they may
destroy. These four sat behind it and nothing else:

| Route | What it destroys |
|---|---|
| `DELETE /admin/collections/:id` | a collection, its images and its public page |
| `DELETE /admin/collections/:id/images/:imageId` | one of its images |
| `DELETE /admin/brands/:id` | a brand and everything hanging off it |
| `DELETE /admin/brands/:id/images/:imageId` | one of its images |

They were missed by the earlier pass for a mechanical reason worth recording:
those two modules declare their routes on `adminRouter`, not `router`, so a
sweep written around `router.delete(` matched nothing and reported "no change"
rather than "not found". A guard that is applied by pattern-matching needs the
pattern checked against every file it claims to cover.

**Fixed** — `requireAdmin` on all four.

### 10b.2 Site-wide settings were writable by any signed-in account

`PUT /api/v1/settings` writes the logo, the contact details and the social
links that every page on the site renders. Any authenticated account could
change them. **Fixed** — `requireAdmin`. Note that `PUT /settings/password` is
deliberately NOT admin-gated: it changes the caller's own password and is
already scoped to them.

### 10b.3 The upload rate limit existed but was never attached

`uploadLimiter` was declared and exported, and no route imported it. Uploads —
a 5 MB body, a magic-byte check, an SVG scrub and a round trip to storage —
were limited only by the general 300/min API cap.

**Fixed** by putting it at the FRONT of the composed upload arrays in
`upload.middleware.ts`, where multer and the content check already live. Two
reasons for that placement rather than per-route:

- a route cannot forget it, because there is no way to reach multer without it;
- **first**, not after multer — behind multer the limiter would only begin
  counting once the 5 MB body had already been read and scanned, which is
  precisely the cost it exists to cap.

### 10b.4 Six vulnerable dependencies → zero

| Package | Advisory | Action |
|---|---|---|
| `qs` (×2) | DoS via attacker-controlled `isBuffer`; array-limit bypass | pinned `>=6.16.0` |
| `xlsx` (×2) | prototype pollution; ReDoS | upgraded 0.18.5 → **0.20.3** |
| `deepmerge-ts` | stack exhaustion on recursive merge | pinned `>=8.0.0` |
| `effect` | AsyncLocalStorage context contamination | pinned `>=3.20.0` |

Two details worth keeping:

**The overrides went in the wrong file first.** pnpm 11 no longer reads
`pnpm.overrides` from `package.json` — it reads `pnpm-workspace.yaml`. The
first attempt installed cleanly, reported success and changed nothing. The
pins now live in `pnpm-workspace.yaml`.

**`xlsx` could not be fixed from npm.** The registry copy is capped at 0.18.5;
SheetJS publishes patched releases from their own CDN, so the dependency now
points at `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. This is the
vendor's documented upgrade path, not a third-party mirror. It does mean an
install needs to reach that host. The export was re-tested on 0.20.3 and still
produces a valid workbook.

For the record, the exposure here was low before the upgrade: both advisories
are in the *parsing* path, and this application only ever writes — there is no
`XLSX.read` anywhere in it. It was upgraded regardless, because "we don't call
the vulnerable function today" is a fact about today's code.

`pnpm audit --prod` now reports **no known vulnerabilities**.

### 10b.5 What was re-verified and found already correct

No secrets in the frontend bundle (checked for service-role keys, connection
strings, JWT secrets, API keys — all absent, and no `VITE_` variable is
emitted). `.env` untracked and ignored. JWT pinned by algorithm, issuer and
audience. Cookies `httpOnly`, `secure` in production, `SameSite` set. Mass
assignment closed — the validated body replaces the raw one, so undeclared
keys never reach Prisma. No server-side outbound fetch takes a user-supplied
URL, so there is no SSRF surface. CSP, HSTS, Referrer-Policy,
Permissions-Policy, X-Frame-Options and both Cross-Origin policies all present;
`X-Powered-By` absent.

### 10b.6 The attacker pass

Run against the live server after the fixes:

| Attempt | Result |
|---|---|
| 10 destructive endpoints unauthenticated | all `401` |
| Cross-site POST and DELETE | both `403` |
| Hostile `Origin` | no `Access-Control-Allow-Origin` returned |
| `Origin: null` | `403` |
| Prototype pollution | `400`, `Object.prototype` clean |
| Mass assignment (`role`, `isActive`) | `400` |
| SQL injection in a slug | `404` |
| 14 logins · 9 contact submissions | throttled at 10 and 5 |
| 12 MB body · 64 KB header | `413` · `431` |
| 50,000-deep JSON parser bomb | `401` in 238 ms, no hang |
| SVG ReDoS, 10–200 KB | **1–2 ms**; over 256 KB rejected |
| SVG scrubbing after all that | script, `on*`, `javascript:`, `@import` stripped; real fills kept |

The site stayed up throughout.

---

## 10c. Fourth pass, 2026-09-07 — four controls this document described but the code did not have

The third pass (§10b) noted that the repository had been rolled back twice on disk between
audits. That happened again. This pass re-read the source for every control rather than
trusting the report, and found **four** that this document describes as done and that were
not in the code. All four are now implemented. Nothing detected their absence in the
meantime, which is the case for §10's re-rating of "no automated tests" to High.

### 10c.1 Refresh tokens were being hashed with bcrypt again — session revocation did not work

`utils/tokenHash.ts` was present, complete, and carried a long comment explaining exactly
why bcrypt must not be used on a token. **It was imported by nothing.** `auth.service.ts`
stored the refresh token with `hashValue()` — which is `bcrypt.hash` — and checked it with
`comparePassword()`.

bcryptjs silently truncates its input at **72 bytes**. A refresh JWT here is ~269 characters,
and its first 72 bytes are the fixed `{"alg":"HS256","typ":"JWT"}` header plus the opening of
the userId. The issued-at, the expiry and the entire signature all fall past the cut, so every
refresh token ever issued to one user has a byte-identical first 72 bytes.

Reproduced against this project's own `bcryptjs` and `jsonwebtoken`:

| Check | Result |
|---|---|
| Two refresh tokens for the same user are different strings | `true` |
| Their first 72 bytes are identical | `true` |
| `bcrypt.compare(tokenB, bcrypt.hash(tokenA))` | **`true`** |
| `sha256(tokenB) === sha256(tokenA)` | `false` |

**What that meant.** The stored hash identified a *user*, not a *session*. Rotation on
`/refresh` evicted nothing; signing in again did not invalidate an older token; a stolen
refresh token stayed usable for its whole seven days no matter what the real user did. The
"sessions can actually be revoked now" claim in §2.5 was not true of the code as it stood.

**Fixed.** `auth.service.ts` now uses `hashToken` and `tokenMatches` from
`utils/tokenHash.ts` — SHA-256 over the whole token, compared with `timingSafeEqual`. OTPs
and passwords still use bcrypt: they are short and low-entropy, which is what bcrypt is for.

**Effect you will notice.** Every existing session is invalidated once, because every stored
hash is a bcrypt digest that SHA-256 will never match. Everyone signs in again — and sign-in
needs an emailed code, so **verify mail delivery before deploying** (§9.6).

### 10c.2 Mock mode had reverted to defaulting ON

`src/services/api/client.js` read `VITE_USE_MOCK ?? 'true'`, and every other mock flag
(`USE_MOCK_AUTH`, `USE_MOCK_BRANDS`, …) inherits that default. Mock auth accepts **any
credentials**. Vite inlines the value at build time, so a build that merely forgot to set
`VITE_USE_MOCK` would ship an admin login that lets anyone in, with nothing at runtime to
reveal it.

The project's own `.env` and `.env.example` both set `VITE_USE_MOCK=false`, so a build made
from this working copy was safe — but the safety rested on a file that is deliberately not in
git rather than on the default.

**Fixed.** Defaults to `'false'`. Mock mode is opt-in.

### 10c.3 The boot-time configuration checks did not exist

§8.3 of this document said the app refuses to start in production on a weak or duplicated JWT
secret or low bcrypt rounds, and named `config/env.ts` as the place. That file contained only
`required()`, which checks that a variable is non-empty and nothing else. A production deploy
with `JWT_ACCESS_SECRET=secret` would have started normally.

**Fixed.** `assertProductionConfig()` in `config/env.ts`, run at import time. Verified both
ways: weak values refuse the boot and name the variable (never the value); the real `.env`
values pass.

### 10c.4 `normaliseQuery` was written but never mounted

`validation.middleware.ts` exports `normaliseQuery`, whose own docstring ends "Mounted before
the routes, so no handler has to think about it." It appeared nowhere outside its own file.

A repeated query parameter — `?status=a&status=b` — makes Express hand the handler an array
where every caller expects a string. Those values flow into Prisma `where` clauses, Prisma
rejects the array, and an unauthenticated request becomes a 500 with a stack trace in the log:
a free way to fill the logs and a probe for what the query layer is.

**Fixed.** Mounted on `/api`, between `apiLimiter` and `csrfProtection`.

### 10c.5 What this pass re-verified and found correct

Checked against the source, not assumed: the security middleware chain in `app.ts` (helmet →
Permissions-Policy → cors → morgan → compression → body limits → static → cookieParser →
health → apiLimiter → **normaliseQuery** → csrfProtection); all five rate limiters defined
**and** attached, plus the blog comment limiter; `requireAdmin` on every destructive route;
magic-byte upload verification via `verifyUploads`; SVG scrubbing on write inside
`fileSecurity.middleware.ts`; JWT algorithm, issuer and audience pinning in `utils/jwt.ts`;
security event logging in the authorize, CSRF and file-security middleware.

### 10c.6 The lesson worth keeping

Three of these four were *present as intent* — a written helper, a documented check, a
committed middleware — and absent as *behaviour*. A file that exists and is imported by
nothing reads exactly like a file that works. Two greps would have caught all three:

```bash
grep -rn "tokenHash" server/src/ | grep -v "utils/tokenHash.ts"
grep -rn "normaliseQuery" server/src/ | grep -v "validation.middleware.ts"
```

An empty result for a security helper is a finding, not a clean bill of health.

---

## 11. Rules for whoever changes this code next

1. **Never widen CORS.** `origin: true` with credentials was a critical hole here. Add to the
   allow-list; never reflect arbitrary origins; never allow the `null` origin.
2. **Never remove the CSRF middleware** or add an exemption without a written reason.
3. **Never use bcrypt on a token.** It truncates at 72 bytes. Use `utils/tokenHash.ts`.
   Passwords keep bcrypt — that distinction is the whole point.
4. **Never generate a credential with `Math.random()`.** Use `node:crypto`.
5. **Sanitise on write, not on read**, so the stored value can be trusted by everything.
6. **Never trust `file.mimetype`.** Keep every upload route behind `fileSecurity.middleware`.
7. **Never log a credential.** Use `securityLog.ts`.
8. **Never pass `req.body` straight into Prisma.** Always `validate(zodSchema)` first — that
   is what strips undeclared keys.
9. **Never put a secret behind a `VITE_` prefix.** Vite inlines those into the browser bundle.
10. **A frontend check is not a control.** Enforce it on the server too, always.
11. **Do not switch off a hardening branch to make something work locally.** Set `NODE_ENV`
    correctly instead.

---

## 12. How this was verified

Nothing above is asserted from reading alone. What was tested, and how:

| Claim | Method | Result |
|---|---|---|
| CORS refuses hostile origins | `curl` with `Origin: https://evil.example`, `null`, `localhost:5173` | No allow-origin header in all three |
| CSRF blocks cross-site writes | `curl POST` with a foreign Origin | `403`; same-origin gives `401` (auth), exempt route gives `400` (validation) |
| bcrypt truncation was real | Script using this project's own `bcryptjs` + `jsonwebtoken` | A **different** token for the same user compared `true` — confirmed, then fixed and re-tested `false` |
| JWT pinning | Forged `alg: none` token and a wrong-audience token | Both rejected |
| Login is uniform | Unknown address vs known address with wrong password | Identical `401` and message |
| OTP lockout | 7 wrong codes in a row | Locked at attempt 5, code destroyed |
| OTP randomness | 2,000 generated codes | 1,997 distinct, all six digits |
| SVG scrubbing | 14 payloads + 2 real-world icon exports + 4 malformed files | All payloads stripped, both icons kept their styling, no crashes |
| Security headers | `curl -I` against the running server | All 8 present |
| Rate limiting | 13 rapid bad logins | 10 × `401`, then `429` in the app's own JSON shape |
| No secrets in the bundle | Scanned `dist/` for connection strings, JWTs, API keys | None found |
| Site still works | Loaded home, admin and blog in a browser | No CSP violations, no broken images |

**Also checked and found clean:** raw SQL (parameterised), `child_process` (none),
`res.redirect` (none), user-supplied URLs fetched server-side (none), Supabase client in the
frontend (none).

---

## 13. Reference — files that hold the security

| File | Responsibility |
|---|---|
| `server/src/app.ts` | Headers, CSP, body limits, middleware order |
| `server/src/config/cors.ts` | Origin allow-list |
| `server/src/config/cookies.ts` | Cookie flags, SameSite policy |
| `server/src/config/env.ts` | Boot-time secret validation |
| `server/src/config/rateLimit.ts` | All limiters |
| `server/src/middleware/auth.middleware.ts` | Session verification |
| `server/src/middleware/authorize.middleware.ts` | Role checks |
| `server/src/middleware/csrf.middleware.ts` | Cross-site request blocking |
| `server/src/middleware/fileSecurity.middleware.ts` | Magic-byte checks, SVG scrubbing |
| `server/src/middleware/upload.middleware.ts` | Upload limits, multer error mapping |
| `server/src/middleware/validation.middleware.ts` | Schema validation, key stripping |
| `server/src/middleware/error.middleware.ts` | Safe error responses |
| `server/src/utils/jwt.ts` | Algorithm/issuer/audience pinning |
| `server/src/utils/tokenHash.ts` | Refresh-token hashing |
| `server/src/utils/otp.ts` | Secure code generation, attempt ceiling |
| `server/src/utils/password.ts` | bcrypt hashing |
| `server/src/utils/sanitizeSvg.ts` | SVG scrubbing |
| `server/src/utils/securityLog.ts` | Security event logging |
| `server/src/modules/blog/blog.sanitize.ts` | Blog HTML allow-list, embed hosts |

For the wider architecture see `BRAIN.md`; for the full audit see `PROJECT_TECHNICAL_AUDIT.md`.
