import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";

import { corsOptions } from "./config/cors.js";
import { apiLimiter } from "./config/rateLimit.js";
import { env } from "./config/env.js";
import { csrfProtection } from "./middleware/csrf.middleware.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/notFound.middleware.js";
import { normaliseQuery } from "./middleware/validation.middleware.js";
import { EMBED_HOSTS } from "./modules/blog/blog.sanitize.js";
import routes from "./routes/index.js";

const app = express();

// The Express fingerprint is free reconnaissance. Helmet removes the header
// too, but saying it here means it stays gone if helmet is ever reconfigured.
app.disable("x-powered-by");

// In production the app sits behind one reverse proxy (Render), so the
// client address arrives in X-Forwarded-For. Without this every request looks
// like it came from the proxy: rate limiting would throttle all visitors
// together, and `secure` cookies would be judged against the wrong protocol.
// Exactly one hop is trusted — trusting them all would let a client set its
// own address and walk past the limiter.
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Brand logos, banners and galleries live in Supabase Storage, so the
// browser loads those <img> URLs straight from the Supabase origin. Helmet's
// default img-src is `'self' data:`, which blocks every one of them — the
// public brand section renders with empty frames and the only clue is a CSP
// message in the console. CSP is disabled in dev, so this bites in
// production only.
const SUPABASE_ORIGIN = new URL(env.SUPABASE_URL).origin;

// A blog post may embed a video or a map. Those are iframes, and `frame-src`
// has to name their hosts or the browser blocks them — the SAME allow-list
// the sanitiser enforces on the way in, so the two can never disagree about
// which providers are permitted.
const EMBED_ORIGINS = EMBED_HOSTS.map((host) => `https://${host}`);

app.use(
  helmet({
    // Vite injects inline scripts and opens an HMR websocket in dev, which the
    // default CSP blocks. Production serves pre-built assets, so CSP stays on.
    contentSecurityPolicy:
      env.NODE_ENV === "production"
        ? {
            useDefaults: true,
            directives: {
              "default-src": ["'self'"],
              // No third-party scripts are loaded anywhere in this app, so
              // 'self' is the whole list. Notably absent: 'unsafe-inline' and
              // 'unsafe-eval', which are what make a CSP decorative.
              "script-src": ["'self'"],
              "script-src-attr": ["'none'"],
              // Tailwind ships a stylesheet, but GSAP writes inline style
              // ATTRIBUTES on every animated element, which style-src-attr
              // governs — hence 'unsafe-inline' there and nowhere else.
              "style-src": ["'self'", "'unsafe-inline'"],
              "style-src-attr": ["'unsafe-inline'"],
              "font-src": ["'self'", "data:"],
              // blob: covers the object URLs the admin panel creates to
              // preview a picked file before it is uploaded.
              "img-src": ["'self'", "data:", "blob:", SUPABASE_ORIGIN],
              "media-src": ["'self'", SUPABASE_ORIGIN],
              "connect-src": ["'self'", SUPABASE_ORIGIN],
              "frame-src": EMBED_ORIGINS,
              // Nothing may frame this site. The admin panel is on the same
              // origin as the public pages, so without this a hidden iframe
              // could be laid under a decoy page and an admin's clicks
              // borrowed. helmet's default is 'self', which still permits it.
              "frame-ancestors": ["'none'"],
              "object-src": ["'none'"],
              "base-uri": ["'self'"],
              "form-action": ["'self'"],
              "upgrade-insecure-requests": [],
            },
          }
        : false,

    // Two years, subdomains included, and eligible for the preload list.
    // helmet's default is 180 days and no preload.
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },

    // Send the full URL to ourselves, only the origin to anyone else — a
    // referrer should never carry an admin path off-site.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // Leave this off: it would require every cross-origin resource to opt in
    // with CORP headers, and the YouTube/Vimeo embeds do not send them.
    crossOriginEmbedderPolicy: false,
  }),
);

// Hardware and capability access this application never uses. Denying them
// outright means a compromised dependency cannot quietly ask for them.
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()",
  );
  next();
});

// CORS
app.use(cors(corsOptions));

// Logger. `dev` colourises and is meant for a terminal; `combined` is the
// format log processors understand. Neither records bodies, headers or
// cookies, so no credential reaches the log through here.
app.use(
  morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.path === "/api/health",
  }),
);

// Compression
app.use(compression());

// Body parsers, with an explicit ceiling.
//
// The default is 100kb, which is both a security default worth stating and —
// as it happens — too small for this application: a long blog post with
// embedded formatting can exceed it, and the admin would have seen a bare 413
// on save. 1mb covers the longest post the editor will accept (the schema
// caps content at 400,000 characters) while still bounding what one request
// can make the server hold in memory.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Unlike /dist these filenames are hand-written and stable, so they cannot be
// cached forever — replacing a photo keeps its name. A day of freshness with
// must-revalidate afterwards keeps repeat views instant while letting a
// replaced image appear within a day (a hard refresh shows it immediately).
app.use(
  express.static("public", {
    dotfiles: "deny",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
    },
  }),
);

// Cookies
app.use(cookieParser());

// Health check. Deliberately says nothing about versions, uptime or the
// database — a health endpoint is reconnaissance if it reports internals.
app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "ok" });
});

// A ceiling on how much any one address can ask for. Mounted after the body
// parsers so a rejected request is still logged normally, and before the
// routes so it covers every one of them. The credential endpoints carry a far
// tighter limit of their own — see auth.routes.ts.
app.use("/api", apiLimiter);

// Express hands a handler an ARRAY when a query parameter is repeated
// (`?status=a&status=b`), and every caller here expects a string. Those values
// reach Prisma `where` clauses, which reject an array and turn an
// unauthenticated request into a 500 with a stack trace in the log — a free
// way to fill the logs and a probe for what the query layer is. Collapsing to
// the last value is what a single-valued parameter is normally understood to
// mean. Mounted before the routes so no handler has to think about it.
app.use("/api", normaliseQuery);

// Cookies authenticate this API, and a browser attaches them to a request
// whoever caused it — so every state-changing call is checked for where it
// came from. Mounted after cookieParser (it reads nothing from cookies, but
// order keeps the chain readable) and before the routes.
app.use("/api", csrfProtection);

// API Routes
app.use("/api/v1", routes);

// 404
app.use("/api", notFoundMiddleware);

// Global Error Handler
app.use(errorMiddleware);

export default app;
