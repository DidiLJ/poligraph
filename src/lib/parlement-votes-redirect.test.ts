import { describe, it, expect } from "vitest";
import { buildVotesListingRedirect } from "./parlement-votes-redirect";

const build = (qs: string) => buildVotesListingRedirect(new URLSearchParams(qs));

describe("buildVotesListingRedirect", () => {
  it("returns null when there is no listing param (the hub must not redirect)", () => {
    expect(build("")).toBeNull();
  });

  it("redirects a single theme param", () => {
    expect(build("theme=sante")).toBe("/parlement/votes?theme=sante");
  });

  it("preserves multiple params in input order", () => {
    expect(build("search=retraites&page=2")).toBe("/parlement/votes?search=retraites&page=2");
    expect(build("chamber=AN&result=adopted")).toBe("/parlement/votes?chamber=AN&result=adopted");
  });

  it("drops empty params and returns null when only empties are present", () => {
    expect(build("theme=&chamber=AN")).toBe("/parlement/votes?chamber=AN");
    expect(build("theme=")).toBeNull();
  });

  it("returns null when every known param is empty (never redirect with no query)", () => {
    expect(build("page=&result=&theme=")).toBeNull();
  });

  it("ignores unknown params", () => {
    expect(build("foo=bar")).toBeNull();
    expect(build("foo=bar&theme=sante")).toBe("/parlement/votes?theme=sante");
  });

  it("keeps the first occurrence of a repeated param", () => {
    expect(build("theme=sante&theme=economie")).toBe("/parlement/votes?theme=sante");
  });
});
