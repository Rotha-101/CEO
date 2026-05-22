/* =============================================================================
   UTILS · Small helpers used everywhere
   ============================================================================= */

/**
 * Escape a string for safe insertion into HTML.
 * @param {*} s - any value (coerced to string)
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/**
 * Deep-clone a JSON-safe value (no functions, no circular refs).
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Debounce a function by N milliseconds.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms = 200) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Clamp a number between min and max.
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Safely parse a float. Returns null for empty / NaN.
 * @param {*} v
 * @returns {number|null}
 */
export function parseNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format a number to a fixed decimal count; falls back to "—" for null.
 * @param {number|null} n
 * @param {number} digits
 * @returns {string}
 */
export function fmt(n, digits = 2) {
  return n == null ? '—' : Number(n).toFixed(digits);
}
