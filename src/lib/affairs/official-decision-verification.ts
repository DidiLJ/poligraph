import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { SourceType } from "@/generated/prisma";
import { USER_AGENT } from "@/config/site";

export type OfficialDecisionVerificationStatus =
  | "VALID"
  | "REDIRECTED"
  | "INDEX_VERIFIED"
  | "BROKEN"
  | "MISMATCH"
  | "BLOCKED"
  | "UNCHECKED";

export interface OfficialDecisionIndexedProof {
  version: 1;
  exactUrl: string;
  verifiedAt: string;
  method: "EXACT_OFFICIAL_SEARCH_RESULT";
  title: string;
  publisher: string;
  pourvoi?: string | null;
  ecli?: string | null;
  decisionDate?: string | null;
  officialId?: string | null;
}

export interface OfficialDecisionExpectation {
  url: string;
  pourvoi?: string | null;
  ecli?: string | null;
  decisionDate?: string | null;
  officialId?: string | null;
  indexedProof?: OfficialDecisionIndexedProof | null;
}

export interface OfficialDecisionVerification {
  version: 1;
  status: OfficialDecisionVerificationStatus;
  checkedAt: string;
  requestedUrl: string;
  resolvedUrl: string | null;
  httpStatus: number | null;
  contentHash: string | null;
  matchedIdentifiers: string[];
  issues: string[];
  indexedProof: OfficialDecisionIndexedProof | null;
}

export interface ProposalOfficialEvidenceInput {
  source?: SourceType | string | null;
  sourceUrl?: string | null;
  officialId?: string | null;
  metadata?: unknown;
}

export interface VerifiedProposalOfficialEvidence {
  sourceUrl: string;
  metadata: Record<string, unknown>;
  verification: OfficialDecisionVerification;
}

export interface ProposalOfficialEvidenceSummary {
  required: boolean;
  acceptable: boolean;
  canonicalUrl: string | null;
  requestedUrl: string | null;
  status: OfficialDecisionVerificationStatus | null;
  checkedAt: string | null;
  matchedIdentifiers: string[];
  issues: string[];
}

export interface ProposalSourceLinkSummary {
  rawUrl: string | null;
  safeUrl: string | null;
}

type OfficialProvider = "LEGIFRANCE" | "COUR_DE_CASSATION" | "CONSEIL_ETAT";

interface AllowedOfficialUrl {
  url: URL;
  provider: OfficialProvider;
  officialId: string;
}

const OFFICIAL_SOURCE_TYPES = new Set(["LEGIFRANCE", "JUDILIBRE"]);
const INDEXED_PROOF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REDIRECTS = 3;

const FRENCH_MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Allows a moderator to open an ordinary editorial source without presenting it
 * as verified judicial evidence. This validates URL structure only. It does not
 * check reachability, redirects, paywalls or agreement with the proposed change.
 */
