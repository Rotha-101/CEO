/* =============================================================================
   DATES · ISO string arithmetic
   ---------------------------------------------------------------------------
   All dates are stored as "YYYY-MM-DD" strings to avoid timezone headaches.
   Input dates are parsed as local midnight.
   ============================================================================= */

/**
 * Return today's date as an ISO "YYYY-MM-DD" string (local time).
 * @returns {string}
 */
export function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/**
 * Return the ISO date N days before the given ISO date.
 * @param {string} iso - "YYYY-MM-DD"
 * @param {number} days - positive integer
 * @returns {string}
 */
export function daysAgoISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/**
 * Return a human weekday name for an ISO date (e.g. "Monday").
 * @param {string} iso
 * @returns {string}
 */
export function fmtWeekday(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Compute the battery cycle number for a given ISO date, treating COD
 * (Commercial Operation Date) as cycle 1.
 * @param {string} cod - ISO date of COD
 * @param {string} iso - ISO date to compute for
 * @returns {number|null}
 */
export function cycleFromCOD(cod, iso) {
  if (!cod || !iso) return null;
  const d1 = new Date(cod + 'T00:00:00');
  const d2 = new Date(iso + 'T00:00:00');
  const diffDays = Math.floor((d2 - d1) / 86400000);
  return diffDays + 1; // Cycle 1 = COD day
}
