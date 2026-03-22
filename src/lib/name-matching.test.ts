import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));

import {
  normalizeText,
  escapeRegex,
  findMentions,
  findPartyMentions,
  isCommonFrenchWord,
  type PoliticianName,
  type PartyName,
} from "./name-matching";

// ============================================
// normalizeText
// ============================================

describe("normalizeText", () => {
  it("should lowercase text", () => {
    expect(normalizeText("Emmanuel MACRON")).toBe("emmanuel macron");
  });

  it("should remove accents", () => {
    expect(normalizeText("François")).toBe("francois");
    expect(normalizeText("Éric")).toBe("eric");
    expect(normalizeText("Cécile")).toBe("cecile");
    expect(normalizeText("Gaël")).toBe("gael");
  });

  it("should normalize dashes to spaces", () => {
    expect(normalizeText("Le Pen")).toBe("le pen");
    expect(normalizeText("Jean-Luc")).toBe("jean luc");
    expect(normalizeText("Jean–Luc")).toBe("jean luc"); // en-dash
    expect(normalizeText("Jean—Luc")).toBe("jean luc"); // em-dash
  });

  it("should normalize apostrophes", () => {
    expect(normalizeText("l'État")).toBe("l'etat");
    expect(normalizeText("l\u2019État")).toBe("l'etat"); // right single quotation mark
    expect(normalizeText("l\u2018État")).toBe("l'etat"); // left single quotation mark
  });

  it("should trim whitespace", () => {
    expect(normalizeText("  Macron  ")).toBe("macron");
  });

  it("should handle combinations", () => {
    expect(normalizeText("Jean-François Copé")).toBe("jean francois cope");
    expect(normalizeText("Élisabeth Borne")).toBe("elisabeth borne");
  });
});

// ============================================
// escapeRegex
// ============================================

describe("escapeRegex", () => {
  it("should escape special regex characters", () => {
    expect(escapeRegex("hello.world")).toBe("hello\\.world");
    expect(escapeRegex("test*")).toBe("test\\*");
    expect(escapeRegex("a+b")).toBe("a\\+b");
    expect(escapeRegex("foo(bar)")).toBe("foo\\(bar\\)");
    expect(escapeRegex("a[b]c")).toBe("a\\[b\\]c");
    expect(escapeRegex("x{y}z")).toBe("x\\{y\\}z");
    expect(escapeRegex("a|b")).toBe("a\\|b");
    expect(escapeRegex("a?b")).toBe("a\\?b");
    expect(escapeRegex("^start$end")).toBe("\\^start\\$end");
    expect(escapeRegex("back\\slash")).toBe("back\\\\slash");
  });

  it("should leave normal text unchanged", () => {
    expect(escapeRegex("macron")).toBe("macron");
    expect(escapeRegex("jean luc melenchon")).toBe("jean luc melenchon");
  });
});

// ============================================
// findMentions
// ============================================

