/* =============================================================================
   CHARTS · Pure-SVG line and bar chart builders
   ---------------------------------------------------------------------------
   No external dependencies. Builds SVG markup strings that can be injected
   straight into the DOM. Hover/tooltip state is captured in __chartState
   for chart-tooltip.js to look up on mousemove.
   ============================================================================= */

import { state } from './state.js';
import { CHART_WINDOW_DAYS, MAIN_COLORS, REDLINE_COLORS, LINE_CHART_SIZE, BAR_CHART_SIZE } from './config.js';
import { redlineFor } from './cycle-math.js';
import { cycleFromCOD, daysAgoISO } from './dates.js';
import { escapeHtml } from './utils.js';

/* Shared hover state, consumed by chart-tooltip.js */
export const __chartState = {};

/* ---------- Public: render all three charts ---------- */
export function renderAllCharts() {
  renderChartUC();
  renderChartCycle();
  renderChartSOH();
  renderChartCyclePerSite();
}

/* ---------- Data collectors ---------- */

/**
 * Gather per-day UC / redline history for a single plant, within the
 * CHART_WINDOW_DAYS window ending at state.currentDate.
 */
export function gatherHistorySeries(plantId) {
  const cutoff = daysAgoISO(state.currentDate, CHART_WINDOW_DAYS - 1);
  const dates = new Set(Object.keys(state.store.reports));
  dates.add(state.currentDate);
  const arr = [];
  [...dates].sort().forEach((date) => {
    if (date > state.currentDate) return;
    if (date < cutoff) return;
    const rep = date === state.currentDate ? state.currentReport : state.store.reports[date];
    if (!rep) return;
    const s = (rep.sites || []).find((x) => x.id === plantId);
    if (!s) return;
    const cfg = state.store.sitesConfig.find((c) => c.id === plantId);
    if (!cfg) return;
    const cyc = (s.cycleCount !== '' && s.cycleCount != null)
      ? Number(s.cycleCount) : cycleFromCOD(cfg.cod, date);
    const rl = redlineFor(cfg, cyc);
    const uc = parseFloat(s.usableCapacity);
    arr.push({
      date,
      cycle: cyc,
      uc: isNaN(uc) ? null : uc,
      redline: rl ? rl.mwh : null,
    });
  });
  return arr;
}

/* ---------- Chart: UC vs ESA ---------- */
export function renderChartUC() {
  const host = document.getElementById('pvChartUC');
  if (!host) return;
  const mains = state.store.sitesConfig.filter((s) => s.tier === 'main');
  if (!mains.length) {
    host.innerHTML = '<div class="chart-empty">No main plants configured.</div>';
    return;
  }
  const series = mains.map((cfg) => ({
    id: cfg.id, cap: cfg.capacityMWh, data: gatherHistorySeries(cfg.id),
  }));
  const allPoints = series
    .flatMap((s) => s.data.filter((p) => p.uc != null).map((p) => ({ x: p.date, y: p.uc })))
    .concat(series.flatMap((s) => s.data.filter((p) => p.redline != null).map((p) => ({ x: p.date, y: p.redline }))));
  if (!allPoints.length) {
    host.innerHTML = '<div class="chart-empty">No measured UC history yet.<br><span style="font-size:14px">Save daily entries to build history.</span></div>';
    return;
  }

  const chartSeries = series.flatMap((s) => {
    const color = REDLINE_COLORS[s.id] || '#333';
    const ucLine = {
      color, dashed: false, label: s.id + ' UC',
      points: s.data.filter((p) => p.uc != null).map((p) => ({ x: p.date, y: p.uc })),
    };
    const rlLine = {
      color, dashed: true, label: s.id + ' ESA',
      points: s.data.filter((p) => p.redline != null).map((p) => ({ x: p.date, y: p.redline })),
    };
    return [rlLine, ucLine];
  });

  const highlightBelow = series.flatMap((s) =>
    s.data
      .filter((p) => p.uc != null && p.redline != null && p.uc < p.redline)
      .map((p) => ({ x: p.date, y: p.uc }))
  );

  host.innerHTML = buildChartSVG({
    ...LINE_CHART_SIZE,
    stateKey: 'pvChartUC',
    series: chartSeries,
    highlightBelow,
    yLabel: 'MWh',
  });
}

