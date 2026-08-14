import { describe, it, expect, vi } from "vitest";

// The page imports the daily-votes surface, whose data layer builds a Prisma
// client at module load. generateMetadata itself only formats today's date.
vi.mock("@/lib/db", () => ({ db: {} }));

import { generateMetadata } from "@/app/parlement/votes/aujourd-hui/page";
import * as page from "@/app/parlement/votes/aujourd-hui/page";

describe("/parlement/votes/aujourd-hui metadata", () => {
  it("states the intent and the date in the title", async () => {
    const m = await generateMetadata();
    expect(m.title).toMatch(/^Votes du Parlement aujourd'hui — \d{1,2} \S+ \d{4}$/);
    expect(m.description).toMatch(
      /^Consultez les scrutins de l'Assemblée nationale et du Sénat du .+ : résultats et détails des votes parlementaires\.$/
    );
  });

  it("keeps its canonical on the bare URL", async () => {
    const m = await generateMetadata();
    expect(m.alternates?.canonical).toBe("/parlement/votes/aujourd-hui");
  });

  it("keeps the ISR contract: revalidate exported, no server searchParams", async () => {
    // The `type` tab is read client-side precisely so this route stays ISR;
    // re-adding a server searchParams prop would make it dynamic again.
    expect(page.revalidate).toBe(300);
    expect(page.default.length).toBe(0);
  });
});
