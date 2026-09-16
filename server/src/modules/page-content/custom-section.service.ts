import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { findPage } from "./page-content.constants.js";
import {
  blocksSchema,
  sectionStyleSchema,
  type SectionBlock,
  type SectionStyle,
} from "./custom-section.types.js";

/**
 * Sections an admin designed, rather than a developer wrote.
 *
 * Stored per page, keyed like a declared section so the arrangement does not
 * need to know the difference: page-layout.service.ts merges the two lists and
 * sorts them together, and the website renders whichever component the key
 * turns out to name.
 */

export interface CustomSectionRecord {
  id: string;
  page: string;
  key: string;
  label: string;
  blocks: SectionBlock[];
  style: SectionStyle;
  updatedAt: Date;
}

/**
 * Only pages that render from their arrangement can hold one.
 *
 * A page whose sections are still fixed in JSX would accept the section, store
 * it, list it in the panel — and never show it. Refusing here is the only
 * honest answer, and the message says what to do about it.
 */
function assertArrangeablePage(pageKey: string) {
  const page = findPage(pageKey);
  if (!page) throw new ApiError(404, "That page does not exist.");
  if (!page.arrangeable) {
    throw new ApiError(400, "Sections cannot be added to this page yet.");
  }
  return page;
}

/**
 * A key that cannot collide with a declared one, whatever the label says.
 *
 * The "custom-" prefix is the guarantee. A declared section is named in code
 * and none of them start with it, so a designed section called "Hero" becomes
 * "custom-hero" and the real hero keeps working. The random tail then keeps
 * two sections of the same name apart without asking the person naming them
 * to care.
 */
function keyFor(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  const tail = Math.random().toString(36).slice(2, 7);
  return `custom-${slug || "section"}-${tail}`;
}

function toRecord(row: {
  id: string;
  page: string;
  sectionKey: string;
  label: string;
  blocks: unknown;
  style: unknown;
  updatedAt: Date;
}): CustomSectionRecord {
  return {
    id: row.id,
    page: row.page,
    key: row.sectionKey,
    label: row.label,
    // Parsed on the way OUT as well as in. These rows are JSON columns: a
    // schema that gains a field, or a row written by an older build, would
    // otherwise reach the website as a shape its renderer does not expect.
    // Parsing here means a bad row is one broken section, caught at the
    // boundary, rather than a blank page.
    blocks: blocksSchema.parse(row.blocks),
    style: sectionStyleSchema.parse(row.style),
    updatedAt: row.updatedAt,
  };
}

const SELECT = {
  id: true,
  page: true,
  sectionKey: true,
  label: true,
  blocks: true,
  style: true,
  updatedAt: true,
} as const;

/** Every designed section on one page, oldest first. */
export async function listForPage(pageKey: string): Promise<CustomSectionRecord[]> {
  const rows = await prisma.customSection.findMany({
    where: { page: pageKey },
    orderBy: { createdAt: "asc" },
    select: SELECT,
  });

  const out: CustomSectionRecord[] = [];

  for (const row of rows) {
    try {
      out.push(toRecord(row));
    } catch {
      // One unreadable row must not take the page's other sections with it.
      // Skipped rather than thrown: the panel still lists and can repair it,
      // and every visitor still gets the rest of the page.
      continue;
    }
  }

  return out;
}

export async function getById(id: string): Promise<CustomSectionRecord> {
  const row = await prisma.customSection.findUnique({ where: { id }, select: SELECT });
  if (!row) throw new ApiError(404, "That section does not exist.");
  return toRecord(row);
}

export async function create(input: {
  page: string;
  label: string;
  blocks: SectionBlock[];
  style: SectionStyle;
}): Promise<CustomSectionRecord> {
  const page = assertArrangeablePage(input.page);

  const row = await prisma.customSection.create({
    data: {
      page: page.key,
      sectionKey: keyFor(input.label),
      label: input.label,
      blocks: input.blocks,
      style: input.style,
    },
    select: SELECT,
  });

  return toRecord(row);
}

/**
 * The key is never rewritten on a rename.
 *
 * It is what the arrangement points at. Regenerating it because someone fixed
 * a typo in the label would orphan the section's position and quietly move it
 * to the bottom of the page.
 */
export async function update(
  id: string,
  input: { label: string; blocks: SectionBlock[]; style: SectionStyle },
): Promise<CustomSectionRecord> {
  await getById(id);

  const row = await prisma.customSection.update({
    where: { id },
    data: { label: input.label, blocks: input.blocks, style: input.style },
    select: SELECT,
  });

  return toRecord(row);
}

/** Removes the section and the position it held, in one transaction. */
export async function remove(id: string): Promise<void> {
  const existing = await getById(id);

  await prisma.$transaction([
    prisma.pageSection.deleteMany({
      where: { page: existing.page, sectionKey: existing.key },
    }),
    prisma.customSection.delete({ where: { id } }),
  ]);
}
