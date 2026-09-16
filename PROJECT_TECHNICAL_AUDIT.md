# PROJECT_TECHNICAL_AUDIT.md — Promise Jewels Private Limited

**Audit date:** 2026-09-03
**Scope:** complete codebase — frontend, backend, database schema, Supabase integration, admin panel, CMS, security, deployment.
**Method:** direct inspection of source files, `package.json`, `pnpm-lock.yaml`, `server/prisma/schema.prisma`, route files, configuration and git metadata. Live behaviour confirmed against the running server on `localhost:2000`.

**Evidence rule:** every statement below is traceable to a file in this repository. Anything that could not be established from the codebase is marked **«NOT VERIFIED FROM CODEBASE»**. No secret values appear anywhere in this document.

---

## 1. Executive summary

Promise Jewels is a **single Node process** that serves three things on one origin and one port: the public marketing website, an admin panel at `/admin`, and a REST API at `/api/v1`. There is no separate frontend host and no separate API host in the current configuration.

**What is genuinely good**

- Clean, consistent module structure on the backend (routes → controller → service → repository), followed by all 13 modules without exception.
- Feature-first frontend organisation that mirrors it.
- Every public page falls back to content bundled with the site when its API call fails, so an outage degrades rather than blanks.
- Prisma is used exclusively through its type-safe query API; the single raw SQL statement is parameterised.
- A genuinely capable CMS: 6 page tabs plus Header and Footer screens, ~250 editable fields covering text, colour, imagery and animation timing.

**What is not**

- The project has **no automated tests of any kind**. `tests/unit`, `tests/integration` and `tests/e2e` contain only `.gitkeep`.
- There is **no CI, no deployment configuration, and no migration history**. `prisma db push` is a manual step that no build or start script runs, so a deploy can silently leave the database behind the code.
- The frontend ships as a **single 1.46 MB JavaScript bundle** with no code splitting.
- `public/` carries **18 MB of images**, several over 700 KB, committed to git.
- A file containing live production secrets is present in the working tree and **inside the most recent commit** (not pushed). See §18.

A substantial security hardening pass was completed on 2026-09-02/03 and is documented in §18. The findings listed there as *fixed* were verified by re-testing.

---

## 2. Project overview

| Property | Value | Verified from |
|---|---|---|
| Package name | `promise-jewels` | `package.json` |
| Version | `1.0.0` | `package.json` |
| Module system | ESM (`"type": "module"`) | `package.json` |
| Description | "Promise Jewels — website, admin panel and API in one project, served by a single Node server." | `package.json` |
| Application type | Client-rendered SPA + REST API in one Express process | `server/src/server.ts`, `src/main.jsx` |
| Rendering | **SPA only.** No SSR, no SSG, no pre-rendering. | `index.html` is a bare shell with `<div id="root">` |
| Repository remote | `github.com/Vedsavani-01/The-Promise-Jewels.git` | `git remote -v` |

### 2.1 Application type

- **Public website** — React SPA, client-rendered.
- **Admin/CMS** — same SPA, routed under `/admin/*`, guarded client-side by `RequireAuth` and server-side by middleware.
- **Backend** — Express 5 REST API mounted at `/api/v1`.
- **Database** — PostgreSQL hosted by Supabase, reached through **Prisma** over a direct Postgres connection.
- **Authentication** — self-implemented JWT + email OTP. **Supabase Auth is not used.**
- **Hosting** — «NOT VERIFIED FROM CODEBASE». No deployment manifest exists in the repo. Comments in `server/src/modules/mail/mail.service.ts` and `server/src/app.ts` refer to Render, and `.env.bak-prod-api` contains an `onrender.com` API URL, but there is no `render.yaml`, `Dockerfile`, `Procfile` or CI workflow to confirm it.

---

## 3. Technology stack

Versions are the declared ranges in `package.json`. Where a version is pinned exactly, that is noted.

| Layer | Technology | Version | Purpose | Verified from |
|---|---|---|---|---|
| Frontend framework | React | ^19.2.8 | UI | `package.json` |
| Frontend build | Vite | ^8.2.0 | Dev server + bundler | `package.json`, `vite.config.js` |
| Routing | react-router-dom | ^7.18.2 | Client routing | `package.json`, `src/app/routes/` |
| CSS framework | Tailwind CSS | ^4.3.3 | Styling | `package.json`, `@tailwindcss/vite` |
| CSS (secondary) | Bootstrap | ^5.3.8 | CSS only, imported into a cascade layer | `src/assets/styles/globals.css:4` |
| Animation | GSAP | ^3.15.0 | Scroll/entrance animation | `src/lib/gsap.js` |
| Smooth scroll | lenis | ^1.3.26 | Scroll smoothing | `package.json` |
| Icons | lucide-react | ^1.28.0 | Admin + site icons | `package.json` |
| Charts | recharts | ^3.10.1 | Dashboard charts | `package.json` |
| Rich text editor | TipTap | ^3.31.0 (11 packages) | Blog post editor | `src/features/blog/components/RichTextEditor.jsx` |
| Backend framework | Express | ^5.2.1 | HTTP server + API | `server/src/app.ts` |
| Language (backend) | TypeScript | 5.8.3 (pinned) | Backend source | `package.json`, `server/tsconfig.json` |
| Runtime loader | tsx | ^4.23.1 | Runs TS directly in dev | `package.json` scripts |
| ORM | Prisma | 6.16.3 (pinned) | Database access | `server/prisma/schema.prisma` |
| Database | PostgreSQL (Supabase) | «NOT VERIFIED» (server version not readable from code) | Data store | `schema.prisma` provider, `DATABASE_URL` host |
| Storage SDK | @supabase/supabase-js | ^2.112.0 | **Storage only** | `server/src/config/supabase.config.ts` |
| Auth (password) | bcryptjs | ^3.0.3 | Password + OTP hashing | `server/src/utils/password.ts` |
| Auth (tokens) | jsonwebtoken | ^9.0.3 | Access/refresh JWTs | `server/src/utils/jwt.ts` |
| Validation | Zod | ^4.4.3 | Request schema validation | every `*.validation.ts` |
| File upload | multer | ^2.2.0 | Multipart parsing (memory storage) | `server/src/middleware/upload.middleware.ts` |
| HTML sanitising | sanitize-html | ^2.17.7 | Blog post HTML | `server/src/modules/blog/blog.sanitize.ts` |
| Security headers | helmet | ^8.3.0 | CSP, HSTS, etc. | `server/src/app.ts` |
| Rate limiting | express-rate-limit | ^8.6.1 | Throttling | `server/src/config/rateLimit.ts` |
| CORS | cors | ^2.8.6 | Origin allow-list | `server/src/config/cors.ts` |
| Cookies | cookie-parser | ^1.4.7 | Auth cookie parsing | `server/src/app.ts` |
| Compression | compression | ^1.8.1 | gzip | `server/src/app.ts` |
| HTTP logging | morgan | ^1.11.0 | Request log | `server/src/app.ts` |
| Spreadsheet | xlsx | ^0.18.5 | Enquiry export | `server/src/modules/inquiries/inquiry.service.ts` |
| Email | Resend HTTPS API | n/a (plain `fetch`) | OTP delivery | `server/src/modules/mail/mail.service.ts:61` |
| Linting | ESLint | ^10.8.0 | | `eslint.config.js` |
| Formatting | Prettier | ^3.9.6 | | `prettier.config.js` |
| **Testing** | **none** | — | **No test framework is installed** | `package.json` has no test runner; `tests/**` holds only `.gitkeep` |
| State management | **none** | — | React local state + module-scope caches only. No Redux/Zustand/Jotai. | `package.json`; `src/store/slices/` contains 1 file |
| Form handling | **none** | — | Plain controlled inputs. No react-hook-form/formik. | `package.json` |

**Note on `src/store/`** — the directory exists with a single file under `slices/`, but no state-management library is installed. This is scaffolding, not an implemented pattern.

---

## 4. Architecture

### 4.1 Process model

```
                     ONE Node process, ONE port (default 2000)
  ┌──────────────────────────────────────────────────────────────────┐
  │  Express app  (server/src/app.ts)                                │
  │                                                                   │
  │   helmet → Permissions-Policy → cors → morgan → compression       │
  │     → express.json(1mb) → express.urlencoded(100kb)               │
  │     → express.static("public") → cookieParser                     │
  │     → GET /api/health                                             │
  │     → apiLimiter (/api) → normaliseQuery (/api)                   │
  │     → csrfProtection (/api)                                       │
  │     → /api/v1 routes                                              │
  │     → notFound (/api) → errorMiddleware                           │
  │                                                                   │
  │  server/src/server.ts then attaches ONE of:                       │
  │    production  → express.static(dist) + SPA fallback to index.html│
  │    development → Vite in middleware mode (HMR over same server)   │
  └──────────────────────────────────────────────────────────────────┘
```

Verified from `server/src/app.ts` and `server/src/server.ts:46-97`.

Consequence worth stating: **the public site and the admin panel share one origin**. That removes CORS from the normal request path entirely, and it is why `SameSite=Lax` cookies are sufficient (see §10).

### 4.2 Request lifecycle for an authenticated API call

