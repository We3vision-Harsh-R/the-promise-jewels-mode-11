# Exhibition operations

**Status: built and verified end to end.** Admin > Exhibitions > the clipboard
icon on any show.

Last updated: 2026-09-13.

| Check | Command | Result |
|---|---|---|
| API + arithmetic | `npm run ops:check` | 32 assertions, passing |
| Route coverage | `npm run rbac:coverage` | 100 guarded, 28 public, **0 uncovered** |
| Permission logic | `npm run rbac:check` | passing |
| Live enforcement | `npm run rbac:e2e` | passing |
| Server types | `npx tsc -p server/tsconfig.json --noEmit` | clean |
| Frontend build | `npx vite build` | clean |

---

## 1. The distinction this is built on

The `exhibitions` record that already existed is a **publishing** record: the
title, venue, dates, gallery and copy the **website** prints. It answers *"which
shows are we attending?"* for a visitor.

This is **operations**: running the show. It answers *"what is the stall
number, what has it cost, who did we meet, and did all the gold come back?"*
for the company.

Same show, two different jobs, two different audiences — and two different
levels of trust, which is why they are two different permissions.

---

## 2. Why none of it is a column on `exhibitions`

`exhibition.repository.ts` reads the public show with **`include`, not
`select`**. That returns *every* column on the row.

A `stallCost` or `goldWeightOut` column added there would travel straight out
of the public API onto the website, and nothing in the code would object. It
would be a leak that depends on somebody remembering to exclude a field.

In their own tables it cannot happen. The public query has no reason to join
them, so operational data is not "hidden from" the website — it is not
reachable from it.

---

## 3. Money and weight are `Decimal`, never `Float`

A float cannot hold `0.1` exactly. For a business weighing gold to the
milligram and reconciling what left against what came back, a rounding error
is not cosmetic — it is an unexplained discrepancy in stock.

So the whole path is decimal:

```
typed as a string  →  validated as a string  →  Prisma.Decimal
   →  Postgres decimal(14,2) / decimal(12,3)  →  summed with Decimal maths
   →  returned as a string  →  displayed by grouping the digits
```

There is no `Number()` anywhere in it. Even the display formatter groups the
digit string by hand rather than calling `toLocaleString()`, which would parse
and round it.

`npm run ops:check` asserts the arithmetic exactly — `195000.00 + 38500.50 =
233500.5`, `1180.250 − 920.000 = 260.25`. Those pass by luck with floats on
small numbers and fail on a real show.

---

## 4. Where it lives in the panel

Exhibition is its own sidebar group, not one entry under Management:

```
EXHIBITION
  Shows          /admin/exhibitions              the record the website prints
  Overview       /admin/exhibitions/<id>/ops/overview
  Leads          …/ops/leads
  Costs          …/ops/costs
  Stock          …/ops/stock
  Crew           …/ops/crew
  Tasks          …/ops/tasks
  Meetings       …/ops/meetings
  Files          …/ops/files
  Daily log      …/ops/log
  Custom fields  …/ops/fields
```

A show is not one screen, it is twelve. Buried as a single link under
Management, eleven of them were reachable only by finding the right row in a
table first.

**The open tab is in the URL, not in state.** A sidebar entry has to be
addressable, and it also makes a tab shareable, bookmarkable and survivable
by the back button.

**Which show?** The operations entries are per-show and a sidebar link
cannot ask which one you meant, so they point at the **last show opened**
(`currentShow.js`, localStorage). The URL still names the show — the memory
only decides where the sidebar points. With nothing remembered the entries
fall back to the Shows list, which is where you would go to pick one anyway.

**Slug vs kind.** `opsSpec.js` gives each module both: `kind` is the API
path segment, `slug` is what appears in the address bar. They differ where
the API name is not what a person would type — `inventory` → `stock`,
`appointments` → `meetings`, `logs` → `log`. Renaming a table should not
rename a bookmark.

> **A small thing worth keeping.** `NavLink` matches on prefix by default,
> so "Shows" (`/admin/exhibitions`) lit up on every operations page beneath
> it — two entries highlighted at once, neither wrong-looking enough to
> notice quickly. `end` is now set on entries that have real routes under
> them.

---

## 5. The ten modules

| Tab | What it holds |
|---|---|
| **Overview** | The stall (hall, number, size, setup/teardown, organiser, budget) and the computed report |
| **Leads** | Buyers met at the stall — rating, stage, value, owner, follow-up |
| **Costs** | Planned vs actual, by category, paid/unpaid |
| **Stock** | What went and what came back — pieces, gross/net weight, value |
| **Crew** | Who is going, travel dates, and their shifts on the stall |
| **Tasks** | Before, during and after — owner, due date, stage |
| **Meetings** | Buyer appointments, optionally linked to a lead |
| **Files** | Stall letter, invoices, passes |
| **Daily log** | What happened each day |
| **Custom fields** | The hybrid half — anything the above did not anticipate |

### The hybrid decision