export function summarizeProposalSourceLink(sourceUrl: unknown): ProposalSourceLinkSummary {
  const rawUrl = asNonEmptyString(sourceUrl);
  if (!rawUrl) return { rawUrl: null, safeUrl: null };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { rawUrl, safeUrl: null };
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    return { rawUrl, safeUrl: null };
  }

  return { rawUrl, safeUrl: parsed.toString() };
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value: string): string {
  const $ = load(value);
  $("script, style").remove();
  return stripDiacritics(
    $.root()
      .text()
      .replace(/[\u2010-\u2015\u2212]/g, "-")
  )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactIdentifier(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function canonicalUrl(url: URL): URL {
  const normalized = new URL(url);
  normalized.hash = "";
  normalized.search = "";
  if (normalized.pathname.length > 1) {
    normalized.pathname = normalized.pathname.replace(/\/+$/, "");
  }
  return normalized;
}

function sameUrl(left: string, right: string): boolean {
  return canonicalUrl(new URL(left)).toString() === canonicalUrl(new URL(right)).toString();
}

function allowedOfficialUrl(
  rawUrl: string
): { ok: true; value: AllowedOfficialUrl } | { ok: false; issue: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, issue: "url_invalide" };
  }

  if (parsed.protocol !== "https:") return { ok: false, issue: "protocole_non_https" };
  if (parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
    return { ok: false, issue: "autorite_url_non_autorisee" };
  }

  const url = canonicalUrl(parsed);
  const host = url.hostname.toLowerCase();
  let match: RegExpExecArray | null;

  if (host === "legifrance.gouv.fr" || host === "www.legifrance.gouv.fr") {
    match = /^\/juri\/id\/(JURITEXT[0-9]+)$/i.exec(url.pathname);
    if (!match) return { ok: false, issue: "chemin_legifrance_non_canonique" };
    return {
      ok: true,
      value: { url, provider: "LEGIFRANCE", officialId: match[1]!.toUpperCase() },
    };
  }

  if (host === "courdecassation.fr" || host === "www.courdecassation.fr") {
    match = /^\/decision\/([a-f0-9]+)$/i.exec(url.pathname);
    if (!match) return { ok: false, issue: "chemin_judilibre_non_canonique" };
    return {
      ok: true,
      value: { url, provider: "COUR_DE_CASSATION", officialId: match[1]!.toLowerCase() },
    };
  }

  if (host === "conseil-etat.fr" || host === "www.conseil-etat.fr") {
    match =
      /^\/fr\/arianeweb\/(?:CE|JADE|TC)\/decision\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/([A-Za-z0-9.-]+)$/i.exec(
        url.pathname
      );
    if (!match) return { ok: false, issue: "chemin_arianeweb_non_canonique" };
    return {
      ok: true,
      value: { url, provider: "CONSEIL_ETAT", officialId: match[1]! },
    };
  }

  return { ok: false, issue: "hote_officiel_non_autorise" };
}

function dateVariants(rawDate: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  if (!match) return [normalizeText(rawDate)];
  const [, year, month, day] = match;
  const monthName = FRENCH_MONTHS[Number(month) - 1];
  if (!monthName) return [normalizeText(rawDate)];
  return [
    `${year}-${month}-${day}`,
    `${day}/${month}/${year}`,
    `${day}-${month}-${year}`,
    `${Number(day)} ${monthName} ${year}`,
  ].map(normalizeText);
}

function verificationResult(
  expectation: OfficialDecisionExpectation,
  status: OfficialDecisionVerificationStatus,
  partial: Partial<
    Omit<OfficialDecisionVerification, "version" | "status" | "checkedAt" | "requestedUrl">
  > = {}
): OfficialDecisionVerification {
  return {
    version: 1,
    status,
    checkedAt: new Date().toISOString(),
    requestedUrl: expectation.url,
    resolvedUrl: partial.resolvedUrl ?? null,
    httpStatus: partial.httpStatus ?? null,
    contentHash: partial.contentHash ?? null,
    matchedIdentifiers: partial.matchedIdentifiers ?? [],
    issues: partial.issues ?? [],
    indexedProof: partial.indexedProof ?? null,
  };
}

export function isSuccessfulOfficialDecisionVerification(
  verification: OfficialDecisionVerification
): boolean {
  return ["VALID", "REDIRECTED", "INDEX_VERIFIED"].includes(verification.status);
}

export function isAcceptableOfficialDecisionVerification(
  verification: OfficialDecisionVerification
): boolean {
  // INDEX_VERIFIED is supplied through importer-controlled metadata. Its internal
  // consistency helps a moderator, but it is not independent provenance. A future
  // persisted or signed official proof may introduce a separate trusted path.
  return verification.status === "VALID";
}

function expectedValues(expectation: OfficialDecisionExpectation) {
  return {
    pourvoi: asNonEmptyString(expectation.pourvoi),
    ecli: asNonEmptyString(expectation.ecli),
    decisionDate: asNonEmptyString(expectation.decisionDate),
    officialId: asNonEmptyString(expectation.officialId),
  };
}

