import { describe, it, expect } from "vitest";
import { PhoneticComparator } from "../../comparators/phonetic";
import { FrenchPhoneticEncoder } from "../../adapters/fr/phonetic";

describe("PhoneticComparator", () => {
  const pc = new PhoneticComparator(new FrenchPhoneticEncoder());

  it("returns 1.0 for phonetically identical names", () => {
    expect(pc.compare("dupont", "dupond")).toBe(1.0);
  });

  it("returns 0 for phonetically different names", () => {
    expect(pc.compare("martin", "dupont")).toBe(0);
  });

  it("satisfies NameComparator interface", () => {
    expect(pc.id).toBe("phonetic");
  });
});
