/* =============================================================================
   CONFIG · Central constants
   ---------------------------------------------------------------------------
   All tweakable values live here. Change any of these to re-shape the app
   behaviour without hunting through the code.
   ============================================================================= */

export const STORAGE_KEY = 'ceo_daily_report_v1';
export const VERSION = 2;

/* ---------- Chart window (days of history shown on line charts) ---------- */
export const CHART_WINDOW_DAYS = 30;

/* ---------- Status options ---------- */
export const STATUS_OPTIONS = ['Healthy', 'Warning', 'HighAlert'];
export const STATUS_LABELS = {
  Healthy:   'Healthy',
  Warning:   'Warning',
  HighAlert: 'High Alert',
};

/* ---------- Accent colors per main plant (also mirrored in CSS vars) ---------- */
export const MAIN_COLORS = {
  SNTL600: '#1976D2',
  SNTL400: '#2E7D32',
};

export const REDLINE_COLORS = {
  SNTL600: '#1976D2',
  SNTL400: '#2E7D32',
};

/* ---------- Contract ESA Guaranteed Usable Capacity anchors ---------- */
/* Source: SchneiTec UC contract reference. Linear interpolation between points. */

export const SNTL600_DEFAULT_ANCHORS = [
  { cycle: 1,    mwh: 601.83 },
  { cycle: 365,  mwh: 567.05 },
  { cycle: 730,  mwh: 552.27 },
  { cycle: 1095, mwh: 540.62 },
  { cycle: 1460, mwh: 530.19 },
  { cycle: 1825, mwh: 520.38 },
  { cycle: 2190, mwh: 510.99 },
  { cycle: 2555, mwh: 501.96 },
  { cycle: 2920, mwh: 493.19 },
  { cycle: 3285, mwh: 484.73 },
  { cycle: 3650, mwh: 476.40 },
  { cycle: 4015, mwh: 469.27 },
  { cycle: 4380, mwh: 460.23 },
  { cycle: 4745, mwh: 452.34 },
  { cycle: 5110, mwh: 444.57 },
  { cycle: 5475, mwh: 436.88 },
  { cycle: 5840, mwh: 429.31 },
  { cycle: 6205, mwh: 421.87 },
  { cycle: 6570, mwh: 414.49 },
  { cycle: 6935, mwh: 407.18 },
];

export const SNTL400_DEFAULT_ANCHORS = [
  { cycle: 1,    mwh: 401.22 },
  { cycle: 365,  mwh: 378.03 },
  { cycle: 730,  mwh: 368.18 },
  { cycle: 1095, mwh: 360.42 },
  { cycle: 1460, mwh: 353.46 },
  { cycle: 1825, mwh: 346.92 },
  { cycle: 2190, mwh: 340.66 },
  { cycle: 2555, mwh: 334.64 },
  { cycle: 2920, mwh: 328.80 },
  { cycle: 3285, mwh: 323.15 },
  { cycle: 3650, mwh: 317.60 },
  { cycle: 4015, mwh: 312.84 },
  { cycle: 4380, mwh: 306.82 },
  { cycle: 4745, mwh: 301.56 },
  { cycle: 5110, mwh: 296.38 },
  { cycle: 5475, mwh: 291.25 },
  { cycle: 5840, mwh: 286.21 },
  { cycle: 6205, mwh: 281.24 },
  { cycle: 6570, mwh: 276.33 },
  { cycle: 6935, mwh: 271.46 },
];

/* Fallback anchors used for user-added main plants (e.g. copied from SNTL600) */
export const DEFAULT_ANCHORS = SNTL600_DEFAULT_ANCHORS;

/* ---------- Chart dimensions ---------- */
export const LINE_CHART_SIZE = { width: 900, height: 260 };
export const BAR_CHART_SIZE  = { width: 900, height: 320 };

/* ---------- Minimum rows for spare parts table in preview ---------- */
export const SPARE_PARTS_MIN_ROWS = 3;
