# SchneiTec · CEO Daily Report Dashboard

A modular, customizable ESS (Energy Storage System) O&M daily report dashboard.

## 📁 Project Structure

```
ceo-daily-report/
├── index.html                  # Main entry point
├── README.md                   # This file
├── docs/                       # Documentation
│   ├── CUSTOMIZATION.md        # How to customize everything
│   ├── DATA_SCHEMA.md          # Data model documentation
│   └── CHANGELOG.md            # Version history
├── src/
│   ├── css/
│   │   ├── variables.css       # Design tokens (colors, spacing, radius)
│   │   ├── base.css            # Reset + base typography
│   │   ├── layout.css          # Grid, containers, headers
│   │   ├── components.css      # Buttons, cards, inputs, modals
│   │   ├── edit-view.css       # Edit mode styles
│   │   ├── preview-view.css    # Preview/print styles
│   │   ├── charts.css          # Chart panel styles
│   │   ├── history.css         # History panel
│   │   └── print.css           # Print media rules
│   ├── js/
│   │   ├── config.js           # All constants: defaults, anchors, colors
│   │   ├── storage.js          # localStorage + snapshot loader
│   │   ├── state.js            # Global state + migrations
│   │   ├── navigation.js       # setView / setDate / shiftDate (breaks cycles)
│   │   ├── dates.js            # Date arithmetic helpers
│   │   ├── cycle-math.js       # ESA interpolation + redline calc
│   │   ├── utils.js            # escapeHtml, small helpers
│   │   ├── render-edit.js      # Edit mode rendering
│   │   ├── render-preview.js   # Preview mode rendering
│   │   ├── charts.js           # SVG chart builders
│   │   ├── chart-tooltip.js    # Chart hover tooltips
│   │   ├── site-modal.js       # Site add/edit modal
│   │   ├── history-panel.js    # History drawer
│   │   ├── io.js               # Import/export JSON, screenshots, reports
│   │   ├── drag-drop.js        # Discord HTML alert import
│   │   └── app.js              # Entry point, wire everything up
│   ├── data/
│   │   ├── seed-data.js        # Historical seed data
│   │   └── default-sites.js    # Default site configurations
│   └── assets/
│       ├── logo-schneitec.js   # Base64 logo exports
│       └── logo-company.js
└── public/                     # Built, single-file distributable (optional)
    └── ceo-daily-report.html
```

## 🚀 Quick Start

### Option A — Development (modular)
Open `index.html` directly in your browser. All modules load locally — no server required (browsers allow `<script type="module">` over file:// for most setups, but if you hit CORS issues, use a local server):

```bash
# Python 3
python3 -m http.server 8000

# Node
npx serve

# Then open http://localhost:8000
```

### Option B — Single-file production
Run the build script to inline everything into one HTML file:

```bash
node build.js
# Output: public/ceo-daily-report.html
```

## 🎨 Customization

See **[docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md)** for detailed guides on:

- Changing brand colors and typography
- Adding/removing sites and plants
- Modifying the ESA contract anchor tables
- Adjusting chart appearance
- Adding new data fields
- Extending the report sections

### Quick tweaks

**Change brand colors** → `src/css/variables.css`

**Change default sites** → `src/data/default-sites.js`

**Change ESA anchors** → `src/js/config.js` (`SNTL600_DEFAULT_ANCHORS`, `SNTL400_DEFAULT_ANCHORS`)

**Change chart window** → `src/js/config.js` (`CHART_WINDOW_DAYS`)

## 🔑 Key Features

- ✅ **Edit & Preview modes** — switch between data entry and report view
- ✅ **Daily snapshots** — save reports per date, navigate history
- ✅ **ESA redline tracking** — automatic contract compliance calculation
- ✅ **Auto cycle calculation** — bidirectional: total ↔ daily cycle
- ✅ **SVG charts** — Usable Capacity vs ESA, Daily Cycle, Cycle per Site
- ✅ **Discord HTML drop import** — drag a Discord alert report onto the alerts card
- ✅ **Export/Import JSON** — full data portability
- ✅ **Screenshot to clipboard** — `html2canvas` integration
- ✅ **"Make Report" snapshot** — generates a standalone shareable HTML
- ✅ **Print-friendly** — optimized @page rules
- ✅ **Anti-gravity ready** — clean modular code, each file under 500 lines

## 📐 Data Model

See **[docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md)** for the full schema.

High level:
```
store = {
  version: 2,
  sitesConfig: [ { id, name, capacityMWh, tier, cod, anchors } ],
  reports: {
    "YYYY-MM-DD": {
      date, summary, alerts[],
      sites: [ { id, status, usableCapacity, cycleCount, todayCycle, rte } ],
      spareParts: [ { plant, name, qty } ]
    }
  }
}
```

## 📝 License

Internal SchneiTec ESS Division tool. All rights reserved.