```
Browser (admin panel)
  │  fetch('/api/v1/…', { credentials: 'include' })
  ▼
helmet / cors / body parsers / cookieParser
  ▼
apiLimiter            300 req/min per IP
  ▼
normaliseQuery        collapses ?k=a&k=b arrays to the last value
  ▼
csrfProtection        Origin/Referer must match allow-list or self (non-GET)
  ▼
requireAuth           reads accessToken cookie → verifies JWT → loads user
                      from DB (id, name, email, isActive, role) every request
  ▼
requireAdmin          (only on the routes that declare it)
  ▼
validate(zodSchema)   parses + STRIPS undeclared keys → req.body
  ▼
controller → service → repository → Prisma → Postgres
  ▼
ApiResponse envelope { success, message, data }
```

### 4.3 The response envelope

Every controller returns `new ApiResponse(success, message, data)` — `server/src/utils/ApiResponse.ts`. Errors are shaped `{ success: false, message, errors }` by `server/src/middleware/error.middleware.ts`. The frontend client (`src/services/api/client.js`) unwraps `data` and throws on `success: false`.

---

## 5. Folder structure

```
promise-jewels/
├── .claude/launch.json         dev-server launch config (tooling, not app)
├── .env                        LIVE secrets — gitignored
├── .env.bak-prod-api           LIVE secrets — see §18, F-01
├── .env.example                template, no real values — tracked
├── .gitignore
├── brain.md                    architecture doc (superseded by BRAIN.md)
├── README.md                   EMPTY (0 bytes)
├── dist/                       build output — gitignored
├── eslint.config.js
├── index.html                  SPA shell
├── jsconfig.json               editor path aliases
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml         declares allowBuilds for native deps
├── prettier.config.js
├── vite.config.js              React + Tailwind plugins, "@" → ./src alias
│
├── public/                     18 MB static assets, served by express.static
│   ├── images/                 75 image files
│   ├── fonts/                  self-hosted Optika + Ringtte
│   └── Icons/                  SVG icons incl. ticker-star.svg
│
├── server/
│   ├── prisma/
│   │   ├── schema.prisma       23 models, 7 enums
│   │   ├── seed.ts             admin + settings seeding
│   │   └── migrate-custom-sections.ts   one-off data script
│   └── src/
│       ├── app.ts              middleware chain (see §4.1)
│       ├── server.ts           port binding + Vite/dist attachment
│       ├── config/             cookies, cors, env, jwt, rateLimit,
│       │                       storage.config, storage.service, supabase.config
│       ├── database/prisma.ts  PrismaClient singleton
│       ├── middleware/         auth, authorize, csrf, error, fileSecurity,
│       │                       notFound, upload, validation
│       ├── modules/            13 feature modules (see §6)
│       ├── routes/index.ts     mount table
│       ├── types/express.d.ts  Request.user augmentation
│       └── utils/              ApiError, ApiResponse, asyncHandler, helpers,
│                               jwt, logger, otp, password, sanitizeSvg,
│                               securityLog, slugify, tokenHash
│
├── src/                        frontend
│   ├── main.jsx
│   ├── app/routes/             AppRoutes, AdminRoutes, RequireAuth
│   ├── assets/                 fonts, icons, images, styles/globals.css
│   ├── components/
│   │   ├── common/ (8)         Navbar, Footer, BrandTabs, SectionHeading,
│   │   │                       SocialIcons, SmoothScroll, PageTransition,
│   │   │                       CustomCursor
│   │   ├── feedback/ (3)       Toast, ConfirmDialog, EmptyState
│   │   ├── forms/ (2)          Field.jsx (Input/Textarea/Select/ColorInput/
│   │   │                       ImageInput/NumberInput), + 1
│   │   ├── layout/ (5)         Sidebar, Topbar, TableToolbar,
│   │   │                       PageHeroCircle, heroContent.js
│   │   └── ui/ (9)             Button, Card, Badge, Modal, DataTable,
│   │                           GalleryModal, StatCard, Switch, Tabs
│   ├── features/               feature-first modules (see §6.2)
│   ├── hooks/ (3)              useGSAP, useReveal, + 1
│   ├── layouts/ (2)            MainLayout (public), AdminLayout
│   ├── lib/gsap.js             GSAP + ScrollTrigger registration
│   ├── pages/                  Home, About, Contact, Error, NotFound
│   ├── services/
│   │   ├── api/client.js       fetch wrapper, mock flags, refresh-on-401
│   │   ├── mock/ (2)           fixture data
│   │   ├── analytics/ (1)
│   │   └── storage/ (1)
│   ├── store/slices/ (1)       scaffolding only — no state library installed
│   ├── types/ (1)
│   └── utils/ (6)              helpers, scroll, …
│
└── tests/
    ├── e2e/.gitkeep            EMPTY
    ├── integration/.gitkeep    EMPTY
    └── unit/.gitkeep           EMPTY
```

### 5.1 Dead, unused, legacy and suspicious files

| Path | Classification | Evidence |
|---|---|---|
| `.env.bak-prod-api` | **Suspicious — live secrets** | Contains 24 populated variables incl. DB URL, Supabase secret key, both JWT secrets, mail key. Untracked now, but present in commit `05bc537`. |
| `README.md` | Empty | 0 bytes |
| `tests/**` | Empty scaffolding | only `.gitkeep` |
| `src/store/slices/` | Dead scaffolding | 1 file; no state library in `package.json` |
| `STORAGE_BUCKETS.TEAM` | Unused constant | declared in `storage.config.ts`; zero references |
| `model team_members` | Unused table | no repository/service references it |
| `model cms_pages` | Unused table | no repository/service references it |
| `model ActivityLog` | Unused table | no repository/service references it |
| `model section_images` | **Orphaned** | feature removed; model retained deliberately to avoid a destructive drop |
| `server/prisma/migrate-custom-sections.ts` | One-off script | not referenced by any npm script |
| `brain.md` | Superseded | replaced by `BRAIN.md`; retained for its historical "traps" notes |

**Should not be committed:** `.env.bak-prod-api` (see §18 F-01). Everything else in `.gitignore` is correctly excluded — `dist/` and `node_modules/` are confirmed untracked.

---

## 6. Code structure

### 6.1 Backend module pattern

Every module in `server/src/modules/` follows the same shape. Deviations are noted.

```
<module>/
  <module>.routes.ts       Express router; declares auth + validation per route
  <module>.controller.ts   HTTP only: read req, call service, send ApiResponse
  <module>.service.ts      business logic, authorisation decisions, sanitising
  <module>.repository.ts   Prisma calls ONLY
  <module>.validation.ts   Zod schemas
  <module>.constants.ts    messages, enums
  <module>.types.ts        DTOs (where present)
```

| Module | Purpose | Has repository | Notes |
|---|---|---|---|
| `auth` | login, OTP, refresh, logout, reset | yes | no `.constants` deviation |
| `blog` | posts + comments | yes | adds `blog.sanitize.ts` |
| `brands` | brand records + images | yes | exports `publicRouter` **and** `adminRouter` |
| `collections` | collection records + images | yes | same dual-router pattern |
| `dashboard` | aggregate counts + trend | yes | contains the only raw SQL |
| `exhibitions` | shows, sections, gallery | yes | per-route `requireAuth`, not `router.use` |
| `inquiries` | contact form + admin queue | yes | XLSX export |
| `mail` | OTP email via Resend | no | service + templates only |
| `media` | image library upload | yes | reduced to upload/list/delete |
| `page-content` | **the CMS** | yes | schema-driven; see §14 |
| `seo` | per-page SEO records | yes | plus `builders/`, `generators/`, `schemas/`, `public/` |
| `seo-settings` | site-wide SEO defaults | yes | |
| `settings` | site contact details, password change | yes | |

### 6.2 Frontend feature pattern

`src/features/<name>/` with `components/`, `hooks/`, `pages/`, `services/`, `store/`, `utils/` and a `<name>.api.js` at the root. Not every subfolder is populated in every feature.

### 6.3 Key shared files

| File | Purpose | Consumers | Security relevance |
|---|---|---|---|
| `src/services/api/client.js` | fetch wrapper; `credentials: 'include'`; unwraps envelope; on 401 calls `/auth/refresh` once then retries | every `*.api.js` | Holds the `USE_MOCK*` flags — all now default **false** |
| `server/src/middleware/auth.middleware.ts` | verifies access token, loads user from DB each request | all protected routes | Reads `role` from DB, not from the token, so revocation is immediate |
| `server/src/middleware/authorize.middleware.ts` | `requireRole` / `requireAdmin` | destructive routes | Deny-by-default |
| `server/src/middleware/csrf.middleware.ts` | Origin/Referer check on non-GET `/api` | all state-changing routes | Two exempt public endpoints |
| `server/src/middleware/fileSecurity.middleware.ts` | magic-byte type detection; SVG scrubbing | all upload routes | Replaces `file.buffer` so no caller can skip it |
| `server/src/middleware/validation.middleware.ts` | Zod parse; strips undeclared body keys | most write routes | Primary mass-assignment defence |
| `server/src/utils/tokenHash.ts` | SHA-256 + `timingSafeEqual` for refresh tokens | auth service | Replaced bcrypt, which truncates at 72 bytes |
| `server/src/modules/blog/blog.sanitize.ts` | sanitize-html allow-list for post HTML | blog service | Applied on write, so stored HTML is already safe |
| `server/src/utils/sanitizeSvg.ts` | regex scrubber for uploaded SVG | fileSecurity middleware | Namespace-aware; filters CSS rather than deleting it |
| `src/components/forms/Field.jsx` | `Input`, `Textarea`, `Select`, `ColorInput`, `ImageInput`, `NumberInput` | CMS editor, blog admin | `ImageInput` enforces `accept` client-side; server re-checks |
| `src/components/layout/heroContent.js` | shared hero fallback + ring images | 4 public pages | Prevents fallback drift |

