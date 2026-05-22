/* =============================================================================
   DRAG-DROP · Discord HTML → Critical Alerts import
   ---------------------------------------------------------------------------
   Drop a Discord ESS daily HTML report onto the alerts card to auto-extract
   Section 1 alert titles and append/replace the current alerts.
   ============================================================================= */

import { state } from './state.js';
import { renderAlertsEdit } from './render-edit.js';
import { renderPreview } from './render-preview.js';

/* ---------- Public: set up the drop zone ---------- */
export function setupAlertsDropZone() {
  const target = document.getElementById('alertsCard');
  if (!target || target.dataset.dropWired) return;
  target.dataset.dropWired = '1';

  target.addEventListener('dragenter', (e) => {
    e.preventDefault();
    target.classList.add('drop-hover');
  });

  target.addEventListener('dragover', (e) => {
    e.preventDefault();
    target.classList.add('drop-hover');
  });

  target.addEventListener('dragleave', (e) => {
    if (e.target === target) target.classList.remove('drop-hover');
  });

  target.addEventListener('drop', (e) => {
    e.preventDefault();
    target.classList.remove('drop-hover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) {
      alert('No file dropped.');
      return;
    }
    const name = (file.name || '').toLowerCase();
    if (!(name.endsWith('.html') || name.endsWith('.htm'))) {
      alert('Please drop an HTML file (.html or .htm).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { importAlertsFromHtml(ev.target.result); }
      catch (err) {
        alert('Import failed: ' + (err && err.message ? err.message : 'unknown'));
      }
    };
    reader.onerror = () => alert('Could not read the file.');
    reader.readAsText(file);
  });
}

/* ---------- Parser ---------- */
function importAlertsFromHtml(htmlText) {
  const m = htmlText.match(/<!--\s*SECTION\s+1[^>]*-->([\s\S]*?)<!--\s*SECTION\s+2/i);
  if (!m) {
    alert('Section 1 "Critical Alerts" marker not found in the dropped HTML.');
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = m[1];
  const alertBoxes = container.querySelectorAll('.alert-box');
  if (!alertBoxes.length) {
    alert('No alert-box entries found in Section 1.');
    return;
  }

  const titles = [];
  alertBoxes.forEach((box) => {
    const t = box.querySelector('.title');
    if (t) {
      let text = t.textContent.trim();
      text = text
        .replace(/\s+/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&amp;/g, '&')
        .replace(/&rarr;/g, '→');
      if (text) titles.push(text);
    }
  });

  if (!titles.length) {
    alert('Alert titles not found.');
    return;
  }

  const mode = confirm(
    `Found ${titles.length} Critical Alert(s):\n\n` +
    titles.map((t, i) => `${i + 1}. ${t.slice(0, 80)}`).join('\n') +
    `\n\nOK = Append to existing alerts\nCancel = Replace all alerts`
  );

  state.currentReport.alerts = state.currentReport.alerts || [];
  if (!mode) state.currentReport.alerts = [];
  titles.forEach((t) => state.currentReport.alerts.push(t));

  renderAlertsEdit();
  if (state.currentView === 'preview') renderPreview();
}