describe("findMentions", () => {
  const politicians: PoliticianName[] = [
    {
      id: "1",
      fullName: "Emmanuel Macron",
      firstName: "Emmanuel",
      lastName: "Macron",
      normalizedFullName: "emmanuel macron",
      normalizedLastName: "macron",
    },
    {
      id: "2",
      fullName: "Marine Le Pen",
      firstName: "Marine",
      lastName: "Le Pen",
      normalizedFullName: "marine le pen",
      normalizedLastName: "le pen",
    },
    {
      id: "3",
      fullName: "Jean-Luc Mélenchon",
      firstName: "Jean-Luc",
      lastName: "Mélenchon",
      normalizedFullName: "jean luc melenchon",
      normalizedLastName: "melenchon",
    },
    {
      id: "4",
      fullName: "Paul Dupont",
      firstName: "Paul",
      lastName: "Dupont",
      normalizedFullName: "paul dupont",
      normalizedLastName: "dupont",
    },
    {
      id: "5",
      fullName: "Marie Martin",
      firstName: "Marie",
      lastName: "Martin",
      normalizedFullName: "marie martin",
      normalizedLastName: "martin",
    },
    {
      id: "6",
      fullName: "Jean Noir",
      firstName: "Jean",
      lastName: "Noir",
      normalizedFullName: "jean noir",
      normalizedLastName: "noir",
    },
    {
      id: "7",
      fullName: "Laurent Wauquiez",
      firstName: "Laurent",
      lastName: "Wauquiez",
      normalizedFullName: "laurent wauquiez",
      normalizedLastName: "wauquiez",
    },
    {
      id: "8",
      fullName: "Daniel Laurent",
      firstName: "Daniel",
      lastName: "Laurent",
      normalizedFullName: "daniel laurent",
      normalizedLastName: "laurent",
    },
    {
      id: "9",
      fullName: "Sandrine Rousseau",
      firstName: "Sandrine",
      lastName: "Rousseau",
      normalizedFullName: "sandrine rousseau",
      normalizedLastName: "rousseau",
    },
    {
      id: "10",
      fullName: "Aurélien Rousseau",
      firstName: "Aurélien",
      lastName: "Rousseau",
      normalizedFullName: "aurelien rousseau",
      normalizedLastName: "rousseau",
    },
    {
      id: "11",
      fullName: "Christophe Marion",
      firstName: "Christophe",
      lastName: "Marion",
      normalizedFullName: "christophe marion",
      normalizedLastName: "marion",
    },
    {
      id: "12",
      fullName: "Marion Maréchal",
      firstName: "Marion",
      lastName: "Maréchal",
      normalizedFullName: "marion marechal",
      normalizedLastName: "marechal",
    },
    {
      id: "13",
      fullName: "Denis Marchand",
      firstName: "Denis",
      lastName: "Marchand",
      normalizedFullName: "denis marchand",
      normalizedLastName: "marchand",
    },
    {
      id: "14",
      fullName: "Claire Fontaine",
      firstName: "Claire",
      lastName: "Fontaine",
      normalizedFullName: "claire fontaine",
      normalizedLastName: "fontaine",
    },
  ];

  it("should match full name", () => {
    const result = findMentions("Le président Emmanuel Macron a déclaré...", politicians);
    expect(result).toEqual([{ politicianId: "1", matchedName: "Emmanuel Macron" }]);
  });

  it("should match last name when >= 5 characters", () => {
    const result = findMentions("Macron a déclaré...", politicians);
    expect(result).toEqual([{ politicianId: "1", matchedName: "Macron" }]);
  });

  it("should not match last name shorter than 5 characters", () => {
    // "Le Pen" normalized is "le pen" — both words are < 5 chars
    const result = findMentions("Le Pen a déclaré...", politicians);
    // Should NOT match by last name alone since "le pen" has len 6 but...
    // Actually "le pen" normalized is "le pen" with length 6, so it should match
    expect(result).toEqual([{ politicianId: "2", matchedName: "Le Pen" }]);
  });

  it("should exclude short last names from last-name matching", () => {
    // "noir" is only 4 chars, excluded by the length check (< 5)
    const result = findMentions("Le ciel est noir ce soir", politicians);
    expect(result).toEqual([]);
  });

  it("should still match short last names via full name", () => {
    const result = findMentions("Jean Noir a pris la parole", politicians);
    expect(result).toEqual([{ politicianId: "6", matchedName: "Jean Noir" }]);
  });

  it("should exclude common French words from last-name matching", () => {
    // "marchand" is a common French word (>= 5 chars), should not match by last name alone
    const result = findMentions("Le marchand du quartier vend des fruits", politicians);
    expect(result).toEqual([]);
  });

  it("should exclude 'fontaine' as a common word from last-name matching", () => {
    const result = findMentions("La fontaine du village est magnifique", politicians);
    expect(result).toEqual([]);
  });

  it("should still match common French words via full name", () => {
    // "Denis Marchand" full name should match even though "marchand" is a common word
    const result = findMentions("Denis Marchand a pris la parole", politicians);
    expect(result).toEqual([{ politicianId: "13", matchedName: "Denis Marchand" }]);
  });

  it("should not produce duplicate matches", () => {
    const result = findMentions("Emmanuel Macron et Macron ont parlé", politicians);
    expect(result).toHaveLength(1);
    expect(result[0]!.politicianId).toBe("1");
  });

  it("should match accented text", () => {
    const result = findMentions("Mélenchon a répondu", politicians);
    expect(result).toEqual([{ politicianId: "3", matchedName: "Mélenchon" }]);
  });

  it("should match text without accents to accented names", () => {
    const result = findMentions("Melenchon a répondu", politicians);
    expect(result).toEqual([{ politicianId: "3", matchedName: "Mélenchon" }]);
  });

  it("should match compound names with dashes", () => {
    const result = findMentions("Jean-Luc Mélenchon a proposé", politicians);
    expect(result).toEqual([{ politicianId: "3", matchedName: "Jean-Luc Mélenchon" }]);
  });

  it("should match multiple politicians in same text", () => {
    const result = findMentions("Débat entre Emmanuel Macron et Mélenchon", politicians);
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.politicianId).sort();
    expect(ids).toEqual(["1", "3"]);
  });

  it("should prefer full name match over last name match", () => {
    const result = findMentions("Emmanuel Macron est président", politicians);
    expect(result).toEqual([{ politicianId: "1", matchedName: "Emmanuel Macron" }]);
  });

  it("should return empty array when no match", () => {
    const result = findMentions("Aucun politicien mentionné ici", politicians);
    expect(result).toEqual([]);
  });

  it("should respect word boundaries", () => {
    const result = findMentions("Le macronisme est un mouvement", politicians);
    expect(result).toEqual([]);
  });

  // Adjacent context check — false positive prevention
  it("should not match last name when it is another politician's first name in context", () => {
    // "Laurent Wauquiez" → "Laurent" is Wauquiez's first name, not Daniel Laurent's last name
    const result = findMentions("Laurent Wauquiez a déclaré...", politicians);
    expect(result).toEqual([{ politicianId: "7", matchedName: "Laurent Wauquiez" }]);
    // Daniel Laurent (id=8) should NOT be in results
    expect(result.find((r) => r.politicianId === "8")).toBeUndefined();
  });

  it("should not cross-match when last name appears as first name of another politician", () => {
    // "Sandrine Rousseau" should match Sandrine Rousseau, NOT Aurélien Rousseau
    const result = findMentions("Sandrine Rousseau a répondu", politicians);
    expect(result).toEqual([{ politicianId: "9", matchedName: "Sandrine Rousseau" }]);
    expect(result.find((r) => r.politicianId === "10")).toBeUndefined();
  });

  it("should not match common-word surname alone without context", () => {
    // "rousseau" is a French adjective (reddish/ruddy), so last-name-only matching is excluded
    const result = findMentions("Rousseau a répondu", politicians);
    expect(result).toEqual([]);
  });

  it("should still match non-dictionary last name alone", () => {
    // "Dupont" is NOT a common French word, so last-name matching works
    const result = findMentions("Dupont a répondu", politicians);
    expect(result).toEqual([{ politicianId: "4", matchedName: "Dupont" }]);
  });

  it("should match both politicians by full name even when names overlap", () => {
    const result = findMentions("Marion Maréchal et Christophe Marion ont débattu", politicians);
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.politicianId).sort();
    expect(ids).toEqual(["11", "12"]);
  });

  // Compound first name false positive prevention
  describe("compound first name collision", () => {
    const withJeanMichel: PoliticianName[] = [
      ...politicians,
      {
        id: "15",
        fullName: "Jean Michel",
        firstName: "Jean",
        lastName: "Michel",
        normalizedFullName: "jean michel",
        normalizedLastName: "michel",
      },
    ];

    it("should NOT match 'Jean Michel' politician in 'Jean-Michel Aulas'", () => {
      const result = findMentions(
        "Jean-Michel Aulas est candidat aux municipales de Lyon",
        withJeanMichel
      );
      expect(result.find((r) => r.politicianId === "15")).toBeUndefined();
    });

    it("should match 'Jean Michel' in 'Jean Michel Aulas' (no hyphen = genuinely ambiguous)", () => {
      const result = findMentions(
        "Jean Michel Aulas est candidat aux municipales de Lyon",
        withJeanMichel
      );
      // Without hyphen, "Jean Michel" could be our politician — match is acceptable
      expect(result.find((r) => r.politicianId === "15")).toBeDefined();
    });

    it("should still match 'Jean Michel' when followed by a common word", () => {
      const result = findMentions(
        "le maire Jean Michel est venu au conseil municipal",
        withJeanMichel
      );
      expect(result.find((r) => r.politicianId === "15")).toBeDefined();
    });

    it("should still match 'Jean Michel' at end of text", () => {
      const result = findMentions("une déclaration de Jean Michel", withJeanMichel);
      expect(result.find((r) => r.politicianId === "15")).toBeDefined();
    });

    it("should still match 'Jean Michel' when followed by punctuation", () => {
      const result = findMentions("Jean Michel, le maire de la commune, a déclaré", withJeanMichel);
      expect(result.find((r) => r.politicianId === "15")).toBeDefined();
    });

    it("should NOT match 'Jean Michel' in 'Jean-Michel Baylet'", () => {
      const result = findMentions("Jean-Michel Baylet exprime sa gratitude", withJeanMichel);
      expect(result.find((r) => r.politicianId === "15")).toBeUndefined();
    });

    it("should NOT match 'Jean Michel' in 'Jean-Michel Lafuente'", () => {
      const result = findMentions(
        "Jean-Michel Lafuente arrive en tête des municipales à Boé",
        withJeanMichel
      );
      expect(result.find((r) => r.politicianId === "15")).toBeUndefined();
    });

    it("should handle 'Marie Claire' not matching 'Marie-Claire Dupont'", () => {
      const withMarieClaire: PoliticianName[] = [
        ...politicians,
        {
          id: "16",
          fullName: "Marie Claire",
          firstName: "Marie",
          lastName: "Claire",
          normalizedFullName: "marie claire",
          normalizedLastName: "claire",
        },
      ];
      const result = findMentions("Marie-Claire Dupont a été élue", withMarieClaire);
      expect(result.find((r) => r.politicianId === "16")).toBeUndefined();
    });

    it("should still match real politician Jean-Michel Blanquer via full name", () => {
      const withBlanquer: PoliticianName[] = [
        ...withJeanMichel,
        {
          id: "17",
          fullName: "Jean-Michel Blanquer",
          firstName: "Jean-Michel",
          lastName: "Blanquer",
          normalizedFullName: "jean michel blanquer",
          normalizedLastName: "blanquer",
        },
      ];
      const result = findMentions("Jean-Michel Blanquer a présenté la réforme", withBlanquer);
      // Blanquer should match
      expect(result.find((r) => r.politicianId === "17")).toBeDefined();
      // "Jean Michel" politician should NOT match
      expect(result.find((r) => r.politicianId === "15")).toBeUndefined();
    });
  });

  // Last name = common first name false positive prevention
  describe("lastName is a common first name", () => {
    const withAmbiguous: PoliticianName[] = [
      ...politicians,
      {
        id: "20",
        fullName: "Virginie Quentin",
        firstName: "Virginie",
        lastName: "Quentin",
        normalizedFullName: "virginie quentin",
        normalizedLastName: "quentin",
      },
      {
        id: "21",
        fullName: "Sabrina Catherine",
        firstName: "Sabrina",
        lastName: "Catherine",
        normalizedFullName: "sabrina catherine",
        normalizedLastName: "catherine",
      },
      {
        id: "22",
        fullName: "Catherine Trautmann",
        firstName: "Catherine",
        lastName: "Trautmann",
        normalizedFullName: "catherine trautmann",
        normalizedLastName: "trautmann",
      },
      {
        id: "23",
        fullName: "Joëlle Laurence",
        firstName: "Joëlle",
        lastName: "Laurence",
        normalizedFullName: "joelle laurence",
        normalizedLastName: "laurence",
      },
      {
        id: "24",
        fullName: "Laurence Ruffin",
        firstName: "Laurence",
        lastName: "Ruffin",
        normalizedFullName: "laurence ruffin",
        normalizedLastName: "ruffin",
      },
      {
        id: "25",
        fullName: "Roland Thierry",
        firstName: "Roland",
        lastName: "Thierry",
        normalizedFullName: "roland thierry",
        normalizedLastName: "thierry",
      },
      {
        id: "26",
        fullName: "Thierry Mariani",
        firstName: "Thierry",
        lastName: "Mariani",
        normalizedFullName: "thierry mariani",
        normalizedLastName: "mariani",
      },
      {
        id: "27",
        fullName: "Quentin Bataillon",
        firstName: "Quentin",
        lastName: "Bataillon",
        normalizedFullName: "quentin bataillon",
        normalizedLastName: "bataillon",
      },
    ];

    it("should NOT match 'Quentin' as lastName when it appears as first name in text", () => {
      // Article about "Quentin F." (anonymized person) — not a politician
      const result = findMentions(
        "À 35 ans, Quentin F., atteint d'un trouble du spectre autistique",
        withAmbiguous
      );
      expect(result.find((r) => r.politicianId === "20")).toBeUndefined();
    });

    it("should NOT match 'Catherine' as lastName when text mentions Catherine Trautmann", () => {
      const result = findMentions(
        "Catherine Trautmann toujours investie par le PS à Strasbourg",
        withAmbiguous
      );
      // Trautmann matches by full name
      expect(result.find((r) => r.politicianId === "22")).toBeDefined();
      // Sabrina Catherine should NOT match (Catherine is a first name)
      expect(result.find((r) => r.politicianId === "21")).toBeUndefined();
    });

    it("should NOT match 'Laurence' as lastName in Laurence Ruffin article", () => {
      const result = findMentions(
        "La liste de Laurence Ruffin dénonce l'agression de militants à Grenoble",
        withAmbiguous
      );
      // Ruffin matches by full name
      expect(result.find((r) => r.politicianId === "24")).toBeDefined();
      // Joëlle Laurence should NOT match
      expect(result.find((r) => r.politicianId === "23")).toBeUndefined();
    });

    it("should NOT match 'Thierry' as lastName in non-politician context", () => {
      const result = findMentions(
        "Thierry, candidat sortant à La Teste-de-Buch, arrive en tête",
        withAmbiguous
      );
      // Roland Thierry should NOT match
      expect(result.find((r) => r.politicianId === "25")).toBeUndefined();
    });

    it("should still match ambiguous lastName via full name", () => {
      const result = findMentions(
        "La candidate Virginie Quentin se présente aux municipales",
        withAmbiguous
      );
      expect(result).toContainEqual({
        politicianId: "20",
        matchedName: "Virginie Quentin",
      });
    });

    it("should still match ambiguous lastName via full name for Sabrina Catherine", () => {
      const result = findMentions("Sabrina Catherine a pris position sur le sujet", withAmbiguous);
      expect(result).toContainEqual({
        politicianId: "21",
        matchedName: "Sabrina Catherine",
      });
    });
  });
});