---

## 7. API inventory

All routes are mounted under `/api/v1` by `server/src/routes/index.ts`, except `/api/health` which is declared directly in `app.ts`.

**Legend** — Auth: `public` = no authentication; `AUTH` = `requireAuth`/`authenticate`; `ADMIN` = additionally `requireAdmin`.

### 7.1 Authentication — `/api/v1/auth`

| Method | Endpoint | Auth | Validation | Rate limit | Notes |
|---|---|---|---|---|---|
| POST | `/login` | public | `loginSchema` | authLimiter 10/15min | Verifies password, then issues an OTP. Does **not** return a session. |
| POST | `/forgot-password` | public | `forgotPasswordSchema` | otpRequestLimiter 5/15min | Always 200 (no enumeration) |
| POST | `/verify-otp` | public | `verifyOtpSchema` | authLimiter | Issues access + refresh cookies |
| POST | `/reset-password` | public | `resetPasswordSchema` | authLimiter | Shares the OTP attempt counter |
| GET | `/me` | AUTH | — | apiLimiter | Returns id, name, email, isActive, lastLoginAt |
| POST | `/refresh` | public* | — | apiLimiter | *Authenticated by the refresh cookie itself |
| POST | `/logout` | AUTH | — | apiLimiter | Clears `refreshTokenHash` |

### 7.2 Blog — `/api/v1/blog`

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/public` | public | Published posts, `take: 200` |
| GET | `/public/:slug` | public | Post + approved comments only |
| POST | `/public/:slug/comments` | public | contactLimiter-style 5/10min; honeypot; CSRF-exempt |
| GET | `/comments` | AUTH | Moderation queue |
| PUT | `/comments/:id` | AUTH | approve / spam |
| DELETE | `/comments/:id` | **ADMIN** | |
| GET | `/` | AUTH | All posts incl. drafts |
| POST | `/` | AUTH | HTML sanitised on write |
| GET | `/:id` | AUTH | |
| PUT | `/:id` | AUTH | |
| DELETE | `/:id` | **ADMIN** | Cascades to comments |

### 7.3 Brands — `/api/v1/brands` (public) and `/api/v1/admin/brands`

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/brands/` | public | Active brands only, `take: 200` |
| GET | `/brands/:slug` | public | Active only |
| GET | `/admin/brands/` | AUTH | |
| GET | `/admin/brands/options` | AUTH | |
| GET | `/admin/brands/:id` | AUTH | |
| POST | `/admin/brands/` | AUTH | multipart: logo, banner, images[10] |
| PUT | `/admin/brands/:id` | AUTH | multipart |
| PATCH | `/admin/brands/reorder` | AUTH | |
| PATCH | `/admin/brands/:id/status` | AUTH | |
| DELETE | `/admin/brands/:id/images/:imageId` | **ADMIN** | |
| DELETE | `/admin/brands/:id` | **ADMIN** | |

### 7.4 Collections — `/api/v1/collections` and `/api/v1/admin/collections`

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/collections/` | public |
| GET | `/collections/:slug` | public |
| GET | `/admin/collections/` | AUTH |
| GET | `/admin/collections/:id` | AUTH |
| POST | `/admin/collections/` | AUTH (multipart) |
| PUT | `/admin/collections/:id` | AUTH (multipart) |
| PATCH | `/admin/collections/reorder` | AUTH |
| PATCH | `/admin/collections/:id/status` | AUTH |
| PATCH | `/admin/collections/:id/featured` | AUTH |
| PATCH | `/admin/collections/:id/images/:imageId/thumbnail` | AUTH |
| DELETE | `/admin/collections/:id/images/:imageId` | AUTH |
| DELETE | `/admin/collections/:id` | AUTH |

### 7.5 Exhibitions — `/api/v1/exhibitions`

This module applies `requireAuth` **per route** rather than with a barrier.

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/` | public | `limit` clamped 1–100 |
| GET | `/search` | public | validated query |
| GET | `/:slug` | public | |
| GET | `/:id/gallery` | public | |
| POST | `/` | AUTH | |
| PATCH | `/:id` | AUTH | |
| DELETE | `/:id` | AUTH | |
| POST | `/:id/gallery` | AUTH | upload |
| POST | `/:id/thumbnail` | AUTH | upload |
| DELETE | `/gallery/:imageId` | AUTH | |

### 7.6 Remaining modules

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/inquiries/contact` | public | contactLimiter 5/10min; CSRF-exempt |
| GET | `/inquiries/` | AUTH | |
| GET | `/inquiries/export` | AUTH | XLSX; formula characters neutralised |
| GET | `/inquiries/:id` | AUTH | |
| PATCH | `/inquiries/:id/status` | AUTH | |
| DELETE | `/inquiries/:id` | AUTH | soft delete (`deletedAt`) |
| GET | `/settings/public` | public | Contact + social only |
| GET | `/settings/` | AUTH | |
| PUT | `/settings/` | **ADMIN** | |
| PUT | `/settings/password` | AUTH | own password only |
| GET | `/page-content/public/:page` | public | **CMS read path** |
| GET | `/page-content/pages` | AUTH | tab list |
| GET | `/page-content/:page` | AUTH | schema + values + palette |
| PUT | `/page-content/:page` | AUTH | **CMS write path** |
| GET | `/media/assets` | AUTH | |
| POST | `/media/assets` | AUTH | uploadLimiter 30/min |
| DELETE | `/media/assets/:id` | AUTH | |
| GET | `/seo/` `/seo/:id` | AUTH | |
| PATCH | `/seo/:id` | AUTH | validation re-enabled |
| GET | `/seo-settings/` | AUTH | |
| PATCH | `/seo-settings/` | AUTH | `.strict()` schema |
| GET | `/dashboard/` | AUTH | aggregates |
| GET | `/sitemap.xml` | public | XML-escaped |
| GET | `/robots.txt` | public | |
| GET | `/llms.txt` | public | |
| GET | `/metadata/:slug` | public | Per-page SEO |
| GET | `/api/health` | public | Returns `{success, message:"ok"}` only |

**Webhooks:** none. **Edge functions:** none. **Server actions:** not applicable (not Next.js).

**Third-party APIs called by this server:** exactly one — `https://api.resend.com/emails` (`mail.service.ts:61`). The URL is a hard-coded literal, so there is **no SSRF surface**.

---

## 8. Supabase architecture

### 8.1 How Supabase is actually used — important

**Supabase is used for two separate things, by two entirely different mechanisms:**

1. **PostgreSQL database** — reached by **Prisma over a direct Postgres connection** (`DATABASE_URL` / `DIRECT_URL`). The Supabase JS client is *not* involved. Host observed at runtime: `aws-1-ap-south-1.pooler.supabase.com` (pooler port 6543 for `DATABASE_URL`, 5432 for `DIRECT_URL`).
2. **Supabase Storage** — reached by `@supabase/supabase-js` using the **secret (service) key**, server-side only.

**Supabase Auth is NOT used.** Authentication is entirely self-implemented (§10).

**There is no Supabase client in the browser.** Verified: `grep -rn "@supabase/supabase-js" src` returns nothing, and a scan of the production bundle in `dist/` found no connection string, JWT or API key.

| Connection | Where | Key used | Client-side? |
|---|---|---|---|
| Database | `server/src/database/prisma.ts` via `DATABASE_URL` | Postgres credentials | No |
| Storage | `server/src/config/supabase.config.ts` | `SUPABASE_SECRET_KEY` | No |
| Auth | — | — | Not used |
| Realtime | — | — | Not used |

```
SUPABASE_URL          = configured
SUPABASE_SECRET_KEY   = configured   (server-side only)
DATABASE_URL          = configured
DIRECT_URL            = configured
```

### 8.2 Supabase RLS — critical context

**Row Level Security is architecturally bypassed in this application, by design of the connection method.**

Prisma connects as the database owner over a direct Postgres connection. RLS policies apply to the PostgREST/`anon`/`authenticated` roles that the Supabase JS client uses — not to a direct owner connection. Therefore:

- Whether RLS is enabled on any table is **«NOT VERIFIED FROM CODEBASE»** — it is dashboard state, not repository state, and I have no Supabase dashboard access.
- Even if RLS were enabled, **it would not constrain this application**, because every query arrives over the owner connection.
- All access control for the database is therefore enforced **in Express middleware and service code**, not in the database.

**Severity: INFO** as an architecture note; **MEDIUM** as a defence-in-depth gap — if `DATABASE_URL` ever leaks, RLS provides no containment. (It did leak; see §18 F-01.)

### 8.3 Supabase Storage

| Bucket | Declared in | Used by | Public? |
|---|---|---|---|
| `brands` | `storage.config.ts` | brand logo/banner/gallery | Public read — brand images render directly from the Supabase origin |
| `collections` | `storage.config.ts` | collection banner/gallery | Public read |
| `exhibitions` | `storage.config.ts` | thumbnails, gallery | Public read |
| `cms` | `storage.config.ts` | media library, blog images, CMS images | Public read |
| `team` | `storage.config.ts` | **nothing — unused constant** | — |

