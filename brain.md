# BRAIN.md — Promise Jewels

**The single source of truth for this project. Read it before changing anything.**

This file records what *actually exists*, not what was planned. If the code and this file
disagree, the code is right and this file is stale — fix it (see §28).

**Never put a secret value in this file.** Variable names and purposes only.

---

## 1. Project identity

| | |
|---|---|
| **Project** | Promise Jewels — company website + admin panel + API |
| **Client** | Promise Jewels Private Limited (jewellery manufacturer & wholesaler, Surat, Gujarat) |
| **Package** | `promise-jewels` v1.0.0, private, ESM |
| **Purpose** | Public marketing site for a B2B jewellery manufacturer, with an admin panel that lets non-developers edit nearly every word, colour and image on it |
| **Status** | Live. One production database, one production storage account. Security hardening completed 2026-09-02/03. |
| **Repository** | `github.com/Vedsavani-01/The-Promise-Jewels.git` |

### Stack

- **Frontend** React 19 · Vite 8 · Tailwind 4 · react-router-dom 7 · GSAP · TipTap (blog editor)
- **Backend** Express 5 · TypeScript 5.8.3 · Zod · Prisma 6.16.3
- **Database** PostgreSQL hosted by Supabase, reached by **Prisma over a direct connection**
- **Storage** Supabase Storage via `@supabase/supabase-js`, **server-side only**
- **Auth** self-built JWT + email OTP. **Supabase Auth is not used.**
- **Email** Resend HTTPS API
- **Tests** none

---

## 2. Architecture

**One Node process serves everything on one port.** There is no separate frontend host.

```
Browser ──HTTPS──► Express (server/src/app.ts)
                     │
                     ├─ security chain: helmet → Permissions-Policy → cors →
                     │  morgan → compression → json(1mb)/urlencoded(100kb) →
                     │  express.static("public") → cookieParser →
                     │  /api/health → apiLimiter → normaliseQuery → csrfProtection
                     │
                     ├─ /api/v1/*  → 13 modules
                     │              requireAuth → requireAdmin → validate(zod)
                     │              → controller → service → repository → Prisma
                     │
                     └─ everything else → the SPA
                          production : express.static(dist) + index.html fallback
                          development: Vite in middleware mode (HMR on same port)
                     │
                     ├──► Supabase Postgres  (Prisma, owner connection)
                     ├──► Supabase Storage   (secret key, 4 public buckets)
                     └──► Resend API         (OTP email, hard-coded URL)
```

**Three consequences you must keep in mind:**

1. **Public site and admin share one origin.** CORS is not in the normal request path. This is why `SameSite=Lax` cookies are correct and sufficient.
2. **Prisma connects as the database owner.** Supabase **RLS does not apply to this application**. All access control lives in Express middleware and service code. See §7.3.
3. **Every public page has a bundled fallback.** If an API call fails, the page renders the copy shipped in the component. Never remove a fallback.

### The API envelope

Success: `{ success: true, message, data }` — `server/src/utils/ApiResponse.ts`
Failure: `{ success: false, message, errors }` — `server/src/middleware/error.middleware.ts`
The frontend client unwraps `data` and throws on `success: false`.

---

## 3. Repository structure

```
promise-jewels/
├── .env                     LIVE secrets — gitignored, never commit
├── .env.bak-prod-api        LIVE secrets — SEE §19. Do not commit. Do not push HEAD.
├── .env.example             template, safe, tracked
├── BRAIN.md                 ← this file
├── PROJECT_TECHNICAL_AUDIT.md   point-in-time audit (2026-09-03)
├── brain.md                 superseded predecessor; kept for its historical notes
├── README.md                EMPTY
├── index.html               SPA shell (title only — no OG/description)
├── vite.config.js           React + Tailwind plugins; "@" → ./src
├── package.json
├── public/                  18 MB static assets (75 images, fonts, Icons/)
├── dist/                    build output — gitignored
├── tests/                   unit/ integration/ e2e/ — ALL EMPTY (.gitkeep only)
│
├── server/
│   ├── prisma/
│   │   ├── schema.prisma            23 models, 7 enums — NO migrations dir
│   │   ├── seed.ts                  needs SEED_ADMIN_PASSWORD
│   │   └── migrate-custom-sections.ts   one-off, not wired to any script
│   └── src/
│       ├── app.ts                   middleware chain
│       ├── server.ts                port binding, Vite-vs-dist attachment
│       ├── config/                  cookies cors env jwt rateLimit
│       │                            storage.config storage.service supabase.config
│       ├── database/prisma.ts       PrismaClient singleton
│       ├── middleware/              auth authorize csrf error fileSecurity
│       │                            notFound upload validation
│       ├── modules/                 auth blog brands collections dashboard
│       │                            exhibitions inquiries mail media
│       │                            page-content seo seo-settings settings
│       ├── routes/index.ts          the mount table
│       ├── types/express.d.ts       Request.user augmentation
│       └── utils/                   ApiError ApiResponse asyncHandler helpers
│                                    jwt logger otp password sanitizeSvg
│                                    securityLog slugify tokenHash
│
└── src/
    ├── main.jsx
    ├── app/routes/          AppRoutes.jsx  AdminRoutes.jsx  RequireAuth.jsx
    ├── assets/styles/globals.css   theme tokens, .pj-prose article styles
    ├── components/
    │   ├── common/          Navbar Footer BrandTabs SectionHeading SocialIcons
    │   │                    SmoothScroll PageTransition CustomCursor
    │   ├── feedback/        Toast ConfirmDialog EmptyState
    │   ├── forms/           Field.jsx → Input Textarea Select
    │   │                    ColorInput ImageInput NumberInput
    │   ├── layout/          Sidebar Topbar TableToolbar
    │   │                    PageHeroCircle heroContent.js
    │   └── ui/              Button Card Badge Modal DataTable
    │                        GalleryModal StatCard Switch Tabs
    ├── features/            auth blog brands collections dashboard exhibitions
    │                        inquiries media page-content seo settings
    ├── hooks/               useGSAP useReveal
    ├── layouts/             MainLayout (public) · AdminLayout
    ├── lib/gsap.js          GSAP + ScrollTrigger registration
    ├── pages/               Home About Contact Error NotFound
    ├── services/api/client.js   fetch wrapper + mock flags + refresh-on-401
    ├── services/mock/       fixtures
    ├── store/slices/        DEAD scaffolding — no state library installed
    └── utils/               helpers scroll …
```

### Dead / unused — do not build on these

`tests/**` (empty) · `src/store/slices/` (no state lib) · `STORAGE_BUCKETS.TEAM` (unreferenced) ·
tables `team_members`, `cms_pages`, `ActivityLog` (no code reads them) ·
table `section_images` + `media_assets.sectionImages` (feature removed; **table deliberately kept** to avoid a destructive drop) ·
`validatedQuery()` in `validation.middleware.ts` (no call sites) · `README.md` (empty).

---

## 4. Important files

| File | Purpose | Depends on | Notes |
|---|---|---|---|
| `server/src/app.ts` | The whole middleware chain | helmet, cors, rateLimit, csrf, routes | Order matters — see §2 |
| `server/src/server.ts` | Binds the port, then attaches Vite (dev) or `dist` (prod) | `env.NODE_ENV` | Port binds **first** so a slow frontend never blocks the API |
| `server/src/routes/index.ts` | Mount table for all 13 modules | every `*.routes.ts` | The one place to see the API shape |
| `server/src/config/env.ts` | Reads + **validates** env | dotenv | Refuses to boot in prod on short/equal JWT secrets or low bcrypt rounds |
| `server/src/config/cors.ts` | Origin allow-list; exports `ALLOWED_ORIGINS` | env | Rejects the opaque `null` origin; filters loopback in production |
| `server/src/config/cookies.ts` | Auth cookie policy | env | `SameSite=Lax` unless `CROSS_SITE_COOKIES=true` |
| `server/src/middleware/auth.middleware.ts` | Verifies the access token, loads the user **from the DB every request** | jwt utils, prisma | Reads `role` from the DB so revocation is immediate |
| `server/src/middleware/authorize.middleware.ts` | `requireRole` / `requireAdmin` | Prisma `UserRole` | Deny by default |
| `server/src/middleware/csrf.middleware.ts` | Origin/Referer check on non-GET `/api` | `ALLOWED_ORIGINS` | Two public endpoints are exempt |
| `server/src/middleware/fileSecurity.middleware.ts` | Magic-byte type check + SVG scrub | sanitizeSvg | **Replaces `file.buffer`** so no module can store the original |
| `server/src/middleware/validation.middleware.ts` | Zod parse; strips undeclared body keys; `normaliseQuery` | zod | Primary mass-assignment defence |
| `server/src/middleware/error.middleware.ts` | The only place an error becomes a response | ApiError, Prisma | Client gets a sentence, log gets everything |
| `server/src/utils/tokenHash.ts` | SHA-256 + `timingSafeEqual` for refresh tokens | node:crypto | **Never use bcrypt here** — it truncates at 72 bytes |
| `server/src/utils/sanitizeSvg.ts` | Scrubs uploaded SVG | — | Namespace-aware; filters CSS rather than deleting it |
| `server/src/utils/securityLog.ts` | Security events as greppable JSON | logger | Emails masked; never log a credential |
| `server/src/modules/page-content/page-content.constants.ts` | **Declares the entire editable surface of the website** | — | The single most important file in the CMS |
| `server/src/modules/blog/blog.sanitize.ts` | sanitize-html allow-list + embed host list | sanitize-html | `EMBED_HOSTS` is also imported by `app.ts` for CSP `frame-src` |
| `src/services/api/client.js` | fetch wrapper, `credentials:'include'`, refresh-on-401 | — | Holds `USE_MOCK*` flags — **all default false** |
| `src/features/page-content/hooks/usePageContent.js` | `useSectionContent(page, section, fallback)` | client.js | Module-scope cache: one request per page, not per section |
| `src/components/layout/heroContent.js` | Shared hero fallback + ring array | — | Prevents fallback drift across pages |
| `src/components/forms/Field.jsx` | All admin inputs incl. ColorInput/ImageInput/NumberInput | — | `baseInput` sets `w-full`; put widths on a **wrapper**, not the input |

---

## 5. Frontend architecture

**Pattern: feature-first.** `src/features/<name>/{components,hooks,pages,services,store,utils}` plus a `<name>.api.js` at the feature root. Shared, non-feature UI lives in `src/components/`.

**Rendering:** SPA only. No SSR/SSG. `index.html` is a bare shell.

**Layouts**
- `MainLayout` — public: `Navbar` + `<Outlet/>` (+ `SmoothScroll`, `PageTransition`)
- `AdminLayout` — admin: `Sidebar` + `Topbar` + `<Outlet/>`, scoped by `.admin-theme`

**State:** React local state only. **No Redux/Zustand/Jotai is installed.** Cross-component sharing is done with module-scope caches inside hooks (`usePageContent`, `usePublicSettings`, `usePublicBrands`, `usePublicCollections`).

**The three patterns to reuse rather than reinvent**

1. **Editable content** — `useSectionContent(page, section, FALLBACK)`. `FALLBACK` is a module-level constant that doubles as the key list; only keys it declares are read.
2. **Hero** — `PageHeroCircle` with `HERO_BASE` + `ringFrom()` from `heroContent.js`.
3. **Admin data page** — `Card` + `DataTable` + `Modal` + `ConfirmDialog` + `useToast`.

**Animation:** GSAP via `useGSAP(fn, scopeRef, deps)` and `useReveal(ref)`. Never import `gsap` directly — use `src/lib/gsap.js`, which registers ScrollTrigger once.

---

## 6. Backend architecture

**One folder per module**, and the layering is not optional:

```
routes.ts       auth guards, rate limiters, validation, upload middleware
controller.ts   HTTP only — read req, call service, send ApiResponse. No logic.
service.ts      business logic, authorisation decisions, sanitising
repository.ts   Prisma calls ONLY. Nothing else touches Prisma.
validation.ts   Zod schemas
constants.ts    messages, enums
```

All 13 modules follow this. Two structural exceptions worth knowing:

- **brands / collections** export **two** routers: a `publicRouter` (default export, mounted at `/brands`) and an `adminRouter` (named export, mounted at `/admin/brands`).
- **exhibitions** applies `requireAuth` **per route** rather than with a `router.use` barrier. Adding a route there means adding the guard yourself.

**Route ordering rule:** literal segments must be declared **before** parameter segments, or the parameter swallows them (`/comments` before `/:id`, `/public` before `/:page`, `/options` before `/:id`).

**Public-route rule:** a public route must be registered **before** `router.use(requireAuth)`. That is the only thing making it public.

---

## 7. Supabase

### 7.1 Connection architecture

| Path | Mechanism | Credential | Client-side? |
|---|---|---|---|
| Database | **Prisma**, direct Postgres | `DATABASE_URL` / `DIRECT_URL` | No |
| Storage | `@supabase/supabase-js` | `SUPABASE_SECRET_KEY` | No |
| Auth | **not used** | — | — |
| Realtime | **not used** | — | — |

`server/src/config/supabase.config.ts` creates the one client, used only by
`server/src/config/storage.service.ts`.

**There is no Supabase client in `src/`.** Verified: no import, and no key or connection
string appears in the built bundle. Keep it that way — anything `VITE_`-prefixed is public.

