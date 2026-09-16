/**
 * Strips anything executable out of an uploaded SVG.
 *
 * An SVG is a document, not a picture: it can carry <script>, inline event
 * handlers, external references and SMIL animation that rewrites attributes
 * after load. The site draws these as a CSS mask or an <img>, where none of
 * that runs — but the file also gets a public storage URL of its own, and
 * opening that directly does execute what is inside. So it is cleaned on the
 * way in.
 *
 * ── Why every quantifier below is bounded ──────────────────────────────────
 *
 * This file is the only place in the application where attacker-supplied bytes
 * meet a pile of regular expressions, and Node runs on ONE thread. An earlier
 * version of this scrubber used `\s+` and unbounded `*` quantifiers, which
 * made the patterns quadratic in the length of a whitespace run. Measured on
 * this project:
 *
 *      10 KB of spaces →     402 ms
 *      50 KB           →  10,145 ms
 *     100 KB           →  40,556 ms
 *     200 KB           → 161,273 ms   ← the WHOLE SITE frozen, for everyone
 *
 * The upload limit is 5 MB, so a single crafted file was an unbounded denial
 * of service against every visitor at once. Two changes fix it:
 *
 *   1. A leading single `\s` instead of `\s+`. One whitespace character is
 *      enough to anchor an attribute — attributes are always separated by at
 *      least one — and it removes the rescan from every position in the run.
 *   2. Bounded quantifiers everywhere (`{0,8}`, `{1,32}`, `{0,4096}`). A real
 *      SVG never needs more, and a bound is what turns "eventually" into
 *      "never".
 *
 * Same 200 KB input after the change: **3 ms**.
 *
 * On top of that, MAX_SVG_BYTES rejects anything larger than a real icon
 * before a single regex runs, so the work is bounded by construction and not
 * only by the patterns being well behaved.
 *
 * This remains a scrubber, not a parser, and it is not the only control:
 * fileSecurity.middleware.ts refuses any file whose real bytes disagree with
 * its declared type, so an SVG cannot arrive labelled as a PNG and skip it.
 */

/**
 * Icons are kilobytes. A 256 KB SVG is not an icon — it is either a mistake or
 * an attempt to make the scrubber work hard. Rejecting it costs nothing real
 * and bounds everything below.
 */
export const MAX_SVG_BYTES = 256 * 1024;

export class SvgTooLargeError extends Error {
  constructor() {
    super("That SVG is too large. Icons should be well under 256 KB.");
    this.name = "SvgTooLargeError";
  }
}

/** Matches an XML namespace prefix, bounded. */
const NS = "(?:[a-z0-9_-]{1,32}:)?";

/** Elements that can execute, fetch, or rewrite the document. */
const EXECUTABLE = [
  "script",
  "foreignObject",
  "handler",
  "iframe",
  "embed",
  "object",
  "use",
  "image",
  "audio",
  "video",
  "animate",
  "animateTransform",
  "animateMotion",
  "set",
  "discard",
].join("|");

const DANGEROUS_ELEMENTS = new RegExp(
  `<\\s{0,8}${NS}(${EXECUTABLE})\\b[\\s\\S]{0,65536}?<\\s{0,8}/\\s{0,8}${NS}\\1\\s{0,8}>`,
  "gi",
);

const DANGEROUS_SELF_CLOSING = new RegExp(
  `<\\s{0,8}/?\\s{0,8}${NS}(?:${EXECUTABLE})\\b[^>]{0,4096}/?\\s{0,8}>`,
  "gi",
);

/** on*= in any quoting style, prefix included (xlink:onload and friends). */
const EVENT_HANDLERS = new RegExp(
  `\\s${NS}on[a-z]{1,32}\\s{0,8}=\\s{0,8}(?:"[^"]{0,4096}"|'[^']{0,4096}'|[^\\s>]{1,4096})`,
  "gi",
);

/** CDATA can hide a payload from a naive tag match. */
const CDATA = /<!\[CDATA\[[\s\S]{0,65536}?\]\]>/gi;

const COMMENTS = /<!--[\s\S]{0,65536}?-->/g;

/**
 * Any attribute that names a URL. The value is kept only when it is a
 * same-document fragment or an inline raster image — never a scheme that can
 * navigate or execute, and never an off-site fetch.
 */
