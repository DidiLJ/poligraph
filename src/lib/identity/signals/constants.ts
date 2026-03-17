/**
 * Shared logLR constants used by signal evaluators and the LegacyCombiner.
 * Changing a value here changes it everywhere — no silent mismatch.
 */

// FirstNameSignal logLR values
export const FIRST_NAME_EXACT_LLR = 3.0;
export const FIRST_NAME_PARTIAL_LLR = 1.0;
export const FIRST_NAME_MISMATCH_LLR = -5.0;

// BirthdateSignal logLR values
export const BIRTHDATE_MATCH_LLR = 14.8;
export const BIRTHDATE_MISMATCH_LLR = -8.0;

// DepartmentSignal logLR values
export const DEPARTMENT_MATCH_LLR = 3.5;
export const DEPARTMENT_MISMATCH_LLR = -1.5;

// GenderSignal logLR values
export const GENDER_MATCH_LLR = 0.7;
export const GENDER_MISMATCH_LLR = -6.0;

// NameFrequencySignal
export const NAME_FREQ_LOG_LR_CAP = 20.0;
export const NAME_FREQ_FUZZY_THRESHOLD = 0.92; // Jaro-Winkler minimum for fuzzy match
export const NAME_FREQ_FUZZY_DISCOUNT = 0.8;

// TemporalSignal logLR values
export const TEMPORAL_ACTIVE_LLR = 2.5;
export const TEMPORAL_RECENT_LLR = 0.5;
export const TEMPORAL_NEUTRAL_LLR = 0;
export const TEMPORAL_OLD_LLR = -0.5;
/** Gap threshold: 2 years in ms */
export const TEMPORAL_RECENT_GAP_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;
/** Gap threshold: 10 years in ms */
export const TEMPORAL_OLD_GAP_MS = 10 * 365.25 * 24 * 60 * 60 * 1000;

// PartyContextSignal logLR values
export const PARTY_CURRENT_LLR = 2.0;
export const PARTY_FORMER_LLR = 0.5;
export const PARTY_NO_LINK_LLR = -0.5;
