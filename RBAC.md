# RBAC — Promise Jewels admin panel

**Status: enforcement is complete and verified end to end. Every API route is
either guarded by a permission or listed as public with a written reason. The
five System *screens* are not built yet — see §7.**

Last updated: 2026-09-10.

| Check | Command | Result |
|---|---|---|
| Permission logic | `npm run rbac:check` | 16 assertions, passing |
| Route coverage | `npm run rbac:coverage` | 64 guarded, 28 public, **0 uncovered** |
| Live enforcement | `npm run rbac:e2e` | 18 assertions against a running server, passing |

---

## 1. The one idea

There is **one catalogue of permissions**, on the server, in
`server/src/modules/rbac/permissions.catalog.ts`.

The server checks against it. The browser is *handed* it and renders whatever
it is given. Neither side keeps its own copy, so the two cannot drift — which
is the failure mode this design exists to prevent.

A permission is a **resource** plus an **action**: `collections:edit`.

- **Resources** are the things an admin works on — one per screen, plus the
  System group.
- **Actions** are `view`, `create`, `edit`, `delete`. Four verbs, because a
  longer list means role forms nobody reads.

`view` is load-bearing: without it the sidebar entry is not rendered and the
route refuses to mount. It is the switch that hides a whole area.

---

## 2. Files

| File | What it is |
|---|---|
| `server/src/modules/rbac/permissions.catalog.ts` | **The catalogue.** The only place a permission is declared. |
| `server/src/modules/rbac/rbac.service.ts` | Resolving a user's permissions, and role CRUD. |
| `server/src/middleware/permission.middleware.ts` | `requirePermission` / `requireAnyPermission`. **The actual control.** |
| `server/src/modules/rbac/rbac.routes.ts` | `/api/v1/rbac/*` |
| `server/src/modules/rbac/rbac.controller.ts` | Thin HTTP layer. |
| `server/src/modules/rbac/rbac.validation.ts` | Zod schemas for role input. |
| `server/src/modules/rbac/rbac.selftest.ts` | 16 assertions on the logic. `npm run rbac:check`. |
| `server/src/modules/rbac/rbac.coverage.ts` | Proves no route is unguarded. `npm run rbac:coverage`. |
| `server/src/modules/rbac/rbac.e2e.ts` | Proves the guards refuse real requests. `npm run rbac:e2e`. |
| `server/src/modules/page-content/page-content.permission.ts` | Picks header/footer/content per request — they share one endpoint. |
| `server/src/modules/page-content/custom-section.routes.ts` | The section designer. Every route needs `sections:*` — Master only, until granted. |
| `src/features/rbac/permissionsContext.js` | The context and its hooks. |
| `src/features/rbac/usePermissions.jsx` | `PermissionsProvider`, `<Can>`. |
| `src/features/rbac/rbac.api.js` | The client calls. **No mock branch, deliberately.** |
| `src/app/routes/RequirePermission.jsx` | Route guard + the no-access screen. |

---

## 3. Three gates, one control

1. **The navigation** does not offer what the role cannot open.
2. **The route** (`RequirePermission`) does not mount it if the URL is typed.
3. **The API** (`requirePermission`) refuses the request regardless.

Only the third is a security control. The first two exist so the panel behaves
sensibly instead of filling with failed requests. **Hiding a button is a
courtesy — the request it would have sent can still be made by hand.**

---

## 4. Database

Five tables, all additive. Verified with `prisma migrate diff` before pushing:
no `DROP`, no data loss. `users` gained one nullable `roleId`.

| Table | Holds |
|---|---|
| `roles` | id, name (unique), description, `isSystem` |
| `role_permissions` | one row per `(roleId, resource, action)` |
| `announcements` | a declaration: title, body, author |
| `announcement_targets` | which roles a declaration was addressed to |
| `notifications` | one row per recipient, with its own `readAt` |

Permissions are **rows, not a JSON blob**, so "which roles can delete a brand"
is a query, and a permission that no longer exists in the catalogue can be
found and cleaned up.

Notifications are **fanned out when a declaration is published**, not resolved
on read. Two reasons: who held a role at the time of writing is the audience
that was intended, and a per-user row is what gives each recipient their own
read state.

---

## 5. The master role

`Master`, `isSystem = true`.

- Holds every permission **without a single stored row** — the check
  short-circuits. A resource added to the catalogue is available to it
  immediately, with no box to remember to tick.
- Cannot be renamed, edited, or deleted. It is the way back in when a
  permission change locks everyone out of everything.
- `ensureMasterRole()` runs at boot: creates it if missing, and assigns it to
  any account with no role.

**Why the boot hook matters:** every account predates RBAC, so every account
had `roleId = null`. Without it, the first deploy would have locked the only
admin out of the panel — including out of the screen where roles are assigned.
Confirmed on this database: 2 accounts, both now hold Master, 0 orphans.

