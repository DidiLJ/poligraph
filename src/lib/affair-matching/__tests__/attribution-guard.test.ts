import { describe, it, expect } from "vitest";
import { assessPressAttribution } from "../attribution-guard";

/**
 * Regression suite for issue #376: the press sync must not attach a judicial
 * affair to a politician who is merely quoted, commenting, locally in charge,
 * or a homonym. These cases are the ones observed in production (5-8 June 2026).
 *
 * The guard runs at creation time, independently of the LLM's `involvement`
 * field, and only ever BLOCKS an attachment — it never creates one.
 */
describe("assessPressAttribution (issue #376)", () => {
  it("attaches when the politician is explicitly mis en cause", () => {
    const text =
      "Jérôme Barella a été mis en examen pour détournement de fonds publics. " +
      "Le maire de la commune a réagi à cette annonce.";
    const result = assessPressAttribution({
      text,
      firstName: "Jérôme",
      lastName: "Barella",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(true);
    expect(result.verdict).toBe("ATTACH");
  });

  it("blocks a minister who only reacts to the affair", () => {
    const text =
      "Une enquête a été ouverte après l'agression. Gérald Darmanin, ministre de " +
      "l'Intérieur, a réagi en dénonçant ces violences et a appelé au calme.";
    const result = assessPressAttribution({
      text,
      firstName: "Gérald",
      lastName: "Darmanin",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("REACTION_ONLY");
  });

  it("blocks the local mayor who is not a party to the affair", () => {
    const text =
      "Les faits se sont déroulés dans une école de la ville. Pierre Lefort, maire de " +
      "la commune, interrogé par la presse, a exprimé son émotion et son soutien aux victimes.";
    const result = assessPressAttribution({
      text,
      firstName: "Pierre",
      lastName: "Lefort",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("REACTION_ONLY");
  });

  it("blocks a first-name homonym even when someone with that surname is mis en cause", () => {
    // Resolved politician is "Jean Louis Renon" but the article is about
    // "Jean-Guy Renon", a different person who shares the surname.
    const text =
      "Jean-Guy Renon, adjoint au maire d'Ondres, a été mis en examen pour prise " +
      "illégale d'intérêts.";
    const result = assessPressAttribution({
      text,
      firstName: "Jean Louis",
      lastName: "Renon",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("HOMONYM_OR_SURNAME_ONLY");
  });

  it("blocks a surname-only mention (full name never appears)", () => {
    const text =
      "Selon nos informations, Philippe aurait été entendu par les enquêteurs dans " +
      "le cadre de cette affaire.";
    const result = assessPressAttribution({
      text,
      firstName: "Édouard",
      lastName: "Philippe",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("HOMONYM_OR_SURNAME_ONLY");
  });

  it("blocks when the politician's name is entirely absent from the text", () => {
    const text =
      "Une enquête pour violences sexuelles sur mineurs vise un animateur " +
      "périscolaire. Les faits remontent à plusieurs mois.";
    const result = assessPressAttribution({
      text,
      firstName: "Gérald",
      lastName: "Darmanin",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("NAME_ABSENT");
  });

  it("does not mistake a speech verb (a condamné) for a conviction", () => {
    // "a condamné ces agressions" is a statement, not a sentence handed down.
    const text =
      "Le ministre Gérald Darmanin a condamné ces agressions lors d'une conférence " +
      "de presse et a salué le travail des forces de l'ordre.";
    const result = assessPressAttribution({
      text,
      firstName: "Gérald",
      lastName: "Darmanin",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("REACTION_ONLY");
  });

  it("attaches when the full name appears with a passive conviction", () => {
    const text =
      "Édouard Philippe a été condamné en première instance pour détournement de " +
      "fonds publics au Havre.";
    const result = assessPressAttribution({
      text,
      firstName: "Édouard",
      lastName: "Philippe",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(true);
    expect(result.verdict).toBe("ATTACH");
  });

  it("attaches a minister who is themselves mis en examen (mise en cause wins over the ministre framing)", () => {
    const text =
      "Le ministre Éric Dupond, mis en examen pour prise illégale d'intérêts, " +
      "conteste les faits qui lui sont reprochés.";
    const result = assessPressAttribution({
      text,
      firstName: "Éric",
      lastName: "Dupond",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(true);
    expect(result.verdict).toBe("ATTACH");
  });

  it("treats an empty surname as non-attributable", () => {
    const result = assessPressAttribution({
      text: "Un texte quelconque.",
      firstName: "Jean",
      lastName: "",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("NAME_ABSENT");
  });

  it("falls back to surname matching when no first name is on record", () => {
    const text = "Mme Vautrin a été placée en garde à vue dans cette affaire de détournement.";
    const result = assessPressAttribution({
      text,
      firstName: null,
      lastName: "Vautrin",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(true);
    expect(result.verdict).toBe("ATTACH");
  });

  // A VICTIM/PLAINTIFF politician is legitimately a party even when the text
  // frames them through their function ("le maire de ..."). The reaction-only
  // block applies to the perpetrator claim (DIRECT/INDIRECT), not to victims.
  it("attaches a victim mayor even when framed by reaction/function markers", () => {
    // "le maire de" + "a exprimé" would block a DIRECT (perpetrator) claim, but
    // for a VICTIM the institutional framing is legitimate, not a false positive.
    const text =
      "Le maire de la commune, Pierre Lefort, a exprimé son inquiétude après avoir " +
      "été victime de menaces de mort et avoir porté plainte.";
    const result = assessPressAttribution({
      text,
      firstName: "Pierre",
      lastName: "Lefort",
      involvement: "VICTIM",
    });
    expect(result.attach).toBe(true);
    expect(result.verdict).toBe("ATTACH");
  });

  it("would block that same framing if the involvement claimed the politician was the perpetrator", () => {
    const text =
      "Le maire de la commune, Pierre Lefort, a exprimé son inquiétude après avoir " +
      "été victime de menaces de mort et avoir porté plainte.";
    const result = assessPressAttribution({
      text,
      firstName: "Pierre",
      lastName: "Lefort",
      involvement: "DIRECT",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("REACTION_ONLY");
  });

  it("still blocks a homonym for a VICTIM involvement (wrong person)", () => {
    const text = "Jean-Guy Renon a porté plainte après avoir été menacé.";
    const result = assessPressAttribution({
      text,
      firstName: "Jean Louis",
      lastName: "Renon",
      involvement: "PLAINTIFF",
    });
    expect(result.attach).toBe(false);
    expect(result.verdict).toBe("HOMONYM_OR_SURNAME_ONLY");
  });
});
