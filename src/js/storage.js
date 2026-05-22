/* =============================================================================
   STORAGE · localStorage + snapshot loader + migrations + seeding
   ---------------------------------------------------------------------------
   Responsible for:
   - Loading and saving the persistent store
   - Merging seed data non-destructively on first load
   - Running one-time migrations (yesterday-shift, ensure defaults, etc.)
   - Honoring the "snapshot" mode: if window.__REPORT_SNAPSHOT__ exists,
     the app is in read-only snapshot mode and writes are suppressed.
   ============================================================================= */

import { STORAGE_KEY, VERSION, SNTL600_DEFAULT_ANCHORS, SNTL400_DEFAULT_ANCHORS, DEFAULT_ANCHORS } from './config.js';
import { DEFAULT_SITES } from '../data/default-sites.js';
import { SEED_DATA } from '../data/seed-data.js';
import { todayISO, daysAgoISO } from './dates.js';
import { deepClone } from './utils.js';

/* ---------- Site record factory ---------- */
function cloneSite(s) {
  return deepClone(s);
}

/**
 * Ensure a site config has all the required defaults filled in.
 * Used when normalizing user-imported or migrated data.
 */
export function ensureSiteDefaults(s) {
  if (s.tier === 'main') {
    if (!s.cod) s.cod = '2026-01-01';
    if (!s.anchors || !s.anchors.length) {
      if (s.id === 'SNTL600') s.anchors = SNTL600_DEFAULT_ANCHORS.map((a) => ({ ...a }));
      else if (s.id === 'SNTL400') s.anchors = SNTL400_DEFAULT_ANCHORS.map((a) => ({ ...a }));
      else s.anchors = DEFAULT_ANCHORS.map((a) => ({ ...a }));
    } else if (s.anchors[0] && s.anchors[0].mwh == null && s.anchors[0].pct != null) {
      // Legacy pct-based anchors: upgrade to contract MWh table for known plants
      if (s.id === 'SNTL600') s.anchors = SNTL600_DEFAULT_ANCHORS.map((a) => ({ ...a }));
      else if (s.id === 'SNTL400') s.anchors = SNTL400_DEFAULT_ANCHORS.map((a) => ({ ...a }));
      // else: preserve the pct format (redlineFor handles it)
    }
  }
  return s;
}

/* ---------- Empty records ---------- */
export function emptySiteRecord(cfg) {
  if (cfg.tier === 'main') {
    return {
      id: cfg.id, status: 'Healthy',
      usableCapacity: '', cycleCount: '', soh: '', todayCycle: '', rte: '', systemAvailability: '',
    };
  }
  return { id: cfg.id, status: 'Healthy', cycleCount: '', todayCycle: '' };
}

export function emptyReport(date, sitesConfig) {
  return {
    date,
    summary: '',
    alerts: [],
    sites: sitesConfig.map(emptySiteRecord),
    spareParts: [],
  };
}

/* ---------- Seed merge ---------- */
function applySeedData(store) {
  const plantIds = Object.keys(SEED_DATA);
  for (const plantId of plantIds) {
    const bucket = SEED_DATA[plantId];
    for (const date in bucket) {
      const v = bucket[date];
      if (!store.reports[date]) {
        store.reports[date] = {
          date,
          summary: '',
          alerts: [],
          sites: store.sitesConfig.map(emptySiteRecord),
        };
      }
      const rep = store.reports[date];
      if (!rep.sites) rep.sites = store.sitesConfig.map(emptySiteRecord);
      let site = rep.sites.find((s) => s.id === plantId);
      if (!site) {
        const cfg = store.sitesConfig.find((c) => c.id === plantId);
        if (cfg) {
          site = emptySiteRecord(cfg);
          rep.sites.push(site);
        }
      }
      if (site) {
        if ('uc'    in v && (site.usableCapacity === '' || site.usableCapacity == null)) site.usableCapacity = v.uc;
        if ('tc'    in v && (site.todayCycle     === '' || site.todayCycle     == null)) site.todayCycle     = v.tc;
        if ('cycle' in v && (site.cycleCount     === '' || site.cycleCount     == null)) site.cycleCount     = v.cycle;
        if ('rte'   in v && (site.rte            === '' || site.rte            == null)) site.rte            = v.rte;
      }
    }
  }
}

/* ---------- Migrations ---------- */
/**
 * Historical quirk: reports used to be entered as "today" while actually
 * containing yesterday's data. This migration shifts such records back one
 * day, exactly once, and marks the store as migrated.
 */