---

## 6. Verified

`npm run rbac:check` — 16 assertions, all passing:

- A role holds exactly what it was granted, and nothing else.
- A user's effective permissions come from their role.
- A limited role is denied `collections:delete`, `users:view`, `roles:view`.
- The master role is flagged, holds everything, and has zero stored rows.
- The master role cannot be edited or deleted.
- A permission not in the catalogue is refused.
- A duplicate role name is refused.

`npm run rbac:e2e` — 18 assertions against a running server. A role holding
only `collections:view` is refused Inquiries, Dashboard, Media, Roles,
Settings and Page content (all 403), is allowed its own `/rbac/me`, and the
public website stays open to an anonymous caller. The same account as Master
is allowed all of them.

`npm run rbac:coverage` — 92 declarations: 64 guarded, 28 public with a
written reason each, **0 uncovered**. Exits non-zero otherwise, so it can gate
a deploy.

---

## 7. NOT built yet

### 7.1 Per-route enforcement — DONE

All 92 route declarations are accounted for: **64 guarded, 28 public, 0
uncovered.** `npm run rbac:coverage` fails the build if that ever stops being
true, so a route added without a permission is caught rather than discovered.

Three things worth recording from doing it:

- **Designing a section is its own resource.** `sections` was added when the
  page builder was (see [PAGE-BUILDER.md](PAGE-BUILDER.md)). It is not part
  of `content` on purpose: editing the words on a page and changing what the
  page is *made of* are different levels of trust, and only the master role
  holds it until it is granted deliberately. Arranging a page, by contrast,
  IS that page's `edit` permission — rearranging a page is editing it.

- **The media library had no resource.** Uploads go through `/media/assets`,
  which Collections, Brands, Exhibitions *and* the Editor all use. Folding it
  into `content` would have meant a Collections-only role could not upload a
  collection image, so `media` is its own resource.
- **Content, Header and Footer are one endpoint.** All three write to
  `page_content` through `/page-content/:page`. A single `content:edit` there
  would have meant granting someone the Header screen silently granted them
  every other page. `page-content.permission.ts` picks the resource from the
  page being addressed.
- **Five routes had the guard running before `requireAuth`.** They returned
  401 for everyone, including the master role — `req.user` did not exist yet.
  Caught by `rbac:e2e`, not by reading; the static coverage check said they
  were guarded, and they were, just uselessly. This is exactly why the live
  test exists alongside the static one.

### 7.2 The five System screens — NOT built

Of the five asked for, only Settings exists.

| Screen | Screen | API behind it |
|---|---|---|
| Settings | exists, unchanged | guarded by `settings:*` |
| Users | **built** | **built** — `/api/v1/users`, full CRUD |
| Roles | **built** | **built** — `/api/v1/rbac/roles`, full CRUD |
| Notifications | **not built** | **not built** (tables exist) |
| Declaration | **not built** | **not built** (tables exist) |

### 7.3 User creation with OTP

New accounts, and the emailed one-time code going to the address the account
was created with. The auth flow already sends OTPs (`auth.service.ts` +
`mail.service.ts`); what is missing is the create-user endpoint and screen.

Note that mail currently sends from Resend's sandbox sender
(`onboarding@resend.dev`), which **only delivers to the account owner's own
address**. A new user would never receive their code until a verified sender
on `thepromisejewels.com` is configured — see BRAIN.md §21.

### 7.5 Declarations and notifications

Tables exist; no API, no fan-out, no UI.

The rule to implement: an announcement is addressed to roles, and the fan-out
writes one notification per user **holding one of those roles at publish
time**. That is what keeps one role's content out of another's.

### 7.6 Sidebar and route wiring — DONE

Every admin route is wrapped in `RequirePermission`, and each sidebar entry
carries its resource key and renders only when the role may open it. A group
whose items are all hidden disappears rather than leaving a heading over
nothing.

---

## 8. Rules for whoever continues this

1. **Never hard-code a permission string in the frontend.** Call
   `can(resource, action)`. The strings live in the catalogue.
2. **Never add a screen without a catalogue entry.** A screen with no resource
   has no permission to grant, and `requirePermission` throws at boot rather
   than failing silently at request time.
3. **Deny by default, everywhere.** No session, no role, no matching grant, or
   an unknown resource are all a 403.
4. **A failed permission fetch means "no permissions", never "allowed".**
   `usePermissions` fails to the empty profile on purpose.
5. **Do not give the master role stored permission rows.** It is unconditional
   by design; rows would rot the moment the catalogue changed.
6. **Run `npm run rbac:check` after touching any of this.** It is currently the
   only automated test in the project.