/* ---------- Chart: Daily Cycle Count ---------- */
export function renderChartCycle() {
  const host = document.getElementById('pvChartCycle');
  if (!host) return;
  const mains = state.store.sitesConfig.filter((s) => s.tier === 'main');
  if (!mains.length) {
    host.innerHTML = '<div class="chart-empty">No main plants configured.</div>';
    return;
  }
  const cutoff = daysAgoISO(state.currentDate, CHART_WINDOW_DAYS - 1);
  const allDates = new Set();
  Object.keys(state.store.reports).forEach((d) => {
    if (d <= state.currentDate && d >= cutoff) allDates.add(d);
  });
  allDates.add(state.currentDate);
  const sorted = [...allDates].sort();

  const series = mains.map((cfg) => {
    const color = MAIN_COLORS[cfg.id] || '#333';
    const points = [];
    sorted.forEach((date) => {
      const rep = date === state.currentDate ? state.currentReport : state.store.reports[date];
      if (!rep) return;
      const s = (rep.sites || []).find((x) => x.id === cfg.id);
      if (!s) return;
      const cyc = (s.todayCycle !== '' && s.todayCycle != null)
        ? Number(s.todayCycle) : null;
      if (cyc != null && !isNaN(cyc)) points.push({ x: date, y: cyc });
    });
    return { color, dashed: false, label: cfg.id, points };
  });

  // Horizontal reference line at 0.5 cycle
  const redlineSeries = {
    color: '#E53935', dashed: true, label: '0.5 Cycle',
    points: sorted.length
      ? [{ x: sorted[0], y: 0.5 }, { x: sorted[sorted.length - 1], y: 0.5 }]
      : [],
  };

  const totalPoints = series.reduce((a, s) => a + s.points.length, 0);
  if (!totalPoints) {
    host.innerHTML = '<div class="chart-empty">No cycle history yet.</div>';
    return;
  }
  host.innerHTML = buildChartSVG({
    ...LINE_CHART_SIZE,
    stateKey: 'pvChartCycle',
    series: [redlineSeries, ...series],
    yLabel: 'Cycle',
  });
}

/* ---------- Chart: SOH Comparison ---------- */
export function renderChartSOH() {
  const host = document.getElementById('pvChartSOH');
  if (!host) return;
  const mains = state.store.sitesConfig.filter((s) => s.tier === 'main');
  if (!mains.length) {
    host.innerHTML = '<div class="chart-empty">No main plants configured.</div>';
    return;
  }

  const cutoff = daysAgoISO(state.currentDate, CHART_WINDOW_DAYS - 1);
  const allDates = new Set();
  Object.keys(state.store.reports).forEach((d) => {
    if (d <= state.currentDate && d >= cutoff) allDates.add(d);
  });
  allDates.add(state.currentDate);
  const sorted = [...allDates].sort();

  const series = mains.map((cfg) => {
    const color = MAIN_COLORS[cfg.id] || '#333';
    const points = [];
    sorted.forEach((date) => {
      const rep = date === state.currentDate ? state.currentReport : state.store.reports[date];
      if (!rep) return;
      const s = (rep.sites || []).find((x) => x.id === cfg.id);
      if (!s) return;
      const soh = (s.soh !== '' && s.soh != null) ? Number(s.soh) : null;
      if (soh != null && !isNaN(soh)) points.push({ x: date, y: soh });
    });
    return { color, dashed: false, label: cfg.id, points };
  });

  const totalPoints = series.reduce((a, s) => a + s.points.length, 0);
  if (!totalPoints) {
    host.innerHTML = '<div class="chart-empty">No SOH history yet.</div>';
    return;
  }

  host.innerHTML = buildChartSVG({
    ...LINE_CHART_SIZE,
    stateKey: 'pvChartSOH',
    series,
    yLabel: 'SOH %',
  });
}

/* ---------- Chart: Number of Cycle vs Project Site (bar chart) ---------- */
/**
 * Grouped bar chart — 3 bars per sub-plant showing daily cycle count
 * for each of the last 3 days (day-2, day-1, today).
 *
 * Total cumulative cycle count and the daily increment are shown above
 * each bar to give context alongside the day-by-day view.
 */
