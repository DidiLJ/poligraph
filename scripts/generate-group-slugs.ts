import { db } from "@/lib/db";

async function main() {
  const groups = await db.parliamentaryGroup.findMany({
    where: { slug: null, legislature: { not: null } },
    select: { id: true, code: true, legislature: true },
  });

  console.log(`Found ${groups.length} groups without slugs`);

  for (const g of groups) {
    const slug = `${g.code}-${g.legislature}`.toLowerCase();
    await db.parliamentaryGroup.update({
      where: { id: g.id },
      data: { slug },
    });
    console.log(`  ${g.code} -> ${slug}`);
  }

  console.log("Done");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