function expectationIssues(
  expectation: OfficialDecisionExpectation,
  url: AllowedOfficialUrl
): string[] {
  const expected = expectedValues(expectation);
  const issues: string[] = [];
  if (!expected.officialId) issues.push("identifiant_officiel_attendu_absent");
  if (!expected.decisionDate) issues.push("date_decision_attendue_absente");
  if (!expected.pourvoi && !expected.ecli) {
    issues.push("pourvoi_ou_ecli_attendu_absent");
  }
  if (
    expected.officialId &&
    compactIdentifier(expected.officialId) !== compactIdentifier(url.officialId)
  ) {
    issues.push("url_et_identifiant_officiel_differents");
  }
  return issues;
}

function expectedPublisher(provider: OfficialProvider): string {
  if (provider === "LEGIFRANCE") return "legifrance";
  if (provider === "COUR_DE_CASSATION") return "cour de cassation";
  return "conseil d'etat";
}

function validateIndexedProof(
  expectation: OfficialDecisionExpectation,
  url: AllowedOfficialUrl
): { proof: OfficialDecisionIndexedProof | null; issues: string[]; matchedIdentifiers: string[] } {
  const proof = expectation.indexedProof ?? null;
  if (!proof) return { proof: null, issues: ["preuve_indexee_absente"], matchedIdentifiers: [] };

  const issues: string[] = [];
  const matchedIdentifiers: string[] = [];
  if (proof.version !== 1 || proof.method !== "EXACT_OFFICIAL_SEARCH_RESULT") {
    issues.push("preuve_indexee_format_invalide");
  }

  const title = asNonEmptyString(proof.title);
  const publisher = asNonEmptyString(proof.publisher);
  if (!title || !publisher) issues.push("preuve_indexee_incomplete");
  if (publisher && normalizeText(publisher) !== expectedPublisher(url.provider)) {
    issues.push("preuve_indexee_editeur_different");
  }

  const verifiedAt = Date.parse(proof.verifiedAt);
  const age = Date.now() - verifiedAt;
  if (!Number.isFinite(verifiedAt) || age < -5 * 60 * 1000 || age > INDEXED_PROOF_MAX_AGE_MS) {
    issues.push("preuve_indexee_expiree_ou_date_invalide");
  }

  try {
    if (!sameUrl(expectation.url, proof.exactUrl)) issues.push("preuve_indexee_url_differente");
  } catch {
    issues.push("preuve_indexee_url_invalide");
  }

  const expected = expectedValues(expectation);
  const compare = (name: keyof typeof expected, actual: string | null | undefined): void => {
    const wanted = expected[name];
    if (!wanted) return;
    if (!actual || compactIdentifier(actual) !== compactIdentifier(wanted)) {
      issues.push(`preuve_indexee_${name}_different`);
    } else {
      matchedIdentifiers.push(name);
    }
  };

  compare("pourvoi", proof.pourvoi);
  compare("ecli", proof.ecli);
  compare("decisionDate", proof.decisionDate);
  compare("officialId", proof.officialId);

  if (
    title &&
    expected.pourvoi &&
    !compactIdentifier(title).includes(compactIdentifier(expected.pourvoi))
  ) {
    issues.push("preuve_indexee_titre_sans_pourvoi");
  }
  if (
    title &&
    expected.decisionDate &&
    !dateVariants(expected.decisionDate).some((variant) => normalizeText(title).includes(variant))
  ) {
    issues.push("preuve_indexee_titre_sans_date");
  }

  return { proof, issues, matchedIdentifiers };
}

function blockedOrIndexedResult(
  expectation: OfficialDecisionExpectation,
  url: AllowedOfficialUrl,
  issue: string,
  partial: { resolvedUrl?: string | null; httpStatus?: number | null } = {}
): OfficialDecisionVerification {
  const indexed = validateIndexedProof(expectation, url);
  if (indexed.proof && indexed.issues.length === 0) {
    return verificationResult(expectation, "INDEX_VERIFIED", {
      resolvedUrl: partial.resolvedUrl ?? url.url.toString(),
      httpStatus: partial.httpStatus ?? null,
      matchedIdentifiers: indexed.matchedIdentifiers,
      issues: [issue, "reference_indexee_declaree_concordante"],
      indexedProof: indexed.proof,
    });
  }
  return verificationResult(expectation, "BLOCKED", {
    resolvedUrl: partial.resolvedUrl ?? null,
    httpStatus: partial.httpStatus ?? null,
    issues: [issue, ...indexed.issues],
    indexedProof: indexed.proof,
  });
}

