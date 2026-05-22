/* =============================================================================
   APP · Entry point — wires up DOM events and bootstraps the UI
   ---------------------------------------------------------------------------
   Loaded as the top-level module. It:
   - Initializes currentReport
   - Wires toolbar button handlers and toggles
   - Exposes a handful of functions on `window` for inline onclick handlers
     used in the anchor table (small, contained case)
   ============================================================================= */

import { state, loadOrInitReport } from './state.js';
import { setView, setDate, setDateToday, shiftDate, updateTopbarDate } from './navigation.js';
import { renderEdit, addAlert, addSparePart } from './render-edit.js';
import { renderPreview } from './render-preview.js';
import {
  openSiteModal, closeSiteModal, toggleMainConfig, saveSite,
  deleteSite, addAnchor, removeAnchor, updateAnchor, resetAnchors,
} from './site-modal.js';
import { openHistory, closeHistory, clearAllReports } from './history-panel.js';
import {
  saveReport, exportJSON, importJSON, takeScreenshot, makeReport, makePreviewReport,
  openSettings, closeSettings, saveSettings
} from './io.js';
import { setupAlertsDropZone } from './drag-drop.js';

/* Re-export navigation so any legacy `import from './app.js'` still resolves */
export { setView, setDate, setDateToday, shiftDate, updateTopbarDate };

/* ---------- Auto-save timer ---------- */
let autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveReport();
  }, 2000); // Auto-save after 2 seconds of inactivity
}

const THEME_KEY = 'ceoDailyReportTheme';
const ZOOM_KEY = 'ceoDailyReportZoom';
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.1;

function getSavedTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  applyTheme(getSavedTheme() === 'dark' ? 'light' : 'dark');
}

function getSavedZoom() {
  const raw = parseFloat(localStorage.getItem(ZOOM_KEY));
  return Number.isFinite(raw) ? raw : 1;
}

function applyZoom(value) {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  document.documentElement.style.setProperty('--app-scale', zoom);
  localStorage.setItem(ZOOM_KEY, zoom.toString());
}

function resetZoom() {
  applyZoom(1);
}

function changeZoom(delta) {
  applyZoom(getSavedZoom() + delta);
}

/* ---------- Wire up toolbar + form events ---------- */
function wireEvents() {
  // Date input
  document.getElementById('dateInput').addEventListener('change', (e) => setDate(e.target.value));

  // Summary textarea
  document.getElementById('fieldSummary').addEventListener('input', (e) => {
    state.currentReport.summary = e.target.value;
    scheduleAutoSave();
  });

  // Wire up auto-save for all input fields in edit mode
  const editContainer = document.getElementById('editMode');
  if (editContainer) {
    editContainer.addEventListener('input', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        scheduleAutoSave();
      }
    });
    editContainer.addEventListener('change', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        scheduleAutoSave();
      }
    });
  }

  // Toolbar buttons — delegate via data-action
  document.querySelectorAll('[data-action]').forEach((el) => {
    const action = el.dataset.action;
    const handler = {
      'shift-prev':        () => shiftDate(-1),
      'shift-next':        () => shiftDate(1),
      'today':             setDateToday,
      'view-edit':         () => setView('edit'),
      'view-preview':      () => setView('preview'),
      'open-history':      openHistory,
      'export':            exportJSON,
      'import':            () => document.getElementById('importFile').click(),
      'print':             () => window.print(),
      'screenshot':        takeScreenshot,
      'make-report':       makeReport,
      'make-preview-report': makePreviewReport,
      'save':              saveReport,
      'zoom-out':          () => changeZoom(-ZOOM_STEP),
      'zoom-reset':        resetZoom,
      'zoom-in':           () => changeZoom(ZOOM_STEP),
      'toggle-theme':      toggleTheme,
      'open-settings':     openSettings,
      'close-settings':    closeSettings,
      'save-settings':     saveSettings,
      'add-alert':         addAlert,
      'add-spare':         addSparePart,
      'close-history':     closeHistory,
      'clear-all-reports': clearAllReports,
      'close-site-modal':  closeSiteModal,
      'save-site':         saveSite,
      'delete-site':       deleteSite,
      'add-anchor':        addAnchor,
      'reset-anchors':     resetAnchors,
    }[action];

    if (handler) {
      el.addEventListener('click', (e) => handler(e));
    }
  });

  // Import file picker
  document.getElementById('importFile').addEventListener('change', importJSON);

  // Backdrop click closes history
  document.getElementById('backdrop').addEventListener('click', closeHistory);

  // Site modal tier selector
  const tierSelect = document.getElementById('smTier');
  if (tierSelect) tierSelect.addEventListener('change', toggleMainConfig);

  // Warn on unsaved changes
  window.addEventListener('beforeunload', (e) => {
    const cur = JSON.stringify(state.currentReport);
    const saved = JSON.stringify(
      state.store.reports[state.currentDate] ||
      { date: state.currentDate, summary: '', alerts: [], sites: [] }
    );
    if (cur !== saved) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/* ---------- Expose for inline onclick handlers (anchor table only) ---------- */
window.updateAnchor = updateAnchor;
window.removeAnchor = removeAnchor;
window.openSiteModal = openSiteModal;

/* ---------- Bootstrap ---------- */
function init() {
  state.currentReport = loadOrInitReport(state.currentDate);
  document.getElementById('dateInput').value = state.currentDate;
  applyTheme(getSavedTheme());
  applyZoom(getSavedZoom());
  updateTopbarDate();
  wireEvents();
  renderEdit();
  renderPreview();
  setupAlertsDropZone();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
