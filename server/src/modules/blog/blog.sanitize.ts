import sanitizeHtml from "sanitize-html";

/**
 * What a blog post is allowed to contain.
 *
 * The editor produces HTML, that HTML is stored, and the public page renders
 * it as HTML — so it is cleaned on the way IN, not on the way out. Cleaning on
 * the way in means the column can be trusted by anything that reads it later,
 * and there is no route (a stray API call, a restored backup, a future admin
 * screen) that can put a script in the database by going around the editor.
 *
 * The list below is everything the editor's toolbar can produce and nothing
 * else. Adding a button to the toolbar means adding its tag here too — if the
 * two disagree, formatting silently disappears on save, which is a much better
 * failure than markup silently surviving.
 */

/**
 * Embeds are the one place a post carries a foreign <iframe>, so the host is
 * checked against this list rather than the tag merely being permitted. An
 * iframe from an arbitrary origin can frame anything at all, including a
 * convincing copy of the admin login.
 */
export const EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "www.instagram.com",
  "instagram.com",
  "www.google.com", // maps
  "maps.google.com",
  "open.spotify.com",
  "w.soundcloud.com",
];

/** Turns a watch/share URL into the embeddable one where the provider needs it. */
export function toEmbedUrl(raw: string): string | null {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();

  // youtu.be/<id> and youtube.com/watch?v=<id> both become /embed/<id>.
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }

  if (host === "www.youtube.com" || host === "youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (url.pathname.startsWith("/embed/")) return url.toString();
    return null;
  }

  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : null;
  }

  // Everything else is accepted only if it is already an embed URL on a host
  // we allow — no guessing at other providers' URL shapes.
  return EMBED_HOSTS.includes(host) ? url.toString() : null;
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup",
    "blockquote", "pre", "code",
    "ul", "ol", "li",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div", "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder"],
    // The editor writes alignment, colour, highlight and font family as inline
    // styles; `allowedStyles` below is what keeps that from becoming a way to
    // inject arbitrary CSS.
    "*": ["style", "class"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      "background-color": [
        /^#[0-9a-fA-F]{3,8}$/,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      // Quoted or bare family names and generic keywords only — no url() and
      // no expressions.
      "font-family": [/^[-\w\s,'"]+$/],
    },
  },
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "data"] },
  // Anything pointing off-site opens in a new tab and cannot reach back at
  // the opener through window.opener.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
  allowedIframeHostnames: EMBED_HOSTS,
  // A tag that is not allowed loses its markup but keeps its words — deleting
  // the text with it would silently eat a paragraph someone had written.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

/** Cleans post HTML. Everything stored in blog_posts.content passes through here. */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}

/**
 * A comment is plain text, full stop.
 *
 * A public comment box is the last place on the site that should accept
 * markup, so nothing is allowed through — the value is stripped to its words
 * and stored as text. The public page then renders it as a string, so it is
 * escaped a second time by React on the way out.
 */
export function sanitizeCommentText(text: string): string {
  return sanitizeHtml(text ?? "", { allowedTags: [], allowedAttributes: {} }).trim();
}

/** Plain text of a post, for the excerpt and the reading time. */
export function toPlainText(html: string): string {
  return sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
