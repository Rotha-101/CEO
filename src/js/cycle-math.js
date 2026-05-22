/* =============================================================================
   CYCLE-MATH · ESA redline interpolation
   ---------------------------------------------------------------------------
   Calculates the contract-guaranteed usable capacity at a given cycle number
   by linearly interpolating between anchor points in the contract table.
   ============================================================================= */

/**
 * Linearly interpolate the contract value at a given cycle number.
 *
 * Anchors can be either:
 *   - MWh-based: { cycle, mwh }  (preferred, contract-table style)
 *   - pct-based: { cycle, pct }  (legacy format, still supported)
 *
 * @param {Array<{cycle:number, mwh?:number, pct?:number}>} anchors
 * @param {number} cycle
 * @returns {number|null}
 */
export function interpolateAnchors(anchors, cycle) {
  if (!anchors || !anchors.length) return null;
  const sorted = [...anchors].sort((a, b) => a.cycle - b.cycle);
  const getVal = (obj) => (obj.mwh != null ? obj.mwh : obj.pct);

  if (cycle <= sorted[0].cycle) return getVal(sorted[0]);
  if (cycle >= sorted[sorted.length - 1].cycle) {
    return getVal(sorted[sorted.length - 1]);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (cycle >= sorted[i].cycle && cycle <= sorted[i + 1].cycle) {
      const span = sorted[i + 1].cycle - sorted[i].cycle;
      const t = (cycle - sorted[i].cycle) / span;
      return getVal(sorted[i]) + t * (getVal(sorted[i + 1]) - getVal(sorted[i]));
    }
  }
  return getVal(sorted[sorted.length - 1]);
}

/**
 * Compute the ESA redline (percent and MWh) for a main plant at a given cycle.
 * Returns null for sub plants or when data is missing.
 *
 * @param {object} siteConfig - must include { tier, anchors, capacityMWh }
 * @param {number|string} cycleCount
 * @returns {{pct:number, mwh:number}|null}
 */
export function redlineFor(siteConfig, cycleCount) {
  if (!siteConfig || siteConfig.tier !== 'main') return null;
  if (cycleCount == null || cycleCount === '' || isNaN(cycleCount)) return null;
  if (!siteConfig.anchors || !siteConfig.anchors.length) return null;

  const firstAnchor = siteConfig.anchors[0];
  if (firstAnchor.mwh != null) {
    // New MWh-based anchors (contract table)
    const mwh = interpolateAnchors(siteConfig.anchors, Number(cycleCount));
    if (mwh == null) return null;
    const pct = siteConfig.capacityMWh
      ? (mwh / siteConfig.capacityMWh) * 100
      : 0;
    return { pct, mwh };
  } else {
    // Legacy pct-based anchors
    const pct = interpolateAnchors(siteConfig.anchors, Number(cycleCount));
    if (pct == null) return null;
    return { pct, mwh: (siteConfig.capacityMWh * pct) / 100 };
  }
}

/**
 * Normalize a status string to one of the known values.
 * @param {string} s
 * @returns {string}
 */
export function normalizeStatus(s) {
  const VALID = ['Healthy', 'Warning', 'HighAlert'];
  return VALID.indexOf(s) >= 0 ? s : 'Healthy';
}
