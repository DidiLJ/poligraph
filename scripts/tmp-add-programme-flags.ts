import { db } from "../src/lib/db";

async function main() {
  const flags = [
    {
      name: "PROGRAMMES_ENABLED",
      label: "Programmes des partis",
      description:
        "Active les pages /programmes et /partis/[slug]/programme, ainsi que le comparateur de programmes",
      enabled: false,
    },
    {
      name: "TEST_POLIGRAPH_ENABLED",
      label: "Le Test Poligraph",
      description: "Active la page /test (quiz programmatique)",
      enabled: false,
    },
    {
      name: "PROFESSIONS_DE_FOI_ENABLED",
      label: "Professions de foi",
      description: "Active les actions PDF dans les ListCard municipales",
      enabled: false,
    },
  ];

  for (const flag of flags) {
    await db.featureFlag.upsert({
      where: { name: flag.name },
      create: flag,
      update: { label: flag.label, description: flag.description },
    });
    console.log(`Feature flag ${flag.name}: upserted`);
  }

  await db.$disconnect();
}

main().catch(console.error);
