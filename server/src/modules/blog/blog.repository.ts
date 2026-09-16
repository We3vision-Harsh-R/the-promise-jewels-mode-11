import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";

class BlogRepository {
  // ---- Posts: admin ----

  listAll(where: Prisma.blog_postsWhereInput = {}) {
    return prisma.blog_posts.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { comments: true } } },
    });
  }

  findById(id: string) {
    return prisma.blog_posts.findUnique({ where: { id } });
  }

  findBySlug(slug: string) {
    return prisma.blog_posts.findUnique({ where: { slug } });
  }

  /** Used to keep slugs unique without racing: excludes the post being saved. */
  findSlugOwner(slug: string, exceptId?: string) {
    return prisma.blog_posts.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
  }

  create(data: Prisma.blog_postsCreateInput) {
    return prisma.blog_posts.create({ data });
  }

  update(id: string, data: Prisma.blog_postsUpdateInput) {
    return prisma.blog_posts.update({ where: { id }, data });
  }

  delete(id: string) {
    // blog_comments cascades off the post, so its comments go with it.
    return prisma.blog_posts.delete({ where: { id } });
  }

  // ---- Posts: public ----

  /**
   * Published posts only, newest first. `publishedAt: { lte: now }` is what
   * makes a future date a schedule rather than a date that shows immediately.
   */
  listPublished(now: Date) {
    return prisma.blog_posts.findMany({
      where: { status: "published", publishedAt: { lte: now } },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverUrl: true,
        authorName: true,
        tags: true,
        publishedAt: true,
      },
    });
  }

  findPublishedBySlug(slug: string, now: Date) {
    return prisma.blog_posts.findFirst({
      where: { slug, status: "published", publishedAt: { lte: now } },
    });
  }

  // ---- Comments ----

  listApprovedFor(postId: string) {
    return prisma.blog_comments.findMany({
      where: { postId, status: "approved" },
      orderBy: { createdAt: "asc" },
      // No email addresses: this list is served to the public site.
      select: { id: true, name: true, body: true, createdAt: true },
    });
  }

  listComments(status?: string) {
    return prisma.blog_comments.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      include: { post: { select: { id: true, title: true, slug: true } } },
    });
  }

  createComment(data: Prisma.blog_commentsUncheckedCreateInput) {
    return prisma.blog_comments.create({ data });
  }

  findCommentById(id: string) {
    return prisma.blog_comments.findUnique({ where: { id } });
  }

  updateCommentStatus(id: string, status: string) {
    return prisma.blog_comments.update({ where: { id }, data: { status } });
  }

  deleteComment(id: string) {
    return prisma.blog_comments.delete({ where: { id } });
  }

  /** How many are waiting on a decision — the badge in the admin panel. */
  countPending() {
    return prisma.blog_comments.count({ where: { status: "pending" } });
  }
}

export default new BlogRepository();
