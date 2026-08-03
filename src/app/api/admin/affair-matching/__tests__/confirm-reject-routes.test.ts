import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Le panneau de résolution sur la fiche affaire propose « Oui, c'est X » / « Non »
 * y compris sur un rattachement confirmé par l'assistance (`auto-triage`). Ces boutons
 * appellent /confirm et /reject. Tant que ces routes refusaient toute ligne au
 * `reviewedAt` non nul, un rattachement assisté ne pouvait pas être tranché par un
 * humain : la validation promise par l'encart était morte pour le cas le plus fréquent.
 *
 * La bonne barrière n'est pas « déjà revue » mais « déjà revue PAR UN HUMAIN » : un
 * humain peut reprendre une revue assistée, pas celle d'un autre humain.
 */

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  createMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    affairPoliticianDecision: {
      findUnique: h.findUnique,
      update: h.update,
      createMany: h.createMany,
    },
    auditLog: { create: h.auditCreate },
    // reject builds an ops array and runs it in one transaction.
    $transaction: (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)({}),
  },
}));
vi.mock("@/lib/api/with-admin-auth", () => ({
  withAdminAuth: (fn: (req: unknown, ctx: unknown) => unknown) => (req: unknown, ctx: unknown) =>
    fn(req, ctx),
}));
vi.mock("@/lib/security/validate", () => ({
  withValidation:
    (_s: unknown, fn: (req: unknown, ctx: unknown, body: unknown) => unknown) =>
    async (req: { json: () => Promise<unknown> }, ctx: unknown) =>
      fn(req, ctx, await req.json()),
}));
vi.mock("@/lib/security/audit", () => ({
  getRequestMeta: () => ({ ip: "203.0.113.1", userAgent: "test-agent" }),
}));

import { POST as confirmPOST } from "@/app/api/admin/affair-matching/confirm/route";
import { POST as rejectPOST } from "@/app/api/admin/affair-matching/reject/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = { params: Promise.resolve({}) };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(body: unknown): any {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ASSISTED = {
  id: "dec_assisted",
  judgment: "SAME",
  reviewedAt: new Date("2026-07-12"),
  reviewedBy: "auto-triage",
  textHash: "hash",
  source: "PRESS",
  sourceRef: "https://presse.example/a",
  candidateText: "texte",
  metadata: null,
  topScore: 5,
  gap: 1,
  resolverVersion: "v1",
};
const NEVER_REVIEWED = { ...ASSISTED, id: "dec_new", reviewedAt: null, reviewedBy: null };
const HUMAN = { ...ASSISTED, id: "dec_human", reviewedBy: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  h.update.mockResolvedValue({ id: "x", judgment: "SAME" });
  h.createMany.mockResolvedValue({ count: 0 });
  h.auditCreate.mockResolvedValue({});
});

describe("POST /affair-matching/confirm", () => {
  it("répond 404 pour une décision introuvable", async () => {
    h.findUnique.mockResolvedValue(null);
    const res = await confirmPOST(req({ decisionId: "dec_x", chosenPoliticianId: "pol_1" }), ctx);
    expect(res.status).toBe(404);
  });

  it("confirme une décision jamais revue", async () => {
    h.findUnique.mockResolvedValue(NEVER_REVIEWED);
    const res = await confirmPOST(req({ decisionId: "dec_new", chosenPoliticianId: "pol_1" }), ctx);
    expect(res.status).toBe(200);
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewedBy: "admin", reviewAction: "CONFIRMED" }),
      })
    );
  });

  it("confirme une décision déjà confirmée par l'assistance", async () => {
    h.findUnique.mockResolvedValue(ASSISTED);
    const res = await confirmPOST(
      req({ decisionId: "dec_assisted", chosenPoliticianId: "pol_1" }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewedBy: "admin" }),
      })
    );
  });

  it("refuse une décision déjà validée par un humain", async () => {
    h.findUnique.mockResolvedValue(HUMAN);
    const res = await confirmPOST(
      req({ decisionId: "dec_human", chosenPoliticianId: "pol_1" }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("POST /affair-matching/reject", () => {
  it("écarte une décision confirmée par l'assistance", async () => {
    h.findUnique.mockResolvedValue(ASSISTED);
    const res = await rejectPOST(
      req({ decisionId: "dec_assisted", action: "MOVE_TO_NO_MATCH" }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewedBy: "admin", judgment: "NO_MATCH" }),
      })
    );
  });

  it("refuse d'écarter une décision déjà validée par un humain", async () => {
    h.findUnique.mockResolvedValue(HUMAN);
    const res = await rejectPOST(req({ decisionId: "dec_human", action: "MOVE_TO_NO_MATCH" }), ctx);
    expect(res.status).toBe(400);
    expect(h.update).not.toHaveBeenCalled();
  });
});
