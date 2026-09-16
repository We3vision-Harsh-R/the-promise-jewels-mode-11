import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { startKeepAlive } from "./jobs/keepAlive.js";
import { installResilience } from "./utils/resilience.js";
import { ensureMasterRole } from "./modules/rbac/rbac.service.js";

// Everything is resolved from the project root — where package.json, /dist and
// vite.config.js live.
//
// This used to be process.cwd(), which is only correct when the process is
// started FROM the project root. A managed host starts the entry file from
// wherever its runner happens to sit, and then express.static() points at a
// directory that does not exist: the API answers normally and every page is a
// blank 404, which reads like a broken build rather than a wrong path.
//
// Resolving from this file's own location is true in both layouts, because the
// entry sits two levels down either way — server/src/server.ts under tsx in
// development, server/dist/server.js after tsc in production.
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const isProduction = env.NODE_ENV === "production";

// The frontend is attached asynchronously in development (Vite has to boot
// first), so this gate sits in the middleware stack ahead of it and holds
// page requests until it is ready. Registering the gate up front means the
// port starts listening long before Vite does, instead of the whole server
// waiting on it — otherwise the process looks hung to anything that waits
// for the port to open.
let frontendReady = isProduction;

app.use((req, res, next) => {
  if (frontendReady || req.path.startsWith("/api")) {
    return next();
  }

  res
    .status(503)
    .set("Retry-After", "2")
    .send(
      "<!doctype html><meta http-equiv=refresh content=1>" +
        "<title>Starting…</title>" +
        "<body style=\"font:14px system-ui;padding:2rem;color:#0E2B26\">" +
        "Dev server is starting…</body>",
    );
});

// Bind the port first. A slow or failing frontend must not stop the API from
// coming up, and tooling that waits on the port gets an immediate answer.
const httpServer = app.listen(env.PORT, () => {
  logger.info(`🚀 Website  → http://localhost:${env.PORT}`);
  logger.info(`🔐 Admin    → http://localhost:${env.PORT}/admin`);
  logger.info(`📡 API      → http://localhost:${env.PORT}/api/v1`);

  // Supabase pauses a free-tier project after about a week with no database
  // activity, and /api/health deliberately touches nothing — so an uptime
  // pinger keeps the app warm while the database still goes to sleep. One
  // trivial query a day prevents it. supabase/keep-alive.mjs is the second
  // layer, for when this process is not running at all.
  startKeepAlive();
});

// Socket timeouts, crash guards and graceful shutdown. Installed immediately
// after listen() so the process is protected from its first request onward:
// one unhandled rejection would otherwise take the whole site down, and a
// held-open socket would sit there until the connection table filled up.
installResilience(httpServer);

// The master role has to exist before anyone signs in, and every account
// needs SOME role or it has no permissions at all. On a database that
// predates RBAC that is every account — so without this the first boot after
// deploying it would lock the only admin out of the panel, including out of
// the screen where roles are assigned. Idempotent, so it costs one query per
// boot after the first.
ensureMasterRole().catch((error: unknown) => {
  logger.error(
    `Could not ensure the master role exists: ${(error as Error).message}`,
  );
});

if (isProduction) {
  // Production: serve the assets Vite already built into /dist, then fall back
  // to index.html so client-side routes (/about, /admin/dashboard, ...) work on
  // a hard refresh.
  const distDir = path.join(projectRoot, "dist");

  // Vite fingerprints every file it emits (index-CsdDyuj-.js), so the name
  // changes whenever the contents do. That makes these safe to cache forever
  // — `immutable` additionally tells the browser not to revalidate even on a
  // reload. express.static's default is `max-age=0`, which meant a returning
  // visitor still paid a round trip per asset to be told "304, unchanged":
  // 35 requests of latency to display a page nothing had changed on.
  //
  // index.html is the exception and must never be cached. It is the file that
  // names the current hashed bundles, so a stale copy would keep pointing at
  // the previous deploy's assets.
  const YEAR_SECONDS = 31536000;

  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }

        res.setHeader(
          "Cache-Control",
          `public, max-age=${YEAR_SECONDS}, immutable`,
        );
      },
    }),
  );

  app.get(/.*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  // Development: run Vite inside this same process in middleware mode, so one
  // node process serves the API and the site with hot reload intact.
  (async () => {
    try {
      const { createServer } = await import("vite");

      const vite = await createServer({
        root: projectRoot,
        appType: "spa",
        server: {
          middlewareMode: true,
          // Hand Vite the HTTP server above so HMR runs over the port we are
          // already listening on. Left to itself, middleware mode opens a
          // SECOND socket for HMR, and in sandboxed environments that extra
          // bind never completes — createServer() then hangs forever and the
          // site never attaches. Sharing the server also keeps the promise
          // of a single node process on a single port.
          hmr: { server: httpServer },
          // PJ_NO_WATCH disables Vite's file watcher. Sandboxed runners (the
          // IDE preview pane) can stall indefinitely inside chokidar's
          // recursive watch setup, which leaves createServer() unresolved and
          // the port bound but not accepting. Without the watcher you lose
          // hot reload — a manual refresh still picks up every change — so
          // this stays opt-in and a normal `pnpm dev` keeps full HMR.
          watch: process.env.PJ_NO_WATCH === "1" ? null : undefined,
        },
      });

      app.use(vite.middlewares);
      frontendReady = true;

      logger.info("🎨 Vite attached — frontend ready.");
    } catch (error) {
      logger.error(
        `Vite failed to start, API is still up: ${(error as Error).message}`,
      );
    }
  })();
}
