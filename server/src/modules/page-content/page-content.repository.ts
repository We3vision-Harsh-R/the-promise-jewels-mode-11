import { prisma } from "../../database/prisma.js";

class PageContentRepository {
  listByPage(page: string) {
    return prisma.page_content.findMany({ where: { page } });
  }

  /**
   * Writes a whole form in one transaction, so a half-saved page can never
   * reach the website. Upsert by (page, section, field): a field the admin
   * left at its default simply has no row, which is what keeps the table
   * small and makes "reset to default" a delete.
   */
  saveMany(
    page: string,
    entries: { section: string; field: string; value: string }[],
  ) {
    return prisma.$transaction(
      entries.map((entry) =>
        prisma.page_content.upsert({
          where: {
            page_section_field: {
              page,
              section: entry.section,
              field: entry.field,
            },
          },
          update: { value: entry.value },
          create: { page, ...entry },
        }),
      ),
    );
  }

  /** Removes overrides so those fields fall back to the bundled copy. */
  deleteMany(page: string, entries: { section: string; field: string }[]) {
    if (entries.length === 0) return Promise.resolve({ count: 0 });

    return prisma.page_content.deleteMany({
      where: {
        page,
        OR: entries.map((entry) => ({
          section: entry.section,
          field: entry.field,
        })),
      },
    });
  }
}

export default new PageContentRepository();
