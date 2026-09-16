# Page builder — arrangement and designed sections

**Status: built and verified end to end.** Every public page now renders from
an arrangement the panel controls, and Master can design brand-new sections
from the admin panel and place them on any of those pages without a deploy.

Last updated: 2026-09-10.

| Check | Command | Result |
|---|---|---|
| Server types | `npx tsc -p server/tsconfig.json --noEmit` | clean |
| Route coverage | `npm run rbac:coverage` | 64 guarded, 28 public, **0 uncovered** |
| Permission logic | `npm run rbac:check` | 16 assertions, passing |
| Live enforcement | `npm run rbac:e2e` | 18 assertions, passing |
| Frontend build | `npx vite build` | clean |

---

## 1. The two halves

The request behind this splits into two genuinely different problems, and it
is worth keeping them apart because they are solved differently.

**Arranging** — moving a band up or down a page, or hiding it. The bands
already exist as React components; only their order changes.

**Designing** — building a band that did not exist before. There is no
component to move, so one has to be assembled from data.

Both end up in the same list in the panel (Admin > Content > *Arrangement*),
because from the editor's side they are the same act: deciding what a visitor
scrolls past. Underneath they are two tables.

---

## 2. Arranging

### What renders a page now

Every public page used to list its own bands as JSX, so the order was fixed at
build time. Each one now hands a **registry** to `PageSections.jsx`:

```jsx
const SECTIONS = {
  hero: () => <HeroCircle />,
  welcome: () => <BrandsSection />,
  // …
};

<PageSections page="home" sections={SECTIONS} />
<Footer />
```

- Keys match `page-content.constants.ts`, which is what the panel lists.
- **Declaration order is the default order**, so a page nobody has touched
  renders exactly as it always did.
- Values are **functions returning JSX**, not bare components. Three pages
  hold state their bands share — which brand is being filtered on, which shows
  have loaded — and a registry of components would have nowhere to put it.
- The **footer is never in the registry**. It closes every page, it is not part
  of any page's arrangement, and it has its own screen in the panel.

### Where the order lives

`page_sections` — one row per section an admin has actually touched:

| column | meaning |
|---|---|
| `page` | a key from `CONTENT_PAGES` |
| `sectionKey` | the section's key on that page |
| `position` | 0-based |
| `isVisible` | false hides it from the website; the copy is kept |

`@@unique([page, sectionKey])`, `@@index([page, position])`.

**An untouched page has no rows at all.** `getLayout` falls back to declaration
order, everything visible — so this table starting empty means the site renders
as it did before the feature existed. That is the property to preserve when
changing anything here.

### Which pages can be arranged

`ContentPage.arrangeable` says so, and only pages rendering through
`PageSections.jsx` carry it. All seven do:

| page | sections, in order |
|---|---|
| home | hero · welcome · collections · pillars · brands · exhibition · growth |
| about | hero · values · leaders · gallery · growth |
| collections | hero · tabs · listing · inquiry · cta |
| brands | hero · listing · growth |
| exhibitions | hero · schedule · listing · cta · faq · inquiry |
| contact | hero · details |
| blog | hero · posts · growth |

Header and Footer are `standalone` and not arrangeable — they are not pages.

Saving an arrangement for a page that is not `arrangeable` is **refused**
rather than stored, because storing it would leave the panel showing an order
the website does not follow.

### Structural sections

Some bands have no editable words of their own — a listing of records, a form,
a grid. They are declared anyway (`structural: true`, empty `fields`) because
the arrangement cannot move or hide what it does not know exists. The Editor
shows them as a card with a link through to the screen that owns their
content.

### ScrollTrigger

Three sections pin themselves with GSAP ScrollTrigger, which measures the
document once on mount. `PageSections` calls `ScrollTrigger.refresh()` on the
frame after an arrangement that arrives post-mount changes the order —
without it a pinned section fires at the wrong scroll position for the rest of
the visit.

---

## 3. Designing

### What a designed section is

A declared section is a React component: it can pin to the scroll, mask
photographs into rings, run a timeline. A designed section cannot do any of
that, and a builder that pretended otherwise would produce broken pages.

What it *can* do is the shape most bands actually are: a strip of colour
holding a heading, some words, a picture, a button. Six block types cover it:

| block | fields |
|---|---|
| `heading` | text, level (1–3), font, size, weight, spacing, colour, alignment |
| `text` | text, same typography |
| `image` | url, alt, width (third/half/wide/full), corner radius |
| `button` | label, href, background, label colour |
| `spacer` | height 4–240px |
| `divider` | colour |

And the band around them: `background`, `paddingY` (0–200), `width`
(narrow/normal/wide), `align`.

### Where it lives

`custom_sections` — `page`, `sectionKey`, `label`, `blocks` (JSON), `style`
(JSON). `@@unique([page, sectionKey])`.

JSON because the shape *is* the design; a column for "the third block's letter
spacing" is not a schema, it is a spreadsheet. Both columns are validated
against a Zod schema (`custom-section.types.ts`) on the way **in and out** — a
row written by an older build reaches the boundary and is skipped as one
broken section, never as a blank page.

The key is always `custom-<slug>-<random>`. No declared section starts with
`custom-`, so a designed section named "Hero" can never collide with the real
one. **The key is not rewritten on rename** — it is what the arrangement
points at, and regenerating it would orphan the section's position.

### What renders one

