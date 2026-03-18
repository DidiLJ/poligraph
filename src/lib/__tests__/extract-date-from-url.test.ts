import { describe, it, expect } from "vitest";
import { extractDateFromUrl } from "../extract-date-from-url";

// Returns "YYYY-MM-DD" from a non-null Date, avoiding timezone issues
function toDateStr(result: Date | null): string | null {
  return result ? result.toISOString().slice(0, 10) : null;
}

describe("/article/YYYY/MM/DD/ (Le Monde)", () => {
  it("extracts date from a realistic Le Monde article URL", () => {
    const url =
      "https://www.lemonde.fr/politique/article/2024/03/15/gouvernement-barnier-les-enjeux-du-jour_6523412_8234.html";
    expect(toDateStr(extractDateFromUrl(url))).toBe("2024-03-15");
  });
});

describe("/YYYY/MM/DD/ (HuffPost-style)", () => {
  it("extracts date from a realistic HuffPost France URL", () => {
    const url = "https://www.huffingtonpost.fr/2024/06/20/actualite-politique-assemblee/";
    expect(toDateStr(extractDateFromUrl(url))).toBe("2024-06-20");
  });

  it("returns null for year 1999 (outside 2000-2030)", () => {
    expect(
      extractDateFromUrl("https://www.huffingtonpost.fr/1999/01/01/ancien-article/")
    ).toBeNull();
  });

  it("returns null for year 2031 (outside 2000-2030)", () => {
    expect(
      extractDateFromUrl("https://www.huffingtonpost.fr/2031/01/01/futur-article/")
    ).toBeNull();
  });

  it("accepts boundary year 2000", () => {
    expect(toDateStr(extractDateFromUrl("https://www.huffingtonpost.fr/2000/01/01/debut/"))).toBe(
      "2000-01-01"
    );
  });

  it("accepts boundary year 2030", () => {
    expect(toDateStr(extractDateFromUrl("https://www.huffingtonpost.fr/2030/12/31/fin/"))).toBe(
      "2030-12-31"
    );
  });
});

describe("-YYYYMMDD_ / -YYYYMMDD- (Libération, France24)", () => {
  it("extracts date from Libération-style -YYYYMMDD_", () => {
    const url = "https://www.liberation.fr/politique/article-20240318_barnier-assemblee_1234567/";
    expect(toDateStr(extractDateFromUrl(url))).toBe("2024-03-18");
  });

  it("extracts date from France24-style -YYYYMMDD-", () => {
    const url = "https://www.france24.com/fr/europe-20240319-actualite-ukraine";
    expect(toDateStr(extractDateFromUrl(url))).toBe("2024-03-19");
  });
});

describe("DD-MM-YYYY- (Le Parisien)", () => {
  it("extracts date from a realistic Le Parisien URL", () => {
    const url = "https://www.leparisien.fr/politique/15-03-2024-assemblee-nationale-1234567.php";
    expect(toDateStr(extractDateFromUrl(url))).toBe("2024-03-15");
  });
});

describe("/DDMMYY/ (Mediapart)", () => {
  it("extracts date when 2-digit year is in 0-30 range", () => {
    const url = "https://www.mediapart.fr/journal/politique/150320/breve-assemblee";
    expect(toDateStr(extractDateFromUrl(url))).toBe("2020-03-15");
  });

  it("returns null when 2-digit year is 31", () => {
    expect(
      extractDateFromUrl("https://www.mediapart.fr/journal/international/311231/note-fin-annee")
    ).toBeNull();
  });
});

describe("rejection: Wikipedia, no pattern, empty", () => {
  it("returns null for Wikipedia URLs", () => {
    expect(
      extractDateFromUrl(
        "https://fr.wikipedia.org/wiki/%C3%89lections_l%C3%A9gislatives_fran%C3%A7aises_de_2024"
      )
    ).toBeNull();
  });

  it("returns null when URL has no date pattern", () => {
    expect(extractDateFromUrl("https://www.example.com/news/politique/sans-date")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractDateFromUrl("")).toBeNull();
  });
});