Public-read is inferred from `storageService.getPublicUrl()` being used for every stored file and those URLs being rendered directly in `<img src>`. **Bucket write policies are «NOT VERIFIED FROM CODEBASE»** — dashboard state.

**Upload controls** (`upload.middleware.ts` + `fileSecurity.middleware.ts`):

| Control | Value |
|---|---|
| Storage | `multer.memoryStorage()` — nothing is written to the server filesystem |
| Max file size | 5 MB |
| Max files per request | 12 |
| Max fields / parts | 40 / 60 |
| Declared types accepted | jpeg, png, webp, svg+xml |
| **Content verification** | magic-byte signature check; declared type must match actual |
| SVG handling | scrubbed by `sanitizeSvg`; buffer replaced before any module can store it |
| Filename | randomised: `sections/<uuid>-<sanitised-name>` (`media.service.ts:buildStoragePath`) |
| Path traversal | structurally impossible — no filesystem writes; storage key is server-generated |
| Delete | `deleteAsset` verifies the row exists first; storage removal is best-effort |

### 8.4 Supabase Authentication

Not used. See §10.

---

## 9. Database architecture

**23 models, 7 enums.** Source: `server/prisma/schema.prisma`.

### 9.1 Enums

| Enum | Values |
|---|---|
| `UserRole` | ADMIN, EDITOR, VIEWER |
| `OtpPurpose` | LOGIN, FORGOT_PASSWORD |
| `InquiryStatus` | NEW, READ |
| `SeoEntityType` | STATIC_PAGE, BRAND, COLLECTION, EXHIBITION, BLOG, PRODUCT, LOCATION |
| `RobotsPolicy` | INDEX_FOLLOW, INDEX_NOFOLLOW, NOINDEX_FOLLOW, NOINDEX_NOFOLLOW |
| `SitemapChangeFrequency` | ALWAYS, HOURLY, DAILY, WEEKLY, MONTHLY, YEARLY, NEVER |
| `SchemaType` | WEBSITE, ORGANIZATION, BRAND, EXHIBITION, COLLECTION, EVENT |

### 9.2 Entity relationships

```
User (users)
 ├─< brands.createdBy
 ├─< collections.createdBy
 └─< exhibitions.createdBy

brands ──< brand_images
       └─< collections ──< collection_images

exhibitions ──< exhibition_images
            └─< exhibition_sections ──< exhibition_section_fields

blog_posts ──< blog_comments            (onDelete: Cascade)

media_assets ──< section_images         (orphaned feature, see §5.1)

SeoPage >──< SeoTag  via SeoPageTag     (composite PK)

Standalone (no FK):
  page_content     inquiries     settings     SeoSettings
  cms_pages*       team_members*  ActivityLog*      (* unused)
```

### 9.3 Tables the application actually reads and writes

| Table | Purpose | Read by | Written by | Key fields | RLS |
|---|---|---|---|---|---|
| `users` | admin accounts | auth, dashboard | auth (login, OTP, reset) | id(PK), email(unique), password, role, otpCode, otpAttempts, refreshTokenHash | Bypassed — §8.2 |
| `brands` | brand records | public site, admin | admin | id(PK), slug(unique), isActive, displayOrder, createdBy(FK) | Bypassed |
| `brand_images` | brand gallery | public, admin | admin | id(PK), brandId(FK), displayOrder | Bypassed |
| `collections` | collection records | public, admin | admin | id(PK), slug, brandId(FK), featured, isActive | Bypassed |
| `collection_images` | collection gallery | public, admin | admin | id(PK), collectionId(FK), isThumbnail | Bypassed |
| `exhibitions` | trade shows | public, admin | admin | id(PK), slug, startDate, endDate, isActive | Bypassed |
| `exhibition_images` | show gallery | public, admin | admin | id(PK), exhibitionId(FK) | Bypassed |
| `exhibition_sections` | custom show sections | public, admin | admin | id(PK), exhibitionId(FK) | Bypassed |
| `exhibition_section_fields` | section rows | public, admin | admin | id(PK), sectionId(FK) | Bypassed |
| `inquiries` | contact submissions | admin | **public** (contact form) | id(PK), status, deletedAt | Bypassed |
| `settings` | site contact/social | public, admin | admin | id(PK) | Bypassed |
| `page_content` | **the CMS store** | public, admin | admin | **unique(page, section, field)**, value | Bypassed |
| `media_assets` | uploaded file registry | admin | admin | id(PK), url, storagePath | Bypassed |
| `blog_posts` | blog | public, admin | admin | id(PK), slug(unique), status, publishedAt | Bypassed |
| `blog_comments` | comments | public(approved), admin | **public** (submit) | id(PK), postId(FK cascade), status | Bypassed |
| `seo_pages` | per-page SEO | public metadata, admin | admin | id(PK), slug, entityType | Bypassed |
| `seo_settings` | SEO defaults | public, admin | admin | id(PK) | Bypassed |
| `seo_tags`, `seo_page_tags` | SEO keywords | admin | admin | composite PK | Bypassed |
| `section_images` | **orphaned** | — | — | unique(section, slot) | Bypassed |
| `cms_pages`, `team_members`, `ActivityLog` | **unused** | — | — | — | Bypassed |

### 9.4 Indexes and constraints (as declared)

- `users.email` unique; `blog_posts.slug` unique; `page_content` unique on `(page, section, field)`; `section_images` unique on `(section, slot)`.
- Indexes: `page_content(page)`, `blog_posts(status, publishedAt)`, `blog_posts(slug)`, `blog_comments(postId, status)`, `blog_comments(status, createdAt)`, `exhibition_sections(exhibitionId)`, `exhibition_section_fields(sectionId)`, `ActivityLog(createdAt)`, `section_images(section, slot)`.
- **Views, database functions and triggers:** none declared in `schema.prisma`. Any that exist in the database directly are **«NOT VERIFIED FROM CODEBASE»**.
- **Migration history: none.** There is no `server/prisma/migrations/` directory — this is a `prisma db push` project.

---

## 10. Authentication

**Self-implemented. Supabase Auth is not used.**

### 10.1 Login flow (two-step, email OTP)

```
POST /auth/login  { email, password }
   │  bcrypt compare (always runs, even for unknown email — timing equalised)
   │  uniform 401 for unknown / wrong password / disabled account
   ▼
issueOtp()  crypto.randomInt six digits → bcrypt-hashed → users.otpCode
   │        expiry = now + OTP_EXPIRY_MINUTES ; otpAttempts reset to 0
   ▼
Resend HTTPS API → admin's inbox        (200 "OTP sent" — no session yet)

POST /auth/verify-otp  { email, otp }
   │  purpose + expiry + attempt-count checked; wrong code increments counter
   │  5 wrong codes → code destroyed
   ▼
access JWT (15m) + refresh JWT (7d)
   │  refresh token SHA-256 hashed → users.refreshTokenHash
   ▼
Set-Cookie accessToken, refreshToken   HttpOnly; Secure(prod); SameSite=Lax; path=/
```

### 10.2 Token handling

| Property | Value | File |
|---|---|---|
| Algorithm | HS256, **pinned** on sign and verify | `utils/jwt.ts` |
| Issuer | `promise-jewels-api`, verified | `utils/jwt.ts` |
| Audience | `promise-jewels-access` / `promise-jewels-refresh`, verified | `utils/jwt.ts` |
| Access lifetime | `JWT_ACCESS_EXPIRES_IN`, default 15m | `config/env.ts` |
| Refresh lifetime | `JWT_REFRESH_EXPIRES_IN`, default 7d | `config/env.ts` |
| Storage | **HttpOnly cookies only** — never `localStorage`, `sessionStorage` or URL | `auth.controller.ts` |
| Server-side record | SHA-256 of the refresh token, constant-time compared | `utils/tokenHash.ts` |
| Rotation | New refresh token on every `/refresh` | `auth.service.ts` |
| Reuse detection | A valid-but-not-current refresh token **drops the whole session** | `auth.service.ts` |

`sessionStorage` is used in `src/features/auth/auth.api.js` **only in mock mode** to hold a fake user object; the real path stores nothing client-side.

### 10.3 Password reset

`POST /auth/forgot-password` → always 200 → OTP mailed if the account exists → `POST /auth/reset-password` with `{email, otp, newPassword}`. Uses the **same** `verifyUserOtp` helper as login, so the attempt counter and lockout apply. On success: password re-hashed, OTP cleared, **all refresh tokens cleared**.

### 10.4 Email verification

`users.isOtpVerified` exists in the schema and is set by the seed, but no route reads or writes it as a verification gate. **Email verification as a distinct flow: not implemented.**

---

## 11. Authorization

### 11.1 Model

| Layer | Mechanism |
|---|---|
| Route | `requireAuth` (session) → `requireAdmin` (role) |
| Role source | `users.role`, **read from the database on every request** (not from the JWT) |
| Roles | `ADMIN`, `EDITOR`, `VIEWER` — all existing accounts default to `ADMIN` |
| Default | Deny — `requireRole` fails on a missing or unrecognised role |
| Frontend | `RequireAuth` in `src/app/routes/RequireAuth.jsx` — **UX only**, not a security boundary |

### 11.2 Where `requireAdmin` is applied