export function renderChartCyclePerSite() {
  const host = document.getElementById('pvChartCyclePerSite');
  if (!host) return;
  const subs = state.store.sitesConfig.filter((s) => s.tier === 'sub');
  if (!subs.length) {
    host.innerHTML = '<div class="chart-empty">No sub plants configured.</div>';
    return;
  }

  // Three target dates: 2 days ago → yesterday → today
  const dateOffsets = [2, 1, 0];
  const dates = dateOffsets.map((n) => daysAgoISO(state.currentDate, n));

  const shortLabel = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groups = subs.map((cfg) => {
    const values = dates.map((date) => {
      const rep = (date === state.currentDate)
        ? state.currentReport
        : state.store.reports[date];
      if (!rep || !rep.sites) return { total: 0, daily: 0 };
      const s = rep.sites.find((x) => x.id === cfg.id);
      if (!s) return { total: 0, daily: 0 };
      const tc = s.todayCycle;
      const cc = s.cycleCount;
      const dailyVal = (tc === '' || tc == null || isNaN(Number(tc))) ? 0 : Number(tc);
      const totalVal = (cc === '' || cc == null || isNaN(Number(cc))) ? 0 : Number(cc);
      return { total: totalVal, daily: dailyVal };
    });

    return {
      label: `${cfg.name}\n(${cfg.capacityMWh}MWh)`,
      values,
    };
  });

  const hasData = groups.some((g) => g.values.some((v) => v.total > 0 || v.daily > 0));
  if (!hasData) {
    host.innerHTML = '<div class="chart-empty">No cycle data for the last 3 days.<br><span style="font-size:14px">Enter cycle values in Edit view.</span></div>';
    return;
  }

  host.innerHTML = buildGroupedBarChartSVG({
    ...BAR_CHART_SIZE,
    groups,
    seriesLabels: dates.map(shortLabel),
    seriesDates: dates,
    // Lightest = oldest day, darkest = most recent (today)
    colors: ['#90CAF9', '#42A5F5', '#1E88E5'],
    yLabel: 'Total Cycle',
  });
}

/* ---------- Chart: Cycle per main plant (stacked bar chart) ---------- */
/**
 * Total cycle per main plant shown as stacked bars.
 *
 * For each main plant, renders 1 stacked bar showing the total cycle count,
 * segmented by the 3 days: 2 days ago, yesterday, today.
 */
export function renderChartCyclePerMainPlant() {
  const host = document.getElementById('pvChartCyclePerMainPlant');
  if (!host) return;
  const mains = state.store.sitesConfig.filter((s) => s.tier === 'main');
  if (!mains.length) {
    host.innerHTML = '<div class="chart-empty">No main plants configured.</div>';
    return;
  }

  // Three target dates, oldest → newest (last 3 days including today)
  const dateOffsets = [2, 1, 0];
  const dates = dateOffsets.map((n) => daysAgoISO(state.currentDate, n));

  // Nice short labels like "Apr 22" for the legend
  const shortLabel = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const bars = mains.map((cfg) => {
    const segments = dates.map((date) => {
      const rep = (date === state.currentDate)
        ? state.currentReport
        : state.store.reports[date];
      if (!rep || !rep.sites) return 0;
      const s = rep.sites.find((x) => x.id === cfg.id);
      if (!s) return 0;
      const cc = s.cycleCount;
      if (cc === '' || cc == null || isNaN(Number(cc))) return 0;
      return Number(cc);
    });

    return {
      label: `${cfg.name}`,
      segments,
    };
  });

  host.innerHTML = buildStackedBarChartSVG({
    ...BAR_CHART_SIZE,
    bars,
    seriesLabels: dates.map(shortLabel),
    // Three shades — lightest = oldest, darkest = most recent
    colors: ['#90CAF9', '#42A5F5', '#1E88E5'],
    yLabel: 'Total Cycle',
  });
}

