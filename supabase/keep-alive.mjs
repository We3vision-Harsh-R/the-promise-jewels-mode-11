#!/usr/bin/env node
/**
 * Touches the database once, so Supabase does not pause the project.
 *
 * A free-tier project pauses after roughly seven days with no database
 * activity. Restoring it is a manual click in the dashboard — which is exactly
 * what this exists to avoid anyone ever having to do.
 *
 * RUN IT FROM THE HOST'S SCHEDULER. See supabase/README.md for the Hostinger
 * cron settings. Once a day is seven times the margin the limit allows.
 *
 *     node supabase/keep-alive.mjs
 *
 * WHY THIS IS PLAIN JAVASCRIPT AND NOT PART OF THE SERVER
 *
 * The app already has a timer that does the same thing
 * (server/src/jobs/keepAlive.ts), and that one is the primary defence. This is
 * the second layer, and the whole point of a second layer is that it does not
 * share a failure with the first: if the app is asleep, restarting, or has
 * crashed over a quiet weekend — precisely the week that matters — its timer
 * is not running.
 *
 * So this is a standalone .mjs with no build step and no TypeScript. It runs
 * the same way from a developer's laptop, from a dev server, and from a
 * production host, whether or not anything has been compiled. The ten lines it
 * duplicates are the price of that, and they are commented on both sides.
 *
 * IT NEEDS NO NEW SECRET
 *
 * It reads DATABASE_URL out of the .env that is already on the host. Nothing
 * is added to a CI provider, a third-party pinger, or anywhere else the
 * production database password does not already live. That was the deciding
 * reason for running it from Hostinger's cron rather than GitHub Actions.
 */

import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

const root = process.cwd()
const require = createRequire(path.join(root, 'package.json'))

function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

async function main() {
  require(path.join(root, 'node_modules/dotenv')).config()

  if (!process.env.DATABASE_URL) {
    console.error(`[${stamp()}] keep-alive FAILED: DATABASE_URL is not set.`)
    console.error('  Run this from the project root, where the .env file is.')
    process.exit(1)
  }

  const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'))
  const prisma = new PrismaClient({ log: ['error'] })

  try {
    // The same query as server/src/jobs/keepAlive.ts. A real table, at most
    // one row, returning a constant — it reads no data and logs none.
    await prisma.$queryRawUnsafe('SELECT 1 FROM settings LIMIT 1')
    console.log(`[${stamp()}] keep-alive ok — database touched`)
  } catch (error) {
    // Exit non-zero so the host's cron records a failure. A keep-alive that
    // fails quietly for six days is worse than no keep-alive, because nobody
    // finds out until the project is already paused.
    console.error(`[${stamp()}] keep-alive FAILED: ${error.message}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