`DELETE /blog/:id`, `DELETE /blog/comments/:id`, `DELETE /admin/brands/:id`, `DELETE /admin/brands/:id/images/:imageId`, `PUT /settings/`.

**Not yet applied** to collection and exhibition deletes, or to SEO writes. Because every account is currently `ADMIN`, this has **no present impact**; it becomes relevant the moment a non-admin account is created. Recorded as a finding (§18 F-14).

### 11.3 IDOR / ownership

Admin records (brands, collections, exhibitions, blog posts) are **organisation-wide**, not per-user — there is no per-user ownership model, so there is nothing to enforce. `PUT /settings/password` is the one identity-bound operation and derives the user id from `req.user`, never from the request body.

---

## 12. Admin panel

Base route `/admin`, guarded by `RequireAuth` around `AdminLayout`.

| Module | Route | Page component | APIs | Tables | Role |
|---|---|---|---|---|---|
| Login | `/admin/login` | `features/auth/pages/LoginPage` | `/auth/login`, `/auth/verify-otp` | users | public |
| Dashboard | `/admin/dashboard` | `features/dashboard/pages/DashboardPage` | `/dashboard` | aggregates | AUTH |
| Collections | `/admin/collections` | `features/collections/pages/CollectionsPage` | `/admin/collections/*` | collections, collection_images | AUTH |
| Brands | `/admin/brands` | `features/brands/pages/BrandsPage` | `/admin/brands/*` | brands, brand_images | AUTH / ADMIN for delete |
| Exhibitions | `/admin/exhibitions` | `features/exhibitions/pages/ExhibitionsPage` | `/exhibitions/*` | exhibitions + children | AUTH |
| Inquiries | `/admin/inquiries` | `features/inquiries/pages/InquiriesPage` | `/inquiries/*` | inquiries | AUTH |
| **Content (CMS)** | `/admin/editor` | `features/page-content/pages/EditorPage` | `/page-content/*` | page_content | AUTH |
| **Header** | `/admin/header` | `features/page-content/pages/HeaderPage` | `/page-content/header` | page_content | AUTH |
| **Footer** | `/admin/footer` | `features/page-content/pages/FooterPage` | `/page-content/footer` | page_content | AUTH |
| **Blog** | `/admin/blog` | `features/blog/pages/BlogPage` | `/blog/*` | blog_posts, blog_comments | AUTH / ADMIN for delete |
| SEO | `/admin/seo` | `features/seo/pages/SeoPage` | `/seo/*`, `/seo-settings` | seo_pages, seo_settings | AUTH |
| Settings | `/admin/settings` | `features/settings/pages/SettingsPage` | `/settings/*` | settings, users | AUTH / ADMIN for site settings |

Sidebar grouping (`src/components/layout/Sidebar.jsx`): **Management** (Collections, Brands, Exhibitions, Inquiries) · **Editor** (Content, Header, Footer) · **Marketing** (Blog, SEO) · Settings.

---

## 13. Public website

| Page | Route | Dynamic/Static | Data source | Editable from admin | SEO |
|---|---|---|---|---|---|
| Home | `/` | Dynamic | `/page-content/public/home`, `/brands`, `/exhibitions`, `/settings/public` | **Yes** — Editor › Home page | `/metadata/home` |
| About | `/AboutPage` | Dynamic | `/page-content/public/about` | **Yes** — Editor › About page | via metadata route |
| Our Brands | `/our-brand` | Dynamic | `/page-content/public/brands`, `/brands` | **Yes** — hero; rows in Admin › Brands | via metadata route |
| Our Collection | `/our-collection` | Dynamic | `/page-content/public/collections`, `/brands`, `/collections` | **Yes** — hero/closing; tiles in Admin › Collections | via metadata route |
| Collection detail | `/our-collection/:categoryId` | Dynamic | `/collections/:slug` | Record-level | via metadata route |
| Exhibitions | `/Exhibition` | Dynamic | `/page-content/public/exhibitions`, `/exhibitions` | **Yes** — hero, schedule heading, CTA band, FAQ | JSON-LD in page |
| Exhibition detail | `/Exhibition/:slug` | Dynamic | `/exhibitions/:slug` | Record-level | JSON-LD |
| Contact | `/contact` | Dynamic | `/page-content/public/contact`, `/settings/public` | **Yes** — Editor › Contact page | via metadata route |
| **Blog list** | `/blog` | Dynamic | `/page-content/public/blog`, `/blog/public` | **Yes** — hero; posts in Marketing › Blog | via metadata route |
| **Blog post** | `/blog/:slug` | Dynamic | `/blog/public/:slug` | Per-post SEO fields | Per-post meta + BlogPosting JSON-LD |

Header and footer appear on every page and are edited from Editor › Header / Footer.

**Forms:** the enquiry form (`InquiryForm`, used on Collections, Exhibitions, Contact) → `POST /inquiries/contact`; the blog comment form → `POST /blog/public/:slug/comments`.

---

## 14. CMS / website editor

This is the most distinctive part of the system and deserves its own explanation.

### 14.1 Architecture — schema-driven, not table-per-page

The editable surface of the website is **declared in one server file**: `server/src/modules/page-content/page-content.constants.ts`. That file defines `CONTENT_PAGES` — an array of pages, each with sections, each with fields. Every field declares its `key`, `label`, `type`, `group`, `hint`, `max` and — critically — its **`default`**, which is the exact value the site ships with.

Storage is a single generic table:

```
page_content ( id, page, section, field, value, updatedAt )
              UNIQUE (page, section, field)
```

**Only overrides are stored.** Saving a value equal to its declared default **deletes** the row. Consequences: the table stays small, "reset to original" is a delete, and an empty table renders the site exactly as designed.

### 14.2 Field types

| Type | Rendered as | Server validation |
|---|---|---|
| `text` | single-line input | length ≤ `max` |
| `textarea` | multi-line | length ≤ `max` |
| `color` | native picker + hex box + **17-swatch brand palette** | `/^#[0-9a-fA-F]{6}$/` |
| `image` | thumbnail + Replace/Reset | must be `/path` or `https://…` |
| `svg` | thumbnail on a checkerboard | must additionally end `.svg` |
| `number` | slider + numeric box + unit | finite, within `min`…`ceiling` |

A section may also declare `manage: { label, path }`, which renders a **link to the admin screen that owns that content** instead of duplicating it (used for brand rows, collection tiles, exhibition listings, contact details, blog posts).

### 14.3 Editable surface (verified counts)

| Editor screen | Sections | Fields | Images |
|---|---|---|---|
| Home page | 7 | 132 | 58 |
| About page | 5 | 121 | 54 |
| Collections page | 5 | 63 | 38 |
| Brands page | 3 | 28 | 18 |
| Exhibitions page | 6 | 71 | 19 |
| Contact page | 2 | 37 | 19 |
| Blog page | 2 | hero + link | ring |
| Header | 2 | 13 | — |
| Footer | 3 | 23 | 1 (SVG icon) |

The Footer's scrolling line additionally exposes **animation controls**: loop duration (4–240 s) and hover slow-down (0–100 %), both rendered as slider + number box.

### 14.4 Data flow

```
Admin  ─ types into EditorPage ─┐
                                 │  whole page posted as { section: { field: value } }
                                 ▼
                 PUT /api/v1/page-content/:page
                                 ▼
     csrfProtection → requireAuth → validate(updatePageContentSchema)
                                 ▼
        page-content.service.update()
          • unknown section/field  → 404
          • length > max           → collected
          • color / image / svg / number type checks → collected
          • ALL violations returned together as { fieldErrors }
          • value === "" or === default → DELETE the override row
          • otherwise               → UPSERT
                                 ▼
                    page_content (Postgres)
                                 ▼
        GET /api/v1/page-content/public/:page   (no auth)
                                 ▼
   useSectionContent(page, section, fallback)   ← module-scope cache, one
                                 ▼                request per page load
              Public component renders merged values
```

`useSectionContent` (`src/features/page-content/hooks/usePageContent.js`) merges saved values **over** the component's own bundled fallback object, and only for keys the fallback declares. A failed request, an empty table or an untouched field therefore all render the original design.

### 14.5 Security posture of the CMS

| Concern | Status |
|---|---|
| Authorisation | `requireAuth` on read-schema and write; public read is values-only (no labels, no schema) |
| Validation | Zod shape + per-type server checks |
| Mass assignment | Only declared `(section, field)` pairs are accepted; anything else is a 404 |
| XSS via colour | Blocked — hex-only regex; values reach `style` attributes |
| XSS via image/svg | Blocked — values reach `src`; only `/path` or `https://` accepted |
| HTML rendering | **The CMS stores no HTML.** All CMS values render as React text or CSS values. |
| Draft/published | **Not implemented** — a save is immediately live |
| Versioning / revision history | **Not implemented** |
| Autosave | **Not implemented** — explicit Save, with an Undo-changes button |
| Preview | **Not implemented** as a separate mode; "View page" opens the live page |

### 14.6 The blog editor — the one place HTML is stored

Distinct from the CMS above. `src/features/blog/components/RichTextEditor.jsx` (TipTap) produces HTML which is stored in `blog_posts.content`.

