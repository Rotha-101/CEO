/* =============================================================================
   RENDER-EDIT · Edit-mode rendering
   ---------------------------------------------------------------------------
   Renders the editable forms for:
   - Summary textarea
   - Critical alerts list
   - Main plant rows (with live ESA/margin readout)
   - Sub plant rows
   - Spare parts input rows
   ============================================================================= */

import { state } from './state.js';
import { STATUS_OPTIONS, STATUS_LABELS } from './config.js';
import { normalizeStatus, redlineFor } from './cycle-math.js';
import { cycleFromCOD, daysAgoISO } from './dates.js';
import { escapeHtml } from './utils.js';
import { renderPreview } from './render-preview.js';

const SPARE_PART_STATUS_OPTIONS = ['Pending', 'In Progress', 'Done'];
const SPARE_PART_STATUS_LABELS = {
  Pending: 'Pending',
  'In Progress': 'In progress',
  Done: 'Done',
};

/* ---------- Entry point ---------- */
export function renderEdit() {
  document.getElementById('fieldSummary').value = state.currentReport.summary || '';
  renderAlertsEdit();
  renderSitesEdit();
  renderSparePartsEdit();
}

/* ---------- Alerts ---------- */
export function renderAlertsEdit() {
  const host = document.getElementById('alertsList');
  host.innerHTML = '';
  (state.currentReport.alerts || []).forEach((txt, i) => {
    const row = document.createElement('div');
    row.className = 'alert-row';
    row.innerHTML = `
      <input value="${escapeHtml(txt)}" placeholder="Alert or risk event...">
      <button class="btn btn-sm btn-danger">✕</button>
    `;
    row.querySelector('input').addEventListener('input', (e) => {
      state.currentReport.alerts[i] = e.target.value;
    });
    row.querySelector('button').addEventListener('click', () => {
      state.currentReport.alerts.splice(i, 1);
      renderAlertsEdit();
    });
    host.appendChild(row);
  });
}

export function addAlert() {
  state.currentReport.alerts = state.currentReport.alerts || [];
  state.currentReport.alerts.push('');
  renderAlertsEdit();
}

/* ---------- Spare parts (Edit) ---------- */
export function renderSparePartsEdit() {
  const host = document.getElementById('sparePartsEdit');
  if (!host) return;
  host.innerHTML = '';
  const plantOptions = state.store.sitesConfig
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join('');

  (state.currentReport.spareParts || []).forEach((part, i) => {
    const row = document.createElement('div');
    row.className = 'sp-input-row';
    row.innerHTML = `
      <select data-f="plant">
        <option value="">— Select plant —</option>
        ${plantOptions}
      </select>
      <input type="text" placeholder="Spare part name (e.g. Battery Module)"
             value="${escapeHtml(part.name || '')}" data-f="name">
      <select data-f="status">
        ${SPARE_PART_STATUS_OPTIONS.map((o) => `<option value="${o}" ${o === (part.status || 'Pending') ? 'selected' : ''}>${SPARE_PART_STATUS_LABELS[o]}</option>`).join('')}
      </select>
      <input type="number" min="0" step="1" class="qty-input" placeholder="Qty"
             value="${part.qty ?? ''}" data-f="qty">
      <button class="btn btn-sm btn-danger" title="Remove">✕</button>
    `;
    const plantSelect = row.querySelector('[data-f="plant"]');
    plantSelect.value = part.plant || '';
    plantSelect.addEventListener('change', (e) => {
      state.currentReport.spareParts[i].plant = e.target.value;
    });
    row.querySelector('[data-f="name"]').addEventListener('input', (e) => {
      state.currentReport.spareParts[i].name = e.target.value;
    });
    row.querySelector('[data-f="status"]').addEventListener('change', (e) => {
      state.currentReport.spareParts[i].status = e.target.value;
    });
    row.querySelector('[data-f="qty"]').addEventListener('input', (e) => {
      const v = e.target.value;
      state.currentReport.spareParts[i].qty =
        v === '' ? '' : parseInt(v, 10) || 0;
    });
    row.querySelector('button').addEventListener('click', () => {
      state.currentReport.spareParts.splice(i, 1);
      renderSparePartsEdit();
    });
    host.appendChild(row);
  });
}

