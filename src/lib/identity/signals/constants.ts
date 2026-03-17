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