// ============================================
// isCommonFrenchWord
// ============================================

describe("isCommonFrenchWord", () => {
  it("should identify common French words", () => {
    expect(isCommonFrenchWord("marchand")).toBe(true);
    expect(isCommonFrenchWord("fontaine")).toBe(true);
    expect(isCommonFrenchWord("chevalier")).toBe(true);
    expect(isCommonFrenchWord("berger")).toBe(true);
    expect(isCommonFrenchWord("baron")).toBe(true);
    expect(isCommonFrenchWord("moulin")).toBe(true);
  });

  it("should identify adjectives and nationalities", () => {
    expect(isCommonFrenchWord("allemand")).toBe(true);
    expect(isCommonFrenchWord("anglais")).toBe(true);
    expect(isCommonFrenchWord("grand")).toBe(true);
    expect(isCommonFrenchWord("petit")).toBe(true);
    expect(isCommonFrenchWord("rouge")).toBe(true);
    expect(isCommonFrenchWord("blanc")).toBe(true);
  });

  it("should identify political terms", () => {
    expect(isCommonFrenchWord("gauche")).toBe(true);
    expect(isCommonFrenchWord("droite")).toBe(true);
    expect(isCommonFrenchWord("maire")).toBe(true);
  });

  it("should identify 'france' via additional exclusions", () => {
    expect(isCommonFrenchWord("france")).toBe(true);
  });

  it("should NOT identify politician-only surnames as common words", () => {
    expect(isCommonFrenchWord("macron")).toBe(false);
    expect(isCommonFrenchWord("melenchon")).toBe(false);
    expect(isCommonFrenchWord("dupont")).toBe(false);
    expect(isCommonFrenchWord("attal")).toBe(false);
    expect(isCommonFrenchWord("wauquiez")).toBe(false);
    expect(isCommonFrenchWord("darmanin")).toBe(false);
  });
});