async function fetchOfficialDecision(
  initial: AllowedOfficialUrl,
  options: { fetchImpl?: typeof fetch; signal: AbortSignal }
): Promise<
  | { ok: true; response: Response; resolved: AllowedOfficialUrl; redirected: boolean }
  | { ok: false; issue: string; resolvedUrl: string | null; httpStatus: number | null }
> {
  let current = initial;
  let redirected = false;
  const visited = new Set<string>();

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const currentUrl = current.url.toString();
    if (visited.has(currentUrl)) {
      return { ok: false, issue: "boucle_redirection", resolvedUrl: currentUrl, httpStatus: null };
    }
    visited.add(currentUrl);

    const requestInit: RequestInit = {
      method: "GET",
      redirect: "manual",
      signal: options.signal,
      headers: { accept: "text/html,application/xhtml+xml" },
    };
    const response = options.fetchImpl
      ? await options.fetchImpl(current.url, requestInit)
      : await fetch(current.url, {
          ...requestInit,
          headers: { accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
        });

    if (response.status < 300 || response.status >= 400) {
      const responseUrl = response.url || currentUrl;
      const resolved = allowedOfficialUrl(responseUrl);
      if (!resolved.ok) {
        return {
          ok: false,
          issue: `reponse_url_non_autorisee:${resolved.issue}`,
          resolvedUrl: responseUrl,
          httpStatus: response.status,
        };
      }
      return { ok: true, response, resolved: resolved.value, redirected };
    }

    const location = response.headers.get("location");
    if (!location) {
      return {
        ok: false,
        issue: "redirection_sans_destination",
        resolvedUrl: currentUrl,
        httpStatus: response.status,
      };
    }

    const destination = allowedOfficialUrl(new URL(location, current.url).toString());
    if (!destination.ok) {
      return {
        ok: false,
        issue: `redirection_non_autorisee:${destination.issue}`,
        resolvedUrl: new URL(location, current.url).toString(),
        httpStatus: response.status,
      };
    }
    current = destination.value;
    redirected = true;
  }

  return {
    ok: false,
    issue: "trop_de_redirections",
    resolvedUrl: current.url.toString(),
    httpStatus: null,
  };
}

