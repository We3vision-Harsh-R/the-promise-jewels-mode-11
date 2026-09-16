import blogRepository from "./blog.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  BLOG_MESSAGES,
  EXCERPT_LENGTH,
  READING_WORDS_PER_MINUTE,
  slugify,
} from "./blog.constants.js";
import { sanitizeCommentText, sanitizePostHtml, toPlainText } from "./blog.sanitize.js";
import type {
  CreateCommentInput,
  CreatePostInput,
  UpdatePostInput,
} from "./blog.validation.js";

/** Minutes to read, from the words actually in the post. */
function readingMinutes(html: string): number {
  const words = toPlainText(html).split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE));
}

/** The first couple of sentences, when nobody wrote a summary. */
function deriveExcerpt(html: string): string {
  const text = toPlainText(html);

  if (text.length <= EXCERPT_LENGTH) return text;

  const cut = text.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  return `${cut.slice(0, lastSpace > 40 ? lastSpace : EXCERPT_LENGTH)}…`;
}

/** "" from a cleared form field means "no value", not "the empty string". */
function orNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();

  return trimmed === "" ? null : trimmed;
}

class BlogService {
  // ---- Admin ----

  async list(status?: string) {
    return blogRepository.listAll(status ? { status } : {});
  }

  async getById(id: string) {
    const post = await blogRepository.findById(id);

    if (!post) throw new ApiError(404, BLOG_MESSAGES.NOT_FOUND);

    return post;
  }

  /**
   * The address a post lives at.
   *
   * Derived from the title when none was typed, and made unique by appending
   * -2, -3 … rather than by refusing to save: two posts legitimately share a
   * title often enough ("IIJS 2026 round-up"), and losing a written post to a
   * name clash is a worse outcome than a slightly longer address. An address
   * the admin typed BY HAND is not silently altered — that is a deliberate
   * choice and a clash there is reported.
   */
  private async resolveSlug(
    wanted: string | undefined,
    title: string,
    exceptId?: string,
  ): Promise<string> {
    const typed = (wanted ?? "").trim();
    const base = slugify(typed || title) || "post";

    if (typed) {
      const owner = await blogRepository.findSlugOwner(base, exceptId);

      if (owner) throw new ApiError(409, BLOG_MESSAGES.SLUG_TAKEN);

      return base;
    }

    let candidate = base;

    for (let n = 2; await blogRepository.findSlugOwner(candidate, exceptId); n += 1) {
      candidate = `${base}-${n}`;
    }

    return candidate;
  }

  async create(input: CreatePostInput) {
    const content = sanitizePostHtml(input.content ?? "");
    const slug = await this.resolveSlug(input.slug, input.title);
    const status = input.status ?? "draft";

    return blogRepository.create({
      title: input.title.trim(),
      slug,
      content,
      excerpt: orNull(input.excerpt) ?? deriveExcerpt(content),
      coverUrl: orNull(input.coverUrl),
      authorName: orNull(input.authorName),
      tags: input.tags ?? [],
      status,
      // Stamped the moment it first goes live, so the public order is
      // "when it was published", not "when it was created".
      publishedAt: status === "published" ? new Date() : null,
      metaTitle: orNull(input.metaTitle),
      metaDescription: orNull(input.metaDescription),
      ogImageUrl: orNull(input.ogImageUrl),
      canonicalUrl: orNull(input.canonicalUrl),
      noindex: input.noindex ?? false,
    });
  }

