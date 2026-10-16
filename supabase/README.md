# Keeping the Supabase project awake

A free-tier Supabase project **pauses after about seven days with no database
activity**. Restoring it is a manual click in the dashboard — which is the
thing this is here to make sure nobody ever has to do.

Three independent layers. Any one alone is enough; together a single failure
does not lose the week. Layers 1 and 2 live on the host; layer 3 runs on GitHub.

---

## Layer 1 — the app's own timer (already running)

`server/src/jobs/keepAlive.ts`. Started by `server.ts` when the port opens.

- Runs one trivial query **30 seconds after boot**, then **every day at 04:00 India time (IST)**
- No configuration, no secret, no endpoint, nothing to set up
- Turn it off with `KEEPALIVE_INTERVAL_HOURS=0`; change the time with
  `KEEPALIVE_TIME_IST=HH:MM` (24-hour, India time)

**When it is not enough:** it lives inside the web process. If the host
restarts the app, puts it to sleep, or it crashes over a quiet weekend, the
timer goes with it — and a quiet week is exactly the one that matters.

---

## Layer 2 — Hostinger cron (needs setting up once)

`supabase/keep-alive.mjs`. Runs from Hostinger's scheduler, so it does not
care whether the app is up.

### hPanel → Advanced → Cron Jobs

| Field | Value |
|---|---|
| Command | `cd /home/USERNAME/domains/thepromisejewels.com/public_html && /usr/bin/node supabase/keep-alive.mjs` |
| Schedule | Every day at **04:00 IST**. Hostinger's cron runs on the server's clock, which is usually UTC; 04:00 IST is **22:30 UTC the day before**, i.e. minute `30`, hour `22`, every day. If hPanel shows another time zone, convert 04:00 IST (UTC+5:30) to it. |

Replace `USERNAME` and the path with the real application directory — the one
holding `package.json` and `.env`.

**The `cd` matters.** The script reads `DATABASE_URL` from the `.env` in the
current directory. Run from anywhere else it exits 1 and says so.

If `/usr/bin/node` is not where node lives on the box, `which node` over SSH
gives the right path.

---

## Layer 3 — GitHub's daily schedule (needs two secrets, once)

`.github/workflows/supabase-keep-alive.yml`. Runs on GitHub, so it works even
when the website, the app timer and the Hostinger cron are all down.

Every day at **04:00 IST** (22:30 UTC) it asks Supabase's public REST API for one
row of the `settings` table, using the **publishable** key. That key is meant to
be public and the answer is an empty list (row-level security), so nothing
sensitive is stored in GitHub and no data is read.

### Set up once

GitHub → this repository → **Settings → Secrets and variables → Actions → New
repository secret**, twice:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key, from Supabase → Project Settings → API Keys |

Then **Actions → Keep Supabase awake → Run workflow** once to check it is green.
A red run means Supabase did not answer — GitHub emails the repository owner,
which is how a stopped keep-alive gets noticed within a day.

GitHub switches scheduled workflows off after 60 days without any activity in
the repository. Pushing a commit (or pressing Run workflow) turns it back on.

### Check it worked

```bash
node supabase/keep-alive.mjs
```

```
[2026-09-13 06:52:48] keep-alive ok — database touched
```

A failure exits non-zero and prints the reason, so Hostinger records it as a
failed job. That is deliberate: **a keep-alive that fails quietly for six days
is worse than none at all**, because nobody finds out until the project has
already paused.

---

## Why Hostinger cron and not GitHub Actions

GitHub Actions is the usual answer and it was rejected on purpose.

It would mean putting the **production database URL into GitHub's secrets** —
a new place your most sensitive credential lives, on a system with its own
access rules and its own breach history. Hostinger's cron runs on the machine
where that credential already sits, so **nothing new is exposed anywhere**.

(GitHub also disables scheduled workflows after 60 days of repository
inactivity, which would fail in precisely the quiet period this exists for.)

---

## Why not just ping `/api/health`

`/api/health` deliberately touches nothing — a health check that reports
internals is reconnaissance, and it is right as it is.

That means pinging it keeps the **app** warm while the **database** still goes
to sleep. Supabase counts database activity, so the ping has to be a real
query. Both layers run:

```sql
SELECT 1 FROM settings LIMIT 1
```

A real table, at most one row, returning a constant. It reads no data and logs
none.

---

## What this does not fix

This is a workaround, not a cure. Pausing is the free tier working as
designed.

If the app is down **and** the cron misses for a full week, the project still
pauses. The actual fix is a paid plan; this buys everything short of that.

Nothing here touches security. No new endpoint is exposed, no new credential
is created, and no data leaves the database.