export async function verifyOfficialDecision(
  expectation: OfficialDecisionExpectation,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<OfficialDecisionVerification> {
  const allowed = allowedOfficialUrl(expectation.url);
  if (!allowed.ok) {
    return verificationResult(expectation, "BLOCKED", { issues: [allowed.issue] });
  }

  const missing = expectationIssues(expectation, allowed.value);
  if (missing.length > 0) {
    return verificationResult(expectation, "UNCHECKED", { issues: missing });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  let fetched: Awaited<ReturnType<typeof fetchOfficialDecision>>;
  try {
    fetched = await fetchOfficialDecision(allowed.value, {
      fetchImpl: options.fetchImpl,
      signal: controller.signal,
    });
  } catch (error) {
    const issue =
      error instanceof Error && error.name === "AbortError" ? "delai_depasse" : "erreur_reseau";
    return blockedOrIndexedResult(expectation, allowed.value, issue);
  } finally {
    clearTimeout(timeout);
  }

  if (!fetched.ok) {
    return verificationResult(expectation, "BLOCKED", {
      resolvedUrl: fetched.resolvedUrl,
      httpStatus: fetched.httpStatus,
      issues: [fetched.issue],
    });
  }

  const { response, resolved, redirected } = fetched;
  const resolvedUrl = resolved.url.toString();
  if (compactIdentifier(resolved.officialId) !== compactIdentifier(allowed.value.officialId)) {
    return verificationResult(expectation, "MISMATCH", {
      resolvedUrl,
      httpStatus: response.status,
      issues: ["redirection_vers_autre_decision"],
    });
  }

  if (response.status === 404 || response.status === 410) {
    return verificationResult(expectation, "BROKEN", {
      resolvedUrl,
      httpStatus: response.status,
      issues: [`http_${response.status}`],
    });
  }
  if ([401, 403, 429].includes(response.status) || response.status >= 500) {
    return blockedOrIndexedResult(expectation, allowed.value, `http_${response.status}`, {
      resolvedUrl,
      httpStatus: response.status,
    });
  }
  if (!response.ok) {
    return verificationResult(expectation, "BROKEN", {
      resolvedUrl,
      httpStatus: response.status,
      issues: [`http_${response.status}`],
    });
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    return blockedOrIndexedResult(expectation, allowed.value, "lecture_reponse_impossible", {
      resolvedUrl,
      httpStatus: response.status,
    });
  }
  const normalized = normalizeText(body);
  const compact = compactIdentifier(normalized);
  const expected = expectedValues(expectation);
  const matchedIdentifiers: string[] = ["officialId"];
  const issues: string[] = [];

  if (expected.pourvoi) {
    if (compact.includes(compactIdentifier(expected.pourvoi))) matchedIdentifiers.push("pourvoi");
    else issues.push("pourvoi_absent_ou_different");
  }
  if (expected.ecli) {
    if (normalized.includes(normalizeText(expected.ecli))) matchedIdentifiers.push("ecli");
    else issues.push("ecli_absent_ou_different");
  }
  if (expected.decisionDate) {
    if (dateVariants(expected.decisionDate).some((variant) => normalized.includes(variant))) {
      matchedIdentifiers.push("decisionDate");
    } else {
      issues.push("date_decision_absente_ou_differente");
    }
  }

  const contentHash = createHash("sha256").update(body).digest("hex");
  if (issues.length > 0) {
    return verificationResult(expectation, "MISMATCH", {
      resolvedUrl,
      httpStatus: response.status,
      contentHash,
      matchedIdentifiers,
      issues,
    });
  }

  return verificationResult(expectation, redirected ? "REDIRECTED" : "VALID", {
    resolvedUrl,
    httpStatus: response.status,
    contentHash,
    matchedIdentifiers,
  });
}

function candidateFromMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!isRecord(metadata)) return null;
  return isRecord(metadata.courtDecisionCandidate) ? metadata.courtDecisionCandidate : null;
}

function indexedProofFromCandidate(value: unknown): OfficialDecisionIndexedProof | null {
  if (!isRecord(value)) return null;
  const exactUrl = asNonEmptyString(value.exactUrl);
  const verifiedAt = asNonEmptyString(value.verifiedAt);
  const title = asNonEmptyString(value.title);
  const publisher = asNonEmptyString(value.publisher);
  if (
    value.version !== 1 ||
    value.method !== "EXACT_OFFICIAL_SEARCH_RESULT" ||
    !exactUrl ||
    !verifiedAt ||
    !title ||
    !publisher
  ) {
    return null;
  }
  return {
    version: 1,
    exactUrl,
    verifiedAt,
    method: "EXACT_OFFICIAL_SEARCH_RESULT",
    title,
    publisher,
    pourvoi: asNonEmptyString(value.pourvoi),
    ecli: asNonEmptyString(value.ecli),
    decisionDate: asNonEmptyString(value.decisionDate),
    officialId: asNonEmptyString(value.officialId),
  };
}

function hasCanonicalOfficialUrl(value: string | null): boolean {
  return value ? allowedOfficialUrl(value).ok : false;
}

function evidenceRequired(input: ProposalOfficialEvidenceInput): boolean {
  return (
    candidateFromMetadata(input.metadata) !== null ||
    OFFICIAL_SOURCE_TYPES.has(input.source ?? "") ||
    hasCanonicalOfficialUrl(asNonEmptyString(input.sourceUrl))
  );
}

