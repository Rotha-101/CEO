/* =============================================================================
   STATE · Global runtime state
   ---------------------------------------------------------------------------
   Single source of mutable runtime state. Importable as module members.
   Views read from here; mutations go through the setters to keep things
   consistent (currentReport is resynced to sitesConfig on every setDate).
   ============================================================================= */

import { loadStore, syncReportToSites, emptyReport } from './storage.js';
import { todayISO, daysAgoISO } from './dates.js';

/* ---------- Mutable state (exported via getters/setters) ---------- */
let _store = loadStore();
// Default to yesterday — today's report usually holds yesterday's ops data
let _currentDate = daysAgoISO(todayISO(), 1);
let _currentReport = null;
let _currentView = 'edit';
let _siteModalCtx = null;
let _workingAnchors = [];

/* ---------- Accessors ---------- */
export const state = {
  get store()           { return _store; },
  get currentDate()     { return _currentDate; },
  get currentReport()   { return _currentReport; },
  get currentView()     { return _currentView; },
  get siteModalCtx()    { return _siteModalCtx; },
  get workingAnchors()  { return _workingAnchors; },

  set store(v)          { _store = v; },
  set currentDate(v)    { _currentDate = v; },
  set currentReport(v)  { _currentReport = v; },
  set currentView(v)    { _currentView = v; },
  set siteModalCtx(v)   { _siteModalCtx = v; },
  set workingAnchors(v) { _workingAnchors = v; },
};

/* ---------- Helpers ---------- */

/**
 * Load or construct a report for a given date and wire it to sitesConfig.
 * @param {string} date ISO "YYYY-MM-DD"
 * @returns {object} a report object
 */
export function loadOrInitReport(date) {
  const existing = _store.reports[date];
  if (existing) return syncReportToSites({ ...existing }, _store.sitesConfig);
  return emptyReport(date, _store.sitesConfig);
}

/**
 * Set the current report to whatever date is selected.
 */
export function refreshCurrentReport() {
  _currentReport = loadOrInitReport(_currentDate);
  return _currentReport;
}
