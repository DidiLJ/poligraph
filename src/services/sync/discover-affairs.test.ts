import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { extractPenaltyData } from "./discover-affairs";
import type { WikidataClaim } from "@/lib/api/wikidata";

describe("extractPenaltyData", () => {
  it("extracts prison sentence from P1596 + P2047 qualifiers", () => {
    const claim: WikidataClaim = {
      mainsnak: {
        datavalue: { value: { id: "Q852973" }, type: "wikibase-entityid" },
      },
      qualifiers: {
        P1596: [{ datavalue: { value: { id: "Q853735" } } }],
        P2047: [
          {
            datavalue: {
              value: { amount: "+2", unit: "http://www.wikidata.org/entity/Q577" },
            },
          },
        ],
      },
    };
    const result = extractPenaltyData(claim);
    expect(result.prisonMonths).toBe(24);
    expect(result.prisonSuspended).toBe(false);
  });

  it("extracts sursis from P1596 qualifier", () => {
    const claim: WikidataClaim = {
      mainsnak: {
        datavalue: { value: { id: "Q852973" }, type: "wikibase-entityid" },
      },
      qualifiers: {
        P1596: [{ datavalue: { value: { id: "Q4737759" } } }],
        P2047: [
          {
            datavalue: {
              value: { amount: "+18", unit: "http://www.wikidata.org/entity/Q5151" },
            },
          },
        ],
      },
    };
    const result = extractPenaltyData(claim);
    expect(result.prisonMonths).toBe(18);
    expect(result.prisonSuspended).toBe(true);
  });

  it("extracts verdict date from P585 qualifier", () => {
    const claim: WikidataClaim = {
      mainsnak: {
        datavalue: { value: { id: "Q852973" }, type: "wikibase-entityid" },
      },
      qualifiers: {
        P585: [
          {
            datavalue: {
              value: { time: "+2022-02-18T00:00:00Z", precision: 11 },
            },
          },
        ],
      },
    };
    const result = extractPenaltyData(claim);
    expect(result.verdictDate).toEqual(new Date("2022-02-18"));
  });

  it("extracts court from P4884 qualifier", () => {
    const claim: WikidataClaim = {
      mainsnak: {
        datavalue: { value: { id: "Q852973" }, type: "wikibase-entityid" },
      },
      qualifiers: {
        P4884: [{ datavalue: { value: { id: "Q3027684" } } }],
      },
    };
    const result = extractPenaltyData(claim);
    expect(result.courtQid).toBe("Q3027684");
  });

  it("extracts multiple penalties (prison + fine)", () => {
    const claim: WikidataClaim = {
      mainsnak: {
        datavalue: { value: { id: "Q852973" }, type: "wikibase-entityid" },
      },
      qualifiers: {
        P1596: [
          { datavalue: { value: { id: "Q853735" } } },
          { datavalue: { value: { id: "Q1243001" } } },
        ],
      },
    };
    const result = extractPenaltyData(claim);
    expect(result.prisonSuspended).toBe(false);
    expect(result.hasFine).toBe(true);
  });

  it("returns empty object for claim without qualifiers", () => {
    const claim: WikidataClaim = {
      mainsnak: {
        datavalue: { value: { id: "Q852973" }, type: "wikibase-entityid" },
      },
    };
    const result = extractPenaltyData(claim);
    expect(result).toEqual({});
  });

  it("handles perpetuity (fixed 9999 months)", () => {
    const claim: WikidataClaim = {
      mainsnak: {
        datavalue: { value: { id: "Q852973" }, type: "wikibase-entityid" },
      },
      qualifiers: {
        P1596: [{ datavalue: { value: { id: "Q68676" } } }],
      },
    };
    const result = extractPenaltyData(claim);
    expect(result.prisonMonths).toBe(9999);
    expect(result.prisonSuspended).toBe(false);
  });
});
