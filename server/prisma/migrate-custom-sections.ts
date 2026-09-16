/**
 * One-off: move exhibitions.customSections (the old Json blob) into the
 * exhibition_sections / exhibition_section_fields tables.
 *
 * Safe to run more than once — a show that already has rows in the new tables
 * is skipped, so this never duplicates. The Json column is left untouched as a
 * backup of the pre-migration state.
 *
 *   pnpm exec tsx server/prisma/migrate-custom-sections.ts
 */
import { prisma } from "../src/database/prisma.js";

type LegacyField = { label?: unknown; value?: unknown };
type LegacySection = { title?: unknown; fields?: unknown };

async function main() {
  const rows = await prisma.exhibitions.findMany({
    select: { id: true, title: true, customSections: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const legacy = row.customSections;

    if (!Array.isArray(legacy) || legacy.length === 0) continue;

    const existing = await prisma.exhibition_sections.count({
      where: { exhibitionId: row.id },
    });

    if (existing > 0) {
      console.log(`skip  ${row.title} — already has ${existing} section(s)`);
      skipped += 1;
      continue;
    }

    for (const [sectionIndex, raw] of (legacy as LegacySection[]).entries()) {
      const title = typeof raw?.title === "string" ? raw.title.trim() : "";
      if (!title) continue;

      const fields = Array.isArray(raw.fields) ? (raw.fields as LegacyField[]) : [];

      await prisma.exhibition_sections.create({
        data: {
          exhibitionId: row.id,
          title,
          displayOrder: sectionIndex,
          fields: {
            create: fields
              .filter((field) => typeof field?.label === "string" && field.label.trim())
              .map((field, fieldIndex) => ({
                label: String(field.label).trim(),
                value: typeof field.value === "string" ? field.value.trim() : "",
                displayOrder: fieldIndex,
              })),
          },
        },
      });
    }

    console.log(`moved ${row.title} — ${legacy.length} section(s)`);
    migrated += 1;
  }

  console.log(`\nDone. ${migrated} exhibition(s) migrated, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