export function addSparePart() {
  state.currentReport.spareParts = state.currentReport.spareParts || [];
  state.currentReport.spareParts.push({ plant: '', name: '', status: 'Pending', qty: '' });
  renderSparePartsEdit();
}

/* ---------- Sites (Main + Sub) ---------- */
export function renderSitesEdit() {
  const mainHost = document.getElementById('mainPlantsGrid');
  const subHost  = document.getElementById('subPlantsGrid');
  mainHost.innerHTML = '';
  if (subHost) subHost.innerHTML = '';

  // Main plants — compact row list
  const mains = state.store.sitesConfig.filter((c) => c.tier === 'main');
  if (mains.length) {
    const header = document.createElement('div');
    header.className = 'main-row header';
    header.innerHTML = `
      <span>Plant</span><span>Status</span><span>UC (MWh)</span>
      <span>RTE %</span><span>System Availability (%)</span><span>Total Cycle</span><span>SOH (%)</span><span>Today Cycle</span><span></span>
    `;
    mainHost.appendChild(header);

    mains.forEach((cfg) => {
      const data = state.currentReport.sites.find((s) => s.id === cfg.id)
                || emptySiteRecordFor(cfg);
      const wrap = document.createElement('div');
      wrap.className = 'main-row-wrap';
      wrap.innerHTML = renderMainRow(cfg, data);
      bindCardFields(wrap, cfg);
      mainHost.appendChild(wrap);
    });
  }

  // Sub plants — compact row list
  if (subHost) {
    const subs = state.store.sitesConfig.filter((c) => c.tier === 'sub');
    if (subs.length) {
      const header = document.createElement('div');
      header.className = 'sub-row header';
      header.innerHTML = `
        <span>Plant</span><span>Capacity</span><span>Status</span>
        <span>Total Cycle</span><span>Today Cycle</span><span></span>
      `;
      subHost.appendChild(header);
      subs.forEach((cfg) => {
        const data = state.currentReport.sites.find((s) => s.id === cfg.id)
                  || emptySiteRecordFor(cfg);
        const row = document.createElement('div');
        row.className = 'sub-row';
        row.innerHTML = renderSubRow(cfg, data);
        bindCardFields(row, cfg);
        subHost.appendChild(row);
      });
    }
  }

  // Single Add Site button (never duplicate on re-render)
  const existing = document.getElementById('addSiteBtn');
  if (existing) existing.remove();
  const addBtn = document.createElement('button');
  addBtn.id = 'addSiteBtn';
  addBtn.className = 'site-add-btn';
  addBtn.style.marginTop = '10px';
  addBtn.innerHTML = '＋ Add Site / Plant';
  addBtn.onclick = () => window.openSiteModal('add');
  if (subHost && subHost.parentNode) subHost.parentNode.appendChild(addBtn);
  else mainHost.appendChild(addBtn);
}

