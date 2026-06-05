import type { AmendmentStatus } from "@/generated/prisma";
import type { NormalizedAmendment } from "./types";

/** AN XML-derived JSON encodes nil as { "@xsi:nil": "true" }. */
export function isNil(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "object" && v !== null && "@xsi:nil" in (v as Record<string, unknown>))
    return true;
  return false;
}

/** Returns the string value or null if nil/absent. Empty string is a value. */
function str(v: unknown): string | null {
  if (isNil(v)) return null;
  if (typeof v === "string") return v;
  return null;
}

const SORT_MAP: Record<string, AmendmentStatus> = {
  Adopté: "ADOPTE",
  Rejeté: "REJETE",
  Retiré: "RETIRE",
  Tombé: "TOMBE",
  "Non soutenu": "TOMBE",
};

function mapStatus(sort: unknown): AmendmentStatus {
  const s = str(sort);
  if (!s) return "DEPOSE"; // pending / not yet voted
  return SORT_MAP[s] ?? "DEPOSE";
}

interface NormalizeContext {
  dossierRefFromPath: string | null;
  texteRefFromPath: string | null;
  legislature: number;
}

export function normalizeAmendment(raw: unknown, ctx: NormalizeContext): NormalizedAmendment {
  const a =
    (raw as { amendement?: Record<string, unknown> }).amendement ??
    (raw as Record<string, unknown>);
  const get = (obj: unknown, key: string): unknown =>
    obj && typeof obj === "object" && !isNil(obj)
      ? (obj as Record<string, unknown>)[key]
      : undefined;

  const identification = get(a, "identification");
  const corps = get(get(a, "corps"), "contenuAuteur");
  const cycleDeVie = get(a, "cycleDeVie");
  const discussionIdentique = get(a, "discussionIdentique");
  const division = get(get(a, "pointeurFragmentTexte"), "division");
  const signataires = get(a, "signataires");
  const auteur = get(signataires, "auteur");

  const numberRaw = str(get(identification, "numeroLong"));

  return {
    externalId: str(get(a, "uid")) ?? "",
    number: numberRaw ?? "",
    texteRef: str(get(a, "texteLegislatifRef")) ?? ctx.texteRefFromPath,
    dossierRefFromPath: ctx.dossierRefFromPath,
    article: str(get(division, "articleDesignation")),
    content: str(get(corps, "dispositif")),
    summary: str(get(corps, "exposeSommaire")),
    status: mapStatus(get(cycleDeVie, "sort")),
    parentExternalId: str(get(a, "amendementParentRef")),
    identicalDiscussionId: str(get(discussionIdentique, "idDiscussion")),
    authorType: str(get(auteur, "typeAuteur")),
    authorName: str(get(signataires, "libelle")),
    legislature: ctx.legislature,
    chamber: "AN",
  };
}