- **Sanitised on WRITE**, not on read (`blog.sanitize.ts`), so the stored column is already safe.
- Allow-list covers headings, marks, lists, quote, code, tables, images, and `<iframe>` **only** from 11 named embed hosts.
- `allowedStyles` permits `text-align`, `color`, `background-color`, `font-family` with value regexes; `allowedSchemes` = https, mailto, tel (+ data: for `img`).
- All links are rewritten `target="_blank" rel="noopener noreferrer nofollow"`.
- Rendered on the public page with `dangerouslySetInnerHTML` — acceptable **because** sanitising happened on write.
- Comments are stored as **plain text** (all markup stripped) and rendered as text.

---

## 15. File / media management

Covered in §8.3. Summary of the pipeline:

```
Admin picks file
   ▼
multer.memoryStorage  → fileFilter checks the DECLARED type (cheap reject)
   ▼
verifyUploads (fileSecurity.middleware)
   • magic-byte detection: JPEG / PNG / WEBP signatures, structural SVG check
   • declared type MUST equal detected type
   • SVG → sanitizeSvg → file.buffer REPLACED
   ▼
module service → storageService.uploadFile(bucket, "sections/<uuid>-<name>", buffer)
   ▼
Supabase Storage (public bucket) → getPublicUrl()
   ▼
URL stored in the relevant table (media_assets / brands / collections / … / page_content)
```

---

## 16. External integrations

| Service | Purpose | Connection method | SDK/API | Env variable | Security |
|---|---|---|---|---|---|
| **Supabase Postgres** | Primary database | Direct Postgres via Prisma | `@prisma/client` | `DATABASE_URL`, `DIRECT_URL` | Owner connection; RLS bypassed (§8.2) |
| **Supabase Storage** | Image/file hosting | HTTPS SDK, server-side | `@supabase/supabase-js` | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Secret key never reaches the browser (verified against `dist/`) |
| **Resend** | Transactional email (OTP) | Plain `fetch` to a hard-coded URL | none (REST) | `RESEND_API_KEY` or `SMTP_PASS` | Server-side only; failures logged, generic error surfaced |

**No other external service is integrated.** Specifically **not present**: analytics, maps, payments, CRM, WhatsApp, social APIs, CDN, error monitoring. The SEO settings form has input fields for Google Analytics / GTM / Facebook Pixel / verification tokens, but **there are no database columns for them and no code consumes them** — see §18 F-16.

---

## 17. Environment variables

Values are never shown. Classification: **PUBLIC** = reaches the browser bundle; **SERVER** = server-side only; **SECRET** = server-side credential.

| Variable | Read in | Purpose | Class | Required | Status |
|---|---|---|---|---|---|
| `NODE_ENV` | `config/env.ts` | Switches CSP, Secure cookies, trust proxy, Vite vs dist | SERVER | No (defaults `development`) | Set to `production` in `.env` |
| `PORT` | `config/env.ts` | Listen port | SERVER | No (default 5000) | Set to 2000 |
| `DATABASE_URL` | `config/env.ts`, `schema.prisma` | Prisma pooled connection | **SECRET** | **Yes** — boot fails without | configured |
| `DIRECT_URL` | `schema.prisma` | Prisma direct connection | **SECRET** | Yes (Prisma) | configured |
| `SUPABASE_URL` | `config/env.ts`, `app.ts` (CSP origin) | Storage endpoint + CSP allow-list | SERVER | **Yes** | configured |
| `SUPABASE_SECRET_KEY` | `config/supabase.config.ts` | Privileged storage operations | **SECRET** | **Yes** | configured — must never be `VITE_`-prefixed |
| `JWT_ACCESS_SECRET` | `config/jwt.ts` | Signs access tokens | **SECRET** | **Yes** — ≥32 chars enforced | configured |
| `JWT_REFRESH_SECRET` | `config/jwt.ts` | Signs refresh tokens | **SECRET** | **Yes** — ≥32 chars, must differ | configured |
| `JWT_ACCESS_EXPIRES_IN` | `config/env.ts` | Access lifetime | SERVER | No (15m) | configured |
| `JWT_REFRESH_EXPIRES_IN` | `config/env.ts` | Refresh lifetime | SERVER | No (7d) | configured |
| `BCRYPT_SALT_ROUNDS` | `utils/password.ts` | Hash cost | SERVER | No (10); ≥10 enforced in prod | configured |
| `SITE_NAME` | `config/env.ts` | SEO | SERVER | **Yes** | configured |
| `SITE_URL` | `config/env.ts`, `cors.ts` | Canonical URL + CORS allow-list | SERVER | **Yes** | configured |
| `FRONTEND_URL` | `config/env.ts`, `cors.ts` | CORS/CSRF allow-list | SERVER | No — **defaults to `http://localhost:5173`** | configured; loopback filtered in production |
| `DEFAULT_OG_IMAGE` | `config/env.ts` | Fallback OG image | SERVER | No | configured |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | `config/env.ts` | Legacy SMTP config | SERVER | No | present but **unused** (Resend HTTPS is used) |
| `SMTP_PASS` | `mail.service.ts` | Fallback for `RESEND_API_KEY` | **SECRET** | Effectively yes | configured |
| `RESEND_API_KEY` | `mail.service.ts` | Mail API key (preferred) | **SECRET** | One of this/`SMTP_PASS` | «NOT VERIFIED» — not in `.env`; `SMTP_PASS` is used |
| `MAIL_FROM` | `config/env.ts` | From address | SERVER | No | configured |
| `OTP_EXPIRY_MINUTES` | `config/env.ts` | OTP lifetime | SERVER | No (5) | configured |
| `CROSS_SITE_COOKIES` | `config/cookies.ts` | Switches SameSite to None | SERVER | No (false) | documented in `.env.example` |
| `CORS_EXTRA_ORIGINS` | `config/cors.ts` | Extra allowed origins | SERVER | No | documented |
| `SEED_ADMIN_PASSWORD` | `server/prisma/seed.ts` | First admin password | **SECRET** | Yes, **for seeding only** | must be set before `pnpm db:seed` |
| `PJ_NO_WATCH` | `server/src/server.ts` | Disables Vite file watcher | SERVER | No | tooling |
| `VITE_API_BASE_URL` | `src/services/api/client.js` | API base path | **PUBLIC** | No (`/api/v1`) | safe — a path, not a secret |
| `VITE_SITE_NAME` | frontend | Display name | **PUBLIC** | No | safe |
| `VITE_USE_MOCK` + 8 per-module flags | `src/services/api/client.js` | Mock switches | **PUBLIC** | No — **all default `false`** | safe |
| `VITE_API_URL` | frontend (one reference) | Legacy | **PUBLIC** | No | «NOT VERIFIED» — not in `.env`; appears in a commented-out line in `Footer.jsx` |

**No secret is `VITE_`-prefixed.** Verified: a scan of `dist/assets/*.js` for connection strings, JWTs and API-key patterns returned nothing.

---

## 18. Security audit

A full hardening pass was performed. Findings are listed with their current state.

### 18.1 Prioritised findings