`src/features/page-content/CustomSection.jsx`. One component draws every
designed section, and its defaults are the brand's own — Ringtte for display,
Optika for body, deep emerald for headings, muted teal for words. Someone who
adds a heading and changes nothing else still gets something that belongs on
this site. What they set overrides it.

The designs travel **with** the arrangement, in the same public response, so
the page never knows its order without knowing how to draw part of it.

```
GET /page-content/public/:page/layout
  -> { order: string[], custom: [{ key, blocks, style }] }
```

Hidden sections are filtered from both halves — a visitor never downloads the
name, let alone the design, of a band somebody chose not to show them.

### Safety

Every value ends up in an inline style or an href on the public website, so
nothing is trusted:

- Colours must match `#rgb` / `#rrggbb`. No `rgb()`, no named colours, no
  `url()`.
- Fonts, weights and sizes are checked against the same lists the Editor is
  handed, exactly as page content is.
- A button's `href` must be a path starting `/` or a full `http(s)://`
  address. `javascript:` is refused — this is the one place a non-developer
  supplies a URL that reaches the markup.
- Padding, radius, spacer height and block count are all capped, so the form
  cannot produce a page that looks broken.

---

## 4. Permissions

Designing a section is its own resource, **`sections`**, in the catalogue —
held only by Master until it is granted deliberately in System > Roles.

It is deliberately not part of `content`. Editing the words on a page and
changing what the page is *made of* are different levels of trust, and a role
can now be given one without the other.

- `sections:view` — open the designer, list a page's designs
- `sections:create` — the "Design a section" button
- `sections:edit` — the pencil beside a designed section
- `sections:delete` — the Delete button

Arranging a page is guarded by that page's own permission
(`requirePagePermission("edit")`), because rearranging a page is editing it.
Header access does not grant it, and vice versa.

The public layout route is unguarded and listed in `rbac.coverage.ts` with its
reason: it is what every visitor sees. `/sections/*` is never public — an
anonymous request gets 401, asserted in `rbac:e2e`.

---

## 5. File map

**Server**

| file | what it is |
|---|---|
| `page-content/page-layout.service.ts` | the arrangement: read, merge declared + designed, save |
| `page-content/page-layout.validation.ts` | the save payload |
| `page-content/custom-section.types.ts` | what a block is, and every rule about it |
| `page-content/custom-section.service.ts` | designed sections: CRUD, key generation |
| `page-content/custom-section.validation.ts` | the create/update payloads |
| `page-content/custom-section.controller.ts` | handlers, plus the designer's option lists |
| `page-content/custom-section.routes.ts` | mounted at `/api/v1/sections`, every route guarded |
| `page-content/page-content.constants.ts` | `arrangeable`, `structural`, the section catalogue |

**Browser**

| file | what it is |
|---|---|
| `features/page-content/PageSections.jsx` | renders a page from its arrangement |
| `features/page-content/hooks/usePageLayout.js` | one cached request per page, falls back to the built-in order |
| `features/page-content/CustomSection.jsx` | draws a designed section |
| `features/page-content/custom-section.api.js` | the designer's API client |
| `features/page-content/pages/SectionDesignerPage.jsx` | the designer, with a live preview |
| `features/page-content/pages/EditorPage.jsx` | the Arrangement card |

---

## 6. Endpoints

| method | path | guard |
|---|---|---|
| GET | `/page-content/public/:page/layout` | public |
| GET | `/page-content/:page/layout` | that page's `view` |
| PUT | `/page-content/:page/layout` | that page's `edit` |
| GET | `/sections/options` | `sections:view` |
| GET | `/sections/page/:page` | `sections:view` |
| GET | `/sections/:id` | `sections:view` |
| POST | `/sections` | `sections:create` |
| PUT | `/sections/:id` | `sections:edit` |
| DELETE | `/sections/:id` | `sections:delete` |

A save must send **every** section on the page exactly once. A partial list is
refused rather than merged: a list that silently dropped one would leave it at
a stale position, which reads as a bug in the reorder rather than in the
payload that caused it.

Deleting a designed section removes its `page_sections` row in the same
transaction, so no position is left pointing at nothing.

---

## 7. Verified

Checked against a running server and in the browser:

- All seven pages render through `PageSections` in their original order.
- Reordering and hiding from the panel changes the live site; hidden sections
  disappear and keep their copy.
- A designed section created in the panel appears on the live page, can be
  moved among the declared ones, and is drawn with the brand's faces
  (`Ringtte` / `Optika` confirmed from computed styles).
- `javascript:` hrefs, non-hex colours, partial section lists, non-arrangeable
  pages and anonymous writes are all refused with a readable message.
- `rbac:coverage` 0 uncovered · `rbac:check` all passed · `rbac:e2e` all
  passed · `tsc` clean · `vite build` clean.

---

## 8. Not built

- **Reordering by dragging.** Up/down buttons instead — a page has five to
  seven sections, the panel is used on tablets too, and arrows work from the
  keyboard with no extra code.
- **Columns inside a designed section.** Blocks stack. A two-column band needs
  a `columns` block type; the renderer is ready for one (unknown types render
  as nothing rather than breaking the page).
- **Designed sections on the Header or Footer.** They are not pages.
- **Per-page copy for the `listing` / `details` sections** on the collections,
  brands, exhibitions and contact pages. Those sections declare heading and
  intro fields that **no component reads** — a defect that predates this work.
  Their position and visibility now work; their text fields still do nothing.
