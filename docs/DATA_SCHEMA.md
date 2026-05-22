# Data Schema

This document describes the shape of data stored in `localStorage` and exported/imported via JSON.

## Top-level `store`

Stored under localStorage key `ceo_daily_report_v1`.

```ts
{
  version: 2,                  // Schema version
  sitesConfig: Site[],         // Plant configurations
  reports: {                   // Keyed by ISO date "YYYY-MM-DD"
    [date: string]: Report
  },
  migrations?: {               // Internal flags
    yesterdayShifted?: boolean
  }
}
```

## `Site`

```ts
{
  id: string,                  // Unique code, e.g. "SNTL600"
  name: string,                // Display name
  location: string,            // Free text
  capacityMWh: number,         // Nameplate capacity
  tier: "main" | "sub",        // Main = UC + ESA tracked; Sub = cycle-only

  // Main-only fields:
  cod?: string,                // ISO date of Commercial Operation (cycle 1)
  anchors?: Anchor[],          // Contract ESA table
}
```

## `Anchor`

Two formats supported. `mwh` is preferred; `pct` is legacy and gets auto-upgraded for known plants.

```ts
{ cycle: number, mwh: number }   // Preferred
// or
{ cycle: number, pct: number }   // Legacy (percent-of-capacity)
```

Linear interpolation is used between anchor points.

## `Report`

```ts
{
  date: string,                // ISO "YYYY-MM-DD"
  summary: string,             // Overall commentary
  alerts: string[],            // Critical alert text lines
  sites: SiteRecord[],         // One per site in sitesConfig
  spareParts: SparePart[],     // Optional
  updatedAt?: string,          // ISO timestamp of last save
}
```

## `SiteRecord` (main plant)

```ts
{
  id: string,                  // Matches Site.id
  status: "Healthy" | "Warning" | "HighAlert",
  usableCapacity: number | "", // MWh measured
  cycleCount:     number | "", // Total cycles to date
  todayCycle:     number | "", // Cycles completed today (0..1+)
  rte:            number | "", // Round-trip efficiency %
}
```

## `SiteRecord` (sub plant)

```ts
{
  id: string,
  status: "Healthy" | "Warning" | "HighAlert",
  cycleCount: number | "",
  todayCycle: number | "",
}
```

## `SparePart`

```ts
{
  plant: string,   // Site.id (may be "")
  name:  string,   // Description of the part
  qty:   number | "",
}
```

## Example JSON export

```json
{
  "version": 2,
  "sitesConfig": [
    {
      "id": "SNTL600",
      "name": "SNTL600",
      "location": "Kampong Chhnang",
      "capacityMWh": 600,
      "tier": "main",
      "cod": "2026-01-01",
      "anchors": [
        { "cycle": 1,    "mwh": 601.83 },
        { "cycle": 365,  "mwh": 567.05 }
      ]
    }
  ],
  "reports": {
    "2026-04-22": {
      "date": "2026-04-22",
      "summary": "All plants healthy, SNTB nearing SOC setpoint deadline.",
      "alerts": [
        "CRITICAL: SNTB 30MWh — SOC 95% Setpoint still in progress"
      ],
      "sites": [
        {
          "id": "SNTL600",
          "status": "Healthy",
          "usableCapacity": 604.27,
          "cycleCount": 152.1,
          "todayCycle": 0.92,
          "rte": 91.15
        }
      ],
      "spareParts": []
    }
  }
}
```

## Derived values (not stored)

The following are computed on-the-fly and never persisted:

- **ESA MWh / ESA %** — from `SiteRecord.cycleCount` + `Site.anchors` via linear interpolation
- **Margin** — `usableCapacity − esaMwh`
- **Auto cycle-from-COD** — when `cycleCount` is blank, `cycleFromCOD(site.cod, reportDate)` is used instead

## Snapshot mode

When the page is loaded with a `window.__REPORT_SNAPSHOT__` variable defined (set by the "Make Report" feature), the store is loaded from that snapshot instead of localStorage, and all writes are suppressed. This creates a static, shareable HTML report.