/* ---------- SVG stacked bar chart builder ---------- */
/**
 * Render a stacked bar chart. Each bar represents one category and is divided
 * into segments for different series (e.g., days).
 *
 * @param {object}   opts
 * @param {number}   opts.width
 * @param {number}   opts.height
 * @param {Array<{label:string, segments:number[]}>} opts.bars
 * @param {string[]} opts.seriesLabels  - one label per segment in the bar
 * @param {string[]} opts.colors        - one color per series
 * @param {string}   [opts.yLabel]
 */
export function buildStackedBarChartSVG({
  width, height, bars, seriesLabels, colors, yLabel = '',
}) {
  const pad = { top: 52, right: 20, bottom: 74, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  if (!bars.length) return '<div class="chart-empty">No data.</div>';

  // Calculate totals and max
  const totals = bars.map((b) => b.segments.reduce((a, v) => a + v, 0));
  const maxVal = Math.max(...totals, 1);
  let yMax;
  if (maxVal <= 1)        yMax = 1;
  else if (maxVal <= 5)   yMax = Math.ceil(maxVal);
  else if (maxVal <= 50)  yMax = Math.ceil(maxVal / 5) * 5;
  else if (maxVal <= 500) yMax = Math.ceil(maxVal / 50) * 50;
  else                    yMax = Math.ceil(maxVal / 100) * 100;

  // Grid lines and Y labels
  const gridCount = 6;
  let gridLines = '', yLabels = '';
  for (let i = 0; i <= gridCount; i++) {
    const v = (yMax * i) / gridCount;
    const y = pad.top + innerH - (v / yMax) * innerH;
    gridLines += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#E0E0E0" stroke-width="1"/>`;
    yLabels += `<text x="${pad.left - 6}" y="${y + 3}" font-size="20" text-anchor="end" fill="#757575">${Math.round(v)}</text>`;
  }

  // Stacked bars
  const barSlot = innerW / bars.length;
  const barW = barSlot * 0.6;
  const barGap = barSlot * 0.2;

  const barsSvg = bars.map((b, idx) => {
    const x = pad.left + idx * barSlot + barGap;
    let html = '';
    let yPos = pad.top + innerH; // Start from bottom

    b.segments.forEach((val, segIdx) => {
      if (val > 0) {
        const h = (val / yMax) * innerH;
        const segY = yPos - h;
        const color = colors[segIdx] || '#999';
        const info = `${b.label} - ${seriesLabels[segIdx]}: ${val.toFixed(val % 1 === 0 ? 0 : 2)}`;
        html += `<rect x="${x}" y="${segY}" width="${barW}" height="${h}" fill="${color}" rx="2" data-info="${escapeHtml(info)}"/>`;
        
        // Value label on segment (if tall enough)
        if (h >= 18) {
          html += `<text x="${x + barW / 2}" y="${segY + h / 2 + 3}" font-size="14" text-anchor="middle" fill="#FFF" font-weight="700">${val.toFixed(val % 1 === 0 ? 0 : 1)}</text>`;
        }
        
        yPos = segY;
      }
    });

    // Total label on top
    const total = b.segments.reduce((a, v) => a + v, 0);
    const totalY = pad.top + innerH - (total / yMax) * innerH;
    if (total > 0) {
      html += `<text x="${x + barW / 2}" y="${totalY - 8}" font-size="18" text-anchor="middle" fill="#1E293B" font-weight="700">+${total.toFixed(total % 1 === 0 ? 0 : 1)}</text>`;
    }

    // Category label under the bar
html += `<text x="${x + barW / 2}" y="${pad.top + innerH + 18}" font-size="19" text-anchor="middle" fill="#424242" font-weight="600">${escapeHtml(b.label)}</text>`;

    return html;
  }).join('');

  // Legend
  const legendSvg = `
    <g font-size="18">
      ${seriesLabels.map((label, i) => `
        <rect x="${pad.left + i * 120}" y="12" width="12" height="12" fill="${colors[i]}" rx="1"/>
        <text x="${pad.left + i * 120 + 18}" y="21" fill="#424242">${escapeHtml(label)}</text>
      `).join('')}
    </g>
  `;

  // Axes + Y label
  const axes = `
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="#424242"/>
    <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="#424242"/>
    <text x="${pad.left - 30}" y="${pad.top + innerH / 2}" font-size="20" fill="#757575" text-anchor="middle" transform="rotate(-90,${pad.left - 30},${pad.top + innerH / 2})">${yLabel}</text>
  `;

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:100%;height:auto">
    ${legendSvg}
    ${gridLines}
    ${axes}
    ${yLabels}
    ${barsSvg}
  </svg>`;
}

/* ---------- SVG line chart builder ---------- */
export function buildChartSVG({ width, height, series, highlightBelow = [], yLabel = '', stateKey = '' }) {
  const pad = { top: 12, right: 14, bottom: 42, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  // Collect x values (dates) and compute time range
  const allX = new Set();
  series.forEach((s) => s.points.forEach((p) => allX.add(p.x)));
  const xs = [...allX].sort();
  if (!xs.length) return '<div class="chart-empty">No data.</div>';

  const xMin = new Date(xs[0] + 'T00:00:00').getTime();
  const xMax = new Date(xs[xs.length - 1] + 'T00:00:00').getTime();
  const xRange = Math.max(xMax - xMin, 86400000);

  const allY = series.flatMap((s) => s.points.map((p) => p.y))
    .filter((v) => v != null && !isNaN(v));
  if (!allY.length) return '<div class="chart-empty">No data.</div>';
  let yMin = Math.min(...allY);
  let yMax = Math.max(...allY);
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad;
  yMax += yPad;

  const scaleX = (iso) => {
    const t = new Date(iso + 'T00:00:00').getTime();
    return pad.left + ((t - xMin) / xRange) * innerW;
  };
  const scaleY = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  // Y gridlines and labels
  const gridCount = 4;
  let gridLines = '';
  let yLabels = '';
  for (let i = 0; i <= gridCount; i++) {
    const v = yMin + ((yMax - yMin) * i) / gridCount;
    const y = scaleY(v);
    gridLines += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#E0E0E0" stroke-width="1"/>`;
    yLabels += `<text x="${pad.left - 6}" y="${y + 3}" font-size="20" text-anchor="end" fill="#757575">${v.toFixed(yMax > 100 ? 0 : 1)}</text>`;
  }

  // X axis ticks (~7 evenly spaced)
  const xLabels = (() => {
    const n = xs.length;
    if (n <= 1) {
      return xs.map((d) =>
        `<text x="${scaleX(d)}" y="${height - pad.bottom + 18}" font-size="14" text-anchor="middle" fill="#757575">${d.slice(5)}</text>`
      ).join('');
    }
    const targetTicks = 7;
    const step = Math.max(1, Math.round((n - 1) / targetTicks));
    const pts = [];
    for (let i = 0; i < n; i += step) pts.push(xs[i]);
    if (pts[pts.length - 1] !== xs[n - 1]) {
      const lastIdx = xs.indexOf(pts[pts.length - 1]);
      if (n - 1 - lastIdx < Math.max(step / 2, 1)) pts.pop();
      pts.push(xs[n - 1]);
    }
    let labels = '', ticks = '';
    pts.forEach((d, i) => {
      const x = scaleX(d);
      const anchor = i === 0 ? 'start' : (i === pts.length - 1 ? 'end' : 'middle');
      ticks += `<line x1="${x}" y1="${height - pad.bottom}" x2="${x}" y2="${height - pad.bottom + 4}" stroke="#9ca3af" stroke-width="1"/>`;
      labels += `<text x="${x}" y="${height - pad.bottom + 18}" font-size="20" text-anchor="${anchor}" fill="#757575">${d.slice(5)}</text>`;
    });
    return ticks + labels;
  })();

  // Series lines + dots
  const paths = series.map((s) => {
    if (!s.points.length) return '';
    const pts = s.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`)
      .join(' ');
    const dash = s.dashed ? ' stroke-dasharray="8,4"' : '';
    const line = `<path d="${pts}" fill="none" stroke="${s.color}" stroke-width="4"${dash}/>`;
    const dots = s.dashed
      ? ''
      : s.points.map((p) =>
          `<circle cx="${scaleX(p.x).toFixed(1)}" cy="${scaleY(p.y).toFixed(1)}" r="5" fill="${s.color}"/>`
        ).join('');
    return line + dots;
  }).join('');

  // Red halos for below-redline points
  const halo = highlightBelow.map((p) =>
    `<circle cx="${scaleX(p.x).toFixed(1)}" cy="${scaleY(p.y).toFixed(1)}" r="6" fill="none" stroke="#E53935" stroke-width="2"/>`
  ).join('');

  // Register hover state
  if (stateKey) {
    const dateMap = {};
    series.forEach((s) => {
      if (s.dashed) return;
      s.points.forEach((p) => {
        if (!dateMap[p.x]) dateMap[p.x] = [];
        dateMap[p.x].push({ label: s.label, color: s.color, value: Number(p.y) });
      });
    });
    // Dashed (redline) values after solids
    series.forEach((s) => {
      if (!s.dashed) return;
      s.points.forEach((p) => {
        if (!dateMap[p.x]) dateMap[p.x] = [];
        dateMap[p.x].push({ label: s.label, color: s.color, value: Number(p.y), dashed: true });
      });
    });
    __chartState[stateKey] = {
      dateMap, xs: [...xs], xMin, xRange, pad, innerW, innerH, yLabel,
    };
  }

  const overlay = stateKey
    ? `<rect x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" fill="transparent" data-chart-key="${escapeHtml(stateKey)}" style="pointer-events:all;cursor:crosshair"/>`
    : '';

  const axes = `
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#424242" stroke-width="1"/>
    <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#424242" stroke-width="1"/>
    <text x="${pad.left - 32}" y="${pad.top + innerH / 2}" font-size="20" fill="#757575" text-anchor="middle" transform="rotate(-90,${pad.left - 32},${pad.top + innerH / 2})">${yLabel}</text>
  `;

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:100%;height:auto">
    ${gridLines}${axes}${yLabels}${xLabels}${paths}${halo}${overlay}
  </svg>`;
}

/* ---------- SVG bar chart builder ---------- */
export function buildBarChartSVG({ width, height, bars, color = '#1E88E5' }) {
  const pad = { top: 40, right: 20, bottom: 56, left: 46 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  if (!bars.length) return '<div class="chart-empty">No data.</div>';

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  // Nice ceiling: nearest 100 above max, min 100
  let yMax;
  if (maxVal <= 100)       yMax = Math.ceil(maxVal / 10) * 10 || 10;
  else if (maxVal <= 500)  yMax = Math.ceil(maxVal / 50) * 50;
  else if (maxVal <= 2000) yMax = Math.ceil(maxVal / 100) * 100;
  else                     yMax = Math.ceil(maxVal / 500) * 500;

  const slotW = innerW / bars.length;
  const barW  = slotW * 0.55;
  const barGap = (slotW - barW) / 2;
  const scaleY = (v) => pad.top + innerH - (v / yMax) * innerH;

  const gridCount = 6;
  let gridLines = '', yLabels = '';
  for (let i = 0; i <= gridCount; i++) {
    const v = (yMax * i) / gridCount;
    const y = scaleY(v);
    gridLines += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#E0E0E0" stroke-width="1"/>`;
    const lv = yMax >= 100 ? Math.round(v) : v.toFixed(1);
    yLabels += `<text x="${pad.left - 6}" y="${y + 3}" font-size="20" text-anchor="end" fill="#757575">${lv}</text>`;
  }

  const barsSvg = bars.map((b, i) => {
    const cx = pad.left + i * slotW + barGap + barW / 2;
    const x  = cx - barW / 2;
    const y  = scaleY(b.value);
    const h  = pad.top + innerH - y;

    // Total value label directly above bar
    const totalLbl = `<text x="${cx}" y="${y - 6}" font-size="19" text-anchor="middle" fill="#1E293B" font-weight="700">${b.value.toFixed(b.value % 1 === 0 ? 0 : 1)}</text>`;
    // Daily delta in red, above total
    const deltaLbl = (b.extra != null)
      ? `<text x="${cx}" y="${y - 19}" font-size="19" text-anchor="middle" fill="#E53935" font-weight="700">+${Number(b.extra).toFixed(b.extra % 1 === 0 ? 0 : 2)}</text>`
      : '';

    const info = `${b.label.replace('\n', ' ')} · Total: ${b.value.toFixed(b.value % 1 === 0 ? 0 : 2)}` +
                 (b.extra != null ? ` · Today: +${Number(b.extra).toFixed(b.extra % 1 === 0 ? 0 : 2)}` : '');
    const rect = `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="2" data-info="${escapeHtml(info)}"/>`;

    // Two-line x-axis label (split on \n)
    const parts = b.label.split('\n');
    const xLbl1 = `<text x="${cx}" y="${pad.top + innerH + 16}" font-size="14" text-anchor="middle" fill="#424242" font-weight="600">${escapeHtml(parts[0] || '')}</text>`;
    const xLbl2 = parts[1]
      ? `<text x="${cx}" y="${pad.top + innerH + 28}" font-size="13" text-anchor="middle" fill="#757575">${escapeHtml(parts[1])}</text>`
      : '';

    return rect + totalLbl + deltaLbl + xLbl1 + xLbl2;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:100%;height:auto">
    ${gridLines}
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="#424242"/>
    <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="#424242"/>
    <text x="${pad.left - 36}" y="${pad.top + innerH / 2}" font-size="20" fill="#757575" text-anchor="middle" transform="rotate(-90,${pad.left - 36},${pad.top + innerH / 2})">Cycle</text>
    ${yLabels}
    ${barsSvg}
  </svg>`;
}

/* ---------- SVG grouped bar chart builder ---------- */
/**
 * Render a grouped bar chart. Each "group" is one category (e.g. a sub plant)
 * containing N bars, one per series (e.g. a past date).
 *
 * @param {object}   opts
 * @param {number}   opts.width
 * @param {number}   opts.height
 * @param {Array<{label:string, values:number[]}>} opts.groups
 * @param {string[]} opts.seriesLabels  - one label per bar within a group (legend)
 * @param {string[]} [opts.seriesDates] - optional ISO dates per series (for tooltips)
 * @param {string[]} opts.colors        - one color per series (length = seriesLabels.length)
 * @param {string}   [opts.yLabel]
 */
export function buildGroupedBarChartSVG({
  width, height, groups, seriesLabels,
  seriesDates = [], colors, yLabel = '',
}) {
  const pad = { top: 70, right: 30, bottom: 104, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  if (!groups.length) return '<div class="chart-empty">No data.</div>';

  const seriesCount = seriesLabels.length;
  const allValues = groups.flatMap((g) => g.values.map((v) => {
    // Extract total value for chart scaling when provided as object
    return typeof v === 'object' && v !== null ? v.total : v;
  }));
  const maxVal = Math.max(...allValues, 1);
  // Round up to a reasonable ceiling for nice tick marks
  let yMax;
  if (maxVal <= 1)        yMax = 1;
  else if (maxVal <= 5)   yMax = Math.ceil(maxVal);
  else if (maxVal <= 10)  yMax = Math.ceil(maxVal / 1) * 1;
  else if (maxVal <= 50)  yMax = Math.ceil(maxVal / 5) * 5;
  else if (maxVal <= 100) yMax = Math.ceil(maxVal / 10) * 10;
  else if (maxVal <= 500) yMax = Math.ceil(maxVal / 50) * 50;
  else                    yMax = Math.ceil(maxVal / 100) * 100;

  // Slot per group: each group gets a fixed slot width; inside it the N bars
  // sit side by side with a tiny inner gap; between groups we keep a bigger gap
  const groupSlot = innerW / groups.length;
  const groupInnerPad = groupSlot * 0.12;         // left+right padding inside group
  const availableForBars = groupSlot - groupInnerPad * 2;
  const innerBarGap = 3;                           // px between bars inside a group
  const barW = Math.max(
    4,
    (availableForBars - innerBarGap * (seriesCount - 1)) / seriesCount
  );

  const scaleY = (v) => pad.top + innerH - (v / yMax) * innerH;

  // Y gridlines
  const gridCount = 6;
  let gridLines = '', yLabels = '';
  for (let i = 0; i <= gridCount; i++) {
    const v = (yMax * i) / gridCount;
    const y = scaleY(v);
    gridLines += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#E0E0E0" stroke-width="1"/>`;
    const labelVal = yMax <= 5 ? v.toFixed(1) : Math.round(v);
    yLabels += `<text x="${pad.left - 8}" y="${y + 5}" font-size="14" text-anchor="end" fill="#757575">${labelVal}</text>`;
  }

  // Legend at the top
  const legendGap = 18;
  let legendX = pad.left;
  const legendY = pad.top - 30;
  let legendSvg = '';
  seriesLabels.forEach((lbl, i) => {
    const sw = 14, swH = 12;
    legendSvg += `<rect x="${legendX}" y="${legendY}" width="${sw}" height="${swH}" fill="${colors[i]}" rx="2"/>`;
    legendSvg += `<text x="${legendX + sw + 6}" y="${legendY + swH - 1}" font-size="14" fill="#424242" font-weight="700">${escapeHtml(lbl)}</text>`;
    // Approx width estimate for spacing
    legendX += sw + 6 + lbl.length * 7.5 + legendGap;
  });

  // Bars
  const barsSvg = groups.map((g, gi) => {
    const slotStart = pad.left + gi * groupSlot + groupInnerPad;
    const centerX = pad.left + gi * groupSlot + groupSlot / 2;

    let html = '';
    g.values.forEach((v, si) => {
      // Handle both simple numbers and object { total, daily }
      const isObj = typeof v === 'object' && v !== null;
      const dailyVal = isObj ? v.daily : v;
      const totalVal = isObj ? v.total : v;
      
        const x = slotStart + si * (barW + innerBarGap);
      const barValue = isObj ? totalVal : v;
      const y = scaleY(barValue);
      const h = pad.top + innerH - y;
      const color = colors[si] || '#1E88E5';
      const dateStr = seriesDates[si] || seriesLabels[si];
      const info = `${g.label} · ${seriesLabels[si]}${dateStr !== seriesLabels[si] ? ' (' + dateStr + ')' : ''} · Total: ${totalVal.toFixed(totalVal % 1 === 0 ? 0 : 2)}, Daily: +${dailyVal.toFixed(dailyVal % 1 === 0 ? 0 : 2)}`;

      // Bar rectangle — draw zero-height bars as a thin stub so hover still works
      const drawH = h < 1 ? 1 : h;
      const drawY = h < 1 ? y - 1 : y;
      html += `<rect x="${x}" y="${drawY}" width="${barW}" height="${drawH}" fill="${color}" rx="2" data-info="${escapeHtml(info)}"/>`;

      // Value labels (total and daily with +)
      if (barW >= 18) {
        html += `<text x="${x + barW / 2}" y="${y - 10}" font-size="12" text-anchor="middle" fill="#1E293B" font-weight="700">${totalVal.toFixed(totalVal % 1 === 0 ? 0 : 1)}</text>`;
        const dailyText = dailyVal > 0 ? `<text x="${x + barW / 2}" y="${y - 1}" font-size="12" text-anchor="middle" fill="#E53935" font-weight="700">+${dailyVal.toFixed(dailyVal % 1 === 0 ? 0 : 2)}</text>` : '';
        html += dailyText;
      }
    });

    // Category label under the group — supports two-line labels (split on \n)
    const parts = g.label.split('\n');
    html += `<text x="${centerX}" y="${pad.top + innerH + 18}" font-size="14" text-anchor="middle" fill="#424242" font-weight="700">${escapeHtml(parts[0] || '')}</text>`;
    if (parts[1]) {
      html += `<text x="${centerX}" y="${pad.top + innerH + 32}" font-size="12" text-anchor="middle" fill="#757575">${escapeHtml(parts[1])}</text>`;
    }
    return html;
  }).join('');

  // Axes + Y label
  const axes = `
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="#424242"/>
    <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="#424242"/>
    <text x="${pad.left - 34}" y="${pad.top + innerH / 2}" font-size="14" fill="#757575" text-anchor="middle" transform="rotate(-90,${pad.left - 34},${pad.top + innerH / 2})">${yLabel}</text>
  `;

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:100%;height:auto">
    ${legendSvg}
    ${gridLines}
    ${axes}
    ${yLabels}
    ${barsSvg}
  </svg>`;
}