| ID | Severity | Finding | Location | Impact | Status |
|---|---|---|---|---|---|
| **F-01** | **CRITICAL** | Live production secrets in a file inside commit `05bc537` | `.env.bak-prod-api` | Full database, storage and session-forgery capability for anyone with the repo | **Untracked + `.gitignore` covers `.env.*`. Commit NOT pushed. Secrets still require rotation — see §24.** |
| **F-02** | **CRITICAL** | Plaintext admin password in seed script, in git history | `server/prisma/seed.ts` | Working first factor for `/admin` | **Fixed** — now reads `SEED_ADMIN_PASSWORD`, no default. Value still burned. |
| **F-03** | **CRITICAL** | CORS reflected any origin with credentials | `config/cors.ts` | Any website could read/drive the authenticated admin API | **Fixed** — explicit allow-list; opaque `null` origin rejected; loopback filtered in production |
| **F-04** | **HIGH** | No CSRF protection; `SameSite=None` cookies | `app.ts`, `config/cookies.ts` | Any site could forge admin writes | **Fixed** — Origin/Referer middleware + `SameSite=Lax` |
| **F-05** | **HIGH** | Refresh-token binding defeated by bcrypt's 72-byte truncation | `auth.service.ts` | Rotation/revocation ineffective; stolen token valid 7 days | **Fixed** — SHA-256 + `timingSafeEqual`; reuse drops session. *Empirically proven before fix.* |
| **F-06** | **HIGH** | OTPs generated with `Math.random()` | `utils/otp.ts` | Predictable second factor and reset code | **Fixed** — `crypto.randomInt` |
| **F-07** | **HIGH** | `/auth/reset-password` bypassed the OTP attempt counter | `auth.service.ts` | Account-takeover route unbounded by lockout | **Fixed** — shares `verifyUserOtp` |
| **F-08** | **HIGH** | SVG uploads on brands/collections/exhibitions unsanitised | 3 service files | Stored XSS on the public storage origin | **Fixed** — moved into `fileSecurity.middleware.ts`, covering all upload routes |
| **F-09** | **HIGH** | SVG scrubber namespace-blind (`<s:script>` survived) | `utils/sanitizeSvg.ts` | Scrubber bypass | **Fixed** — namespace-aware; 14/14 payloads stripped in test |
| **F-10** | **HIGH** | `forgot-password` limiter inert (`skipSuccessfulRequests` + always-200) | `config/rateLimit.ts` | Unauthenticated OTP mail-bomb; reset denial | **Fixed** — dedicated `otpRequestLimiter` |
| **F-11** | **HIGH** | Contact-form text unescaped into admin XLSX | `inquiry.service.ts` | Formula injection executing on the admin's machine | **Fixed** — leading formula characters neutralised |
| **F-12** | **HIGH** | OTPs printed to stdout when mail key missing | `mail.service.ts` | Credential in logs | **Fixed** — production refuses instead of degrading |
| **F-13** | **MEDIUM** | Frontend mock mode defaulted ON | `src/services/api/client.js` | A build missing `VITE_USE_MOCK` shipped a login accepting any credentials | **Fixed** — all flags default `false` |
| **F-14** | **MEDIUM** | No role model; `requireAuth` was the whole authorisation system | `schema.prisma` | Any account could do anything | **Partially fixed** — `UserRole` added, `requireAdmin` applied to 5 routes. Collections/exhibitions deletes and SEO writes still AUTH-only. |
| **F-15** | **MEDIUM** | Mass assignment: SEO and SEO-settings validation commented out | `seo.routes.ts`, `seo-settings.routes.ts` | Arbitrary column writes incl. sitemap `slug` | **Fixed** — partial schemas re-enabled |
| **F-16** | **MEDIUM** | SEO settings form sends 9 fields with no columns | `seo-settings.validation.ts` | Silent no-op save | **Mitigated** — schema is `.strict()`, so the failure is loud and named. **The feature still does not exist.** |
| **F-17** | **MEDIUM** | Admin email exposed by public exhibition endpoints | `exhibition.repository.ts` | Target for credential attacks | **Fixed** — `email` removed from the public include |
| **F-18** | **MEDIUM** | Unbounded `?limit=` and unpaginated public lists | exhibitions, brands, collections, blog | Response-size DoS | **Fixed** — clamped to 100; `take: 200` caps |
| **F-19** | **MEDIUM** | Stack traces and Prisma internals in error responses | `error.middleware.ts` | Information disclosure | **Fixed** — mapped codes, generic 500 + log reference |
| **F-20** | **MEDIUM** | No security event logging | — | Attacks leave no trace | **Fixed** — `utils/securityLog.ts`; emails masked |
| **F-21** | **MEDIUM** | XML injection into `sitemap.xml` | `sitemap.generator.ts` | Poisoned sitemap | **Fixed** — escaped |
| **F-22** | **LOW** | `NODE_ENV` defaults to `development` | `config/env.ts` | A deploy omitting it silently loses CSP, Secure cookies, proxy trust | **Open** — see §24 |
| **F-23** | **LOW** | Supabase storage errors relayed verbatim | `storage.service.ts` | Bucket/key disclosure | **Fixed** |
| **F-24** | **LOW** | Multer errors became unlogged 500s | `upload.middleware.ts` | Poor diagnostics | **Fixed** — mapped to 413/400 |
| **F-25** | **LOW** | Unused runtime dependencies | `package.json` | Supply-chain surface | **Fixed** — `bullmq`, `nodemailer`, `express-serve-static-core` removed |
| **F-26** | **LOW** | `xlsx@0.18.5` — final publish of an abandoned package | `package.json` | No patched version exists | **Open** — the injection path through it is closed (F-11) |
| **F-27** | **INFO** | RLS provides no containment for this app | architecture | If `DATABASE_URL` leaks, nothing constrains it | **Open by design** — see §8.2 |

### 18.2 Injection review

| Class | Result |
|---|---|
| SQL injection | **Not present.** The only raw SQL is `dashboard.repository.ts:135`, using `Prisma.sql` tagged-template parameters (`${startDate}`, `${endDate}`, both `Date`). Everything else uses Prisma's typed API. |
| NoSQL injection | Not applicable |
| Command injection | **Not present** — no `child_process` anywhere in `server/src` |
| Template injection | Not present |
| Path traversal | **Structurally impossible** — no filesystem writes; storage keys are server-generated UUIDs |
| SSRF | **No surface** — the single outbound call is a hard-coded literal URL |
| Open redirect | **None** — no `res.redirect` anywhere in `server/src` |
| XSS | Two HTML paths, both sanitised on write (blog HTML, uploaded SVG). All other user data renders as React text. |

### 18.3 Dependency security

No lockfile audit tool was run against a live advisory database, so **no CVE is claimed**. Observations from metadata only:

- `xlsx@0.18.5` — the last npm publish; the package moved off npm and receives no updates there.
- `@types/nodemailer` remains in devDependencies although `nodemailer` was removed. Harmless; a types-only leftover.
- `bootstrap` is imported for CSS only, inside a cascade layer.

---

## 19. Performance audit

Measured facts only.

| Observation | Value | Source |
|---|---|---|
| Production JS bundle | **1,464.9 KB** (single chunk) | `dist/assets/index-CnswpL7L.js` |
| Production CSS bundle | 450.0 KB | `dist/assets/*.css` |
| Code splitting | **None** — 0 uses of `React.lazy` | grep across `src` |
| `public/` total | **18 MB** | `du -sh public` |
| Image files in `public/` | 75 | `find` |
| Largest committed images | 716 KB, 710 KB, 472 KB (brand backgrounds) | `git ls-files` + size |
| `loading="lazy"` | 20 occurrences | grep |
| Vite build warning | "Some chunks are larger than 500 kB" | build output |

**Query patterns**

- Public reads are single queries with nested `include`s — no N+1 loops observed.
- `useSectionContent` caches per page at module scope, so a page with seven CMS-driven sections makes **one** request, not seven.
- `usePublicSettings`, `usePublicBrands`, `usePublicCollections` each fetch independently per page.
- `exhibitionService.findAll` issues `findMany` **and** `count` — two queries per list request.
- No HTTP caching headers are set on API responses; `compression()` is enabled.

**Not measured:** runtime timings, Lighthouse scores, TTFB. No benchmark numbers are invented.

---

## 20. SEO audit

| Item | Status | Evidence |
|---|---|---|
| `sitemap.xml` | **Present**, generated from `seo_pages` | `/api/v1/sitemap.xml` |
| `robots.txt` | **Present**, generated | `/api/v1/robots.txt` |
| `llms.txt` | **Present** (unusual, deliberate) | `/api/v1/llms.txt` |
| Per-page metadata API | **Present** — `/metadata/:slug` | `seo.public.controller.ts` |
| Structured data | **Present** — Organization/Website/Event/Collection builders; BlogPosting on posts; Exhibition JSON-LD | `seo/schemas/`, `BlogPostPage.jsx` |
| Open Graph / Twitter | **Present** in the SEO record and on blog posts | `openGraph.builder.ts`, `twitter.builder.ts` |
| Canonical URLs | **Present** | `canonical.builder.ts` |
| CMS-controlled SEO | **Present** — per-post fields; per-page SEO records in Admin › SEO | §12 |
| **`index.html` metadata** | **Weak** — only `<title>Promise Jewel</title>`. No description, no OG, no canonical in the served HTML. | `index.html` |
| **Social preview cards** | **Broken for crawlers that do not run JS.** All metadata is injected client-side; Facebook/LinkedIn read the served HTML. | `useSeoMeta.js`, `BlogPostPage.jsx` |
| Image `alt` coverage | **22 of 52 `<img>` tags** have an `alt` attribute | grep across `src` |
| Heading hierarchy | «NOT VERIFIED FROM CODEBASE» — not systematically analysed |

**The single most consequential SEO gap:** this is a client-rendered SPA with no pre-rendering. Search engines that execute JavaScript will see the metadata; social crawlers will not.

---

## 21. Deployment / DevOps

| Aspect | Finding |
|---|---|
| Build | `pnpm build` → `vite build && tsc -p server/tsconfig.json` |
| Start | `pnpm start` → `cross-env NODE_ENV=production node server/dist/server.js` |
| Dev | `pnpm dev` → `tsx watch server/src/server.ts` (Vite in middleware mode) |
| Dev (no watcher) | `pnpm dev:preview` → `PJ_NO_WATCH=1` |
| **Schema application** | `pnpm db:push` — **manual only. Not run by build or start.** |
| Seeding | `pnpm db:seed` — manual; now requires `SEED_ADMIN_PASSWORD` |
| **CI/CD** | **None.** No `.github/`, no GitLab/Circle/Jenkins config. |
| **Docker** | **None.** |
| **Host manifest** | **None.** No `render.yaml`, `vercel.json`, `netlify.toml`, `Procfile`. |
| Hosting platform | «NOT VERIFIED FROM CODEBASE» — Render is referenced in comments and in `.env.bak-prod-api`, but nothing in the repo configures it |
| SSL/TLS | Assumed terminated by the host. `trust proxy: 1` is set in production; HSTS is emitted (2 years, includeSubDomains, preload). No application-level HTTP→HTTPS redirect. |
| Domain | `SITE_URL` / `FRONTEND_URL` point at `the.thepromiesjewels.com` |

**The most significant DevOps risk:** because no build or start step runs `prisma db push`, a deploy of a commit that changed the schema will start successfully and then fail at runtime on every request that touches a new column. `error.middleware.ts` now names this case explicitly ("SCHEMA DRIFT") in the log.

---

## 22. Git / source control audit

