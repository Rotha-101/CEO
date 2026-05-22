/* =============================================================================
   NAVIGATION · Shared view/date navigation primitives
   ---------------------------------------------------------------------------
   Extracted out of app.js to break circular imports. Modules that need to
   trigger a date change or view switch (history-panel, io, site-modal) can
   import from here without pulling in app.js's full dependency graph.
   ============================================================================= */

import { state, loadOrInitReport } from './state.js';
import { fmtWeekday } from './dates.js';
import { renderEdit } from './render-edit.js';
import { renderPreview } from './render-preview.js';

/* ---------- View toggle ---------- */
export function setView(v) {
  state.currentView = v;
  document.getElementById('editView').classList.toggle('hidden', v !== 'edit');
  document.getElementById('previewView').classList.toggle('hidden', v !== 'preview');
  document.getElementById('tabEdit').classList.toggle('active', v === 'edit');
  document.getElementById('tabPreview').classList.toggle('active', v === 'preview');
  if (v === 'preview') renderPreview();
}

/* ---------- Date navigation ---------- */
export function updateTopbarDate() {
  document.getElementById('topbarDate').textContent = state.currentDate;
  document.getElementById('topbarWeekday').textContent = fmtWeekday(state.currentDate);
}

export function shiftDate(delta) {
  const d = new Date(state.currentDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  setDate(`${y}-${m}-${day}`);
}

export function setDateToday() {
  // "Today" = yesterday's calendar date (today's report holds yesterday's data)
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  setDate(`${y}-${m}-${day}`);
}

export function setDate(iso) {
  state.currentDate = iso;
  const input = document.getElementById('dateInput');
  if (input) input.value = iso;
  state.currentReport = loadOrInitReport(iso);
  updateTopbarDate();
  renderEdit();
  renderPreview();
}
