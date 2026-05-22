# Customization Guide

This dashboard is designed to be heavily customizable. Here are the most common changes.

## 🎨 Change brand colors

**File:** `src/css/variables.css`

All colors are CSS variables at the top of this file. Change one value and the whole app updates.

```css
:root {
  --green-700: #2E7D32;   /* Primary brand color */
  --blue-700:  #1976D2;   /* SNTL600 accent */
  --red-600:   #E53935;   /* Alerts, below-redline */
  /* ... */
}
```

**Tip:** If you change `--green-700`, you should probably also update `MAIN_COLORS` and `REDLINE_COLORS` in `src/js/config.js` so the charts match.

## 🏭 Add, remove, or rename a plant

**File:** `src/data/default-sites.js`

Edit the `DEFAULT_SITES` array:

```js
export const DEFAULT_SITES = [
  // Add a new main plant
  {
    id: 'SNTL200',
    name: 'SNTL200',
    location: 'Battambang',
    capacityMWh: 200,
    tier: 'main',
    cod: '2026-06-01',
    anchors: [ /* your contract table */ ],
  },
  // Add a new sub plant
  { id: 'NEWSITE', name: 'NewSite', capacityMWh: 5, tier: 'sub' },
];
```

**Note:** This only affects **new** users / fresh installs. Existing users have their config in `localStorage`. To wipe localStorage, open DevTools → Application → Local Storage → delete `ceo_daily_report_v1`. Or import a fresh JSON.

The safest way to ship new defaults to all users is to either:

1. Bump `VERSION` in `src/js/config.js` and add a migration in `storage.js`, **or**
2. Use the Import button to load a JSON file with the new `sitesConfig`.

## 📈 Change the ESA contract anchor table

**File:** `src/js/config.js`

The `SNTL600_DEFAULT_ANCHORS` and `SNTL400_DEFAULT_ANCHORS` arrays drive the redline ESA calculation. Each entry maps a cycle count to a contracted MWh value; the app linearly interpolates between anchor points.

```js
export const SNTL600_DEFAULT_ANCHORS = [
  { cycle: 1,    mwh: 601.83 },
  { cycle: 365,  mwh: 567.05 },
  // ... add your own
];
```

Users can also edit anchors per-site via the UI (⚙ button on a site row → Anchor Table).

## 📊 Adjust chart windows

**File:** `src/js/config.js`

```js
export const CHART_WINDOW_DAYS = 30;   // Days of history shown on line charts
export const LINE_CHART_SIZE = { width: 520, height: 180 };
export const BAR_CHART_SIZE  = { width: 720, height: 260 };
```

## 🔧 Add a new data field to a site

This requires touching three files. Example: adding a "voltage" field to main plants.

**1. `src/js/storage.js` → `emptySiteRecord`:**
```js
if (cfg.tier === 'main') {
  return {
    id: cfg.id, status: 'Healthy',
    usableCapacity: '', cycleCount: '', todayCycle: '', rte: '',
    voltage: '',  // ← NEW
  };
}
```

**2. `src/js/render-edit.js` → `renderMainRow` template:**
Add a new `<input data-f="voltage" ...>` cell and update the grid columns in `edit-view.css`.

**3. `src/js/render-preview.js` → `renderPlantSummary`:**
Add a new `.kpi` block showing `data.voltage`.

## 🎛️ Change the status options

**File:** `src/js/config.js`

```js
export const STATUS_OPTIONS = ['Healthy', 'Warning', 'HighAlert'];
export const STATUS_LABELS = {
  Healthy:   'Healthy',
  Warning:   'Warning',
  HighAlert: 'High Alert',
};
```

Don't forget to add matching CSS classes for new statuses in `edit-view.css` and `components.css` (look for `.status-Healthy`, `.pill.Healthy`, etc.).

## 🖼️ Replace the brand logos

**File:** `index.html`

Look for `<div class="brand-logo1">` and `<div class="brand-logo2">`. Replace with `<img>` tags:

```html
<img class="brand-logo1" src="assets/my-logo.png" alt="Company">
```

Or keep them as base64-embedded images in `src/assets/logos.js` (see the original file's `data:image/png;base64,...` strings).

## 🔌 Add a new report section

Example: adding a "Production Targets" block.

1. **Edit `index.html`** — add a new section in `#editView` and `#previewView`.
2. **Edit `src/js/storage.js`** — add the field to `emptyReport`.
3. **Edit `src/js/render-edit.js`** — write a renderer.
4. **Edit `src/js/render-preview.js`** — write the preview renderer.

## 🌓 Add dark mode

**File:** `src/css/variables.css`

Add a `[data-theme="dark"]` selector with overridden values:

```css
[data-theme="dark"] {
  --gray-100: #1e1e1e;
  --gray-50:  #2a2a2a;
  --white:    #333333;
  --gray-900: #e0e0e0;
  /* ... */
}
```

Then toggle `document.documentElement.dataset.theme` from a new toolbar button.

## 🗣️ Localize the UI

Currently strings are hardcoded in English in the render functions and `index.html`. For localization, extract strings into an object keyed by language and add a language switcher in the toolbar.

## 🧪 Testing changes locally

The app uses ES modules (`<script type="module">`), so some browsers block `file://` loads. Serve with any HTTP server:

```bash
# Python
python3 -m http.server 8000

# Node (one-off)
npx serve

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000`.
