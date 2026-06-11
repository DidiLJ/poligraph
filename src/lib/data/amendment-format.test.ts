import { describe, it, expect } from "vitest";
import {
  amendmentNumberSortKey,
  compareAmendmentNumbers,
  formatArticleLabel,
} from "./amendment-format";

describe("amendmentNumberSortKey", () => {
  it("extracts the embedded integer", () => {
    expect(amendmentNumberSortKey("600")).toBe(600);
    expect(amendmentNumberSortKey("600 (Rect)")).toBe(600);
    expect(amendmentNumberSortKey("CD332")).toBe(332);
    expect(amendmentNumberSortKey("I-390")).toBe(390);
  });
  it("returns null when there is no digit", () => {
    expect(amendmentNumberSortKey("ABC")).toBeNull();
    expect(amendmentNumberSortKey("")).toBeNull();
  });
});

describe("compareAmendmentNumbers", () => {
  it("sorts numerically rather than as strings", () => {
    const input = ["10", "1", "100", "2", "1000"];
    expect([...input].sort(compareAmendmentNumbers)).toEqual(["1", "2", "10", "100", "1000"]);
  });
  it("places a plain number before its rectified variant", () => {
    expect(compareAmendmentNumbers("600", "600 (Rect)")).toBeLessThan(0);
  });
  it("orders commission-prefixed numbers by their integer part", () => {
    // CE135 (135) before CD332 (332), regardless of the alphabetical prefix.
    expect(["CD332", "CE135"].sort(compareAmendmentNumbers)).toEqual(["CE135", "CD332"]);
  });
  it("pushes digit-less values to the end", () => {
    expect(["ABC", "5", "12"].sort(compareAmendmentNumbers)).toEqual(["5", "12", "ABC"]);
  });
});

describe("formatArticleLabel", () => {
  it("strips the insert-article formula and sentence-cases", () => {
    expect(formatArticleLabel("APRÈS L'ARTICLE 11, insérer l'article suivant:")).toBe(
      "Après l'article 11"
    );
  });
  it("sentence-cases plain all-caps designations", () => {
    expect(formatArticleLabel("ARTICLE 10")).toBe("Article 10");
    expect(formatArticleLabel("ARTICLE PREMIER")).toBe("Article premier");
    expect(formatArticleLabel("ARTICLE 9 BIS")).toBe("Article 9 bis");
  });
  it("leaves mixed-case input untouched", () => {
    expect(formatArticleLabel("Article 10")).toBe("Article 10");
  });
});