/* ---------- Row templates ---------- */
function renderMainRow(cfg, data) {
  const cycleFromDate = cycleFromCOD(cfg.cod, state.currentDate);
  const cycle = (data.cycleCount !== '' && data.cycleCount != null)
    ? Number(data.cycleCount) : cycleFromDate;
  const rl = redlineFor(cfg, cycle);
  const uc = (data.usableCapacity !== '' && data.usableCapacity != null)
    ? Number(data.usableCapacity) : null;
  const margin = (uc != null && rl) ? (uc - rl.mwh) : null;
  const marginPct = (margin != null) ? (margin / rl.mwh * 100) : null;
  const marginCls = margin == null ? '' : (margin >= 0 ? 'margin-pos' : 'margin-neg');

  return `
    <div class="main-row">
      <div class="plant-info">
        <div class="name">${escapeHtml(cfg.name)}</div>
        <div class="meta">${escapeHtml(cfg.location || '—')} · ${cfg.capacityMWh} MWh · COD ${cfg.cod || '—'}</div>
      </div>
      <select class="status-${normalizeStatus(data.status)}" data-f="status">
        ${STATUS_OPTIONS.map((o) => `<option value="${o}" ${o === normalizeStatus(data.status) ? 'selected' : ''}>${STATUS_LABELS[o]}</option>`).join('')}
      </select>
      <input type="number" step="0.01" data-f="usableCapacity" value="${data.usableCapacity ?? ''}" placeholder="UC (MWh)">
      <input type="number" min="0" max="100" step="0.01" data-f="rte" value="${data.rte ?? ''}" placeholder="RTE %">
      <input type="number" min="0" max="100" step="0.01" data-f="systemAvailability" value="${data.systemAvailability ?? ''}" placeholder="System Availability %">
      <input type="number" step="1" data-f="cycleCount" value="${data.cycleCount ?? ''}" placeholder="auto: ${cycleFromDate ?? '—'}">
      <input type="number" min="0" max="100" step="0.01" data-f="soh" value="${data.soh ?? ''}" placeholder="e.g. 97.44">
      <input type="number" step="0.001" data-f="todayCycle" value="${data.todayCycle ?? ''}" placeholder="e.g. 0.659">
      <button class="row-edit" title="Edit site config" data-action="edit-site" data-id="${cfg.id}">⚙</button>
    </div>
    <div class="main-readout-row redline-readout ${margin != null && margin < 0 ? 'margin-alert' : ''}">
      <span class="rl-label">Cycle</span><span class="rl-val">${cycle ?? '—'}</span>
      <span class="rl-label">ESA %</span><span class="rl-val">${rl ? rl.pct.toFixed(2) + '%' : '—'}</span>
      <span class="rl-label">ESA MWh</span><span class="rl-val">${rl ? rl.mwh.toFixed(2) : '—'}</span>
      <span class="rl-label">Margin</span>
      <span class="rl-val ${marginCls}">${margin != null ? (margin >= 0 ? '+' : '') + margin.toFixed(2) + ' MWh' : '—'}${marginPct != null ? ' (' + (marginPct >= 0 ? '+' : '') + marginPct.toFixed(2) + '%)' : ''}</span>
      <span class="rl-label">System Availability</span>
      <span class="rl-val">${data.systemAvailability !== '' && data.systemAvailability != null ? Number(data.systemAvailability).toFixed(2) + '%' : '—'}</span>
      <span class="rl-label">RTE</span>
      <span class="rl-val">${data.rte !== '' && data.rte != null ? Number(data.rte).toFixed(2) + '%' : '—'}</span>
      <span class="rl-label">SOH</span>
      <span class="rl-val">${data.soh !== '' && data.soh != null ? Number(data.soh).toFixed(2) + '%' : '—'}</span>
    </div>
  `;
}

function renderSubRow(cfg, data) {
  return `
    <div class="plant-name">${escapeHtml(cfg.name)}</div>
    <div class="plant-cap">${cfg.capacityMWh} MWh</div>
    <select class="status-${normalizeStatus(data.status)}" data-f="status">
      ${STATUS_OPTIONS.map((o) => `<option value="${o}" ${o === normalizeStatus(data.status) ? 'selected' : ''}>${STATUS_LABELS[o]}</option>`).join('')}
    </select>
    <input type="number" step="1" data-f="cycleCount" value="${data.cycleCount ?? ''}" placeholder="Total Cycle">
    <input type="number" step="0.001" data-f="todayCycle" value="${data.todayCycle ?? ''}" placeholder="e.g. 0.659">
    <button class="row-edit" title="Edit site" data-action="edit-site" data-id="${cfg.id}">⚙</button>
  `;
}

/* ---------- Field bindings + auto-calc ---------- */
function getYesterdayTotalCycle(plantId) {
  const yest = daysAgoISO(state.currentDate, 1);
  const rep = state.store.reports[yest];
  if (!rep || !rep.sites) return null;
  const site = rep.sites.find((s) => s.id === plantId);
  if (!site) return null;
  const yc = site.cycleCount;
  if (yc === '' || yc == null || isNaN(Number(yc))) return null;
  return Number(yc);
}

