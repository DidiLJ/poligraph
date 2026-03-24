import { describe, it, expect } from "vitest";
import { parseWideResultRow2014 } from "../parse-wide-results-2014";

describe("parseWideResultRow2014", () => {
  it("parses a row with two lists", () => {
    const cols = [
      "25/03/2014 12:50:21",
      "01",
      "LI2",
      "AIN",
      "004",
      "Ambérieu-en-Bugey",
      "00008198",
      "00003422",
      "41,74",
      "00004776",
      "58,26",
      "00000191",
      "2,33",
      "4,00",
      "00004585",
      "55,93",
      "96,00",
      "LDVG",
      "F",
      "EXPOSITO",
      "Josiane",
      "AMBERIEU AMBITION",
      "0",
      "0",
      "0",
      "00000954",
      "11,64",
      "20,81",
      "LDVG",
      "F",
      "PIDOUX",
      "Catherine",
      "VIVONS NOTRE VILLE",
      "0",
      "0",
      "0",
      "00000822",
      "10,03",
      "17,93",
    ];

    const result = parseWideResultRow2014(cols);

    expect(result.inseeCode).toBe("01004");
    expect(result.communeName).toBe("Ambérieu-en-Bugey");
    expect(result.deptCode).toBe("01");
    expect(result.deptName).toBe("AIN");
    expect(result.registeredVoters).toBe(8198);
    expect(result.actualVoters).toBe(4776);
    expect(result.blankVotes).toBe(191);
    expect(result.nullVotes).toBe(0);
    expect(result.expressedVotes).toBe(4585);
    expect(result.lists).toHaveLength(2);

    const list1 = result.lists[0]!;
    expect(list1.panelNumber).toBe(1);
    expect(list1.nuanceCode).toBe("LDVG");
    expect(list1.gender).toBe("F");
    expect(list1.lastName).toBe("EXPOSITO");
    expect(list1.firstName).toBe("Josiane");
    expect(list1.listName).toBe("AMBERIEU AMBITION");
    expect(list1.seatsWon).toBe(0);
    expect(list1.votes).toBe(954);
    expect(list1.pctExpressed).toBeCloseTo(20.81, 1);

    const list2 = result.lists[1]!;
    expect(list2.panelNumber).toBe(2);
    expect(list2.lastName).toBe("PIDOUX");
    expect(list2.votes).toBe(822);
  });

  it("parses a single-list commune with seats won", () => {
    const cols = [
      "25/03/2014 12:50:21",
      "01",
      "LI2",
      "AIN",
      "005",
      "Ambérieux-en-Dombes",
      "00001159",
      "00000497",
      "42,88",
      "00000662",
      "57,12",
      "00000183",
      "15,79",
      "27,64",
      "00000479",
      "41,33",
      "72,36",
      "LDIV",
      "M",
      "PERNET",
      "Pierre",
      "ENGAGES POUR VOTRE AVENIR",
      "19",
      "0",
      "2",
      "00000479",
      "41,33",
      "100,00",
    ];

    const result = parseWideResultRow2014(cols);

    expect(result.inseeCode).toBe("01005");
    expect(result.lists).toHaveLength(1);
    expect(result.lists[0]!.seatsWon).toBe(19);
    expect(result.lists[0]!.seatsCC).toBe(2);
    expect(result.lists[0]!.pctExpressed).toBeCloseTo(100, 0);
  });

  it("handles Corsica department codes", () => {
    const cols = [
      "25/03/2014",
      "2A",
      "LI2",
      "CORSE-DU-SUD",
      "004",
      "Ajaccio",
      "00040000",
      "00020000",
      "50,00",
      "00020000",
      "50,00",
      "00001000",
      "2,50",
      "5,00",
      "00019000",
      "47,50",
      "95,00",
      "LDVG",
      "M",
      "DOE",
      "John",
      "LISTE TEST",
      "29",
      "0",
      "0",
      "00019000",
      "47,50",
      "100,00",
    ];

    const result = parseWideResultRow2014(cols);
    expect(result.inseeCode).toBe("2A004");
  });
});
