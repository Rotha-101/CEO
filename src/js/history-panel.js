/* =============================================================================
   HISTORY-PANEL · Slide-in drawer listing all saved reports
   ============================================================================= */

import { state, loadOrInitReport } from './state.js';
import { saveStore } from './storage.js';
import { fmtWeekday } from './dates.js';
import { escapeHtml } from './utils.js';
import { setDate } from './navigation.js';
import { renderEdit } from './render-edit.js';
import { renderPreview } from './render-preview.js';

/* ---------- Open / close ---------- */
export function openHistory() {
  renderHistory();
  document.getElementById('historyPanel').classList.add('open');
  document.getElementById('backdrop').classList.add('open');
}

export function closeHistory() {
  document.getElementById('historyPanel').classList.remove('open');
  document.getElementById('backdrop').classList.remove('open');
}

/* ---------- List ---------- */
export function renderHistory() {
  const host = document.getElementById('historyList');
  const dates = Object.keys(state.store.reports).sort().reverse();

  if (!dates.length) {
    host.innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--gray-500);font-size:13px">No saved reports yet.</div>';
    return;
  }

  host.innerHTML = dates.map((d) => {
    const r = state.store.reports[d];
    const running = (r.sites || []).filter((s) => s.status === 'Healthy' || s.status === 'Warning').length;
    const total = (r.sites || []).length;
    const alerts = (r.alerts || []).filter((a) => a && a.trim()).length;
    const summaryPreview = r.summary
      ? ' · ' + escapeHtml(r.summary.slice(0, 40)) + (r.summary.length > 40 ? '…' : '')
      : '';

    return `
      <div class="history-item" data-action="open" data-date="${d}">
        <div>
          <div class="date">${d} · ${fmtWeekday(d)}</div>
          <div class="meta">${running}/${total} running · ${alerts} alert${alerts !== 1 ? 's' : ''}${summaryPreview}</div>
        </div>
        <div class="actions">
          <button class="btn btn-sm btn-danger" data-action="delete" data-date="${d}">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Delegate clicks
  host.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = el.dataset.action;
      const date = el.dataset.date;
      if (action === 'open') {
        setDate(date);
        closeHistory();
      } else if (action === 'delete') {
        deleteReport(date);
      }
    });
  });
}

export function deleteReport(date) {
  if (!confirm(`Delete report for ${date}?`)) return;
  delete state.store.reports[date];
  saveStore(state.store);
  renderHistory();
}

export function clearAllReports() {
  if (!confirm('Clear ALL saved reports? Site configuration is kept.')) return;
  state.store.reports = {};
  saveStore(state.store);
  renderHistory();
  state.currentReport = loadOrInitReport(state.currentDate);
  renderEdit();
  renderPreview();
}