  async update(id: string, input: UpdatePostInput) {
    const existing = await this.getById(id);

    const content =
      input.content === undefined ? existing.content : sanitizePostHtml(input.content);

    const title = input.title?.trim() ?? existing.title;

    const slug =
      input.slug === undefined && input.title === undefined
        ? existing.slug
        : await this.resolveSlug(input.slug ?? existing.slug, title, id);

    const status = input.status ?? existing.status;

    // Publishing for the first time stamps the date; re-saving an already
    // published post keeps the original date, and returning it to draft
    // clears it so a later publish reads as a new one.
    let publishedAt = existing.publishedAt;
    if (status === "published" && !existing.publishedAt) publishedAt = new Date();
    if (status !== "published") publishedAt = null;

    const excerpt =
      input.excerpt === undefined
        ? existing.excerpt
        : orNull(input.excerpt) ?? deriveExcerpt(content);

    return blogRepository.update(id, {
      title,
      slug,
      content,
      excerpt,
      status,
      publishedAt,
      ...(input.coverUrl !== undefined && { coverUrl: orNull(input.coverUrl) }),
      ...(input.authorName !== undefined && { authorName: orNull(input.authorName) }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.metaTitle !== undefined && { metaTitle: orNull(input.metaTitle) }),
      ...(input.metaDescription !== undefined && {
        metaDescription: orNull(input.metaDescription),
      }),
      ...(input.ogImageUrl !== undefined && { ogImageUrl: orNull(input.ogImageUrl) }),
      ...(input.canonicalUrl !== undefined && {
        canonicalUrl: orNull(input.canonicalUrl),
      }),
      ...(input.noindex !== undefined && { noindex: input.noindex }),
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await blogRepository.delete(id);

    return { id };
  }

  // ---- Public ----

  async listPublic() {
    const posts = await blogRepository.listPublished(new Date());

    return posts.map((post) => ({ ...post, tags: post.tags ?? [] }));
  }

  async getPublicBySlug(slug: string) {
    const post = await blogRepository.findPublishedBySlug(slug, new Date());

    if (!post) throw new ApiError(404, BLOG_MESSAGES.NOT_FOUND);

    const comments = await blogRepository.listApprovedFor(post.id);

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverUrl: post.coverUrl,
      authorName: post.authorName,
      tags: post.tags ?? [],
      publishedAt: post.publishedAt,
      readMinutes: readingMinutes(post.content),
      seo: {
        metaTitle: post.metaTitle || post.title,
        metaDescription: post.metaDescription || post.excerpt,
        ogImageUrl: post.ogImageUrl || post.coverUrl,
        canonicalUrl: post.canonicalUrl,
        noindex: post.noindex,
      },
      comments,
    };
  }

  /**
   * A comment from the public site.
   *
   * Held as "pending" and shown to nobody until an admin approves it — an
   * open comment box on a public page is a spam target, and the alternative
   * is publishing whatever arrives. `website` is a honeypot: a real person
   * never sees the field, so anything that fills it is automated and the
   * comment is filed as spam. It still returns success, because telling a bot
   * it was caught only teaches it to try again differently.
   */
  async addComment(slug: string, input: CreateCommentInput) {
    const post = await blogRepository.findPublishedBySlug(slug, new Date());

    if (!post) throw new ApiError(404, BLOG_MESSAGES.NOT_FOUND);

    const body = sanitizeCommentText(input.body);

    if (!body) throw new ApiError(400, "Please write a comment.");

    await blogRepository.createComment({
      postId: post.id,
      name: sanitizeCommentText(input.name).slice(0, 80),
      email: orNull(input.email),
      body,
      status: (input.website ?? "").trim() ? "spam" : "pending",
    });

    return { message: BLOG_MESSAGES.COMMENT_CREATED };
  }

  // ---- Comment moderation ----

  listComments(status?: string) {
    return blogRepository.listComments(status);
  }

  countPendingComments() {
    return blogRepository.countPending();
  }

  async setCommentStatus(id: string, status: string) {
    const comment = await blogRepository.findCommentById(id);

    if (!comment) throw new ApiError(404, BLOG_MESSAGES.COMMENT_NOT_FOUND);

    return blogRepository.updateCommentStatus(id, status);
  }

  async removeComment(id: string) {
    const comment = await blogRepository.findCommentById(id);

    if (!comment) throw new ApiError(404, BLOG_MESSAGES.COMMENT_NOT_FOUND);

    await blogRepository.deleteComment(id);

    return { id };
  }
}

export default new BlogService();
