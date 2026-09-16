export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const COMMENT_STATUSES = ["pending", "approved", "spam"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

/** Words a minute, for the "N min read" line. The usual figure for prose. */
export const READING_WORDS_PER_MINUTE = 200;

/** How much plain text becomes the excerpt when none was written by hand. */
export const EXCERPT_LENGTH = 180;

export const BLOG_MESSAGES = {
  FETCHED: "Posts fetched successfully.",
  POST_FETCHED: "Post fetched successfully.",
  CREATED: "Post created.",
  UPDATED: "Post updated.",
  DELETED: "Post deleted.",
  NOT_FOUND: "That post does not exist.",
  SLUG_TAKEN: "Another post already uses that web address. Try a different one.",
  COMMENT_CREATED:
    "Thanks — your comment has been sent and will appear once it is approved.",
  COMMENT_UPDATED: "Comment updated.",
  COMMENT_DELETED: "Comment deleted.",
  COMMENT_NOT_FOUND: "That comment does not exist.",
  COMMENTS_FETCHED: "Comments fetched successfully.",
  NOT_PUBLISHED: "That post is not published.",
} as const;

/**
 * Turns a title into the address the post lives at.
 *
 * Kept here rather than in the service because BOTH sides need the same
 * answer: the admin form shows the address as you type the title, and the
 * server derives one when none is given. Two implementations would drift and
 * the preview would start lying about where the post will be.
 */
export function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    // Strip accents so "Kanṭhī" and "Kanthi" land on the same address.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