### 7.2 Storage buckets

`brands` · `collections` · `exhibitions` · `cms` — all public-read (files render directly
from the Supabase origin, which is why `app.ts` adds that origin to CSP `img-src`).
`team` is declared in `storage.config.ts` and **never used**.

Object keys are server-generated: `sections/<uuid>-<sanitised-original-name>`.
The client-supplied filename never controls the path.

### 7.3 RLS — read this before assuming anything

**Row Level Security does not constrain this application.** Prisma connects as the database
owner over a direct Postgres connection; RLS applies to the PostgREST `anon`/`authenticated`
roles the Supabase JS client uses. Whether RLS is enabled on any table is **NOT VERIFIED
FROM CODEBASE** — it is dashboard state.

Enabling RLS is still worth doing as defence in depth (it would contain a leaked *anon* key),
but it will not stop anything that reaches the DB through this app, and it must never be
treated as a substitute for the middleware guards.

---

## 8. Database

**23 models, 7 enums** — `server/prisma/schema.prisma`. **No migrations directory:** this is
a `prisma db push` project.

### Enums
`UserRole` (ADMIN, EDITOR, VIEWER) · `OtpPurpose` (LOGIN, FORGOT_PASSWORD) ·
`InquiryStatus` (NEW, READ) · `SeoEntityType` · `RobotsPolicy` ·
`SitemapChangeFrequency` · `SchemaType`

### Relationships

```
User (users)
 ├─< brands.createdBy
 ├─< collections.createdBy
 └─< exhibitions.createdBy

brands ──< brand_images
       └─< collections ──< collection_images

exhibitions ──< exhibition_images
            └─< exhibition_sections ──< exhibition_section_fields

blog_posts ──< blog_comments          (onDelete: Cascade)
media_assets ──< section_images       (orphaned feature)
SeoPage >──< SeoTag  via SeoPageTag   (composite PK)

no FK: page_content · inquiries · settings · SeoSettings
unused: cms_pages · team_members · ActivityLog
```

### Tables in active use

| Table | Written by | Key constraint |
|---|---|---|
| `users` | auth only | `email` unique |
| `brands` / `brand_images` | admin | `slug` |
| `collections` / `collection_images` | admin | `slug`, `brandId` FK |
| `exhibitions` (+ images, sections, section_fields) | admin | `slug` |
| `inquiries` | **public** contact form | soft delete via `deletedAt` |
| `settings` | admin (ADMIN role) | single row |
| **`page_content`** | admin CMS | **unique(page, section, field)** |
| `media_assets` | admin upload | |
| `blog_posts` | admin | `slug` unique |
| `blog_comments` | **public** submit, admin moderate | cascade from post |
| `seo_pages` / `seo_settings` / `seo_tags` / `seo_page_tags` | admin | |

Indexes: `page_content(page)`, `blog_posts(status, publishedAt)`, `blog_posts(slug)`,
`blog_comments(postId, status)`, `blog_comments(status, createdAt)`,
`exhibition_sections(exhibitionId)`, `exhibition_section_fields(sectionId)`.

**No views, functions or triggers are declared in the schema.** Anything created directly in
the database is NOT VERIFIED FROM CODEBASE.

---

## 9. API registry

All under `/api/v1` unless noted. **AUTH** = `requireAuth`; **ADMIN** = also `requireAdmin`.

### auth
| Method | Path | Auth | Limiter |
|---|---|---|---|
| POST | `/auth/login` | public | authLimiter 10/15m |
| POST | `/auth/forgot-password` | public | otpRequestLimiter 5/15m |
| POST | `/auth/verify-otp` | public | authLimiter |
| POST | `/auth/reset-password` | public | authLimiter |
| GET | `/auth/me` | AUTH | |
| POST | `/auth/refresh` | refresh cookie | |
| POST | `/auth/logout` | AUTH | |

### blog
| Method | Path | Auth |
|---|---|---|
| GET | `/blog/public` | public |
| GET | `/blog/public/:slug` | public |
| POST | `/blog/public/:slug/comments` | public (5/10m, honeypot, CSRF-exempt) |
| GET | `/blog/comments` | AUTH |
| PUT | `/blog/comments/:id` | AUTH |
| DELETE | `/blog/comments/:id` | **ADMIN** |
| GET · POST | `/blog` | AUTH |
| GET · PUT | `/blog/:id` | AUTH |
| DELETE | `/blog/:id` | **ADMIN** |

### brands · collections
| Method | Path | Auth |
|---|---|---|
| GET | `/brands` · `/brands/:slug` | public |
| GET | `/collections` · `/collections/:slug` | public |
| GET | `/admin/brands` · `/options` · `/:id` | AUTH |
| POST · PUT | `/admin/brands` · `/admin/brands/:id` | AUTH (multipart) |
| PATCH | `/admin/brands/reorder` · `/:id/status` | AUTH |
| DELETE | `/admin/brands/:id` · `/:id/images/:imageId` | **ADMIN** |
| GET | `/admin/collections` · `/:id` | AUTH |
| POST · PUT | `/admin/collections` · `/:id` | AUTH (multipart) |
| PATCH | `/admin/collections/reorder` · `/:id/status` · `/:id/featured` · `/:id/images/:imageId/thumbnail` | AUTH |
| DELETE | `/admin/collections/:id` · `/:id/images/:imageId` | AUTH |

### exhibitions (per-route guards)
| Method | Path | Auth |
|---|---|---|
| GET | `/exhibitions` · `/search` · `/:slug` · `/:id/gallery` | public |
| POST · PATCH · DELETE | `/exhibitions` · `/:id` | AUTH |
| POST | `/exhibitions/:id/gallery` · `/:id/thumbnail` | AUTH (upload) |
| DELETE | `/exhibitions/gallery/:imageId` | AUTH |

### the rest
| Method | Path | Auth |
|---|---|---|
| POST | `/inquiries/contact` | public (5/10m, CSRF-exempt) |
| GET | `/inquiries` · `/export` · `/:id` | AUTH |
| PATCH | `/inquiries/:id/status` | AUTH |
| DELETE | `/inquiries/:id` | AUTH (soft) |
| GET | `/settings/public` | public |
| GET | `/settings` | AUTH |
| PUT | `/settings` | **ADMIN** |
| PUT | `/settings/password` | AUTH (own only) |
| GET | `/page-content/public/:page` | public |
| GET | `/page-content/pages` · `/:page` | AUTH |
| PUT | `/page-content/:page` | AUTH |
| GET · POST | `/media/assets` | AUTH (upload 30/min) |
| DELETE | `/media/assets/:id` | AUTH |
| GET | `/seo` · `/seo/:id` | AUTH |
| PATCH | `/seo/:id` | AUTH |
| GET · PATCH | `/seo-settings` | AUTH |
| GET | `/dashboard` | AUTH |
| GET | `/sitemap.xml` · `/robots.txt` · `/llms.txt` · `/metadata/:slug` | public |
| GET | `/api/health` | public (not under /v1) |

**No webhooks. No edge functions. One outbound call: `https://api.resend.com/emails`.**

---

## 10. Authentication

**Two-step: password, then an emailed six-digit code. Supabase Auth is not involved.**

```
POST /auth/login {email,password}
   bcrypt compare ALWAYS runs (even for an unknown email — timing equalised
   against a dummy hash). Unknown / wrong / disabled all return the SAME 401.
        ↓
   crypto.randomInt six-digit OTP → bcrypt-hashed into users.otpCode
   expiry = OTP_EXPIRY_MINUTES, otpAttempts reset to 0
        ↓
   Resend → inbox.  Response is 200 "OTP sent" — NO session yet.

POST /auth/verify-otp {email,otp}
   purpose + expiry + attempt count checked
   wrong code → otpAttempts++ ; 5 wrong → code DESTROYED
        ↓
   access JWT 15m + refresh JWT 7d
   refresh token SHA-256 → users.refreshTokenHash
        ↓
   Set-Cookie: HttpOnly, Secure(prod), SameSite=Lax, path=/
```

**Tokens:** HS256 **pinned**, issuer `promise-jewels-api`, audience
`promise-jewels-access` / `promise-jewels-refresh`, all verified on every check.
**Cookies only** — never `localStorage`, `sessionStorage` or a URL.
(`sessionStorage` appears in `features/auth/auth.api.js` only on the mock branch.)

**Refresh:** rotates on every use. A valid-but-not-current refresh token is treated as
reuse and **drops the whole session**.

**Reset:** `forgot-password` always returns 200 (no enumeration) → OTP → `reset-password`
uses the **same** `verifyUserOtp` helper, so the lockout applies. On success the password is
re-hashed, the OTP cleared and **all refresh tokens cleared**.

**Email verification as a separate flow: not implemented.** `users.isOtpVerified` exists but
gates nothing.

---

## 11. Authorization

| | |
|---|---|
| Roles | `ADMIN`, `EDITOR`, `VIEWER` — **every existing account is ADMIN** |
| Source of truth | `users.role`, read **from the database on every request** — never from the JWT, so revocation is immediate |
| Guards | `requireAuth` (session) then `requireRole(...)` / `requireAdmin` |
| Default | **Deny** — a missing or unknown role fails |
| Frontend `RequireAuth` | **UX only.** Never treat it as a security boundary. |

`requireAdmin` is currently on: `DELETE /blog/:id`, `DELETE /blog/comments/:id`,
`DELETE /admin/brands/:id`, `DELETE /admin/brands/:id/images/:imageId`, `PUT /settings`.

**Not yet on** collection/exhibition deletes or SEO writes — see §19.

**Ownership:** admin records are organisation-wide; there is no per-user ownership model, so
there is no IDOR surface. The one identity-bound call, `PUT /settings/password`, takes the
user id from `req.user` and never from the body.

---

## 12. Admin panel

Base `/admin`, wrapped in `RequireAuth` → `AdminLayout`. Sidebar groups:

**Management** — Collections · Brands · Exhibitions · Inquiries
**Editor** — Content · Header · Footer
**Marketing** — Blog · SEO
**Settings**

| Route | Page | APIs | Tables |
|---|---|---|---|
| `/admin/login` | LoginPage | `/auth/login`, `/auth/verify-otp` | users |
| `/admin/dashboard` | DashboardPage | `/dashboard` | aggregates |
| `/admin/collections` | CollectionsPage | `/admin/collections/*` | collections(+images) |
| `/admin/brands` | BrandsPage | `/admin/brands/*` | brands(+images) |
| `/admin/exhibitions` | ExhibitionsPage | `/exhibitions/*` | exhibitions(+children) |
| `/admin/inquiries` | InquiriesPage | `/inquiries/*` | inquiries |
| `/admin/editor` | EditorPage (`area="page"`) | `/page-content/*` | page_content |
| `/admin/header` | HeaderPage (`area="header"`) | `/page-content/header` | page_content |
| `/admin/footer` | FooterPage (`area="footer"`) | `/page-content/footer` | page_content |
| `/admin/blog` | BlogPage | `/blog/*` | blog_posts, blog_comments |
| `/admin/seo` | SeoPage | `/seo/*`, `/seo-settings` | seo_pages, seo_settings |
| `/admin/settings` | SettingsPage | `/settings/*` | settings, users |

`HeaderPage` and `FooterPage` are thin wrappers around the **same** `EditorPage` component,
differing only by the `area` prop. `EditorPage` filters the page list by `area` and hides the
tab bar when there is only one entry.

---

## 13. Website (public routes)

| Route | Page | CMS tab |
|---|---|---|
| `/` | Home | Home page |
| `/AboutPage` | About | About page |
| `/our-brand` | OurBrandsPage | Brands page |
| `/our-collection` | OurCollectionPage | Collections page |
| `/our-collection/:categoryId` | CollectionDetailsPage | (record) |
| `/contact` | ContactPage | Contact page |
| `/Exhibition` | ExhibitionPage | Exhibitions page |
| `/Exhibition/:slug` | ExhibitionDetailPage | (record) |
| `/blog` | BlogListPage | Blog page |
| `/blog/:slug` | BlogPostPage | (per post) |

**Route spellings are deliberate and load-bearing** — `/AboutPage` and `/Exhibition` are
capitalised. `Navbar.jsx` and `Footer.jsx` link to these exact strings. Changing a route means
changing both.

Header and footer appear on every page and are edited under Editor › Header / Footer.

---

## 14. Website editor / CMS

> **The order of a page and its designed sections are documented separately,
> in [PAGE-BUILDER.md](PAGE-BUILDER.md).** This section covers what a page
> *says*; that one covers what a page *is made of* — which bands appear, in
> what order, and the ones an admin built in the panel rather than a
> developer in code.

**This is the heart of the product. Understand it before touching content code.**

### How it works

The editable surface is **declared in one server file**:
`server/src/modules/page-content/page-content.constants.ts` → `CONTENT_PAGES`.

```ts
ContentPage   { key, label, path, sections[], area? }
ContentSection{ key, label, description, fields[], manage? }
ContentField  { key, label, type, default, group?, hint?, max, min?, ceiling?, unit? }
```

Storage is one generic table:

```
page_content ( id, page, section, field, value, updatedAt )
               UNIQUE (page, section, field)
```

**Only overrides are stored.** A value equal to its declared `default` is **deleted**, not
saved. So: the table stays tiny, "reset to original" is a delete, and an empty table renders
the site exactly as designed.

