/**
 * Turning what reception typed into a chain-wide patient lookup.
 *
 * Shared by the patient list and the patient picker so both interpret a search
 * term identically -- a divergence here would mean "search all clinics" behaved
 * differently depending on which screen you started from.
 */

const FULL_MOBILE = /^\d{10}$/;
const PATIENT_CODE = /^PT-?\d{1,6}$/i;

/** Shortest name fragment the API accepts for a chain-wide search. */
export const MIN_NAME_LOOKUP = 3;

/** "pt1" / "PT-1" / "000001" -> "PT-000001" */
export function normaliseCode(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return `PT-${digits.padStart(6, '0')}`;
}

/**
 * Query parameters for `GET /patients/lookup`, or null when the term is too
 * short to search on. Order matters: an exact mobile or Patient ID is a precise
 * match, so it is preferred over treating the digits as part of a name.
 */
export function lookupParamsFor(term) {
  const query = String(term ?? '').trim();
  if (!query) return null;

  const digits = query.replace(/\D/g, '');
  if (FULL_MOBILE.test(digits)) return { mobile: digits };
  if (PATIENT_CODE.test(query)) return { patient_code: normaliseCode(query) };
  if (query.length >= MIN_NAME_LOOKUP) return { name: query };
  return null;
}
