# Testing the Promise Jewels site — safely

This file is the message to hand to whoever tests or continues developing the
site (a person, or an AI assistant). It says what to check, in what order, and
— just as important — how to test **without slowing the live website down or
filling the database with junk.**

Copy everything under the line into an email or a chat.

---

## Message to the tester

Hello — please test the Promise Jewels website and admin panel using the steps
below, in order. The site is live, so I need the testing itself to be gentle.
Read the **Rules** first.

### Rules — what NOT to do

1. **Never load-test the live site.** No tools that fire hundreds of requests
   (ab, wrk, k6, JMeter, "stress test" extensions). The database is a single
   small free-tier project and the server keeps one process; a burst of traffic
   slows real visitors. Test one page at a time, by hand.
2. **Do not run the self-tests against production data.** `npm run rbac:e2e` and
   `npm run otp:check` log in as the real admin and change real settings. Run
   them only against a local copy with its own database.
3. **Do not submit the contact form repeatedly.** Every submission is a real
   enquiry in the owner's inbox. Send at most one, with the name `TEST – ignore`,
   and delete it afterwards under Admin → Inquiries.
4. **Edit content in single, deliberate saves.** Every save in the admin panel
   empties the website's cache so the change shows instantly; ten saves a minute
   means ten cold loads for visitors. Make your change, check it, put it back.
5. **Always put things back.** Anything you change while testing (text, colours,
   fonts, pictures, settings) must be restored before you finish. Write down the
   original value *before* you change it.
6. **Use your own test account, not the owner's.** Ask for a temporary admin
   login. Do not change the owner's password, and delete your account when done.
7. **Do not paste secrets** (the `.env` file, database password, API keys) into
   chats, tickets or screenshots.
8. **Run speed tests from one browser tab, once per page.** Not in a loop.
   Lighthouse and DevTools throttling are fine; automated repeat runs are not.
9. **If anything looks wrong, stop and report it** — do not "fix" production data
   by hand to make a test pass.

### Setup

```bash
npm install
cp .env.example .env        # fill in the values you were given
npm run build
npm start                   # or: npm run dev
```

Production uses the Supabase **session pooler (port 5432)** with
`connection_limit=5` — see the note above `DATABASE_URL` in `.env.example`.

### Step 1 — one-command health check (30 seconds)

```bash
npm run smoke:check                                  # the server on this machine
npm run smoke:check -- https://YOUR-LIVE-DOMAIN      # the live site
```

It checks every page loads, every public API call answers (and how fast), that
private API calls refuse a stranger, that every internal link and every
picture/font path in the code leads to something real, and that the visitor ping
works. **It must end with `ALL PASSED`.** A `WARN` about a slow API call means
the cache is cold — wait a minute and run it again before reporting it.

Also run, locally:

```bash
npx tsc -p server/tsconfig.json --noEmit    # server types
npm run rbac:coverage                        # every API route is guarded or deliberately public
npm run rbac:check                           # permission logic
npm run vault:check
npm run error:check
```

### Step 2 — walk every public page (10 minutes)

Open each address, on a phone-sized window **and** a desktop window. For each:
no blank screen, no overlapping text, every picture shows, the browser console
has no red errors (a 404 for `/api/v1/metadata/...` is expected until SEO
records exist), and every button or link goes somewhere.

| Address | Also check |
|---|---|
| `/` | hero, featured collections, brands, exhibitions, "Let's Drive Growth" |
| `/AboutPage` and `/AboutPage#team` | the "team" link scrolls to Our Leaders; in Our Pillars a diamond turns as you scroll (wide screens, and small on a phone); the "Get Started" button at the bottom opens `/contact` |
| `/our-team` | every person shown in Admin → Our Team appears with photo, name and role; one with no photo shows initials; an empty team shows the "introduced soon" message |
| `/our-brand` | brand rows, closing band |
| `/our-collection` | brand tabs filter, a collection tile opens its page; a white-background product photo sits on an ivory mat, a dark photograph fills its card |
| `/our-collection/<a real slug>` | description, specifications, gallery, enquiry form |
| `/our-collection/not-a-collection` | shows "Collection not found" with a way back |
| `/contact` | phone/email/address match Admin → Settings; form validation messages |
| `/Exhibition` and `/Exhibition/<slug>` | dates, FAQ opens/closes, "Book a meeting" |
| `/blog` and `/blog/<slug>` | empty state, a post, a comment |
| `/anything-else` | the "This page could not be found" page |

