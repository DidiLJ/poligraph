/**
 * Press attribution guard (issue #376).
 *
 * The deterministic affair-matching resolver answers "does the text mention this
 * person?" — not "is this person a party to the procedure?". A minister who
 * reacts to an affair, the mayor of the commune where the facts happened, or a
 * homonym sharing the surname can all clear the resolver's SAME threshold on a
 * full-name match alone. This guard runs at creation time, before any DB write,
 * and BLOCKS those attachments. It never creates an attachment.
 *
 * It is intentionally conservative: when the evidence that the politician is a
 * party to the affair is weak or ambiguous, the affair is not attached.
 */

export type AttributionVerdict =
  | "ATTACH"
  | "NAME_ABSENT"
  | "HOMONYM_OR_SURNAME_ONLY"
  | "REACTION_ONLY";

/**
 * Involvement levels the guard understands. Only DIRECT/INDIRECT claim the
 * politician is the perpetrator, so only those get the reaction-only block.
 */
export type GuardInvolvement = "DIRECT" | "INDIRECT" | "VICTIM" | "PLAINTIFF" | "MENTIONED_ONLY";

export interface AttributionGuardInput {
  /** Full text of the article analysed by the press pipeline. */
  text: string;
  /** Resolved politician's first name, or null when unknown. */
  firstName: string | null;
  /** Resolved politician's last name. */
  lastName: string;
  /** Detected involvement; decides whether the reaction-only block applies. */
  involvement: GuardInvolvement;
}

export interface AttributionGuardResult {
  verdict: AttributionVerdict;
  attach: boolean;
  reason: string;
}

/** Window (in characters) scanned on each side of a surname occurrence. */
const CONTEXT_WINDOW = 160;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Patterns showing the named person is a party to the procedure (defendant,
 * suspect, convicted). "condamné" is matched only in sentence forms
 * ("a été condamné", "condamné à/pour") so a speech act ("a condamné ces
 * faits") is NOT counted as a conviction.
 */
const MISE_EN_CAUSE_PATTERNS: RegExp[] = [
  /\bmise?s? en examen\b/,
  /\bmise?s? en cause\b/,
  /\bpoursuivi(?:e|s|es)?\b/,
  /\binculp(?:e|ee|es|ees)\b/,
  /\bprevenu(?:e|s|es)?\b/,
  /\bgarde a vue\b/,
  /\bgardee? a vue\b/,
  /\bplace(?:e|s|es)? en (?:garde a vue|detention)\b/,
  /\b(?:a ete|ete|est|sera|fut|avait ete) condamne(?:e|s|es)?\b/,
  /\bcondamne(?:e|s|es)? (?:a|pour|le|en|par)\b/,
  /\bjuge(?:e|s|es)? pour\b/,
  /\brenvoye(?:e|s|es)? (?:devant|en correctionnelle)\b/,
  /\bdefere(?:e|s|es)?\b/,
  /\becroue(?:e|s|es)?\b/,
  /\bcomparai?t\b/,
  /\bvise(?:e|s|es)? par (?:une enquete|des poursuites|une information judiciaire)\b/,
  /\bsoupconne(?:e|s|es)? d(?:e|')\b/,
  /\baccuse(?:e|s|es)? d(?:e|')\b/,
  /\binterpelle(?:e|s|es)?\b/,
  /\bmis en cause\b/,
  /\bmandat de depot\b/,
];

/**
 * Patterns showing the named person only reacts to or comments on the affair,
 * or is named purely through an institutional function.
 */
const REACTION_PATTERNS: RegExp[] = [
  /\ba reagi\b/,
  /\breagit\b/,
  /\ba declare\b/,
  /\bdeclare que\b/,
  /\ba denonce\b/,
  /\bdenonce\b/,
  /\ba condamne (?:ce|ces|cet|cette|les|l |la|le )/,
  /\ba estime\b/,
  /\ba regrette\b/,
  /\ba salue\b/,
  /\ba appele\b/,
  /\bappelle au\b/,
  /\ba exprime\b/,
  /\ba indique\b/,
  /\ba precise\b/,
  /\ba affirme\b/,
  /\ba reclame\b/,
  /\bs(?:'|e )est dit\b/,
  /\binterroge(?:e|s|es)? par\b/,
  /\ble maire de\b/,
  /\bla maire de\b/,
  /\b(?:le|la) ministre\b/,
  /\bau nom de la (?:commune|ville)\b/,
];

function matchesAny(haystack: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(haystack));
}

function result(
  verdict: AttributionVerdict,
  attach: boolean,
  reason: string
): AttributionGuardResult {
  return { verdict, attach, reason };
}

/**
 * Decide whether a press-detected affair may be attached to the resolved
 * politician. Pure function, no DB/AI access.
 */
export function assessPressAttribution(input: AttributionGuardInput): AttributionGuardResult {
  const text = normalize(input.text);
  const lastName = normalize(input.lastName);

  if (!lastName) {
    return result("NAME_ABSENT", false, "Resolved politician has no usable last name");
  }

  const surnameRe = new RegExp(`\\b${escapeRegExp(lastName)}\\b`, "g");
  const surnameMatches = [...text.matchAll(surnameRe)];
  if (surnameMatches.length === 0) {
    return result("NAME_ABSENT", false, `Last name "${input.lastName}" absent from the article`);
  }

  // Homonym / surname-only guard: when a first name is on record, the full name
  // (first + last, adjacent) must appear, otherwise we cannot tell this person
  // from a homonym or a surname-only mention.
  const firstName = input.firstName ? normalize(input.firstName) : "";
  if (firstName) {
    const firstTokens = firstName.split(" ").filter(Boolean).map(escapeRegExp);
    const fullNameRe = new RegExp(`\\b${firstTokens.join("\\s+")}\\s+${escapeRegExp(lastName)}\\b`);
    if (!fullNameRe.test(text)) {
      return result(
        "HOMONYM_OR_SURNAME_ONLY",
        false,
        `Full name "${input.firstName} ${input.lastName}" not found; only the surname appears (homonym risk)`
      );
    }
  }

  // Participation analysis on the windows around every surname occurrence.
  let hasMiseEnCause = false;
  let hasReaction = false;
  for (const match of surnameMatches) {
    const index = match.index ?? 0;
    const window = text.slice(
      Math.max(0, index - CONTEXT_WINDOW),
      index + lastName.length + CONTEXT_WINDOW
    );
    if (matchesAny(window, MISE_EN_CAUSE_PATTERNS)) hasMiseEnCause = true;
    if (matchesAny(window, REACTION_PATTERNS)) hasReaction = true;
  }

  if (hasMiseEnCause) {
    return result("ATTACH", true, "Mise en cause markers found near the politician's name");
  }

  // The reaction-only block only applies when the affair claims the politician
  // is the perpetrator. A VICTIM/PLAINTIFF is legitimately a party even when the
  // text frames them through their institutional function.
  const claimsPerpetrator = input.involvement === "DIRECT" || input.involvement === "INDIRECT";
  if (claimsPerpetrator && hasReaction) {
    return result(
      "REACTION_ONLY",
      false,
      "Politician appears only as a commenter / institutional function, not a party"
    );
  }

  return result("ATTACH", true, "Politician named with no commentary-only framing");
}