| Check | Result |
|---|---|
| Tracked `.env*` files | Only `.env.example` (contains no real values) |
| `.env.bak-prod-api` | **Untracked now**, but **present in commit `05bc537` (HEAD)**. That commit is **not pushed** (`main` is 1 ahead of `origin/main`; `origin/main` does not contain the file). |
| `dist/` tracked | No |
| `node_modules/` tracked | No |
| Largest tracked files | 5 images between 366 KB and 716 KB (see §19) |
| `.gitignore` coverage | Good — `node_modules/`, `dist/`, `build/`, `logs/`, `.env`, `.env.*` with `!.env.example`, editor dirs, `coverage/`, `.cache/`, `.vite/` |
| Commits in history | 3 (`224a944`, `f263af3`, `05bc537`) |

---

## 23. Code quality audit

| Severity | Finding |
|---|---|
| **HIGH** | **No tests at all.** No framework installed; `tests/**` is empty. Every change is verified manually. |
| **HIGH** | **No migration history.** `db push` with no migrations means schema changes are unreviewable and unrepeatable across environments. |
| **MEDIUM** | **Mixed formatting discipline in the backend.** `storage.service.ts`, `exhibition.*` and parts of `auth.middleware.ts` use a different indentation and brace style from the rest; some files contain trailing whitespace on blank lines. `prettier` is installed but not enforced by a hook or CI. |
| **MEDIUM** | **Frontend type safety is absent.** `src/` is JavaScript with JSDoc-free components; TypeScript is backend-only. |
| **MEDIUM** | **Pre-existing lint errors: 18.** Chiefly `react-hooks/set-state-in-effect` (the `useEffect(() => { load() }, [load])` pattern, used consistently across admin pages) and three unused imports in `Topbar.jsx`. |
| **MEDIUM** | **Duplicated fallback data.** The 18-frame hero ring array is declared in `heroContent.js`, `AboutPage.jsx`, `Herocircle.jsx`, `GrowthSection.jsx` **and** `page-content.constants.ts`. They must agree by hand. |
| **LOW** | Dead scaffolding: `src/store/slices/`, `tests/**`, `STORAGE_BUCKETS.TEAM`, three unused tables. |
| **LOW** | `validatedQuery()` in `validation.middleware.ts` has no call sites. |
| **LOW** | `README.md` is empty. |
| **INFO** | Separation of concerns is otherwise **good** — the routes→controller→service→repository rule is followed by all 13 modules without exception, and Prisma calls appear only in repositories. |

---

## 24. Recommendations

### Immediate — before the next deploy

1. **Rotate every secret in `.env.bak-prod-api`**: database password, Supabase secret key, both JWT secrets, the Resend key. They are in a local commit and in a file that has been copied between working directories.
2. **Remove the secret from git history.** The commit is unpushed and is the tip, so `git commit --amend --no-edit` after the file was untracked is sufficient. **Do not push before doing this.**
3. **Change the seeded admin password** and set `SEED_ADMIN_PASSWORD`. The old value is in history.
4. **Run `prisma db push` as part of deployment**, or add it to a release step. Otherwise the `role` / `otpAttempts` columns will be missing in any environment that has not had it run manually.
5. **Set `NODE_ENV=production` explicitly on the host** and verify it. Every hardening branch is gated on that exact string (F-22).
6. **Confirm mail delivery works before deploying**, because the token changes force everyone to sign in again, and sign-in requires an emailed code.

### Short term

7. Add a test framework and cover, at minimum: the auth flow, the CMS write path, and the sanitisers. There is currently no automated protection against regression.
8. Apply `requireAdmin` to the remaining destructive routes (collection/exhibition delete, SEO writes) — F-14.
9. Either implement the 9 missing SEO-settings columns or remove those inputs from the form — F-16.
10. Enable RLS on the Supabase tables as defence in depth, accepting that it does not constrain the app's own owner connection.
11. Add `alt` text to the 30 `<img>` tags that lack it.

### Medium term

12. **Code-split the frontend.** A 1.46 MB single bundle is served to every visitor, including the admin panel's code, TipTap and recharts. Route-level `React.lazy` around `/admin/*` and the blog editor would remove most of it from the public path.
13. **Compress and resize `public/images`.** 18 MB of source images with several over 700 KB.
14. Introduce Prisma **migrations** instead of `db push`.
15. Consolidate the duplicated hero-ring arrays into `heroContent.js` alone.
16. Enforce Prettier and the lint rules in CI so backend formatting converges.

### Long term

17. **Pre-render or server-render the public pages.** This is the single change that would most improve SEO and social sharing, both currently limited by client-only rendering.
18. Consider extracting a `sessions` table so refresh tokens can be revoked individually per device.
19. Add error monitoring and log shipping; `securityLog.ts` already emits greppable JSON lines designed for it.

---

## 25. Complete system map

```
                          ┌──────────────────────────────┐
                          │  Browser                     │
                          │  (public visitor OR admin)   │
                          └───────────────┬──────────────┘
                                          │  HTTPS, one origin
                                          ▼
      ╔═══════════════════════════════════════════════════════════════════╗
      ║  SINGLE NODE PROCESS — Express 5   (server/src/server.ts)         ║
      ║                                                                   ║
      ║   ┌─────────────────── security chain (app.ts) ────────────────┐  ║
      ║   │ helmet(CSP,HSTS) → Permissions-Policy → cors(allow-list)   │  ║
      ║   │ → morgan → compression → json(1mb) → static(public)        │  ║
      ║   │ → cookieParser → apiLimiter → normaliseQuery → csrf        │  ║
      ║   └────────────────────────────────────────────────────────────┘  ║
      ║                    │                              │               ║
      ║        ┌───────────▼──────────┐      ┌────────────▼────────────┐  ║
      ║        │  SPA delivery        │      │  REST API  /api/v1      │  ║
      ║        │  prod: dist/ + SPA   │      │  13 modules             │  ║
      ║        │  dev : Vite mw mode  │      │  requireAuth →          │  ║
      ║        └──────────────────────┘      │  requireAdmin →         │  ║
      ║                                      │  validate(zod) →        │  ║
      ║                                      │  service → repository   │  ║
      ║                                      └────────────┬────────────┘  ║
      ╚═══════════════════════════════════════════════════╪═══════════════╝
                                                          │
                    ┌─────────────────────────────────────┼──────────────────┐
                    │                                     │                  │
                    ▼                                     ▼                  ▼
      ┌──────────────────────────┐        ┌────────────────────┐   ┌──────────────────┐
      │  Supabase PostgreSQL     │        │ Supabase Storage   │   │  Resend API      │
      │  via PRISMA              │        │ via supabase-js    │   │  (HTTPS, OTP)    │
      │  DIRECT owner connection │        │ SECRET key         │   │  hard-coded URL  │
      │  → RLS does NOT apply    │        │ 4 public buckets   │   └──────────────────┘
      │  23 models               │        │ brands/collections │
      └──────────────────────────┘        │ exhibitions/cms    │
                                          └────────────────────┘

  CONTENT AUTHORING PATHS
  ───────────────────────
  Admin › Editor (Content/Header/Footer) ──► page_content  ──► every public page
  Admin › Marketing › Blog (TipTap)      ──► blog_posts    ──► /blog, /blog/:slug
  Admin › Management (Brands/Collections/Exhibitions) ──► their own tables
  Admin › Marketing › SEO                ──► seo_pages     ──► sitemap, metadata
  Admin › Settings                       ──► settings      ──► footer, enquiry form
  Public visitor › contact form          ──► inquiries     ──► Admin › Inquiries
  Public visitor › blog comment          ──► blog_comments ──► held for approval
```

---

## 26. Technical dependencies summary

**Runtime (production):** 32 packages — React 19 + react-router 7, Express 5, Prisma 6.16.3, `@supabase/supabase-js`, 11 TipTap packages, bcryptjs, jsonwebtoken, zod, multer, sanitize-html, helmet, cors, express-rate-limit, compression, cookie-parser, morgan, dotenv, gsap, lenis, lucide-react, recharts, bootstrap, xlsx.

**Development:** 25 packages — TypeScript 5.8.3, Vite 8, Tailwind 4, ESLint 10, Prettier 3, tsx, prisma CLI, cross-env, and 12 `@types/*`.

**Single points of external dependency:** Supabase (database **and** storage — one vendor, two critical paths) and Resend (the only route to a login code, because login requires OTP).

---

## 27. Appendix

### A. Verification commands used

```bash
git ls-files | grep -iE "\.env"          # tracked env files
git log --oneline --all -- .env.bak-prod-api
grep -rn "queryRaw\|executeRaw" server/src
grep -rn "child_process\|res.redirect" server/src
grep -rn "@supabase/supabase-js" src      # → no results
grep -rn "dangerouslySetInnerHTML" src
npx tsc -p server/tsconfig.json --noEmit
npx vite build
```

### B. Things explicitly NOT verified from the codebase

- Supabase RLS enablement and policy definitions (dashboard state; no dashboard access).
- Supabase Storage bucket read/write policies (dashboard state).
- The hosting platform, its environment variables and its TLS configuration.
- PostgreSQL server version.
- Any database view, function or trigger created outside `schema.prisma`.
- Whether `RESEND_API_KEY` is set in the production environment (`SMTP_PASS` is used as the fallback locally).
- Whether commit `05bc537` has been pushed to a remote other than the configured `origin` (the configured origin returned "Repository not found" for the credentials available).

### C. Document maintenance

This audit reflects the codebase as of **2026-09-03**. `BRAIN.md` is the living companion document and must be updated with every architectural change; this audit is a point-in-time snapshot and may be regenerated rather than edited.
