import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { findPage } from "./page-content.constants.js";
import { listForPage } from "./custom-section.service.js";
import type { SectionBlock, SectionStyle } from "./custom-section.types.js";

/**
 * The order sections appear in on a page, and whether each one appears at all.
 *
 * The catalogue in page-content.constants.ts says which sections a page HAS.
 * This says how they are arranged. Keeping the two apart matters: a section
 * removed from the catalogue stops existing everywhere at once, while its
 * position is just a preference that can be forgotten without consequence.
 *
 * Rows are written only when someone changes something. An untouched page has
 * no rows at all and falls back to declaration order, every section visible —
 * so this table starting empty means every page renders exactly as it did
 * before the feature existed.
 */

export interface SectionLayoutEntry {
  key: string;
  label: string;
  description: string;
  position: number;
  isVisible: boolean;
  /**
   * Sections whose content is owned by another screen (Brands, Exhibitions).
   * They can be reordered and hidden like any other, but the panel shows
   * where their content actually comes from.
   */
  manage?: { label: string; path: string };
  /**
   * Present only on sections designed in the panel.
   *
   * The arrangement treats declared and designed sections identically — they
   * sort together, hide together and move together. This is what lets the
   * panel offer "edit its design" on one and not the other, and what lets the
   * website render the designed ones without a second request.
   */
  custom?: {
    id: string;
    blocks: SectionBlock[];
    style: SectionStyle;
  };
}

function assertPage(pageKey: string) {
  const page = findPage(pageKey);
  if (!page) throw new ApiError(404, "That page does not exist.");
  return page;
}

/**
 * The page's sections in the order they should render.
 *
 * Declaration order is the tie-breaker and the fallback, so a section added to
 * the catalogue tomorrow appears at the position it was declared rather than
 * silently jumping to the top because it has no row yet.
 */
export async function getLayout(pageKey: string): Promise<SectionLayoutEntry[]> {
  const page = assertPage(pageKey);

  const [saved, designed] = await Promise.all([
    prisma.pageSection.findMany({
      where: { page: page.key },
      select: { sectionKey: true, position: true, isVisible: true },
    }),
    page.arrangeable ? listForPage(page.key) : Promise.resolve([]),
  ]);

  const byKey = new Map(saved.map((row) => [row.sectionKey, row]));

  const declared: SectionLayoutEntry[] = page.sections.map((section, index) => {
    const row = byKey.get(section.key);

    return {
      key: section.key,
      label: section.label,
      description: section.description,
      position: row?.position ?? index,
      isVisible: row?.isVisible ?? true,
      manage: section.manage,
    };
  });

  // A section designed today has no saved position, and it goes to the bottom
  // rather than the top: appearing above the hero the moment it is created
  // would be a surprise, and moving it up is one click.
  const custom: SectionLayoutEntry[] = designed.map((section, index) => {
    const row = byKey.get(section.key);

    return {
      key: section.key,
      label: section.label,
      description: `Designed in the panel — ${section.blocks.length} block${
        section.blocks.length === 1 ? "" : "s"
      }.`,
      position: row?.position ?? page.sections.length + index,
      isVisible: row?.isVisible ?? true,
      custom: {
        id: section.id,
        blocks: section.blocks,
        style: section.style,
      },
    };
  });

  return [...declared, ...custom].sort((a, b) => a.position - b.position);
}

export interface PublicLayout {
  /** The keys to render, in order. */
  order: string[];
  /** The designed sections among them, with everything needed to draw one. */
  custom: Array<{
    key: string;
    blocks: SectionBlock[];
    style: SectionStyle;
  }>;
}

/**
 * What the public website reads.
 *
 * Deliberately not the same shape as the admin view. The site has no use for a
 * label or a description, and sending the hidden ones would mean every visitor
 * downloads the name of a section somebody chose not to show them — nor the
 * design of one, which is why the custom list is filtered too.
 *
 * The designs travel WITH the order rather than behind a second request: a
 * page that knew its arrangement but not how to draw part of it would render
 * a gap and then fill it, which is worse than either half arriving alone.
 */
export async function getPublicLayout(pageKey: string): Promise<PublicLayout> {
  const layout = await getLayout(pageKey);
  const visible = layout.filter((entry) => entry.isVisible);

  return {
    order: visible.map((entry) => entry.key),
    custom: visible
      .filter((entry) => entry.custom)
      .map((entry) => ({
        key: entry.key,
        blocks: entry.custom!.blocks,
        style: entry.custom!.style,
      })),
  };
}

/**
 * Replaces a page's arrangement.
 *
 * The whole list is sent, not a diff — the form always knows the full order,
 * and a partial update would leave the unmentioned sections at stale positions
 * that only show up as a wrong order later.
 */
export async function saveLayout(
  pageKey: string,
  entries: Array<{ key: string; isVisible: boolean }>,
): Promise<SectionLayoutEntry[]> {
  const page = assertPage(pageKey);

  // A page that still lists its sections as JSX cannot honour an
  // arrangement. Storing one anyway would leave the panel showing an order
  // the website does not follow, which is worse than refusing.
  if (!page.arrangeable) {
    throw new ApiError(400, "This page's sections cannot be rearranged yet.");
  }

  const designed = await listForPage(page.key);
  const known = new Set([
    ...page.sections.map((section) => section.key),
    ...designed.map((section) => section.key),
  ]);

  for (const entry of entries) {
    if (!known.has(entry.key)) {
      throw new ApiError(400, `"${entry.key}" is not a section on this page.`);
    }
  }

  // Every section must appear exactly once. A list that silently dropped one
  // would leave it at whatever position it held before, which reads as a bug
  // in the reorder rather than in the payload that caused it.
  if (entries.length !== known.size) {
    throw new ApiError(
      400,
      `Expected all ${known.size} sections, got ${entries.length}.`,
    );
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key)) {
      throw new ApiError(400, `"${entry.key}" appears more than once.`);
    }
    seen.add(entry.key);
  }

  await prisma.$transaction(
    entries.map((entry, index) =>
      prisma.pageSection.upsert({
        where: { page_sectionKey: { page: page.key, sectionKey: entry.key } },
        create: {
          page: page.key,
          sectionKey: entry.key,
          position: index,
          isVisible: entry.isVisible,
        },
        update: { position: index, isVisible: entry.isVisible },
      }),
    ),
  );

  return getLayout(page.key);
}
