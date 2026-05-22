/* =============================================================================
   SITE-MODAL · Add / edit a plant configuration
   ---------------------------------------------------------------------------
   Exposes functions on window so inline onclick handlers in index.html can
   invoke them without modules. Cleanly updates the sitesConfig + current
   report when a site is added, edited, or removed.
   ============================================================================= */

import { state } from './state.js';
import { saveStore, ensureSiteDefaults, emptySiteRecord } from './storage.js';
import {
  SNTL600_DEFAULT_ANCHORS,
  SNTL400_DEFAULT_ANCHORS,
  DEFAULT_ANCHORS,
} from './config.js';
import { renderEdit } from './render-edit.js';
import { renderPreview } from './render-preview.js';

/* ---------- Open / close ---------- */
export function openSiteModal(mode, id) {
  state.siteModalCtx = { mode, id };
  document.getElementById('siteModalTitle').textContent =
    mode === 'add' ? 'Add Site' : 'Edit Site';
  document.getElementById('smDeleteBtn').style.display =
    mode === 'edit' ? '' : 'none';

  if (mode === 'edit') {
    const s = state.store.sitesConfig.find((x) => x.id === id);
    document.getElementById('smId').value = s.id;
    document.getElementById('smId').disabled = true;
    document.getElementById('smName').value = s.name;
    document.getElementById('smLocation').value = s.location || '';
    document.getElementById('smCapacity').value = s.capacityMWh;
    document.getElementById('smTier').value = s.tier;
    document.getElementById('smCOD').value = s.cod || '';

    if (s.tier === 'main' && s.anchors) {
      state.workingAnchors = s.anchors.map((a) => ({ ...a }));
    } else if (s.id === 'SNTL600') {
      state.workingAnchors = SNTL600_DEFAULT_ANCHORS.map((a) => ({ ...a }));
    } else if (s.id === 'SNTL400') {
      state.workingAnchors = SNTL400_DEFAULT_ANCHORS.map((a) => ({ ...a }));
    } else {
      state.workingAnchors = DEFAULT_ANCHORS.map((a) => ({ ...a }));
    }
  } else {
    ['smId', 'smName', 'smLocation', 'smCapacity', 'smCOD'].forEach((k) => {
      document.getElementById(k).value = '';
    });
    document.getElementById('smId').disabled = false;
    document.getElementById('smTier').value = 'sub';
    state.workingAnchors = [...DEFAULT_ANCHORS];
  }

  toggleMainConfig();
  renderAnchorRows();
  document.getElementById('siteModal').classList.add('open');
}

export function closeSiteModal() {
  document.getElementById('siteModal').classList.remove('open');
}

export function toggleMainConfig() {
  const tier = document.getElementById('smTier').value;
  document.getElementById('mainConfigSection').style.display =
    tier === 'main' ? '' : 'none';
}

/* ---------- Anchor table ---------- */
export function renderAnchorRows() {
  const host = document.getElementById('anchorRows');
  if (!host) return;
  host.innerHTML = state.workingAnchors.map((a, i) => {
    const val = a.mwh != null ? a.mwh : a.pct;
    const field = a.mwh != null ? 'mwh' : (a.pct != null ? 'pct' : 'mwh');
    return `
      <tr>
        <td><input type="number" min="1" step="1" value="${a.cycle}"
              onchange="window.updateAnchor(${i},'cycle',this.value)"></td>
        <td><input type="number" min="0" step="0.01" value="${val}"
              onchange="window.updateAnchor(${i},'${field}',this.value)"></td>
        <td><button onclick="window.removeAnchor(${i})">✕</button></td>
      </tr>
    `;
  }).join('');
}

export function updateAnchor(i, field, val) {
  state.workingAnchors[i][field] = parseFloat(val) || 0;
}

export function addAnchor() {
  state.workingAnchors.push({ cycle: 0, mwh: 0 });
  renderAnchorRows();
}

export function removeAnchor(i) {
  state.workingAnchors.splice(i, 1);
  renderAnchorRows();
}

export function resetAnchors() {
  if (!confirm('Reset anchors to contract default table?')) return;
  const id = state.siteModalCtx ? state.siteModalCtx.id : null;
  if (id === 'SNTL600') {
    state.workingAnchors = SNTL600_DEFAULT_ANCHORS.map((a) => ({ ...a }));
  } else if (id === 'SNTL400') {
    state.workingAnchors = SNTL400_DEFAULT_ANCHORS.map((a) => ({ ...a }));
  } else {
    state.workingAnchors = DEFAULT_ANCHORS.map((a) => ({ ...a }));
  }
  renderAnchorRows();
}

/* ---------- Save / delete ---------- */
export function saveSite() {
  const id = document.getElementById('smId').value.trim();
  const name = document.getElementById('smName').value.trim() || id;
  const location = document.getElementById('smLocation').value.trim();
  const capacityMWh = parseFloat(document.getElementById('smCapacity').value) || 0;
  const tier = document.getElementById('smTier').value;
  const cod = document.getElementById('smCOD').value || '';

  if (!id) {
    alert('Site ID is required');
    return;
  }

  const payload = { id, name, location, capacityMWh, tier };
  if (tier === 'main') {
    payload.cod = cod;
    payload.anchors = state.workingAnchors
      .filter((a) => a.cycle && (a.mwh || a.pct))
      .sort((a, b) => a.cycle - b.cycle);
    if (!payload.anchors.length) payload.anchors = [...DEFAULT_ANCHORS];
  }

  if (state.siteModalCtx.mode === 'add') {
    if (state.store.sitesConfig.some((s) => s.id === id)) {
      alert('Site ID already exists');
      return;
    }
    state.store.sitesConfig.push(payload);
    state.currentReport.sites.push(emptySiteRecord(payload));
  } else {
    const s = state.store.sitesConfig.find((x) => x.id === state.siteModalCtx.id);
    Object.assign(s, { name, location, capacityMWh, tier });
    if (tier === 'main') {
      s.cod = cod;
      s.anchors = payload.anchors;
    } else {
      delete s.cod;
      delete s.anchors;
    }
    ensureSiteDefaults(s);
    const idx = state.currentReport.sites.findIndex((r) => r.id === s.id);
    if (idx >= 0) {
      state.currentReport.sites[idx] = {
        ...emptySiteRecord(s),
        ...state.currentReport.sites[idx],
      };
    }
  }

  saveStore(state.store);
  closeSiteModal();
  renderEdit();
  renderPreview();
}

export function deleteSite() {
  if (!confirm('Delete this site? Past reports stay; this only removes it from future entries.')) return;
  const id = state.siteModalCtx.id;
  state.store.sitesConfig = state.store.sitesConfig.filter((s) => s.id !== id);
  state.currentReport.sites = state.currentReport.sites.filter((s) => s.id !== id);
  saveStore(state.store);
  closeSiteModal();
  renderEdit();
  renderPreview();
}