function applyYesterdayShiftMigration(store) {
  if (store.migrations && store.migrations.yesterdayShifted) return;
  const today = todayISO();
  const yest = daysAgoISO(today, 1);
  const t = store.reports[today];
  if (t && t.sites) {
    const hasUserData = t.sites.some((s) =>
      (s.usableCapacity !== '' && s.usableCapacity != null) ||
      (s.cycleCount     !== '' && s.cycleCount     != null) ||
      (s.soh            !== '' && s.soh            != null) ||
      (s.todayCycle     !== '' && s.todayCycle     != null) ||
      (s.rte            !== '' && s.rte            != null)
    );
    if (hasUserData) {
      const y = store.reports[yest];
      if (y && y.sites) {
        t.sites.forEach((ts) => {
          const ys = y.sites.find((x) => x.id === ts.id);
          if (ys) {
            ['usableCapacity', 'cycleCount', 'soh', 'todayCycle', 'rte', 'status'].forEach((f) => {
              if (ts[f] !== '' && ts[f] != null) ys[f] = ts[f];
            });
          }
        });
        y.date = yest;
        if (t.summary) y.summary = t.summary;
        if (t.alerts && t.alerts.length) y.alerts = t.alerts;
        if (t.spareParts && t.spareParts.length) y.spareParts = t.spareParts;
      } else {
        t.date = yest;
        store.reports[yest] = t;
      }
      delete store.reports[today];
    }
  }
  store.migrations = store.migrations || {};
  store.migrations.yesterdayShifted = true;
}

/* ---------- Public API ---------- */

/**
 * Create a fresh, empty store (plus seeded data).
 */
export function newStore() {
  const s = {
    version: VERSION,
    sitesConfig: DEFAULT_SITES.map(cloneSite),
    reports: {},
  };
  applySeedData(s);
  return s;
}

/**
 * Load the store from either the embedded snapshot or localStorage.
 * Falls back to a fresh newStore() on failure.
 */
export function loadStore() {
  try {
    // Snapshot mode: read-only hardcoded snapshot embedded in the HTML
    if (typeof window !== 'undefined' && window.__REPORT_SNAPSHOT__) {
      const snap = window.__REPORT_SNAPSHOT__;
      if (!snap.sitesConfig || !Array.isArray(snap.sitesConfig) || !snap.sitesConfig.length) {
        snap.sitesConfig = DEFAULT_SITES.map(cloneSite);
      } else {
        snap.sitesConfig = snap.sitesConfig.map(ensureSiteDefaults);
      }
      snap.reports = snap.reports || {};
      return snap;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return newStore();
    const s = JSON.parse(raw);
    s.version = s.version || VERSION;

    if (!s.sitesConfig || !s.sitesConfig.length) {
      s.sitesConfig = DEFAULT_SITES.map(cloneSite);
    } else {
      s.sitesConfig = s.sitesConfig.map(ensureSiteDefaults);
      // Re-add any factory-default sub plants that went missing
      const defaultSubs = DEFAULT_SITES.filter((x) => x.tier === 'sub');
      defaultSubs.forEach((sub) => {
        if (!s.sitesConfig.find((x) => x.id === sub.id)) {
          s.sitesConfig.push(cloneSite(sub));
        }
      });
    }

    s.reports = s.reports || {};
    applySeedData(s);
    applyYesterdayShiftMigration(s);

    // Persist back so seeded data is available next time
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
    return s;
  } catch (e) {
    console.error('Failed to load store:', e);
    return newStore();
  }
}

/**
 * Persist the store to localStorage. In snapshot mode this is a no-op.
 */
export function saveStore(s) {
  if (typeof window !== 'undefined' && window.__REPORT_SNAPSHOT__) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * Sync an existing report's `sites` array to match the current sitesConfig
 * order, adding new sites and preserving existing data.
 */
export function syncReportToSites(report, sitesConfig) {
  if (!report.spareParts) report.spareParts = [];
  const byId = Object.fromEntries((report.sites || []).map((s) => [s.id, s]));
  report.sites = sitesConfig.map((cfg) => {
    const existing = byId[cfg.id];
    if (!existing) return emptySiteRecord(cfg);
    const base = emptySiteRecord(cfg);
    const merged = { ...base, ...existing };
    merged.status = merged.status || 'Healthy';
    return merged;
  });
  return report;
}
