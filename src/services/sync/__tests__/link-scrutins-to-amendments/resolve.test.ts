import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { ParsedTitle } from "@/services/sync/link-scrutins-to-amendments/types";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

let db: typeof import("@/lib/db").db;
let resolveLinks: typeof import("@/services/sync/link-scrutins-to-amendments/resolve").resolveLinks;

const SCRUTIN_PFX = "TEST_LINK_S_";
const AMEND_PFX = "TEST_LINK_A_";

const parsedPotier: ParsedTitle = {
  principalNumbers: [],
  subAmendmentNumber: "2368",
  parentAmendmentNumber: "2058",
  hasIdentique: true,
  identiqueNumbers: [],
  warnings: [],
  confidence: 0.85,
};

describeIfDb("resolveLinks", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ resolveLinks } = await import("@/services/sync/link-scrutins-to-amendments/resolve"));
    await db.legislativeDossier.upsert({
      where: { externalId: "TEST_LINK_DLR_1" },
      create: {
        externalId: "TEST_LINK_DLR_1",
        slug: "test-link-dossier",
        title: "Test dossier",
        status: "EN_COURS",
      },
      update: {},
    });
    const dossierId = (
      await db.legislativeDossier.findUniqueOrThrow({ where: { externalId: "TEST_LINK_DLR_1" } })
    ).id;

    await db.scrutinAmendment.deleteMany({
      where: { amendment: { externalId: { startsWith: AMEND_PFX } } },
    });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: AMEND_PFX } } });
    await db.amendment.createMany({
      data: [
        {
          externalId: `${AMEND_PFX}2058`,
          number: "2058",
          texteRef: "TEST_PIONANR_1",
          dossierId,
          status: "ADOPTE",
          legislature: 17,
          chamber: "AN",
          identicalGroupKey: "GRP_TEST",
        },
        {
          externalId: `${AMEND_PFX}2074`,
          number: "2074",
          texteRef: "TEST_PIONANR_1",
          dossierId,
          status: "ADOPTE",
          legislature: 17,
          chamber: "AN",
          identicalGroupKey: "GRP_TEST",
        },
        {
          externalId: `${AMEND_PFX}2368`,
          number: "2368",
          texteRef: "TEST_PIONANR_1",
          dossierId,
          status: "ADOPTE",
          legislature: 17,
          chamber: "AN",
        },
      ],
    });

    await db.scrutinAmendment.deleteMany({
      where: { scrutin: { externalId: { startsWith: SCRUTIN_PFX } } },
    });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: SCRUTIN_PFX } } });
    await db.scrutin.create({
      data: {
        externalId: `${SCRUTIN_PFX}1`,
        title:
          "le sous-amendement n° 2368 de M. Potier à l'amendement n° 2058 du Gouvernement et l'amendement identique suivant",
        votingDate: new Date("2026-05-22T10:00:00Z"),
        legislature: 17,
        chamber: "AN",
        votesFor: 287,
        votesAgainst: 222,
        votesAbstain: 14,
        result: "ADOPTED",
        dossierLegislatifId: dossierId,
      },
    });
  });

  afterAll(async () => {
    await db.scrutinAmendment.deleteMany({
      where: { scrutin: { externalId: { startsWith: SCRUTIN_PFX } } },
    });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: SCRUTIN_PFX } } });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: AMEND_PFX } } });
    await db.legislativeDossier.deleteMany({ where: { externalId: "TEST_LINK_DLR_1" } });
  });

  it("resolves SUB + PARENT + IDENTICAL roles when the scrutin is dossier-scoped", async () => {
    const scrutin = await db.scrutin.findUniqueOrThrow({
      where: { externalId: `${SCRUTIN_PFX}1` },
    });
    const res = await resolveLinks(scrutin, parsedPotier);
    expect(res.scope).toBe("dossier");
    expect(res.links.map((l) => l.role).sort()).toEqual([
      "IDENTICAL",
      "PARENT_AMENDMENT",
      "SUB_AMENDMENT",
    ]);
    const amendments = await db.amendment.findMany({
      where: { externalId: { startsWith: AMEND_PFX } },
      select: { id: true, externalId: true },
    });
    const idByExt = new Map(amendments.map((a) => [a.externalId, a.id]));
    expect(res.links.find((l) => l.role === "SUB_AMENDMENT")!.amendmentId).toBe(
      idByExt.get(`${AMEND_PFX}2368`)
    );
    expect(res.links.find((l) => l.role === "PARENT_AMENDMENT")!.amendmentId).toBe(
      idByExt.get(`${AMEND_PFX}2058`)
    );
    expect(res.links.find((l) => l.role === "IDENTICAL")!.amendmentId).toBe(
      idByExt.get(`${AMEND_PFX}2074`)
    );
  });

  it("returns unscoped + no links when the scrutin has no dossier link", async () => {
    const ds = await db.scrutin.create({
      data: {
        externalId: `${SCRUTIN_PFX}orphan`,
        title: "l'amendement n° 1234 du Gouvernement",
        votingDate: new Date("2026-05-22T10:00:00Z"),
        legislature: 17,
        chamber: "AN",
        votesFor: 1,
        votesAgainst: 0,
        votesAbstain: 0,
        result: "ADOPTED",
        dossierLegislatifId: null,
      },
    });
    const res = await resolveLinks(ds, {
      ...parsedPotier,
      principalNumbers: ["1234"],
      subAmendmentNumber: null,
      parentAmendmentNumber: null,
      hasIdentique: false,
    });
    expect(res.scope).toBe("unscoped");
    expect(res.links).toHaveLength(0);
    expect(res.warnings.some((w) => w.code === "UNSCOPED")).toBe(true);
  });

  it("AMBIGUOUS_CANDIDATES writes NO link in V1 (no arbitrary first-pick)", async () => {
    const dossierId = (
      await db.legislativeDossier.findUniqueOrThrow({ where: { externalId: "TEST_LINK_DLR_1" } })
    ).id;
    await db.amendment.create({
      data: {
        externalId: `${AMEND_PFX}dup_a`,
        number: "555",
        texteRef: "TEST_PIONANR_1",
        dossierId,
        status: "DEPOSE",
        legislature: 17,
        chamber: "AN",
      },
    });
    await db.amendment.create({
      data: {
        externalId: `${AMEND_PFX}dup_b`,
        number: "555",
        texteRef: "TEST_PIONANR_2",
        dossierId,
        status: "DEPOSE",
        legislature: 17,
        chamber: "AN",
      },
    });
    const scrutin = await db.scrutin.findUniqueOrThrow({
      where: { externalId: `${SCRUTIN_PFX}1` },
    });
    const res = await resolveLinks(scrutin, {
      ...parsedPotier,
      subAmendmentNumber: null,
      parentAmendmentNumber: null,
      principalNumbers: ["555"],
      hasIdentique: false,
    });
    expect(res.warnings.some((w) => w.code === "AMBIGUOUS_CANDIDATES")).toBe(true);
    expect(res.links.filter((l) => l.role === "PRINCIPAL")).toHaveLength(0);
  });

  it("matches a rectified variant (title '600' → candidate '600 (Rect)') when unique", async () => {
    const dossierId = (
      await db.legislativeDossier.findUniqueOrThrow({ where: { externalId: "TEST_LINK_DLR_1" } })
    ).id;
    await db.amendment.create({
      data: {
        externalId: `${AMEND_PFX}rect_one`,
        number: "600 (Rect)",
        texteRef: "TEST_PIONANR_1",
        dossierId,
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
      },
    });
    const scrutin = await db.scrutin.findUniqueOrThrow({
      where: { externalId: `${SCRUTIN_PFX}1` },
    });
    const res = await resolveLinks(scrutin, {
      ...parsedPotier,
      subAmendmentNumber: null,
      parentAmendmentNumber: null,
      principalNumbers: ["600"],
      hasIdentique: false,
    });
    const link = res.links.find((l) => l.role === "PRINCIPAL");
    expect(link).toBeDefined();
    const a = await db.amendment.findUnique({ where: { externalId: `${AMEND_PFX}rect_one` } });
    expect(link?.amendmentId).toBe(a?.id);
  });

  it("does NOT match when multiple rectified variants exist (ambiguous)", async () => {
    const dossierId = (
      await db.legislativeDossier.findUniqueOrThrow({ where: { externalId: "TEST_LINK_DLR_1" } })
    ).id;
    await db.amendment.create({
      data: {
        externalId: `${AMEND_PFX}rect_a`,
        number: "777 (Rect)",
        texteRef: "TEST_PIONANR_1",
        dossierId,
        status: "DEPOSE",
        legislature: 17,
        chamber: "AN",
      },
    });
    await db.amendment.create({
      data: {
        externalId: `${AMEND_PFX}rect_b`,
        number: "777 (Rect 2)",
        texteRef: "TEST_PIONANR_1",
        dossierId,
        status: "DEPOSE",
        legislature: 17,
        chamber: "AN",
      },
    });
    const scrutin = await db.scrutin.findUniqueOrThrow({
      where: { externalId: `${SCRUTIN_PFX}1` },
    });
    const res = await resolveLinks(scrutin, {
      ...parsedPotier,
      subAmendmentNumber: null,
      parentAmendmentNumber: null,
      principalNumbers: ["777"],
      hasIdentique: false,
    });
    expect(res.warnings.some((w) => w.code === "AMBIGUOUS_CANDIDATES")).toBe(true);
    expect(res.links.filter((l) => l.role === "PRINCIPAL")).toHaveLength(0);
  });

  it("warns CANDIDATE_NOT_FOUND when a cited number resolves to nothing in scope", async () => {
    const scrutin = await db.scrutin.findUniqueOrThrow({
      where: { externalId: `${SCRUTIN_PFX}1` },
    });
    const res = await resolveLinks(scrutin, {
      ...parsedPotier,
      subAmendmentNumber: null,
      parentAmendmentNumber: null,
      principalNumbers: ["999999"],
      hasIdentique: false,
    });
    expect(res.warnings.some((w) => w.code === "CANDIDATE_NOT_FOUND")).toBe(true);
    expect(res.links.some((l) => l.role === "PRINCIPAL")).toBe(false);
  });

  it("drops parent link and marks TARGET_SUB_AMENDMENT_NOT_FOUND when the sub target is missing", async () => {
    const scrutin = await db.scrutin.findUniqueOrThrow({
      where: { externalId: `${SCRUTIN_PFX}1` },
    });
    const res = await resolveLinks(scrutin, {
      ...parsedPotier,
      subAmendmentNumber: "999999",
      parentAmendmentNumber: "2058",
      principalNumbers: [],
      hasIdentique: false,
    });
    expect(res.warnings.some((w) => w.code === "TARGET_SUB_AMENDMENT_NOT_FOUND")).toBe(true);
    expect(res.links).toHaveLength(0);
  });
});

describeIfDb("dedupeLinks (pure)", () => {
  it("collapses the same amendment to one link with the higher-priority role", async () => {
    const { dedupeLinks } = await import("@/services/sync/link-scrutins-to-amendments/resolve");
    const out = dedupeLinks([
      {
        scrutinId: "s1",
        amendmentId: "a1",
        role: "IDENTICAL",
        parserConfidence: 0.9,
        parserWarnings: [],
      },
      {
        scrutinId: "s1",
        amendmentId: "a1",
        role: "PRINCIPAL",
        parserConfidence: 0.7,
        parserWarnings: [],
      },
      {
        scrutinId: "s1",
        amendmentId: "a2",
        role: "SUB_AMENDMENT",
        parserConfidence: 0.8,
        parserWarnings: [],
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((l) => l.amendmentId === "a1")!.role).toBe("PRINCIPAL");
    expect(out.find((l) => l.amendmentId === "a2")!.role).toBe("SUB_AMENDMENT");
  });
});