// ============================================
// findPartyMentions
// ============================================

describe("findPartyMentions", () => {
  const parties: PartyName[] = [
    {
      id: "p1",
      name: "Rassemblement National",
      shortName: "RN",
      normalizedName: "rassemblement national",
      normalizedShortName: "rn",
    },
    {
      id: "p2",
      name: "La France Insoumise",
      shortName: "LFI",
      normalizedName: "la france insoumise",
      normalizedShortName: "lfi",
    },
    {
      id: "p3",
      name: "Les Républicains",
      shortName: "LR",
      normalizedName: "les republicains",
      normalizedShortName: "lr",
    },
    {
      id: "p4",
      name: "Parti Socialiste",
      shortName: "PS",
      normalizedName: "parti socialiste",
      normalizedShortName: "ps",
    },
    {
      id: "p5",
      name: "Renaissance",
      shortName: "RE",
      normalizedName: "renaissance",
      normalizedShortName: "re",
    },
  ];

  it("should match full party name", () => {
    const result = findPartyMentions("Le Rassemblement National a voté contre", parties);
    expect(result).toEqual([{ partyId: "p1", matchedName: "Rassemblement National" }]);
  });

  it("should match short name when >= 3 characters", () => {
    const result = findPartyMentions("LFI propose un amendement", parties);
    expect(result).toEqual([{ partyId: "p2", matchedName: "LFI" }]);
  });

  it("should not match short name shorter than 3 characters", () => {
    // "RN" is only 2 chars, should not match by shortname
    const result = findPartyMentions("Le RN a voté contre", parties);
    expect(result).toEqual([]);
  });

  it("should exclude ambiguous short names", () => {
    // "LR" is in EXCLUDED_PARTY_SHORTNAMES
    const result = findPartyMentions("LR s'oppose", parties);
    expect(result).toEqual([]);
  });

  it("should exclude PS shortname (too ambiguous)", () => {
    const result = findPartyMentions("PS: merci de votre attention", parties);
    expect(result).toEqual([]);
  });

  it("should still match excluded shortnames via full name", () => {
    const result = findPartyMentions("Les Républicains ont voté", parties);
    expect(result).toEqual([{ partyId: "p3", matchedName: "Les Républicains" }]);
  });

  it("should not produce duplicate matches", () => {
    const result = findPartyMentions("La France Insoumise, aussi appelée LFI, a voté", parties);
    expect(result).toHaveLength(1);
    expect(result[0]!.partyId).toBe("p2");
  });

  it("should match multiple parties in same text", () => {
    const result = findPartyMentions(
      "Débat entre Rassemblement National et La France Insoumise",
      parties
    );
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.partyId).sort();
    expect(ids).toEqual(["p1", "p2"]);
  });

  it("should return empty array when no match", () => {
    const result = findPartyMentions("Aucun parti mentionné", parties);
    expect(result).toEqual([]);
  });
});
