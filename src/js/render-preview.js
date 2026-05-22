/* =============================================================================
   RENDER-PREVIEW · Preview/report rendering
   ---------------------------------------------------------------------------
   Builds the read-only report view: header, plant summary cards,
   spare parts table, critical alerts, and all three charts.
   ============================================================================= */

import { state } from './state.js';
import { SPARE_PARTS_MIN_ROWS, MAIN_COLORS } from './config.js';
import { normalizeStatus, redlineFor } from './cycle-math.js';
import { cycleFromCOD, fmtWeekday, todayISO } from './dates.js';
import { escapeHtml } from './utils.js';
import { renderAllCharts } from './charts.js';
import { attachChartTooltips } from './chart-tooltip.js';
import { STATUS_LABELS } from './config.js';

/* ---------- Entry point ---------- */
export function renderPreview() {
  if (!state.currentReport) return;

  const reportDate = todayISO(); // header shows today
  document.getElementById('pvDate').textContent = reportDate;
  document.getElementById('pvWeekday').textContent = fmtWeekday(reportDate);

  const dataDateEl = document.getElementById('pvDataDate');
  if (dataDateEl) dataDateEl.textContent = 'Data for: ' + state.currentDate;

  document.getElementById('pvSummary').textContent = state.currentReport.summary || '—';
  document.getElementById('pvGenAt').textContent = 'Generated ' + new Date().toLocaleString();

  renderPlantSummary();
  renderAlerts();
  renderSpareParts();
  renderAllCharts();
  attachChartTooltips();
}

/* ---------- Plant summary cards (main plants) ---------- */
function renderPlantSummary() {
  const host = document.getElementById('pvPlantSummary');
  if (!host) return;

  const mains = state.store.sitesConfig.filter((s) => s.tier === 'main');
  host.innerHTML = mains.map((cfg) => {
    const data = state.currentReport.sites.find((s) => s.id === cfg.id) || {};
    const cycleFromDate = cycleFromCOD(cfg.cod, state.currentDate);
    const actualCycle = (data.cycleCount !== '' && data.cycleCount != null)
      ? Number(data.cycleCount) : null;
    const esaCycle = cycleFromDate;
    const cycle = actualCycle != null ? actualCycle : cycleFromDate;
    const rl = redlineFor(cfg, cycle);
    const uc = (data.usableCapacity !== '' && data.usableCapacity != null)
      ? Number(data.usableCapacity) : null;
    const margin = (uc != null && rl) ? (uc - rl.mwh) : null;
    const marginCls = margin == null ? '' : (margin >= 0 ? 'good' : 'danger');
    const color = MAIN_COLORS[cfg.id] || '#2E7D32';
    const panelCls = cfg.id === 'SNTL600' ? 'blue' : 'green';

    return `
      <div class="plant-summary ${panelCls}">
        <h3>
          <span class="dot" style="background:${color}"></span>
          <span class="plant-name">${escapeHtml(cfg.name)}</span>
          <span class="plant-meta">${escapeHtml(cfg.location || '—')} · ${cfg.capacityMWh} MWh</span>
          <span class="pill plant-status ${normalizeStatus(data.status)}">${STATUS_LABELS[normalizeStatus(data.status)]}</span>
        </h3>
        <div class="plant-kpis plant-kpis-3block">
          <div class="kpi-row-top">
            <div class="kpi kpi-split">
              <div class="split-row">
                <div class="split-col"><div class="sv">${uc != null ? uc.toFixed(2) : '—'}</div><div class="sl">Usable Cap</div></div>
                <div class="split-div"></div>
                <div class="split-col ${marginCls}"><div class="sv">${margin != null ? (margin >= 0 ? '+' : '') + margin.toFixed(2) : '—'}</div><div class="sl">Margin</div></div>
              </div>
              <div class="l">UC / Margin (MWh)</div>
            </div>
            <div class="kpi kpi-multi">
              <div class="multi-row">
                <div class="multi-col"><div class="sv">${actualCycle ?? '—'}</div><div class="sl">Actual</div></div>
                <div class="multi-div"></div>
                <div class="multi-col"><div class="sv">${esaCycle ?? '—'}</div><div class="sl">ESA</div></div>
              </div>
              <div class="l">Total Cycle</div>
            </div>
          </div>
          <div class="kpi-row-bottom">
            <div class="kpi"><div class="v">${data.systemAvailability !== '' && data.systemAvailability != null ? Number(data.systemAvailability).toFixed(2) + '%' : '—'}</div><div class="l">System Availability</div></div>
            <div class="kpi"><div class="v">${data.rte !== '' && data.rte != null ? Number(data.rte).toFixed(2) + '%' : '—'}</div><div class="l">RTE</div></div>
            <div class="kpi"><div class="v">${data.soh !== '' && data.soh != null ? Number(data.soh).toFixed(2) + '%' : '—'}</div><div class="l">SOH</div></div>
            <div class="kpi"><div class="v">${data.todayCycle !== '' && data.todayCycle != null ? Number(data.todayCycle).toFixed(3) : '—'}</div><div class="l">Today Cycle</div></div>
          </div>
        </div>
      </div>
    `;
  }).join('') || '<div class="chart-empty">No main plants configured.</div>';
}

/* ---------- Alerts ---------- */
function renderAlerts() {
  const alerts = (state.currentReport.alerts || []).filter((a) => a && a.trim());
  const host = document.getElementById('pvAlerts');
  if (!host) return;
  if (!alerts.length) {
    host.innerHTML = '<div class="no-alerts">✓ No critical alerts or high-risk events reported today.</div>';
  } else {
    host.innerHTML = alerts
      .map((a) => `<div class="alert-box"><strong>⚠</strong> ${escapeHtml(a)}</div>`)
      .join('');
  }
}

/* ---------- Spare parts table ---------- */
function renderSpareParts() {
  const body = document.getElementById('pvSparePartsBody');
  if (!body) return;
  const parts = (state.currentReport.spareParts || [])
    .filter((p) => (p.name && p.name.trim()) || (p.qty !== '' && p.qty != null));

  let html = '';
  parts.forEach((p) => {
    const plantCfg = state.store.sitesConfig.find((c) => c.id === p.plant);
    const plantLabel = plantCfg ? plantCfg.name : (p.plant || '—');
    html += `<tr class="filled"><td>${escapeHtml(plantLabel)}</td><td>${escapeHtml(p.name || '—')}</td><td>${escapeHtml(p.status || 'Pending')}</td><td class="qnt">${p.qty ?? '—'}</td></tr>`;
  });
  for (let i = parts.length; i < SPARE_PARTS_MIN_ROWS; i++) {
    html += '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td class="qnt">&nbsp;</td></tr>';
  }
  body.innerHTML = html;
}
