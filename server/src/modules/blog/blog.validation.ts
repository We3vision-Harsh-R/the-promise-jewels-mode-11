import { z } from "zod";

import { COMMENT_STATUSES, POST_STATUSES } from "./blog.constants.js";

// Shape and length only. WHAT the HTML may contain is not a job for a schema —
// it is decided by the sanitiser, which rewrites the value rather than
// rejecting it, so a post is never lost because of one disallowed tag.
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createPostSchema = z.object({
  title: z.string().trim().min(1, "Give the post a title.").max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "A web address can use lowercase letters, numbers and hyphens only.",
    )
    .optional()
    .or(z.literal("")),
  excerpt: optionalText(400),
  content: z.string().max(400_000).optional().or(z.literal("")),
  coverUrl: optionalText(500),
  authorName: optionalText(120),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  status: z.enum(POST_STATUSES).optional(),

  metaTitle: optionalText(200),
  metaDescription: optionalText(320),
  ogImageUrl: optionalText(500),
  canonicalUrl: optionalText(500),
  noindex: z.boolean().optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const createCommentSchema = z.object({
  name: z.string().trim().min(1, "Please add your name.").max(80),
  email: z
    .string()
    .trim()
    .email("That email address does not look right.")
    .max(160)
    .optional()
    .or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(2, "Please write a comment.")
    .max(2000, "Comments are limited to 2000 characters."),
  // A field a person never sees and a bot fills in. Present in the schema so
  // it is accepted rather than rejected as unknown; the service decides what
  // to do with it.
  website: z.string().max(200).optional(),
});

export const updateCommentSchema = z.object({
  status: z.enum(COMMENT_STATUSES),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