### Field types

| type | Editor control | Server check |
|---|---|---|
| `text` / `textarea` | input / textarea | length ≤ `max` |
| `color` | picker + hex box + **17-swatch brand palette** | `/^#[0-9a-fA-F]{6}$/` |
| `image` | thumbnail + Replace/Reset | `/path` or `https://…` |
| `svg` | thumbnail on checkerboard | as image **and** must end `.svg` |
| `number` | **slider + number box + unit** | finite, within `min`…`ceiling` |

A section may declare `manage: { label, path }` instead of fields — it then renders a **link
to the admin screen that owns that content** (brand rows, collection tiles, exhibition
listings, contact details, blog posts). This is how the CMS avoids duplicating records.

### Colour convention (Home page, 2026-09-07)

**A colour belongs to one piece of copy and is declared immediately after it.** Two builders
in `page-content.constants.ts` enforce the shape:

| Builder | Produces | Use for |
|---|---|---|
| `tint(key, label, value, group?, hint?)` | `${key}Color` | text the design paints in one flat shade |
| `fade(key, label, from, to, group?)` | `${key}Color` + `${key}ColorTo` | text clipped to a top-to-bottom gradient |

The key is always the text field's own key with `Color` appended, and both fields carry the
text field's `group`, so the Editor's two-column grid puts the colour beside (or directly
under) the words it tints.

**Three rules that are easy to get wrong:**

1. **The component's fallback object must list every colour key.** `useSectionContent`
   treats the fallback as the list of keys it will read — a colour missing from it never
   reaches the component, and the field silently does nothing in the panel.
2. **Do not pass a key that already ends in `Color`** to `tint` — you get `fooColorColor`.
3. **Decoration is not copy.** Hairlines, scrims, card borders and hover fills are drawn from
   `src/pages/Home/homeChrome.js` (`CHROME`), spread onto each section's root element and
   read through the `--pj-*` variables the existing classes already name. They are
   deliberately **not** in the Editor.

### Editable surface

| Screen | Sections | Fields | Images |
|---|---|---|---|
| Home page | 7 | 165 | 63 |
| About page | 5 | 121 | 54 |
| Collections page | 5 | 63 | 38 |
| Brands page | 3 | 28 | 18 |
| Exhibitions page | 6 | 71 | 19 |
| Contact page | 2 | 37 | 19 |
| Blog page | 2 | hero + link | ring |
| Header | 2 | 13 | — |
| Footer | 3 | 23 | 1 SVG |

The footer's scrolling line also exposes **animation controls** — loop seconds (4–240) and
hover slow-down (0–100 %).

### Data flow

```
Admin types in EditorPage
   │ posts the WHOLE page: { section: { field: value } }
   ▼
PUT /api/v1/page-content/:page
   csrf → requireAuth → validate(shape)
   ▼
page-content.service.update()
   unknown section/field → 404
   length / color / image / svg / number checks → COLLECTED, not thrown one at a time
   value === "" or === default → DELETE the row
   otherwise → UPSERT
   any violations → 400 { errors: { fieldErrors: { "section.field": [msg] } } }
   ▼
page_content
   ▼
GET /api/v1/page-content/public/:page   (public, values only — no labels, no schema)
   ▼
useSectionContent(page, section, FALLBACK)   module-scope cache
   ▼
merged over the component's bundled fallback → rendered
```

### CMS security

- Public read returns **values only**. The schema and labels require auth.
- Only declared `(section, field)` pairs are accepted — anything else is a 404.
- **The CMS stores no HTML.** Values render as React text or CSS values, so there is no XSS
  sink here. Colours are hex-only because they reach `style`; image/svg values are
  path-or-https because they reach `src`.
- **No draft/publish, no versioning, no autosave, no preview mode.** A save is live
  immediately. There is an "Undo changes" button that discards unsaved edits only.

### The blog editor — the one place HTML is stored

`src/features/blog/components/RichTextEditor.jsx` (TipTap) writes HTML into
`blog_posts.content`.

- **Sanitised on WRITE** (`blog.sanitize.ts`), never on read — so the stored column is
  already safe and anything reading it can trust it.
- `<iframe>` allowed **only** from the 11 hosts in `EMBED_HOSTS`. That same array is imported
  by `app.ts` to build CSP `frame-src`, so the two can never disagree.
- Links are rewritten `target="_blank" rel="noopener noreferrer nofollow"`.
- Rendered with `dangerouslySetInnerHTML` — acceptable **only because** of the write-time
  sanitising.
- **Comments are plain text.** All markup is stripped on the way in and they render as text.

---

## 15. Data flow (key workflows)

**Admin login**
`LoginPage → POST /auth/login → (password ok) → OTP emailed → POST /auth/verify-otp → cookies set → useAuth loads /auth/me → RequireAuth admits → /admin/dashboard`

**Editing website content** — see §14.

**Publishing a blog post**
`BlogPage → RichTextEditor (HTML) → POST/PUT /blog → sanitizePostHtml → blog_posts (status=published, publishedAt stamped) → /blog and /blog/:slug`

**Image upload (any module)**
`file picked → multer memoryStorage → fileFilter (declared type) → verifyUploads (magic bytes, declared must equal actual, SVG scrubbed and buffer REPLACED) → service → storageService.uploadFile(bucket, "sections/<uuid>-<name>") → getPublicUrl → URL saved in the owning table`

**Public content retrieval**
`page mounts → useSectionContent(page, section, FALLBACK) → cached GET /page-content/public/:page → merge over fallback → render (fallback survives any failure)`

**Contact enquiry**
`InquiryForm → POST /inquiries/contact (rate-limited, CSRF-exempt, Zod-validated) → inquiries row → Admin › Inquiries → optional XLSX export (formula characters neutralised)`

**Blog comment**
`CommentSection → POST /blog/public/:slug/comments → honeypot check → plain-text stripped → status "pending" → invisible until an admin approves`

**Logout / session end**
`POST /auth/logout → refreshTokenHash cleared → cookies cleared. The access token remains cryptographically valid until it expires (≤15 min) — this is a known, accepted window.`

---

## 16. Environment variables

**Names and purposes only. Never record a value here.**

**Secrets (server-only):** `DATABASE_URL` · `DIRECT_URL` · `SUPABASE_SECRET_KEY` ·
`JWT_ACCESS_SECRET` · `JWT_REFRESH_SECRET` · `SMTP_PASS` / `RESEND_API_KEY` ·
`SEED_ADMIN_PASSWORD`

**Server config:** `NODE_ENV` · `PORT` · `SUPABASE_URL` · `SITE_NAME` · `SITE_URL` ·
`FRONTEND_URL` · `DEFAULT_OG_IMAGE` · `JWT_ACCESS_EXPIRES_IN` · `JWT_REFRESH_EXPIRES_IN` ·
`BCRYPT_SALT_ROUNDS` · `OTP_EXPIRY_MINUTES` · `MAIL_FROM` · `SMTP_HOST` · `SMTP_PORT` ·
`SMTP_USER` · `CROSS_SITE_COOKIES` · `CORS_EXTRA_ORIGINS` · `PJ_NO_WATCH`

**Public (reaches the browser — safe by design):** `VITE_API_BASE_URL` · `VITE_SITE_NAME` ·
`VITE_USE_MOCK` and the eight per-module `VITE_USE_MOCK_*` flags.

**Boot-time validation** (`config/env.ts`): required variables are enforced; JWT secrets must
be ≥32 characters **and different from each other**; `BCRYPT_SALT_ROUNDS` ≥10 in production.
The app refuses to start in production if any of these fail.

**Rule: no secret may ever carry a `VITE_` prefix.** Vite inlines every `VITE_*` variable into
the browser bundle.

---

## 17. External integrations

