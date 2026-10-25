import "dotenv/config";

import { prisma } from "../database/prisma.js";

/**
 * Moves the ring photographs to the shared Rings library.
 *
 * Until now every page kept its own copy: `ring.1` … `ring.18` on each page's
 * hero, `outer.N` / `inner.N` on the Home hero, and `img.N` in the closing band.
 * They are one library now (page "rings"), with Home's rings as its photographs.
 *
 *   1. Home's saved outer / inner photographs are copied into the library, unless
 *      the library already has that photograph.
 *   2. The per-page copies are deleted — nothing reads them any more, and leaving
 *      them would make it look as though they still did something.
 *
 * Run once with `npm run rings:migrate`. Safe to run again: step 1 never
 * overwrites, and step 2 finds nothing the second time.
 */

async function main() {
  console.log("\nMoving ring photographs to the shared library\n");

  let copied = 0;

  for (const ring of ["outer", "inner"] as const) {
    const saved = await prisma.page_content.findMany({
      where: { page: "home", section: "hero", field: { startsWith: `${ring}.` } },
    });

    for (const row of saved) {
      const n = row.field.slice(ring.length + 1);
      if (!/^\d{1,2}$/.test(n) || !row.value) continue;

      const exists = await prisma.page_content.findUnique({
        where: { page_section_field: { page: "rings", section: ring, field: n } },
      });
      if (exists) continue;

      await prisma.page_content.create({ data: { page: "rings", section: ring, field: n, value: row.value } });
      copied += 1;
    }
  }

  console.log(`  copied into the library       ${copied}`);

  const removed = await prisma.page_content.deleteMany({
    where: {
      OR: [
        { section: "hero", field: { startsWith: "ring." } },
        { page: "home", section: "hero", field: { startsWith: "outer." } },
        { page: "home", section: "hero", field: { startsWith: "inner." } },
        { section: "growth", field: { startsWith: "img." } },
      ],
    },
  });

  console.log(`  old per-page copies removed   ${removed.count}\n`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