function expectationFromInput(
  input: ProposalOfficialEvidenceInput,
  candidate: Record<string, unknown>
): OfficialDecisionExpectation | null {
  const url =
    asNonEmptyString(candidate.canonicalUrl) ??
    asNonEmptyString(candidate.url) ??
    asNonEmptyString(input.sourceUrl);
  if (!url) return null;

  const inputOfficialId = asNonEmptyString(input.officialId);
  const providerId =
    asNonEmptyString(candidate.legifranceId) ??
    asNonEmptyString(candidate.judilibreId) ??
    asNonEmptyString(candidate.officialId) ??
    (inputOfficialId && /^(?:JURITEXT[0-9]+|[a-f0-9]{16,})$/i.test(inputOfficialId)
      ? inputOfficialId
      : null);

  return {
    url,
    pourvoi: asNonEmptyString(candidate.pourvoi) ?? (providerId ? null : inputOfficialId),
    ecli: asNonEmptyString(candidate.ecli),
    decisionDate: asNonEmptyString(candidate.date) ?? asNonEmptyString(candidate.decisionDate),
    officialId: providerId,
    indexedProof: indexedProofFromCandidate(candidate.indexedProof),
  };
}

export async function verifyProposalOfficialEvidence(
  input: ProposalOfficialEvidenceInput,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<VerifiedProposalOfficialEvidence | null> {
  if (!evidenceRequired(input)) return null;

  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const candidate = candidateFromMetadata(metadata);
  if (!candidate) {
    return {
      sourceUrl: asNonEmptyString(input.sourceUrl) ?? "",
      metadata,
      verification: verificationResult(
        { url: asNonEmptyString(input.sourceUrl) ?? "" },
        "UNCHECKED",
        { issues: ["decision_officielle_candidate_absente"] }
      ),
    };
  }

  const expectation = expectationFromInput(input, candidate);
  if (!expectation) {
    return {
      sourceUrl: asNonEmptyString(input.sourceUrl) ?? "",
      metadata,
      verification: verificationResult({ url: "" }, "UNCHECKED", {
        issues: ["url_decision_absente"],
      }),
    };
  }

  const sourceUrl = asNonEmptyString(input.sourceUrl) ?? expectation.url;
  try {
    if (!sameUrl(sourceUrl, expectation.url)) {
      return {
        sourceUrl,
        metadata,
        verification: verificationResult(expectation, "MISMATCH", {
          issues: ["source_url_et_decision_candidate_differentes"],
        }),
      };
    }
  } catch {
    return {
      sourceUrl,
      metadata,
      verification: verificationResult(expectation, "BLOCKED", { issues: ["url_invalide"] }),
    };
  }

  const verification = await verifyOfficialDecision(expectation, options);
  const resolvedUrl = verification.resolvedUrl ?? expectation.url;
  return {
    sourceUrl: resolvedUrl,
    metadata: {
      ...metadata,
      courtDecisionCandidate: {
        ...candidate,
        url: resolvedUrl,
        canonicalUrl: resolvedUrl,
        verification,
      },
    },
    verification,
  };
}

export class OfficialEvidenceVerificationError extends Error {
  constructor(readonly verification: OfficialDecisionVerification) {
    super(`La décision officielle n'est pas vérifiée (${verification.status})`);
    this.name = "OfficialEvidenceVerificationError";
  }
}

export async function verifyAndAnnotateProposalOfficialEvidence(
  input: ProposalOfficialEvidenceInput,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<VerifiedProposalOfficialEvidence | null> {
  let verified = await verifyProposalOfficialEvidence(input, options);

  if (verified?.verification.status === "REDIRECTED") {
    const initialUrl = verified.verification.requestedUrl;
    const direct = await verifyProposalOfficialEvidence(
      {
        ...input,
        sourceUrl: verified.sourceUrl,
        metadata: verified.metadata,
      },
      options
    );

    if (direct) {
      const candidate = candidateFromMetadata(direct.metadata);
      verified = candidate
        ? {
            ...direct,
            metadata: {
              ...direct.metadata,
              courtDecisionCandidate: {
                ...candidate,
                urlNormalization: {
                  initialUrl,
                  finalUrl: direct.sourceUrl,
                  normalizedAt: direct.verification.checkedAt,
                  reason: "OFFICIAL_REDIRECT",
                },
              },
            },
          }
        : direct;
    }
  }

  if (verified && !isSuccessfulOfficialDecisionVerification(verified.verification)) {
    throw new OfficialEvidenceVerificationError(verified.verification);
  }
  return verified;
}

function verificationFromCandidate(
  candidate: Record<string, unknown>
): OfficialDecisionVerification | null {
  const verification = isRecord(candidate.verification) ? candidate.verification : null;
  const status = asNonEmptyString(
    verification?.status
  ) as OfficialDecisionVerificationStatus | null;
  if (!status) return null;
  const validStatuses: OfficialDecisionVerificationStatus[] = [
    "VALID",
    "REDIRECTED",
    "INDEX_VERIFIED",
    "BROKEN",
    "MISMATCH",
    "BLOCKED",
    "UNCHECKED",
  ];
  if (!validStatuses.includes(status)) return null;
  return {
    version: 1,
    status,
    checkedAt: asNonEmptyString(verification?.checkedAt) ?? "",
    requestedUrl: asNonEmptyString(verification?.requestedUrl) ?? "",
    resolvedUrl: asNonEmptyString(verification?.resolvedUrl),
    httpStatus: typeof verification?.httpStatus === "number" ? verification.httpStatus : null,
    contentHash: asNonEmptyString(verification?.contentHash),
    matchedIdentifiers: Array.isArray(verification?.matchedIdentifiers)
      ? verification.matchedIdentifiers.filter(
          (value): value is string => typeof value === "string"
        )
      : [],
    issues: Array.isArray(verification?.issues)
      ? verification.issues.filter((value): value is string => typeof value === "string")
      : [],
    indexedProof: indexedProofFromCandidate(verification?.indexedProof ?? candidate.indexedProof),
  };
}

export function summarizeProposalOfficialEvidence(
  input: ProposalOfficialEvidenceInput
): ProposalOfficialEvidenceSummary {
  const required = evidenceRequired(input);
  const candidate = candidateFromMetadata(input.metadata);
  const stored = candidate ? verificationFromCandidate(candidate) : null;
  const expectation = candidate ? expectationFromInput(input, candidate) : null;
  let acceptable = stored ? isAcceptableOfficialDecisionVerification(stored) : false;
  let issues = stored?.issues ?? [];
  const requestedUrl = required
    ? (asNonEmptyString(candidate?.canonicalUrl) ??
      asNonEmptyString(candidate?.url) ??
      asNonEmptyString(input.sourceUrl))
    : null;
  const allowedLink = requestedUrl ? allowedOfficialUrl(requestedUrl) : null;

  if (allowedLink && !allowedLink.ok) {
    issues = [...new Set([...issues, `url_administration_non_cliquable:${allowedLink.issue}`])];
  }

  if (stored?.status === "INDEX_VERIFIED" && expectation) {
    const allowed = allowedOfficialUrl(expectation.url);
    if (!allowed.ok) {
      acceptable = false;
      issues = [...issues, allowed.issue];
    } else {
      const indexed = validateIndexedProof(expectation, allowed.value);
      if (indexed.issues.length > 0) {
        acceptable = false;
        issues = [...new Set([...issues, ...indexed.issues])];
      }
    }
  }

  return {
    required,
    acceptable,
    canonicalUrl: allowedLink?.ok ? allowedLink.value.url.toString() : null,
    requestedUrl,
    status: stored?.status ?? null,
    checkedAt: asNonEmptyString(stored?.checkedAt),
    matchedIdentifiers: stored?.matchedIdentifiers ?? [],
    issues,
  };
}