function bindCardFields(card, cfg) {
  // Wire up data-action buttons (⚙ edit) — uses window.openSiteModal so we
  // don't need a static import from site-modal.js (avoids a circular dep).
  card.querySelectorAll('[data-action="edit-site"]').forEach((btn) => {
    btn.addEventListener('click', () => window.openSiteModal('edit', btn.dataset.id));
  });

  card.querySelectorAll('[data-f]').forEach((el) => {
    el.addEventListener('input', () => {
      const f = el.dataset.f;
      const rec = state.currentReport.sites.find((s) => s.id === cfg.id);
      let v = el.value;
      if (['usableCapacity', 'cycleCount', 'soh', 'todayCycle', 'rte', 'systemAvailability'].includes(f)) {
        v = v === '' ? '' : parseFloat(v);
      }
      rec[f] = v;

      // Restyle status select
      if (f === 'status') {
        el.classList.remove('status-Healthy', 'status-Warning', 'status-HighAlert');
        el.classList.add('status-' + v);
      }

      // Bidirectional auto-calc: total ↔ today cycle using yesterday's total
      if (f === 'cycleCount' && v !== '' && !isNaN(v)) {
        const yTotal = getYesterdayTotalCycle(cfg.id);
        if (yTotal != null) {
          const todayDaily = Number(v) - yTotal;
          rec.todayCycle = Number(todayDaily.toFixed(3));
          const todayInput = card.querySelector('[data-f="todayCycle"]');
          if (todayInput) todayInput.value = rec.todayCycle;
        }
      } else if (f === 'todayCycle' && v !== '' && !isNaN(v)) {
        const yTotal = getYesterdayTotalCycle(cfg.id);
        if (yTotal != null) {
          const totalCycle = yTotal + Number(v);
          rec.cycleCount = Number(totalCycle.toFixed(3));
          const totalInput = card.querySelector('[data-f="cycleCount"]');
          if (totalInput) totalInput.value = rec.cycleCount;
        }
      }

      // Re-render ESA readout row for main plants
      if (cfg.tier === 'main' && ['usableCapacity', 'cycleCount', 'soh', 'todayCycle', 'rte', 'systemAvailability'].includes(f)) {
        refreshMainCardReadout(card, cfg, rec);
      }
    });
  });
}

function refreshMainCardReadout(card, cfg, data) {
  const cycleFromDate = cycleFromCOD(cfg.cod, state.currentDate);
  const cycle = (data.cycleCount !== '' && data.cycleCount != null)
    ? Number(data.cycleCount) : cycleFromDate;
  const rl = redlineFor(cfg, cycle);
  const uc = (data.usableCapacity !== '' && data.usableCapacity != null)
    ? Number(data.usableCapacity) : null;
  const margin = (uc != null && rl) ? (uc - rl.mwh) : null;
  const marginPct = (margin != null) ? (margin / rl.mwh * 100) : null;
  const marginCls = margin == null ? '' : (margin >= 0 ? 'margin-pos' : 'margin-neg');

  const ro = card.querySelector('.redline-readout');
  if (!ro) return;

  if (margin != null && margin < 0) ro.classList.add('margin-alert');
  else ro.classList.remove('margin-alert');

  ro.innerHTML = `
    <span class="rl-label">Cycle</span><span class="rl-val">${cycle ?? '—'}</span>
    <span class="rl-label">ESA %</span><span class="rl-val">${rl ? rl.pct.toFixed(2) + '%' : '—'}</span>
    <span class="rl-label">ESA MWh</span><span class="rl-val">${rl ? rl.mwh.toFixed(2) : '—'}</span>
    <span class="rl-label">Margin</span>
    <span class="rl-val ${marginCls}">${margin != null ? (margin >= 0 ? '+' : '') + margin.toFixed(2) + ' MWh' : '—'}${marginPct != null ? ' (' + (marginPct >= 0 ? '+' : '') + marginPct.toFixed(2) + '%)' : ''}</span>
    <span class="rl-label">System Availability</span>
    <span class="rl-val">${data.systemAvailability !== '' && data.systemAvailability != null ? Number(data.systemAvailability).toFixed(2) + '%' : '—'}</span>
    <span class="rl-label">RTE</span>
    <span class="rl-val">${data.rte !== '' && data.rte != null ? Number(data.rte).toFixed(2) + '%' : '—'}</span>
    <span class="rl-label">SOH</span>
    <span class="rl-val">${data.soh !== '' && data.soh != null ? Number(data.soh).toFixed(2) + '%' : '—'}</span>
  `;
}

/* ---------- Private helper ---------- */
function emptySiteRecordFor(cfg) {
  if (cfg.tier === 'main') {
    return { id: cfg.id, status: 'Healthy', usableCapacity: '', cycleCount: '', soh: '', todayCycle: '', rte: '', systemAvailability: '' };
  }
  return { id: cfg.id, status: 'Healthy', cycleCount: '', todayCycle: '' };
}
