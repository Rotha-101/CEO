# Changelog

## v2.0 · Modular refactor

**Breaking:** single-file dashboard has been split into a modular project.

### Added
- Clean separation of concerns into `src/css/`, `src/js/`, `src/data/`
- Full documentation: `README.md`, `docs/CUSTOMIZATION.md`, `docs/DATA_SCHEMA.md`
- `build.js` for producing a single-file distributable
- ES module structure for clean imports
- `data-action` attributes replace most inline `onclick` handlers
- Expanded JSDoc comments across all modules

### Changed
- All color tokens moved to `src/css/variables.css`
- Anchor table formats unified (MWh preferred, pct still supported)
- Status options centralized in `src/js/config.js`

### Kept identical behavior
- localStorage key (`ceo_daily_report_v1`)
- Export JSON schema
- "Make Report" snapshot output format
- All UI interactions and keyboard flows

## v1.x · Single-file dashboard

Original monolithic HTML file with embedded CSS and JS.