| Service | Purpose | How | Env |
|---|---|---|---|
| Supabase Postgres | Database | Prisma, direct connection | `DATABASE_URL`, `DIRECT_URL` |
| Supabase Storage | Images/files | `@supabase/supabase-js`, server-side | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` |
| Resend | OTP email | plain `fetch` to a hard-coded URL | `RESEND_API_KEY` or `SMTP_PASS` |

**That is the complete list.** No analytics, maps, payments, CRM, WhatsApp, social APIs, CDN
or error monitoring is integrated. The SEO settings form shows inputs for Google Analytics,
GTM, Facebook Pixel and verification tokens, but **no columns and no code exist for them** —
see §19.

---

## 18. Security rules

These are constraints, not preferences.

1. **Never widen CORS.** `origin: true` with `credentials: true` was a critical vulnerability
   here. Add origins to the allow-list in `config/cors.ts` (or `CORS_EXTRA_ORIGINS`), and
   never reflect an arbitrary origin. The opaque `null` origin must always be refused.
2. **Never remove the CSRF middleware** or add an exemption without a written reason. The two
   existing exemptions are public, unprivileged writes.
3. **Never use bcrypt on a token.** It truncates at 72 bytes; a JWT's first 72 bytes are
   identical for every token issued to a user. Use `utils/tokenHash.ts`. Passwords keep
   bcrypt — that distinction is the point.
4. **Never generate a credential with `Math.random()`.** Use `node:crypto`.
5. **Sanitise on WRITE, not on read.** Blog HTML and uploaded SVG are cleaned before storage,
   so every reader can trust the column.
6. **Never trust `file.mimetype`.** It is a client claim. `fileSecurity.middleware.ts` reads
   the bytes; keep every upload route behind it.
7. **Never log a credential** — no password, OTP, token or cookie. Use `securityLog.ts`,
   which masks emails.
8. **Validate on the server, always.** `validate(zodSchema)` strips undeclared keys — that is
   the mass-assignment defence. Never pass `req.body` straight into Prisma.
9. **Do not rely on Supabase RLS.** It does not apply to this app (§7.3).
10. **Never put a secret behind a `VITE_` prefix.**
11. **Frontend guards are UX.** Every rule must also exist on the server.
12. **Do not disable a hardening branch to make something work locally.** Set `NODE_ENV`
    correctly instead.

---

## 19. Known issues

Re-verified against the source on **2026-09-07**. Six entries in the previous list were
stale — the fix was already in the code, or the number was measured wrongly — and are
recorded under "Closed" below rather than deleted, because a reader who has seen the old
list needs to know they were checked rather than dropped.

**Confirmed, open:**

| # | Issue | Where |
|---|---|---|
| 1 | **Secrets in commit `05bc537`.** `.env.bak-prod-api` is untracked now, but the commit still contains it — re-confirmed 2026-09-07 with `git log --all --name-only`. It is **NOT pushed** (`git log origin/main..HEAD` shows it still local). All values need rotating regardless. | git history |
| 2 | **No migration runs on deploy.** `db push` is manual; `build`/`start` do not call it. A schema change deployed without it fails at runtime. `error.middleware.ts` logs "SCHEMA DRIFT" (P2022) to make it diagnosable. | `package.json` |
| 3 | **No tests at all.** `tests/**` holds three `.gitkeep` files and nothing else; no framework installed. | `tests/` |
| 4 | `NODE_ENV` still defaults to `development`, so a deploy that omits it silently loses CSP, Secure cookies and proxy trust. The new boot check (§8.3 of SECURITY.md) does **not** close this: it only runs *when* `NODE_ENV` is production, so it cannot catch the case where the variable is missing. | `config/env.ts` |
| 7 | **Social preview cards are broken for crawlers that don't run JS.** All metadata is injected client-side. Needs pre-rendering. | SPA architecture |
| 8 | Single ~1.46 MB JS bundle; no code splitting. No `React.lazy` anywhere in `src/`, no `manualChunks` in `vite.config.js`. | build output |
| 9 | 18 MB of images in `public/`, several >700 KB, committed. | `public/` |
| 12 | **13 lint errors remain**, all of them structural rather than mechanical: 10 × `react-hooks/set-state-in-effect` (one consistent pattern across the admin pages — changing it changes render behaviour) and 3 × `react-refresh/only-export-components` (each needs a file split). The 6 unused-variable errors are fixed; the 21 errors ESLint was reporting inside `server/dist/` were generated code and are now ignored. | `src/` |
| 14 | **19 colour fields outside the Home page are declared but never applied.** An admin sets one, saves, and nothing changes — the component lists the key in its fallback object (so the value is fetched) and then never reads it. About page 7 (`growth.ctaFromColor`, `growth.ctaToColor`, `values.bodyColor`, `leaders.headingColor`, `leaders.roleColor`, `leaders.bodyColor`, `gallery.headingColor`), Collections/Brands/Exhibitions 2 each (`listing.headingColor`, `listing.introColor`), Contact 2 (`details.headingColor`, `details.detailColor`), Header 2 (`bar.linkColor`, `bar.linkHoverColor`), Footer 2 (`band.linkColor`, `ticker.itemColor`). The Home page was cleared of these on 2026-09-07 (§23); these pages were out of scope for that change. Each is either wired up or deleted — leaving a control that does nothing is the worst of the three. | `src/pages/**`, `src/components/common/**` |
| 13 | **`@tiptap/*` was imported but never declared.** Nine packages were missing from `package.json` — the blog editor could not resolve at all on a clean install. Added at 3.31.3 on 2026-09-07. Recorded here because it means `pnpm-lock.yaml` was out of step with the imports, and nothing in the build catches that class of drift. | `package.json` |

**Closed on re-verification (2026-09-07) — no code change was needed:**

| # | Old claim | What the source actually shows |
|---|---|---|
| 5 | `requireAdmin` missing on collection/exhibition deletes and SEO writes | Present on all of them — `collection.routes.ts:67`, `brand.routes.ts:65`, `exhibition.routes.ts:49,116`, `seo.routes.ts:20`, `seo-settings.routes.ts:16`, `settings.routes.ts:35`, `inquiry.routes.ts:72`, `media.routes.ts:30`, `blog.routes.ts:74,81` |
| 6 | SEO settings form sends 9 fields with no columns | The form now renders exactly the six fields the `SeoSettings` model has. The orphan fields are gone from `SeoPage.jsx` |
| 10 | "22 of 52 `<img>` tags have `alt`" | All **55** have it. The original figure came from a same-line `grep`, which cannot see an `alt` on a wrapped JSX tag |
| 11 | `xlsx@0.18.5` abandoned | `package.json` already points at the SheetJS CDN tarball and the installed version is **0.20.3**, which is ahead of npm's final 0.18.5 |

**Sessions are invalidated again** by the refresh-token hashing fix of 2026-09-07 (§23):
every stored `refreshTokenHash` is a bcrypt digest and the comparison is now SHA-256, so no
existing refresh token can match. Everyone must sign in again. Since sign-in needs an
emailed code, **verify mail delivery before deploying**.

---

## 20. Technical debt

- **No tests, no CI, no migrations.** These three together mean every change is verified by
  hand and every schema change is unrepeatable.
- **Duplicated hero-ring array** in five places (`heroContent.js`, `AboutPage.jsx`,
  `Herocircle.jsx`, `GrowthSection.jsx`, `page-content.constants.ts`). They must agree by hand.
- **Backend formatting is inconsistent** — `storage.service.ts`, the exhibitions module and
  parts of `auth.middleware.ts` use a different style. Prettier is installed but not enforced.
- **Frontend has no type safety** (JS, not TS).
- **Dead scaffolding:** `src/store/slices/`, `tests/**`, `STORAGE_BUCKETS.TEAM`,
  `validatedQuery()`, tables `team_members` / `cms_pages` / `ActivityLog`.
- **`section_images` is orphaned** — the feature was removed, the table deliberately kept to
  avoid a destructive drop. Do not build on it; do not drop it without asking.

---

## 21. Deployment

| | |
|---|---|
| Build | `pnpm build` → `vite build && tsc -p server/tsconfig.json` |
| Start | `pnpm start` → `NODE_ENV=production node server/dist/server.js` |
| Dev | `pnpm dev` (Vite middleware + HMR) · `pnpm dev:preview` (no file watcher) |
| Schema | `pnpm db:push` — **manual, not in any deploy step** |
| Seed | `pnpm db:seed` — requires `SEED_ADMIN_PASSWORD` |
| CI/CD | **none** |
| Docker | **none** |
| Host | **Hostinger Business shared hosting (CloudLinux)**, hPanel > Websites > thepromisejewels.com > Node.js. Account `u171276989`, order `1009821505`, doc root `/home/u171276989/domains/thepromisejewels.com/public_html`. Verified live 2026-09-07. |

### Hostinger settings that must stay as they are

| Setting | Value | Why |
|---|---|---|
| Node version | **22** | Driven by `engines.node` in package.json. `@supabase/supabase-js` and `sanitize-html` both require >=22; with `>=20` the panel picked 20.19.4 and installed them on an unsupported engine. |
| Package manager | **npm** | **pnpm is not available on the build image** — corepack cannot fetch it and the build dies with `Cannot find module .../pnpm.cjs`. See the lockfile note below. |
| Build script | `build` | `prisma generate && vite build && tsc -p server/tsconfig.json` |
| Entry file | `server/dist/server.js` | Taken from `main` in package.json. Without `main` the panel guesses `server.js`, which does not exist, and the app never starts. |
| Root / output directory | *(blank)* | One Express process serves the API and `dist/`. Pointing the doc root at `dist` would bypass the app. |
| Environment variables | hPanel, **not** `.env` | `.env` is gitignored and is not in the deploy archive. |

### Two lockfiles — read this before touching dependencies

The repo carries **both** `pnpm-lock.yaml` (local development) and `package-lock.json`
(production, because the host only has npm). They can drift, and the drift is invisible until
a deploy breaks.

- The transitive security pins live in **two places that must agree**:
  `pnpm-workspace.yaml > overrides` (pnpm reads it, npm ignores it) and
  `package.json > overrides` (npm reads it, pnpm ignores it). Change one, change the other.
  `qs` is pinned >=6.16.0 for GHSA-4mjr-xmp4-gh2g; verify it survived with
  `node -e "console.log(require('./package-lock.json').packages['node_modules/qs'].version)"`.
- **pnpm's nested `node_modules` hides bugs that npm's flat one exposes.** A dependency
  `express-serve-static-core@0.1.1` — a stub whose own `typings` field shadows
  `@types/express-serve-static-core` — sat in `dependencies` for months. Under pnpm nothing
  noticed; under npm every Express type vanished and `tsc` failed with ~40
  `Property 'body' does not exist on type 'Request'` errors. It was removed 2026-09-07.
  To reproduce a host build locally, install into a clean directory with npm, not pnpm.

**Deploy checklist**
1. `NODE_ENV=production` is set on the host.
2. All required env vars present (boot fails loudly otherwise — see below).
3. `pnpm db:push` has been run against that environment.
4. Mail delivery verified — sign-in needs it, and the key is `SMTP_PASS` (used as the Resend
   API key, see `mail.service.ts`). Without it OTP emails are only logged and **nobody can
   sign in.**
5. Upload a source-only archive (no `node_modules`, no `dist`, no `.env`); the host runs
   install + build itself.

**Required env vars** — the boot throws on the first one missing:
`DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `SITE_NAME`, `SITE_URL`. In production `assertProductionConfig()`
additionally refuses to start on a JWT secret under 32 chars, on the two being identical, or
on bcrypt rounds below 10.

**Deploy checklist**
1. `NODE_ENV=production` is set on the host.
2. All required env vars present (boot fails loudly otherwise).
3. `pnpm db:push` has been run against that environment.
4. Mail delivery verified — sign-in needs it.
5. `pnpm build`, then `pnpm start`.

**In production the server serves `dist/`.** A frontend change is not live until
`vite build` has been re-run. This catches people out constantly.

---

## 22. Development rules

1. **Do exactly what was asked.** No opportunistic renaming, tidying, restructuring,
   reformatting or package upgrades.
2. **Never change the database schema on your own.** `schema.prisma` points at the client's
   **live** database. Ask first. When approved, prefer an additive nullable column — never a
   rename, never a drop.
3. **Never delete data or files to "clean up".** Test-looking rows (`DEV`, `Test Collection`)
   are the client's data. Say they look like test data; do not remove them.
4. **Never touch `.env`, the API base URL or the Supabase keys** unless asked.
5. **Never remove a fallback.** Public pages must survive an API outage.
6. **Follow the existing architecture.** Backend: routes → controller → service → repository,
   Prisma only in repositories. Frontend: feature-first, reuse the three patterns in §5.
7. **Do not create a duplicate API.** Check §9 first.
8. **Do not bypass authorization.** Server-side guard or it does not exist.
9. **Sanitise anything that becomes HTML**, on write.
10. **Validate every admin input** with a Zod schema on the route.
11. **Do not disable Supabase RLS** — and do not assume it protects anything (§7.3).
12. **Never expose secrets**; never add a `VITE_` prefix to one.
13. **Verify in the browser before reporting done.** `vite build`, load the page, check the
    console and the network tab.
14. **Update this file** after any architectural change (§28).

### Traps already hit here — do not re-introduce

- **`baseInput` sets `w-full`.** Putting `w-20` on the same element does nothing (stylesheet
  order wins). Put the width on a wrapper.
- **Express 5 `req.query` is a getter.** `Object.assign(req.query, …)` is silently discarded.
- **`req.path` inside `app.use("/api", …)` is mount-relative.** Use `req.originalUrl` for
  full-path matching.
- **Tailwind `opacity-*` on a parent** fades its children too. To fade only the parent's own
  text, use an alpha colour instead.
- **Bootstrap ships `!important` utilities** in a cascade layer. `.opacity-0` there beats
  inline styles GSAP writes — use arbitrary values like `[opacity:0]`.
- **Literal route segments must precede parameter segments.**
- **Route capitalisation is load-bearing** (`/AboutPage`, `/Exhibition`).
- **`lucide-react` does not export `Youtube`** in the installed version.

---

## 23. Change log

### 2026-09-13 — Supabase keep-alive

A free-tier Supabase project pauses after ~7 days with no database activity,
and restoring it is a manual dashboard click. Two independent layers now
prevent it. Setup in [supabase/README.md](supabase/README.md).

**The catch that makes this non-obvious:** `/api/health` deliberately
touches nothing — a health check that reports internals is reconnaissance,
and that is the right design. It also means pinging it keeps the APP warm
while the DATABASE still goes to sleep. Supabase counts database activity,
so both layers run a real query: `SELECT 1 FROM settings LIMIT 1`.

- **Layer 1** — `server/src/jobs/keepAlive.ts`, started by `server.ts`. One
  query 30s after boot, then daily. The early tick matters: a host that
  restarts the app every few hours would otherwise never reach the first
  interval and the database would never be touched at all.
- **Layer 2** — `supabase/keep-alive.mjs`, run by Hostinger cron. Plain
  JavaScript with no build step, so it runs identically in dev and prod
  whether or not anything has been compiled. The point of a second layer is
  that it does not share a failure with the first — if the app is asleep or
  crashed over a quiet weekend, its timer is not running.

**Hostinger cron rather than GitHub Actions, deliberately.** Actions is the
usual answer and would mean putting the production DATABASE_URL into GitHub
secrets — a new place the most sensitive credential lives. Hostinger runs on
the machine where it already sits, so nothing new is exposed. (Actions also
disables scheduled workflows after 60 days of repo inactivity, which fails
in exactly the quiet period this exists for.)

The keep-alive exits non-zero on failure so cron records it: one that fails
quietly for six days is worse than none, because nobody finds out until the
project has already paused.

**It is a workaround, not a cure.** If the app is down AND cron misses for a
week, the project still pauses. The real fix is a paid plan.

### 2026-09-13 — Security hardening pass

Full audit and detail in [SECURITY-HARDENING.md](SECURITY-HARDENING.md).

**The ask was "encrypt everything in Supabase". That is not what was built,
and the reasoning matters.** Most of this database is published on the
internet — collection names, brand logos, blog posts, the words on the home
page. Encrypting those costs a decrypt on every page load, kills sorting and
indexing, and protects nothing that is not already public. The line is drawn
at data that is NOT public and identifies a person or a deal.

**Encrypted at rest (AES-256-GCM, per column):** enquiry name/email/phone/
company/message, and exhibition lead name/company/phone/email/interest/notes.

**Deliberately left readable:** published website content, and — importantly
— money and gold weights. Those are `Decimal` columns precisely so the
report totals are exact; ciphertext cannot be summed. They are protected by
their own permission (`exhibitionOps`) instead.

`DATA_ENCRYPTION_KEY` is SEPARATE from `NOTES_ENCRYPTION_KEY` — one protects
the owner's passwords, the other customers' contact details, and one leak
should not be both. `security:check` fails if they are ever equal.

**What the audit found and fixed:**

- Enquiry contact details were in plaintext. Now encrypted.
- RLS was off on all 42 tables. NOT exploitable — `anon`/`authenticated`
  hold no grants, so PostgREST reaches nothing — but one dashboard click
  (enabling Realtime) adds those grants, and the table would then be
  world-readable to anyone with the publishable key. Enabled on all 42; the
  app connects as `postgres` (BYPASSRLS) so nothing changed for it.
- A refresh hash was still bcrypt from before the SHA-256 fix. A SHA-256
  compare can never match it, so that session could never refresh. Cleared.
- **The dev OTP log was guarded on "no mail provider", not on NODE_ENV.** A
  production deploy that lost its mail key would have printed live sign-in
  codes into the log. Now fails loudly in production instead.
- Encryption keys were only checked lazily, so a missing one stayed silent
  until somebody used the feature. Now checked at boot in production.

**Still outstanding, and it needs a person:** `.env.bak-prod-api` is in git
history. Every credential it held — database password, both JWT secrets, the
Supabase secret key, the mail password — should be treated as exposed and
rotated. Deleting the file did not remove it from history.

**Cost, stated:** enquiry search moved from SQL into Node, because ILIKE
cannot run on ciphertext. Fine at this volume; revisit past ~50,000 rows
with a blind index.

New: `npm run security:check` (19 live checks, exits non-zero, meant as a
deploy gate) and `npm run security:harden` (idempotent; encrypts legacy
rows, enables RLS, clears stale hashes).

### 2026-09-13 — Exhibition is its own section

The eleven exhibition screens moved out of Management into their own sidebar
group: **Shows** (the record the website prints) plus the ten operations
screens. A show is not one screen, it is twelve, and eleven of them were
previously reachable only by finding the right row in a table first.

- The open tab is in the URL (`/admin/exhibitions/<id>/ops/leads`), not in
  state — a sidebar entry has to be addressable, and it makes a tab
  shareable and the back button honest.
- The operations entries are per-show and a sidebar link cannot ask which
  show you meant, so they point at the last one opened (`currentShow.js`).
- `opsSpec.js` now carries a `slug` as well as a `kind`: the API path and
  the address bar are allowed to differ (`inventory` -> `stock`). Renaming a
  table should not rename a bookmark.
- `NavLink` prefix-matches by default, so "Shows" lit up on every operations
  page under it. `end` is now set on entries with real routes beneath them.

### 2026-09-13 — Exhibition operations (10 modules)

Running a show, as opposed to advertising one. Full detail in
[EXHIBITION-OPS.md](EXHIBITION-OPS.md). The three things worth knowing here:

**1. None of it is a column on `exhibitions`.** That repository reads the
public show with `include`, not `select`, so it returns every column. A
`stallCost` column added there would have gone straight out of the public API
onto the website. Eleven separate tables instead, which the public query has
no reason to join — the data is not hidden from the website, it is
unreachable from it.

**2. Money and weight are `Decimal` end to end.** Typed as a string,
validated as a string, stored as Postgres `decimal`, summed with Decimal
maths, returned as a string, displayed by grouping the digits. No `Number()`
anywhere — not even in the formatter, because `toLocaleString()` would parse
and round it. For a business weighing gold to the milligram a float error is
not cosmetic, it is missing stock. `npm run ops:check` asserts the sums
exactly.

**3. Its own permission, `exhibitionOps`.** Writing a show's website copy and
seeing its margin are different levels of trust, and usually different people.

Hybrid flexibility as agreed: fixed tables for anything that must be summed,
filtered or reported on; custom label/value fields for everything else, added
from the panel without a developer. A custom field is a note you can find
again, not a number the report understands.

**Two things caught by the checks, not by reading:**

- `rbac:coverage` reported all 31 new routes as UNCOVERED because the guards
  were local consts. It reads declarations as text and will not follow an
  alias — correctly, since an alias could be anything. Guards written out in
  full.
- **Every modal in the dark panel was rendering with the LIGHT theme.**
  `Modal.jsx` portals to `<body>` and copied the `admin-theme` class but not
  the `data-admin-theme` attribute, and every dark rule needs both. Measured
  at `rgba(255,255,255,0.62)` inputs on a `rgb(1,8,6)` page. Pre-existing and
  affecting every modal in the panel; fixed in one line by reading the
  attribute `useAdminTheme` already mirrors onto `<body>`.

### 2026-09-12 — The login database error: two defects, not one

The sign-in page showed a raw Prisma failure — `Can't reach database server
at aws-1-ap-south-1.pooler.supabase.com:6543`. The database was fine by the
time it was checked (DNS resolved, TCP 6543 open, a query returned in 329ms),
so the fault was intermittent. Two separate things were wrong.

**1. The pooled URL had no connection limit.** `DATABASE_URL` pointed at
Supabase's transaction-mode pooler with `pgbouncer=true` and nothing else, so
Prisma opened its default pool of `cores * 2 + 1` — **25** on this machine —
against a pooler that allows far fewer per client. The symptom is
intermittent, worsens the longer the server runs, and shows up as two
different-looking errors: `P2024 Timed out fetching a new connection`
(seen earlier in this project) and `Can't reach database server` (seen now).
The pooler is already doing the pooling, so the fix is one connection per
client: `&connection_limit=1&pool_timeout=20`. `DIRECT_URL` stays on 5432
with no pooler, because migrations need a real session.

Verified with 80 concurrent database-backed requests: all 200, no errors in
the server log.

**2. That message should never have reached a browser.** It carried the
absolute path `D:HarshThe-Promise-Jewels mode 10serversrcmodulesauth…`,
the surrounding source lines and the database hostname — to anyone who could
load the sign-in page.

- `PrismaClientInitializationError` is NOT a `KnownRequestError`, so it fell
  past the handler that translates Prisma codes and into the catch-all, which
  in development echoes `err.message` verbatim. It now has its own branch and
  returns **503** with a sentence an operator can act on — 503 because nothing
  is wrong with the request and a caller that retries later is right.
- `P2024` (pool exhausted) now maps to 503 for the same reason.
- The development catch-all still sends the internal message, because that is
  what makes a local 500 diagnosable — but it is passed through `redact()`,
  which strips filesystem paths and keeps the file name and the reason.

**A trap worth remembering.** The first `redact()` used `[^s"']*`, which
stops at the first space — and this project's own path contains spaces
("The-Promise-Jewels mode 10"). It matched nothing while looking correct.
`npm run error:check` now asserts it against the exact string that leaked,
with the backslashes built from a character code so no shell or editor can
quietly alter them. (Two of my own test harnesses were mangled that way
before the real bug was found.)

### 2026-09-10 — The Vault (System > Vault)

Somewhere for the owner to keep the passwords and notes they were keeping in
their head. Full detail in [VAULT.md](VAULT.md); what matters here:

- **The database holds one sealed blob per entry and nothing else readable.**
  Not just the password — the title, the body, the tags, the field names and
  which KIND of entry it is are all inside it. A column of readable titles is
  a map of what the vault holds; a `kind` column counts the passwords.
- AES-256-GCM, random IV per seal, key in `NOTES_ENCRYPTION_KEY`. GCM rather
  than CBC so a row altered in the database fails to open instead of
  decrypting to something.
- **The owner id is the AAD**, so a row re-pointed at another account will
  not open. Asserted in `npm run vault:check`.
- **Nobody can read anybody else's, Master included** — and not because a
  screen is missing. No route parameter, query string or body field in the
  module names an account; the owner comes from the session and goes into
  every `where`. This is the one place Master is not a skeleton key: every
  other resource is company data, a vault is one person's passwords.
- Searching happens in the browser, over what is already decrypted on screen.
  A searchable copy of the titles server-side is exactly what the sealing is
  there to prevent.

**It is not end-to-end**, and that is a deliberate trade: the key is in the
server environment, so a database dump is useless but the server can decrypt.
Deriving the key from a passphrase the server never sees would be stronger,
and a forgotten passphrase would destroy every note with no way back.

**Deploy note:** `NOTES_ENCRYPTION_KEY` must be set per environment and kept
somewhere safe offline. Lose it and every note is unreadable for good,
backups included. Without it the site still runs and only the vault refuses,
with a screen saying why.

### 2026-09-10 — Dark theme, twice as deep. Admin only.

Every value in the dark theme had its **lightness halved**, hue held. The
band ran 3%-9% of the way up from black; it now runs about **1.5%-5%**.
Measured after: body `rgb(1,8,6)` = 1.8% (was 3.5%), cards `rgb(3,15,12)` =
3.5% (was 7.3%).

**Halving, not subtracting.** Take a fixed amount off each stop and the
darkest ones hit black first, the mesh collapses into a flat field, and the
green goes with it. Halve them and every stop keeps its ratio to its
neighbours — same mesh, drawn an octave lower, still recognisably green.
Hue stayed at ~163 degrees, which matters MORE at this depth: there are only
a handful of 8-bit steps left to carry the colour, and a hue that drifts
here reads as black with a cast.

Text got easier to read, not harder — cream on a darker ground is more
contrast. What needed watching was the surfaces: shadows do nothing against
a ground this dark (nowhere darker to go), so the brass hairline came up
from 0.16 to 0.20 to carry the work the shadow no longer can.

**Scope: admin only.** Every selector in the block names `.admin-theme`.
The public website renders under `.web-theme`, carries no theme attribute,
and paints its own literal colours — verified live: sections still
`rgb(255,255,255)`, hero unchanged.

**A real bug surfaced doing this: the login ground was never being painted.**
`.pj-login-bg` also carries Tailwind's `!bg-ink-900`, and Tailwind v4 emits
utilities inside `@layer utilities`. For `!important` declarations a LAYERED
rule beats an unlayered one whatever the specificity — the same trap this
file already documented for Bootstrap's `.bg-white`. So every
`background-color` set for that page lost, and the mesh was compositing over
`--color-ink-900` (#0A2A22) instead of over the deep ground. That is why the
login screen kept looking lighter than the panel, through several rounds of
darkening. Fixed the way `.pj-btn-danger` was: the bottom layer is a
two-stop background IMAGE, which `bg-*` utilities never touch.

### 2026-09-10 — Deeper again, and the rail got its margin back

**The band moved down.** It ran from about 5% to 14% of the way up from
black; it now runs from **3% to 9%**, so every surface in the dark theme is
at least 90% dark. Same hue spread (158-168 degrees), same trick — depth
still comes from hue rather than lightness, there is simply less lightness
to spend. Ground `#03100C`, cards `#061F19`, glass `rgba(7,39,31,.70)`.

**Premium, in colour, is not a colour you add — it is what you take away.**
At this depth the gold is the only chromatic event on the screen, and one
warm thing against a very deep, very even field is what reads as expensive.
So the gold went warmer: `#DCC68D` (a pale straw) to `#E3CE9E` (champagne —
more red, reads as metal rather than as yellow, the difference between gilt
and paint). Everything else went darker.

**The sidebar went 200px -> 244px.** At 200 the rail was the same width as
its longest label, so every row read as text pressed against two edges. The
extra 44px is margin, not content — nothing new fits in it, the labels
simply stop touching the sides. That gap is most of what separates a panel
that looks considered from one that looks cramped. `AdminLayout`'s
`lg:pl-[236px]` moved to `lg:pl-[280px]` to match; the two must stay in step
and there is a note on `SIDEBAR_WIDTH` saying so.

**Not a code bug, worth knowing:** a dev server left running for hours
across many hot reloads will exhaust Prisma's connection pool and every
request starts failing with `P2024 Timed out fetching a new connection`.
The panel just spins on the auth check. Restart the server.

### 2026-09-10 — The dark theme is one dark green mesh

Three requirements that pull against each other: **no light green**, **no
high contrast**, and **a mesh gradient**. A mesh normally gets its life from
light stops, and this one cannot have any.

**How it is reconciled.** Every stop in the mesh is a step on the green ramp
between `#030F0C` and `#0C3A2E` — a band about nine percent of the way up
from black. Nothing in the dark theme is lighter than that, panels included.
What gives it depth is that the stops differ in **hue** (158 to 168 degrees)
rather than in lightness: the eye reads that as a surface catching light
differently across its width, while a photometer would call it all the same
darkness. Contrast between any two points on the ground is under three
percent and it still does not look printed.

- Ground: six stops, `background-attachment: fixed` so it is the room the
  page is in rather than a pattern printed on it.
- Cards: the same mesh, two stops, placed wider apart — a full copy of the
  ground's mesh inside a 120px box reads as a stripe.
- Glass keeps its blur but loses its lift; it was the lightest thing on the
  screen and is now inside the band with everything else.
- The brass rim dropped from 0.26 to 0.16, and the specular edge from white
  at 0.18 to gold at 0.10 — it was the last genuinely light thing left.

**Dither.** A mesh this dark bands: screens carry 8 bits per channel and the
whole theme lives inside about nine of the 256 steps, so a gradient crossing
two of them draws a hard arc. On the login screen — one large empty field —
the arcs were plainly visible. Fixed the way film and print have always
fixed it: a 140px tile of fractal turbulence at 4%, as a data URI, laid over
the two full-page grounds. Invisible as texture, decisive against the bands.

**One gotcha worth keeping.** The dashboard's cards render as `Card glass`,
which drops `.pj-card` and paints from an INLINE style reading
`--glass-fill` / `--glass-border`. Inline beats a stylesheet, so those cards
kept the pre-mesh tokens and sat visibly brighter than everything else. They
are fixed by re-pointing those two tokens, not by touching the JSX — if a
surface in this panel ever refuses to follow the theme, check whether it is
painting itself inline first.

### 2026-09-10 — Liquid Glass, and a flat deep green under it

**Two changes, same afternoon. Design only — no logic, content or wiring
was touched.**

**1. The ground went flat and deep.** The dark theme had four gradients on
the page ground (an emerald pool, a brass bloom, a second pool, a vignette)
and a diagonal light-to-dark sheen inside every panel. All of it put light
back into the green, and light in a green is what makes it read as flag
green rather than as a jewel. It is now one colour — ramp step 900,
`#041611` — with panels a flat step above it and a brass rim doing the
separating. The login screen lost its two blurred glow blobs, the halo
behind the crest and the pulsing gold bloom for the same reason.

**2. Liquid Glass** — ported from `skills/liquid-glass`. That skill is
written for SwiftUI (`.glassEffect()`, `GlassEffectContainer`,
`.buttonStyle(.glass)`), none of which exists in a browser, so what was
ported is the design system's rules:

- **"Never apply glass to content itself. Glass is for controls and
  navigation only."** This was the panel's biggest deviation: one rule gave
  the same translucent blurred material to the sidebar, the modals, every
  table, every form and every box in the Editor. There are two materials
  now — glass for the navigation layer (sidebar, topbar, sheets, controls),
  solid for content. It is also faster: each blurred surface costs a
  `CABackdropLayer` and three offscreen textures.
- **"Glass cannot sample other glass."** Nothing inside a glass surface is
  glass; a modal is glass, its fields are not.
- **Specular edges, not washes.** Every highlight is an inset hairline. This
  is what let the glass rules and the flat deep green coexist.
- **Two densities**, as `.regular` vs `.clear`: a sheet sits over the page
  it came from, so it is denser than a toolbar.
- **`.interactive()`** — the press-scale is ported; the shimmer and
  touch-point illumination need the compositor's own sampling and are not.
- **Accessibility is part of the material.** `prefers-reduced-transparency`
  makes glass opaque, `prefers-contrast: more` gives stark brass borders and
  drops the shadows, `prefers-reduced-motion` drops the press-scale.

**One bug fixed:** the login card had been painting itself with an inline
gradient plus a darkening overlay for months, and neither was ever visible —
`.pj-card` sets its background with `!important`, which beats an inline
style, and the login screen sits outside AdminLayout so it was being handed
the LIGHT theme's white glass. That is where the murky grey card came from.
It is painted in `globals.css` now, where the winning rule lives.

### 2026-09-10 — One green, and it is a jewel green

**Change:** Every green in the admin panel now comes off a single ramp held
at hue ~163 degrees, and the dark theme was rebuilt around depth rather than
saturation. The public website is untouched.

**Why.** The greens the panel had ran between 168 and 175 degrees — teal —
and the worst of them sat at middling lightness and middling saturation.
That combination is the colour of municipal signage and national flags, and
no amount of gold on top of it reads as luxury. The greens that DO read as
regal (Brunswick, Castleton, British racing) all sit between 155 and 165
degrees, and they are dark: the richness comes from depth, not from
saturation.

The ramp is written out in full at the top of `globals.css`. What moved:

- `--color-emerald-400` was **#2F6B6B**, a desaturated teal that went grey
  against cream. It was the single colour making the panel look cheap.
- The dark page ground was a flat teal wash (`rgba(36,106,106,.32)` over
  `#123B36`). It is now a deep green floor with an emerald pool in one
  corner, a faint brass bloom in the other, and a soft vignette so the
  corners fall away — depth from fall-off, not from more gradients.
- **Panels now sit lighter than the ground they are on**, with the gold rim
  raised from 0.20 to 0.26. That rim does more for the look than any fill.
- Refraction (the saturation boost behind glass) was dialled from 0.8 to 0.5
  in dark. At 0.8 the emerald bloom came through the top panels as a pale
  grey-green wash — the exact flat green being removed.
- The panel hairline is warm gold now, not white.
- The login card was **#053D40 -> #246A6A**, running to nearly pure cyan on
  the first screen anyone sees. It is two steps of the ramp.
- The light theme ground was warmed off a cool grey to ivory, so the gold
  beside it stops looking dull.

**One bug fixed on the way:** the Arrangement rows used solid `bg-white`.
The dark theme only remaps `bg-white/*` (with an alpha), so those rows
stayed a bright block with cream text on them — invisible. They are
`bg-white/70` now, which is a raised surface in both themes.

**Not touched:** `BRAND_PALETTE` in `page-content.constants.ts`. Those are
the colours the Editor offers for the WEBSITE, and changing them would
change the public site rather than the panel.

### 2026-09-10 — Pages are arranged, and new sections are designed, from the panel

**Change:** Every public page now renders from an arrangement stored in the
database instead of a list of JSX tags, and Master can design brand-new
sections in the admin panel and place them on any page. Full detail in
[PAGE-BUILDER.md](PAGE-BUILDER.md); the short version:

- Each page hands a registry of `key -> () => JSX` to `PageSections.jsx`.
  Declaration order is the default, so an untouched page renders exactly as
  before — `page_sections` starting empty is the guarantee, not an accident.
- Admin > Content grew an **Arrangement** card: move a band up or down, hide
  one (its copy is kept), and the section cards below follow the same order,
  so the panel finally reads like the page it edits.
- Bands with no editable words of their own — listings, forms, grids — are
  now declared as `structural` sections so they can be moved and hidden too.
- A **designed section** is a row in `custom_sections`: a list of blocks
  (heading, paragraph, picture, button, space, line) plus the band around
  them. One component draws all of them, defaulting to the brand's own faces
  and colours so a section built by the client still looks like this site.
- Designing is its own permission resource, `sections`, held only by Master
  until granted in System > Roles. Editing the words on a page and changing
  what the page is made of are different levels of trust.
- Colours, fonts, sizes and hrefs are all validated server-side. A
  `javascript:` href is refused — it is the one place a non-developer
  supplies a URL that reaches the public markup.

**Verified:** all seven pages render unchanged; reordering, hiding and a
designed section were exercised end to end in the browser. `rbac:coverage`
64 guarded / 28 public / 0 uncovered · `rbac:check` and `rbac:e2e` (now 18
assertions) passing · `tsc` and `vite build` clean.

### 2026-09-10 — The emailed sign-in code is now a setting, and defaults to off

**Change:** Whether signing in needs the one-time emailed code is a toggle on
the Settings screen. **Default: off.** The decision lives in one new file,
`server/src/modules/auth/otp-policy.ts`, and every path that would send or
check a code asks it first.

**Why off by default.** An OTP is only a second factor if the code arrives.
When it does not it is a locked door with no key — which is exactly the state
this panel was in: mail sends from Resend's sandbox sender
(`onboarding@resend.dev`), which only delivers to the account owner's own
address, so a newly created user could sign in with their password and then be
stopped at a code that would never reach them. A setting that defaults to "on"
and silently locks out every new account is worse than one that defaults to
"off" and is turned on deliberately once mail is known to work.

- `login()` now returns either `{ otpRequired: true }` or a finished session.
  With the code off, the password WAS the whole check and the controller sets
  the cookies there; with it on, nothing changes from before.
- `startSession()` is shared by both routes in, so a session is created
  identically whichever way got there.
- The browser reads `otpRequired` off the response rather than inferring it.
  A missing flag is treated as "yes, ask for one", so the mock path and any
  older server still behave as they did.
- **Password reset is deliberately NOT covered by the toggle.** There is no
  password to check in that flow, so the emailed code is the only thing proving
  the person owns the address. Turning it off there would let anyone reset
  anyone's password by typing their email.

**One real bug found while testing this.** The policy first read the settings
row with `findFirst()`. This database has **two** settings rows — the
repository has always addressed a fixed `SETTINGS_ID` and left the other one
behind — so `findFirst` returned whichever Postgres felt like, which was not
the row the Settings screen saves. The toggle appeared to do nothing. It now
reads by id. (The orphaned second row is untouched; it is the client's data and
nothing reads it.)

**Verified end to end** with `npm run otp:check`, which drives the real
`/auth/login` over HTTP: with the code off, login returns 200 with a user and
both session cookies; with it on, login returns 200 with no user and no
cookies. Restores the setting afterwards whatever happens.

**Files:** `server/src/modules/auth/otp-policy.ts` (new),
`otp-policy.selftest.ts` (new), `auth.service.ts`, `auth.controller.ts`,
`settings.{service,validation,types}.ts`, `schema.prisma` (one additive
`settings.otpRequired` column, default false), `useAuth.jsx`, `LoginPage.jsx`,
`SettingsPage.jsx`, `package.json`.

**Impact:** additive column only, no data touched. Signing in no longer asks
for a code until someone turns it on in Settings.


### 2026-09-10 — System section: Users and Roles screens, nav and routes gated

**Change:** The sidebar has a **System** group — Settings (unchanged), Users
and Roles — and the two new screens are built and working against the real API.

- **Users API** (`server/src/modules/users/**`). Creating an account here is
  all it takes for that person to sign in: they use the email and password set
  on the form, and the one-time code goes to that same address. No invite to
  accept, and no window where an account exists but cannot be used. The
  password hash and every OTP column are stripped from everything the module
  returns.
- **Roles screen** builds its permission grid from the catalogue the SERVER
  sends. Nothing in the frontend knows what permissions exist — adding a screen
  to `permissions.catalog.ts` makes it appear in every role form with no change
  to the page.
- **Users screen** picks a role from the roles API and carries a "Create a new
  role" link straight to the Roles screen, so "the role I need does not exist"
  is one click rather than a dead end.
- **The sidebar is now gated.** Each entry carries its resource key and is
  rendered only when the role may open it; a group whose items are all hidden
  disappears rather than leaving a heading over nothing. Until the profile
  loads, nothing is shown — a flash of screens you cannot open is worse than a
  moment of empty rail.
- **Every admin route is wrapped in `RequirePermission`**, so a hidden screen
  cannot be reached by typing its URL either.

Guard rails worth knowing, all enforced server-side:

- You cannot deactivate or delete **your own** account, or change your own
  role. Locking yourself out is the one mistake here nobody else can undo.
- The **last active Master** cannot lose the role, be disabled, or be deleted.
- Changing a password or a role clears that account's refresh token, so
  whatever it was allowed to do gets re-decided.
- Email is not editable after creation: it is where the sign-in code goes, so
  changing it changes who can get into the account. That belongs in its own
  deliberate operation, not riding along in a name edit.

**Verified live**, signed in as `thepromisejewels@gmail.com` with a real token:
the System group renders, both accounts list with their roles, and creating a
role called "Content Editor" with six ticked permissions saved, appeared back
in the list, stored exactly those six rows, and resolved for a holder as
`content:edit` yes / `collections:view` no / `users:view` no / `roles:edit` no.
The test role was then deleted.

**Files:** `server/src/modules/users/**` (new), `user.routes.ts` mounted at
`/api/v1/users`, `securityLog.ts` (+user lifecycle events),
`src/features/users/**` (new), `src/features/rbac/pages/RolesPage.jsx` (new),
`Sidebar.jsx`, `AdminRoutes.jsx`, `AdminLayout.jsx`.

**Impact:** 56 routes now guarded, still 0 uncovered. No schema change — the
tables were already there. Everyone holds Master, so nothing anyone can
currently do changed.


### 2026-09-10 — RBAC now actually enforces: 0 uncovered routes

**Change:** Applied the permission layer to every API route, and built two
checks that keep it applied. See **RBAC.md**.

- **52 routes guarded, 27 deliberately public, 0 uncovered.** Every public
  route carries a written reason in `rbac.coverage.ts`; anything neither
  guarded nor listed fails the check.
- **`npm run rbac:coverage`** — reads the route files and reports any
  declaration with no guard. Static, so it names the file and line. Exits
  non-zero, so it can gate a deploy.
- **`npm run rbac:e2e`** — 13 assertions against a running server with a real
  signed token. A role holding only `collections:view` gets 403 from
  Inquiries, Dashboard, Media, Roles, Settings and Page content; the same
  account as Master gets 200. All GETs — a test that proved DELETE was refused
  by attempting one would delete real data the day it regressed.

Three things the work turned up:

1. **The media library had no resource.** `/media/assets` is the upload behind
   Collections, Brands, Exhibitions AND the Editor. Folding it into `content`
   would have stopped a Collections-only role uploading a collection image, so
   `media` became its own resource.
2. **Content, Header and Footer are one endpoint.** All three write through
   `/page-content/:page`. One `content:edit` there would mean granting the
   Header screen silently granted every other page, so
   `page-content.permission.ts` picks the resource from the page being
   addressed.
3. **Five routes had the guard running BEFORE `requireAuth`** — dashboard and
   four exhibition routes. They returned 401 to everyone including Master,
   because `req.user` did not exist yet. The static check called them guarded,
   and they were, just uselessly. Only the live test caught it, which is the
   argument for having both.

**Still not built:** four of the five System screens (User Creation, Roles,
Notifications, Declaration — only Settings exists), the users and declarations
APIs, and the sidebar/route gating. `RequirePermission` is written and tested
but not yet applied, so a role without `collections:view` currently sees the
link and a failed screen rather than no link. Nothing is exposed by that — the
API refuses regardless.

**Files:** all 11 `*.routes.ts` under `server/src/modules`,
`permission.middleware.ts` (guards now tagged so coverage is checkable),
`permissions.catalog.ts` (+`media`), `page-content.permission.ts` (new),
`rbac.coverage.ts` (new), `rbac.e2e.ts` (new), `package.json`, `RBAC.md`.

**Impact:** no schema change, no data touched. Everyone holds Master, so no
existing behaviour changes — but a custom role is now genuinely restricted on
the server, which it was not before today.


### 2026-09-10 — RBAC: foundation, verified. Screens not built yet.

**Change:** Role-based access control, built as its own module. See **RBAC.md**
for the design, the file map and the rules; this entry records what landed and
what did not.

Built and verified:

- **One permission catalogue** (`permissions.catalog.ts`) — the only place a
  permission is declared. The server checks against it and the browser is
  handed it, so the two halves cannot drift. A permission is `resource:action`
  over four verbs.
- **Five tables**, all additive: `roles`, `role_permissions`, `announcements`,
  `announcement_targets`, `notifications`, plus one nullable `users.roleId`.
  Checked with `prisma migrate diff` before pushing — no DROP, no data loss.
- **`requirePermission` middleware** — the actual control. Deny by default, and
  it throws at BOOT on a resource that is not in the catalogue, so a typo in a
  route cannot fail silently at request time.
- **The master role**, holding everything with zero stored rows, unrenamable
  and undeletable. `ensureMasterRole()` runs at boot and adopts any account
  with no role — without it the first deploy would have locked the only admin
  out of the panel, including out of the screen where roles are assigned. On
  this database: 2 accounts, both now hold Master, 0 orphans.
- **Frontend primitives**: `PermissionsProvider`, `<Can>`, `useCan`, and
  `RequirePermission` with a no-access screen. The client API has **no mock
  branch** on purpose — developing against an invented access model is the
  exact bug this feature prevents.
- **`npm run rbac:check`** — 16 assertions covering grants, effective
  permissions, the master short-circuit, and the guard rails. All passing.
  This is currently the only automated test in the project (§19 #3).

**NOT built** — stated plainly because a half-applied access control is worse
than none:

- **Per-route enforcement.** `requirePermission` is mounted on `/api/v1/rbac/*`
  only. The other **63 admin routes across 11 modules** still use the old
  `requireAdmin` or nothing, so RBAC currently governs who may manage *roles*
  and little else. The right fix is a central route→permission map with
  deny-by-default, not 63 hand-edits — scattered edits fail open when one is
  missed.
- **Four of the five System screens**: User Creation, Roles, Notifications and
  Declaration. Only Settings exists.
- **User creation with an emailed OTP**, and the declaration fan-out.

**Files:** `server/src/modules/rbac/**` (new), `permission.middleware.ts`
(new), `schema.prisma`, `server.ts`, `routes/index.ts`, `package.json`,
`src/features/rbac/**` (new), `RequirePermission.jsx` (new), `providers.jsx`,
`RBAC.md` (new).

**Impact:** additive schema only, no data touched, nothing removed. Everyone
holds Master, so no existing behaviour changes. The panel gained one endpoint
group and one provider; the sidebar and routes are untouched.


### 2026-09-10 — About page typography, and a light/dark switch for the panel

**Change (About):** The About page now carries the same per-field typography as
Home — font, size, colour, weight and letter spacing beside each of its 30
pieces of copy, in that order, rendered through the same section boxes.
`withTypography()` is applied to `ABOUT_SECTIONS`; the Editor and the styling
helper needed no changes, which was the point of building them that way.

Getting there meant fixing what was already there:

- **Six pages were passing hero colours into a component that never declared
  them.** `PageHeroCircle` hard-codes `from-[#01383B] to-[#286F6F]` and
  `text-[#2F6B6B]`, and has no `eyebrowColorFrom` / `titleColorFrom` /
  `subtitleColor` / `ctaTextColor` props at all. About, Blog, Brands,
  Collections, Exhibitions and Contact all passed them anyway, so every hero
  colour field in the Editor did nothing on any of those pages. The component
  now takes the section object and applies both the colours and the typography;
  the six callers pass `content={hero}` and the dead props are gone.
- **The hero colour keys did not follow the convention** the pairing relies on
  (`eyebrowColorFrom`, `titleColorFrom`, `ctaTextColor`). Renamed to
  `<copyKey>Color` / `<copyKey>ColorTo` and moved to sit beside their copy.
  Checked against the database first: 26 override rows exist, none of them a
  hero colour, so nothing was orphaned.
- **About's growth band used different button keys from Home's** —
  `ctaFromColor`/`ctaToColor` against `ctaBgColor`/`ctaBgColorTo` — while both
  pages render through the same `GrowthSection`. Aligned to Home's.
- **Two section headings were declared and never rendered.** `leaders.heading`
  and `gallery.heading` were in the schema and in the component fallbacks, but
  both headings were hard-coded in the markup. Gallery's default said "Our
  Work" while the page had always shown "Gallery" — the mismatch was invisible
  precisely because nothing read the field. Both are wired now, the default
  corrected to what the page shows, and the Leaders heading keeps its
  light-word/bold-word treatment by splitting on the first space.

`typeStyle.js` moved from `src/pages/Home/` to `src/features/page-content/`,
now that two pages use it.

**Change (theme):** The admin panel has a light and a dark theme, switched from
a row at the bottom of the sidebar and remembered per browser in
`localStorage`.

The panel was built dark, converted to white glass at some point, and the dark
version is now back as an option rather than a replacement. The whole dark
treatment hangs off one attribute — `[data-admin-theme="dark"]` on the element
that already carries `.admin-theme` — so light is simply its absence and
neither theme needs a second stylesheet.

What actually made the panel light was **not** the glass fill, which is where
the first attempt went looking. Three separate things had been hard-coded past
the tokens, and each had to be restated rather than re-pointed:

1. A **second `.admin-theme.dashboard-bg` rule** repainting the page ground
   `#F7F9F8 → #EFF4F3`. This was the real one: cream text was being drawn
   correctly the whole time, onto a near-white ground.
2. Two broad attribute selectors — `[class*="bg-white/"]` → `#F1F5F4` and
   `[class*="bg-ivory"]` → `#FAFBFB` — turning every translucent surface into
   a solid light box, which is what made the inner form panels light.
3. Literal colours for text that a token could not follow: `text-brass-*`
   darkened to `#6E5730` for AA on white, `text-ivory*` remapped to `#12312B`,
   and the table hairlines.

The colour mixer renders in a portal on `<body>`, outside `.admin-theme`
entirely, so the theme hook mirrors the attribute onto `<body>` and the picker
styles off that. The attribute is removed on unmount so the public site is
never left wearing an admin theme.

**Files:** `page-content.constants.ts`, `PageHeroCircle.jsx` and its six
callers, `Ours.jsx`, `OurLeaders.jsx`, `Gallery.jsx`, `typeStyle.js` (moved),
`globals.css`, `useAdminTheme.js` (new), `AdminLayout.jsx`, `Sidebar.jsx`,
`Topbar.jsx`, `ColorPicker.jsx`, `EditorPage.jsx`.

**Impact:** About grows to 276 Editor fields, 40 of them copy blocks, 0 styling
fields stranded. No schema migration, no data touched. Hero colours start
working on six pages that were silently ignoring them — all six keep their
shipped defaults, so nothing changes until an admin edits one. Panel defaults
to dark; the choice is per-browser, not per-account.

**Note for the next person:** `tsx watch` hangs on this machine — the server
starts, prints its env line and never binds. `.claude/launch.json` runs plain
`tsx`, so **server-side changes need the dev server restarted**; Vite still
hot-reloads the frontend. This is the same chokidar stall the `PJ_NO_WATCH`
comment in `server.ts` describes.


### 2026-09-10 — Editor: the Home page tab, rebuilt as sections

**Change:** The per-field typography work left the Home tab as one flat column
of 333 inputs — unreadable, and with no way to tell which colour belonged to
which sentence. Rebuilt around three ideas:

1. **Every section is its own box, closed by default.** The page is now seven
   labelled cards, each with the section name, a one-line description and a
   count ("5 texts · 30 pictures"), so the question "where is the hero
   heading" is answered without scrolling. A gold hairline separates them.
2. **Each piece of copy is a block, with its own styling folded inside it.**
   `buildBlocks()` walks the schema and gathers a text field together with the
   font, size, colour, weight and spacing whose keys belong to it. The words
   stay the thing you see; "Appearance" opens the five controls underneath.
   A styling field only joins the copy above it when its key is that key plus
   the expected suffix, so a colour that tints something else — a button
   background, a heading spanning two fields — stays separate rather than
   being absorbed into whatever preceded it. Verified against the live schema:
   42 copy blocks, 0 styling fields stranded.
3. **Long runs of pictures fold themselves away.** Eighteen ring frames is
   eighteen thumbnails and eighteen Replace buttons, which pushed every text
   field in the Hero section off the bottom of the screen. Groups of more than
   three pictures now start collapsed behind "Show 18".

Also: the "styled" dot beside Appearance compares each value against that
field's **default**, not against empty. Colours ship with real values, so the
first version lit the dot on every block on the page and marked nothing.

**Files:** `src/features/page-content/pages/EditorPage.jsx`.

**Impact:** presentation only — no schema change, no API change, nothing about
what is stored or what the public site renders. Verified in the running panel:
seven collapsed section boxes, copy blocks with working Appearance panels, the
colour mixer opening over the form, and the picture groups folding.


### 2026-09-10 — Fix: the admin panel never finished loading

**Change:** Removed the "already asked" ref from the session check in
`useAuth.jsx`.

**What went wrong:** the earlier change that stopped the public site asking
`GET /auth/me` guarded the request with a ref, so that leaving /admin and
coming back would not re-fetch a session already held. StrictMode runs an
effect twice. The first pass set the ref and then had its own cleanup mark the
in-flight result as stale; the second pass saw the ref and never asked at all.
So `user` stayed `undefined`, which `RequireAuth` reads as "still checking" —
every admin route rendered its spinner forever and the panel looked dead. The
public site was unaffected, which is why it survived the earlier check.

**Fix:** the effect now depends on nothing but whether the current path is
under /admin. Entering the admin area fetches; StrictMode's second pass fetches
again in development and keeps the answer. Re-entering /admin from the public
site costs one request and revalidates the session, which is worth having.

**Files:** `src/features/auth/hooks/useAuth.jsx`, `.claude/launch.json` (dev
server runs with its file watcher on again — running it with `PJ_NO_WATCH=1`
serves stale CSS and JS after an edit, which cost time twice today).

**Impact:** admin panel loads. Verified `/admin/dashboard` redirects to the
login form, and the public homepage still makes no `/auth/*` calls at all.


### 2026-09-10 — Home page: full per-field typography in the Editor

**Change:** Every piece of copy on the Home page — all 42 of them across the
seven sections — now carries its own typeface, size, weight, letter spacing and
colour, laid out in that order directly beneath the words they apply to.

- **Four new field types** (`font`, `fontsize`, `weight`, `spacing`) and two
  builders in `page-content.constants.ts`. `withTypography()` rebuilds each
  Home section's field list rather than the alternative of writing the controls
  out by hand beside all 42 strings, which is 42 chances to misplace one and no
  protection for a string added later.
- **Every new control defaults to empty**, meaning "leave the design alone".
  Nothing on the live site changed when this shipped; the sections render
  exactly as before until somebody deliberately edits one.
- **Sizes keep their responsive steps.** The design carries three breakpoints
  per heading in Tailwind classes, and one inline `font-size` would flatten all
  three — a heading sized for a desktop would overflow a phone. An admin size
  is written as `--pj-fs` and `:root [style*="--pj-fs"]` in globals.css steps it
  down at the same breakpoints the design already used. Verified: a 40px
  setting computes to 40px on desktop and 20px at 375px wide.
- **Amiora, Choase and Giliant are usable for the first time.** All three
  shipped in `/public/fonts` with no `@font-face` rule, so nothing could apply
  them. Declared now, and they join Ringtte and Optika in the picker.
- **New colour picker.** Round brand swatches, the hex beside them, and a last
  swatch that opens a Figma-style panel — saturation square, hue and opacity
  rails, hex box — positioned in a portal so it is never clipped by the card it
  sits in.
- **The server checks the new values against the same lists the picker is built
  from.** These end up inside inline `style` attributes; a font family is a CSS
  fragment, not a caption, and the admin form is not the only thing that can
  POST here.
- **Our Brands stays out of the Editor.** The brand rows are records in
  Admin > Brands and are edited there; the Home section now carries a
  "Manage brands" link through to that screen instead of a second copy of the
  data that could drift.

**Audit:** every field the Editor declares for Home was checked against the
component that renders it — all 42 pieces of copy are wired to their styling,
and the one apparent dead field found on the first pass (`growth.img.17`) was a
false positive: the growth ring reads its eighteen images through a loop.

**Files:** `page-content.constants.ts`, `page-content.service.ts` (validation +
fonts/weights/limits on the schema payload), `Field.jsx`, `ColorPicker.jsx`
(new), `EditorPage.jsx`, `usePageContent.js`, `typeStyle.js` (new),
`globals.css`, and all seven `src/pages/Home/components/*`.

**Impact:** Home grew from 165 to 333 Editor fields. No schema change, no data
touched, and no visual change until an admin sets something. Only the Home page
was converted — the other pages keep the previous shape.


### 2026-09-07 — Hostinger deployment setup

**Change:** Prepared the project for the managed host and deployed it to
`thepromisejewels.com`. Three real defects surfaced that only appear off a developer machine:

1. **`express-serve-static-core@0.1.1` was a runtime dependency.** A stub package
   ("only here to make types work") whose `typings` field shadows the real
   `@types/express-serve-static-core` once npm flattens `node_modules`. pnpm's nested layout
   hid it completely. On the host, `tsc` failed with ~40 errors of the form
   `Property 'body' does not exist on type 'Request'`. Removed — nothing imports it, and
   `tsc` passes without it under both layouts (verified against a real npm flat install).
2. **The project root was resolved from `process.cwd()`.** True only when the process is
   started from the project root; a managed runner starts the entry file from elsewhere, and
   `express.static` then points at a directory that does not exist — the API answers and
   every page 404s, which reads like a broken build. Now resolved from `import.meta.url`,
   which is correct in both the tsx and the compiled layout.
3. **`.env.bak-prod-api` was still tracked**, holding live production credentials, and
   `.gitignore` only covered `.env` and `.env.local`. SECURITY.md §9.2 claimed it was
   already untracked; it was not. Untracked now, pattern widened to `.env.*` with
   `!.env.example`, and excluded from the deploy archive.

Also: `prisma generate` added to `build` (the host installs with `--ignore-scripts` in some
paths); `main` added so the panel detects the entry file; `engines` raised to >=22 to match
what `@supabase/supabase-js` and `sanitize-html` require; `package-lock.json` committed
because the build image has no pnpm; the pnpm-only `overrides` mirrored into package.json so
the `qs` advisory pin survives an npm install; empty `src/store/slices` and `tests/**`
placeholders deleted.

**Files:** `package.json`, `package-lock.json` (new), `server/src/server.ts`, `.gitignore`,
`brain.md`. Deleted: `src/store/`, `tests/`, and `.env.bak-prod-api` from the git index
(the file is left on disk).

**Reason:** Requested — put the site live on Hostinger.

**Impact:**
- Build pipeline verified end to end on the host: npm install → prisma generate → vite build
  → tsc all succeed, and the app is deployed.
- **The site is not yet serving.** It returns 503 because no environment variables are set —
  the runtime log shows `injected env (0) from .env` then
  `Missing required environment variable: DATABASE_URL`. Setting them in hPanel is the only
  remaining step; see §21.
- `.env.bak-prod-api` is still inside commit `05bc537`. Untracking it does not remove it
  from history — §19 #1 stands.
- Local development is unchanged and still uses pnpm.

### 2026-09-07 — Home page: per-field colours, page-wide override removed

**Change:** Colour on the Home page was one page-level "Colours" section — six shades pushed
onto the page wrapper as CSS variables and read by every section below it. It was the only
colour control on the page that did anything, and it was all-or-nothing: every heading shared
one teal, so the Welcome heading could not differ from the Pillars heading.

Meanwhile the **Growth section declared seven colour fields of its own that no component ever
read**. An admin could set them, save, and see nothing change — the page-wide variables were
what those elements actually used. The panel was offering settings that did not exist.

Both are gone. Every editable string in all seven Home sections now carries its own colour,
declared immediately after it (`tint`/`fade`, §14) and applied by that section's own
component. Gradient-painted copy — the big two-word headings, the scrolling hero names —
gets a top/bottom pair; each heading word is now clipped to its own gradient rather than
sharing one across the line, which renders identically for a single line of text but lets the
light word and the bold word be coloured apart. 60 colour fields, none of which override any
other.

Decoration was separated from copy: hairlines, scrims, card borders and hover fills moved to
`src/pages/Home/homeChrome.js` as fixed design constants, spread onto each section's root so
the existing `--pj-*` classes still resolve. They are not in the Editor — an admin colouring
a heading should not have to think about the 1px rule beside it.

**Files:** `server/src/modules/page-content/page-content.constants.ts` (`tint`/`fade`
builders, `HOME_SECTIONS` rewritten), `src/pages/Home/homeChrome.js` (new),
`src/pages/Home/Home.jsx`, and all seven section components — `Herocircle.jsx`,
`BrandsSection.jsx`, `FeaturedCollections.jsx`, `OurPillars.jsx`, `OurBrands.jsx`,
`Exhibition.jsx`, `GrowthSection.jsx`.

**Reason:** Requested — colour editing beside every text field on the Home page, and the
removal of colour fields that were overridden or dead.

**Impact:**
- **No schema change, no data touched.** `page_content` rows for the removed
  `home.colours.*` fields are ignored by `valuesFor()` (it returns only fields the schema
  declares), so a saved page-wide colour simply stops applying. The rows are left in place
  rather than deleted.
- **The client HAD two page-wide overrides saved, and they are preserved.** The live database
  held `colours.bodyColor = #0E4238` (shipped: `#0B5B5D`) and
  `colours.headingAltColor = #3E9C86` (shipped: `#286F6F`) — so the live page was already
  showing a palette the code did not declare. Every new per-field default derived from those
  two carries the **client's** value, not the shipped one, in both the schema and the
  component fallbacks (`homeChrome.js` carries the same note). Dropping the section without
  doing this would have silently reverted their page.
  **So two Home defaults are deliberately not the original design values.** Anyone comparing
  `page-content.constants.ts` against a pre-2026-09-07 checkout will see the difference and
  should not "correct" it.
- Every section re-checked in the browser after the change — computed colours identical to
  what the page rendered before it: hero title `rgb(14,66,56)`; ticker and all four section
  headings `#01383B`→`rgb(62,156,134)`; welcome eyebrow `#C9A15A`; growth highlight
  `#C9A15A`.

### 2026-09-07 — Re-verification sweep: four regressions closed

**Change:** Audited every claim in `brain.md` §19 and `SECURITY.md` §8–§10 against the
source rather than against the previous report. Four controls that both documents describe as
DONE were **not present in the code** — the repository was rolled back on disk between audits
and they were lost with it. All four are now implemented.

1. **Refresh tokens were hashed with bcrypt again.** `utils/tokenHash.ts` existed, was fully
   documented, and was imported by nothing. `auth.service.ts` used `hashValue()`
   (`bcrypt.hash`) to store the refresh token and `comparePassword()` to check it. bcrypt
   truncates at 72 bytes and a refresh JWT's first 72 bytes are the fixed header plus the
   opening of the userId, so the stored hash identified a *user*, not a *session*.
   Reproduced against this project's own `bcryptjs` + `jsonwebtoken`: two different refresh
   tokens for the same user, `bcrypt.compare(tokenB, hashOf(tokenA))` → `true`. Rotation on
   `/refresh` therefore evicted nothing and a stolen token stayed valid for its full seven
   days. Now uses `hashToken`/`tokenMatches` (SHA-256, constant-time). Passwords and OTPs
   keep bcrypt — they are short and low-entropy, which is what bcrypt is for.
2. **Mock mode defaulted back to ON.** `USE_MOCK` read `?? 'true'`, and every other mock
   flag inherits it. Mock auth accepts any credentials, and Vite inlines the value at build
   time, so a build that merely forgot `VITE_USE_MOCK` shipped an admin login that let
   anyone in — invisibly. Now defaults to `'false'`; mock mode is opt-in.
3. **The boot-time configuration checks did not exist.** `SECURITY.md` §8.3 describes them
   as living in `config/env.ts`; `required()` was the only check there. Added
   `assertProductionConfig()`: in production it refuses to start on a JWT secret under 32
   characters, on the two JWT secrets being identical, or on bcrypt rounds below 10. Verified
   in both directions — weak values refuse the boot, the real `.env` values pass.
4. **`normaliseQuery` was written but never mounted.** Its own docstring says "Mounted
   before the routes"; it appeared nowhere outside its own file. A repeated query parameter
   (`?status=a&status=b`) hands the handler an array, which reaches a Prisma `where` and
   turns an unauthenticated request into a 500 with a stack trace in the log. Now mounted on
   `/api` between `apiLimiter` and `csrfProtection`.

Also: fixed the 6 mechanical lint errors (unused imports in `Topbar.jsx` and `SeoPage.jsx`,
unused `title`/`subtitle` props); converted `EditorPage.jsx`'s `savedRef` to state so the
`dirty` memo no longer reads a ref during render; stopped ESLint from linting `server/dist`
(21 of the 41 reported errors were generated code); declared the nine `@tiptap/*` packages
that the blog editor imports but `package.json` never listed.

**Files:** `server/src/modules/auth/auth.service.ts`, `server/src/config/env.ts`,
`server/src/app.ts`, `src/services/api/client.js`, `src/components/layout/Topbar.jsx`,
`src/features/seo/pages/SeoPage.jsx`, `src/features/page-content/pages/EditorPage.jsx`,
`eslint.config.js`, `package.json`, `pnpm-lock.yaml`, `.claude/launch.json` (new),
`brain.md`, `security.md`.

**Reason:** The two documents were being read as a description of the running system. On four
counts they were not.

**Impact:**
- **Every session is invalidated.** Stored `refreshTokenHash` values are bcrypt digests;
  the comparison is now SHA-256, so none can match. Everyone signs in again, and sign-in
  needs an emailed code — **verify mail delivery before deploying.**
- **A production deploy will now fail loudly** if a JWT secret is weak, duplicated, or bcrypt
  rounds are under 10. That is intended. It cannot catch a *missing* `NODE_ENV` — see §19 #4.
- New dependencies: 9 `@tiptap/*` packages at 3.31.3 (+56 transitive).
- No schema change. No data touched.

### 2026-09-03 — Technical audit and documentation
**Change:** Full codebase audit; created `PROJECT_TECHNICAL_AUDIT.md`; rewrote `BRAIN.md` in
the 23-section structure. No application code changed.
**Files:** `PROJECT_TECHNICAL_AUDIT.md` (new), `BRAIN.md` (rewritten). `brain.md` retained.
**Reason:** Establish a verified single source of truth.
**Impact:** Documentation only.

### 2026-09-03 — Security hardening (second pass)
**Change:** Fixed defects found by an adversarial review of the first pass: the opaque `null`
origin could satisfy the CORS and CSRF allow-lists; `/auth/reset-password` bypassed the OTP
attempt counter; the SVG scrubber was namespace-blind (`<s:script>` survived) and over-stripped
legitimate styling; CSP `connect-src` ignored the allow-list; the XLSX fix corrupted phone
numbers; page-content threw on the first invalid legacy value, blocking whole-page saves;
SEO length floors trapped legacy records; the login password ceiling could lock out an
existing passphrase. Added P2022 "schema drift" handling.
**Files:** `config/cors.ts`, `middleware/csrf.middleware.ts`, `utils/sanitizeSvg.ts`,
`modules/auth/auth.service.ts`, `auth.validation.ts`, `app.ts`, `middleware/error.middleware.ts`,
`modules/inquiries/inquiry.service.ts`, `modules/page-content/page-content.service.ts`,
`page-content.constants.ts`, `modules/seo/seo.validation.ts`,
`modules/seo-settings/seo-settings.validation.ts`.
**Reason:** The first hardening pass introduced its own bypasses and regressions.
**Impact:** All controls re-verified live. 14/14 SVG payloads stripped; real icons keep styling.

### 2026-09-02 — Security hardening (first pass)
**Change:** CORS allow-list replacing `origin:true`; CSRF middleware; `SameSite=Lax`;
refresh tokens moved from bcrypt (72-byte truncation) to SHA-256; `crypto.randomInt` OTPs with
attempt lockout; JWT algorithm/issuer/audience pinning; `UserRole` + `requireAdmin`;
magic-byte upload validation; central SVG scrubbing; rate limiters for OTP request, contact
form and uploads; CSP/HSTS/Permissions-Policy hardening; error and 404 sanitising; security
event logging; secret-strength boot checks; mock flags defaulted off; hardcoded seed password
removed; unused dependencies removed.
**Files:** ~45 files across `server/src/**`, `src/services/api/client.js`, `schema.prisma`,
`seed.ts`, `.gitignore`, `.env.example`.
**Reason:** Full OWASP-aligned audit.
**Impact:** **Existing sessions invalidated once.** DB gained `users.role` and
`users.otpAttempts`.

### 2026-09-02 — Blog module
**Change:** Added blog: `blog_posts` + `blog_comments`; server module; TipTap editor; public
`/blog` and `/blog/:slug`; comment moderation; share row; per-post SEO. Added Marketing › Blog.
**Files:** `server/src/modules/blog/**`, `src/features/blog/**`, `AppRoutes.jsx`,
`AdminRoutes.jsx`, `Sidebar.jsx`, `schema.prisma`, `globals.css` (`.pj-prose`).
**Reason:** Client requested a blog with rich text, embeds, sharing and comments.
**Impact:** Two new tables (additive). New deps: 11 TipTap packages + `sanitize-html`.

### 2026-09-02 — Header and Footer editors
**Change:** Added `area` to `ContentPage`; `EditorPage` became area-aware; new
`/admin/header` and `/admin/footer`; footer ticker gained SVG icon + colour + animation speed
controls; added `svg` and `number` field types.
**Files:** `page-content.constants.ts`, `page-content.service.ts`, `EditorPage.jsx`,
`HeaderPage.jsx`, `FooterPage.jsx`, `Field.jsx`, `Navbar.jsx`, `Footer.jsx`,
`upload.middleware.ts`, `utils/sanitizeSvg.ts`, `public/Icons/ticker-star.svg`.
**Reason:** Header/footer are on every page and were not editable.
**Impact:** SVG uploads enabled (scrubbed).

### 2026-09-02 — CMS expansion
**Change:** Made Collections, Brands, Exhibitions and Contact pages editable; added
`manage` links to Management screens; added colour and image field types with a 17-swatch
brand palette; images across Home and About made editable; removed the separate
Editor › Images page (migrating its published frame into `page_content`).
**Files:** `page-content.constants.ts`, `page-content.service.ts`, `Field.jsx`,
`EditorPage.jsx`, `media` module (reduced to upload/list/delete), all public page components,
`heroContent.js` (new).
**Reason:** Client wanted the whole site editable from the panel.
**Impact:** `section_images` orphaned but retained. `media.validation.ts` deleted.

---

## 28. BRAIN.md maintenance rule

**This file is a living document. It must always describe the CURRENT implementation.**

Before an architectural change: **read this file.**
After the change: **update it in the same piece of work**, covering whichever of these moved —

folder structure · important files · API registry (§9) · database (§8) · Supabase (§7) ·
environment variables (§16) · authentication (§10) · authorization (§11) · CMS (§14) ·
data flow (§15) · dependencies · security rules (§18) · known issues (§19) ·
technical debt (§20) · **change log (§23)**.

Change-log entry format:

```
### YYYY-MM-DD — short title
**Change:**  what actually changed
**Files:**   the files touched
**Reason:**  why
**Impact:**  migrations, breaking changes, new deps, anything a deployer must know
```

If you find this file disagreeing with the code, **the code is right** — correct the file and
note it in the change log.