Fixed tables for anything that must be **summed, filtered or reported on** —
money, weights, leads, people. A label/value pair cannot be totalled, so those
could never be generic.

Custom fields for everything else: a meter reading, a courier docket, whatever
next year's show needs. Added from the panel, no developer.

**A custom field is a note you can find again, not a number the system
understands.** That line is the whole design.

### Leads are not `inquiries`

`inquiries` is fed by the website's contact form — a stranger typing into a
box. A lead is filled in by staff standing at a stall with a person in front of
them, and needs a rating, an owner and a follow-up date that a web enquiry has
no use for. One table serving both would be mostly-empty columns in two
directions.

---

## 6. The report

Computed on read, never stored. These numbers are a function of rows that
change all day during a show; a stored total is a total that is wrong between
the edit and whatever was supposed to refresh it.

It gives: spent vs budget, unpaid, leads by rating and stage, pipeline vs won,
cost per lead, and the stock reconciliation.

**Only counted stock lines are totalled.** A line becomes "counted" the moment
any *back* figure is filled in — the act of typing what returned **is** the
count, so nobody has to remember to press a button. Uncounted lines are
reported separately (`Stock not counted`) rather than silently left out, and
`null` pieces-back is deliberately **not** the same as `0`: null means nobody
has counted it, zero means it all sold.

---

## 7. Permissions

Its own resource: **`exhibitionOps`**, separate from `exhibitions`.

Somebody trusted to write a show's description for the website is not
automatically somebody who should see its margin, and they are often different
people. The clipboard button on the Exhibitions list only appears for an
account holding `exhibitionOps:view`.

Nothing here is public.

> **A note on the guards.** These were written as four local consts
> (`const view = requirePermission(...)`) and `rbac:coverage` reported **all 31
> routes as UNCOVERED**. It reads route declarations as text and looks for the
> call — which is exactly what makes it worth having: it cannot be satisfied by
> a variable that merely looks like a guard. Following the alias would have
> weakened the check to keep the file short. Every guard is now written out in
> full.

---

## 8. Scoping

Every child row is reached through its show's ops row, and every update and
delete is an `updateMany` / `deleteMany` with the ops id in the `where`.

A row id from one show used against another changes nothing and returns 404 —
asserted in `ops:check`, step 8. It also means "does this row exist" and "is it
this show's" are the same answer, so the API cannot be used to discover ids.

---

## 9. File map

**Server** — `server/src/modules/exhibition-ops/`

| File | What it is |
|---|---|
| `exhibition-ops.types.ts` | Zod schemas. Money/weight as checked strings. |
| `exhibition-ops.service.ts` | All reads and writes, plus the report arithmetic. |
| `exhibition-ops.controller.ts` | Thin HTTP layer. |
| `exhibition-ops.routes.ts` | `/api/v1/exhibition-ops`, every route guarded. |
| `exhibition-ops.e2e.mjs` | `npm run ops:check`. |

**Browser** — `src/features/exhibition-ops/`

| File | What it is |
|---|---|
| `opsSpec.js` | The nine list modules, declared as data. |
| `OpsTable.jsx` | One component that renders all of them. |
| `exhibition-ops.api.js` | The client calls. |
| `pages/ExhibitionOpsPage.jsx` | Tabs, the report, and the stall form. |

Nine near-identical tables would have been nine places for the same bug to be
fixed eight times, so they are declared once and rendered by one component.

**Tables:** `exhibition_ops`, `_leads`, `_costs`, `_crew`, `_shifts`, `_tasks`,
`_documents`, `_logs`, `_inventory`, `_appointments`, `_ops_fields`.

---

## 10. A bug this work surfaced

**Every modal in the dark admin panel was rendering with the light theme.**

`Modal.jsx` portals to `<body>`, outside `.admin-theme`, and copied the
*class* across — but not the `data-admin-theme` *attribute*. Every dark rule in
`globals.css` is written `.admin-theme[data-admin-theme="dark"] …`, so none of
them matched: near-white inputs with dark green text, floating on a dark page.

Measured, not guessed — `rgba(255, 255, 255, 0.62)` on a background of
`rgb(1, 8, 6)`.

It was pre-existing and affected **every** modal — Collections, Brands, Blog,
the Vault, the section designer. `useAdminTheme` already mirrors the attribute
onto `<body>` for the colour picker, so the modal now reads it from there. One
line; every dark modal rule started working.

---

## 11. Not built

- **Orders.** A lead can be marked WON with a value, but there is no order
  record, no line items and no invoice.
- **Lead capture on a phone at the stall.** The screen is responsive but it is
  an admin form, not a two-tap capture flow. If leads are being typed at a
  stall on a phone, that is the next thing worth building.
- **Carrying stock forward between shows.** Each show's stock list is its own.
- **Export.** No CSV or PDF of the report yet.
- **Recurring shows.** IIJS every year is a fresh record each time; nothing
  copies last year's costs or checklist forward.