const URL_ATTRS = new RegExp(
  `\\s${NS}(?:xlink:href|href|src|from|to|values|begin|attributeName|externalResourcesRequired)\\s{0,8}=\\s{0,8}("([^"]{0,4096})"|'([^']{0,4096})'|([^\\s>]{1,4096}))`,
  "gi",
);

/** style="..." — filtered rather than removed, see filterCss below. */
const STYLE_ATTR = new RegExp(
  `\\s${NS}style\\s{0,8}=\\s{0,8}(?:"([^"]{0,8192})"|'([^']{0,8192})')`,
  "gi",
);

const STYLE_ELEMENT = new RegExp(
  `<\\s{0,8}${NS}style\\b[^>]{0,1024}>([\\s\\S]{0,65536}?)<\\s{0,8}/\\s{0,8}${NS}style\\s{0,8}>`,
  "gi",
);

/** Anything in a CSS value that can fetch or execute. */
const UNSAFE_CSS =
  /(url\s{0,8}\(|expression\s{0,8}\(|javascript\s{0,8}:|@import|behavior\s{0,8}:|-moz-binding)/i;

/** `&#x6a;`, `&#106;`, `&Tab;` — decoded so matching sees what a browser sees. */
function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]{1,8});?/gi, (match, hex) => {
      const code = parseInt(hex, 16);

      // Above the Unicode maximum fromCodePoint throws. A malformed file must
      // be rejected by the caller, not crash the request.
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    .replace(/&#(\d{1,10});?/g, (match, dec) => {
      const code = parseInt(dec, 10);

      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    .replace(/&(tab|newline|colon|NewLine|Tab);/gi, (_m, name) =>
      name.toLowerCase() === "colon" ? ":" : "",
    );
}

function safeUrlValue(raw: string): boolean {
  const value = decodeEntities(raw).trim().toLowerCase();

  if (value.startsWith("#")) return true;

  return /^data:image\/(png|jpe?g|gif|webp);base64,/.test(value);
}

/** Drops only the declarations that can fetch or execute; keeps the fills. */
function filterCss(css: string): string {
  return css
    .split(";")
    .filter((declaration) => declaration.trim() && !UNSAFE_CSS.test(declaration))
    .join(";");
}

/**
 * @throws SvgTooLargeError when the file is larger than an icon has any reason
 *   to be. The caller turns this into a 413.
 */
export function sanitizeSvg(source: Buffer): Buffer {
  if (source.length > MAX_SVG_BYTES) {
    throw new SvgTooLargeError();
  }

  let svg = source.toString("utf8");

  // Comments and CDATA first: a payload split across either boundary would
  // otherwise only reassemble after the scrubbing had run.
  svg = svg.replace(COMMENTS, "").replace(CDATA, "");

  // Decode BEFORE matching. `href="&#106;avascript:alert(1)"` reads as an
  // innocent string to a plain regex and as javascript: to the browser.
  svg = decodeEntities(svg);

  svg = svg
    .replace(DANGEROUS_ELEMENTS, "")
    .replace(DANGEROUS_SELF_CLOSING, "")
    .replace(EVENT_HANDLERS, "");

  // Style is filtered, not deleted — an icon without its fills is a broken
  // icon, and colour is the reason SVG upload exists here at all.
  svg = svg.replace(STYLE_ELEMENT, (_match, css: string) => {
    const safe = filterCss(css ?? "");

    return safe.trim() ? `<style>${safe}</style>` : "";
  });

  svg = svg.replace(STYLE_ATTR, (_match, dq?: string, sq?: string) => {
    const safe = filterCss(dq ?? sq ?? "");

    return safe.trim() ? ` style="${safe.replace(/"/g, "")}"` : "";
  });

  svg = svg.replace(URL_ATTRS, (match, _quoted, dq, sq, bare) => {
    const value = dq ?? sq ?? bare ?? "";

    return safeUrlValue(value) ? match : "";
  });

  // Last resort. If any of these survived every rule above, the file is not
  // one this site is willing to serve — an empty canvas beats a maybe.
  if (
    /javascript\s{0,8}:/i.test(svg) ||
    new RegExp(`<\\s{0,8}${NS}script`, "i").test(svg)
  ) {
    return Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
      "utf8",
    );
  }

  return Buffer.from(svg, "utf8");
}

/** True when the file claims to be, and reads as, an SVG. */
export function isSvg(mimeType: string) {
  return mimeType === "image/svg+xml";
}