Open the footer and header links on **two different pages** — they must be the
same on both.

### Step 3 — admin panel (15 minutes)

Sign in at `/admin` with your test account. Open every screen from the sidebar:
Dashboard, Collections, Brands, **Our Team**, Inquiries, Shows (and the operations screens),
Content, Header, Footer, Blog, SEO, **Visitors**, Settings, Users, Roles, Vault.
Each must load without an error banner. Visit `/admin/not-a-page` — it must land
on the dashboard, not loop.

**Our Team** (add, edit, replace the photo, remove the photo, hide, reorder with the
arrows, delete): after each change reload `/our-team` — it must match at once. Use a
fake person (`TEST – ignore`) and delete them when finished; deleting also removes
the photo from storage.

### Step 4 — edit text, colours, fonts, pictures (the main feature)

Admin → **Content** has one tab per page, plus **Enquiry form**, **Collection
page** and **Exhibition page**. Every piece of text on the website is a field.

For ONE field at a time (note its original value first):

1. Change the **text** → Save → reload the public page. It must change at once.
2. Change its **colour**, **font**, **size**, **weight**, **spacing** → Save →
   reload. Check the size on a phone-width window too; it must step down, not
   overflow.
3. Change a **picture** (upload a small image) → Save → reload.
4. Use **Arrangement** to hide a section and move another up → reload → then put
   the order back.
5. Put every value back and save once more.

If a field in the Editor changes nothing on the site, that is a bug — report the
page, section and field name.

### Step 5 — visitors

1. Open the public site in a normal window, then a phone-size window, clicking
   through three or four pages.
2. In Admin → **Visitors**: "On the website now" must count you; "Who is where"
   must show a cursor on the page you are on and move it when you change page.
3. Countries show `??`/Unknown when testing from your own machine — that is
   expected. Real countries appear for real visitors.
4. Browsers that send "Do Not Track", and crawlers/bots, are deliberately not
   counted.

### Step 6 — speed (one run per page, throttled)

In Chrome DevTools → Network tab: tick **Disable cache**, choose **Fast 4G**,
DevTools Performance → CPU **4× slowdown**, reload `/`.

* First paint / largest paint should be **under 2 seconds**.
* No request should be pending for more than a second except pictures below the
  fold.
* The API calls (`/api/v1/page-content/public/...`, `/settings/public`,
  `/brands`, …) should each take **well under 100 ms** after the first load.
* Page chunks for the other pages download quietly after the home page has
  finished loading; clicking a link afterwards should be instant.

If a page is slow, note: the address, the connection setting, what the slowest
request was, and its time. Do not "optimise" by guesswork.

### Step 7 — clean up

Delete your test account (Admin → Users), any test enquiry (Inquiries), any test
comment or post, and confirm every edited value is back to the original.

### How to report a problem

For each problem send: **where** (address or admin screen), **what you did**,
**what you expected**, **what happened**, a screenshot, and the browser console
text if there is an error. One problem per message.

---

## Notes for the developer (not part of the message)

* Public API reads are served from an in-memory cache
  (`server/src/middleware/publicCache.middleware.ts`) that any successful admin
  write empties; hot pages are refetched in the background a couple of seconds
  later. Response header `X-Cache: HIT | STALE | MISS` shows which happened.
* The database is far from the visitors; every query costs real time. Use the
  session pooler (port 5432) rather than the transaction pooler (port 6543) —
  measured 0.38 s against 1.83 s per query — and pick the Supabase region nearest
  your visitors when creating the project.
* Visitor tracking stores a country and a page only. See
  `server/src/modules/visitors/visitor.service.ts` for why pings are batched.
* Pages other than Home are loaded on demand (`src/app/routes/lazyPages.js`) and
  prefetched when the browser is idle.
