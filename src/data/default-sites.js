/* =============================================================================
   DEFAULT SITES · Factory-default plant configuration
   ---------------------------------------------------------------------------
   Edit this file to change the default list of plants that ship with the app.
   Remember that existing user data in localStorage takes precedence over
   these defaults — use Import/Export JSON to bulk-migrate configurations.
   ============================================================================= */

import {
  SNTL600_DEFAULT_ANCHORS,
  SNTL400_DEFAULT_ANCHORS,
} from '../js/config.js';

export const DEFAULT_SITES = [
  {
    id: 'SNTL600',
    name: 'SNTL600',
    location: 'Kampong Chhnang',
    capacityMWh: 600,
    tier: 'main',
    cod: '2026-01-01',
    anchors: SNTL600_DEFAULT_ANCHORS.map((a) => ({ ...a })),
  },
  {
    id: 'SNTL400',
    name: 'SNTL400',
    location: 'Pursat',
    capacityMWh: 400,
    tier: 'main',
    cod: '2026-01-01',
    anchors: SNTL400_DEFAULT_ANCHORS.map((a) => ({ ...a })),
  },
  { id: 'SNTD', name: 'SNTD', location: '', capacityMWh: 12, tier: 'sub' },
  { id: 'DMF',  name: 'DMF',  location: '', capacityMWh: 6,  tier: 'sub' },
  { id: 'SNTB', name: 'SNTB', location: '', capacityMWh: 30, tier: 'sub' },
  { id: 'SNTV', name: 'SNTV', location: '', capacityMWh: 12, tier: 'sub' },
  { id: 'SNTZ', name: 'SNTZ', location: '', capacityMWh: 3,  tier: 'sub' },
  { id: 'MSGP', name: 'MSGP', location: '', capacityMWh: 4,  tier: 'sub' },
];
