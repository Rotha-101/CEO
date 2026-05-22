/* =============================================================================
   IO · Import / export / screenshot / make-report
   ---------------------------------------------------------------------------
   All non-localStorage data pathways: JSON save/load, html2canvas clipboard
   capture, and the "Make Report" static HTML snapshot.
   ============================================================================= */

import { state, loadOrInitReport } from './state.js';
import { saveStore, ensureSiteDefaults } from './storage.js';
import { VERSION } from './config.js';
import { DEFAULT_SITES } from '../data/default-sites.js';
import { todayISO } from './dates.js';
import { deepClone } from './utils.js';
import { renderEdit } from './render-edit.js';
import { renderPreview } from './render-preview.js';
import { setView } from './navigation.js';

/* ---------- Save (localStorage) ---------- */
export function saveReport(ev) {
  state.currentReport.updatedAt = new Date().toISOString();
  state.store.reports[state.currentDate] = deepClone(state.currentReport);
  saveStore(state.store);

  if (ev && ev.target) {
    const original = ev.target.textContent;
    ev.target.textContent = '✓ Saved';
    setTimeout(() => { ev.target.textContent = original; }, 1200);
  }
  if (state.currentView === 'preview') renderPreview();
}

/* ---------- Export JSON ---------- */
export function exportJSON() {
  // Flush current edits before exporting
  state.store.reports[state.currentDate] = deepClone(state.currentReport);
  saveStore(state.store);

  let reportCount = Object.keys(state.store.reports).length;
  let alertCount = 0, sparePartCount = 0, siteCount = 0;
  Object.values(state.store.reports).forEach((r) => {
    if (r.alerts) alertCount += r.alerts.filter((a) => a && String(a).trim()).length;
    if (r.spareParts) sparePartCount += r.spareParts.filter((p) => (p.name && p.name.trim()) || (p.qty !== '' && p.qty != null)).length;
    if (r.sites) {
      siteCount += r.sites.filter((s) =>
        (s.usableCapacity !== '' && s.usableCapacity != null) ||
        (s.cycleCount !== '' && s.cycleCount != null) ||
        (s.soh !== '' && s.soh != null) ||
        (s.todayCycle !== '' && s.todayCycle != null)
      ).length;
    }
  });

  const blob = new Blob([JSON.stringify(state.store, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const fileDate = todayISO();
  a.download = `CEO_Daily_Report_${fileDate}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  alert(
    'Export complete\n\n' +
    '• Reports exported: ' + reportCount + '\n' +
    '• Critical alerts (total): ' + alertCount + '\n' +
    '• Spare part entries: ' + sparePartCount + '\n' +
    '• Site records with data: ' + siteCount + '\n\n' +
    'File: CEO_Daily_Report_' + fileDate + '.json'
  );
}

/* ---------- Import JSON ---------- */
export function importJSON(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
      if (!data.reports) throw new Error('Missing reports');
      const choice = confirm(
        `Import ${Object.keys(data.reports).length} reports?\n\n` +
        'OK = Merge (keep existing)\n' +
        'Cancel = Replace all'
      );
      if (choice) {
        state.store.reports = { ...state.store.reports, ...data.reports };
        if (data.sitesConfig && data.sitesConfig.length) {
          state.store.sitesConfig = data.sitesConfig.map(ensureSiteDefaults);
        }
      } else {
        state.store = {
          version: VERSION,
          sitesConfig: (data.sitesConfig || DEFAULT_SITES).map(ensureSiteDefaults),
          reports: data.reports,
        };
      }
      saveStore(state.store);
      state.currentReport = loadOrInitReport(state.currentDate);
      renderEdit();
      renderPreview();
      alert('Import successful.');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    ev.target.value = '';
  };
  reader.readAsText(file);
}

/* ---------- Screenshot → clipboard ---------- */
export function takeScreenshot(ev) {
  if (state.currentView !== 'preview') setView('preview');
  const target = document.getElementById('previewDoc');
  if (!target) {
    alert('Preview not available');
    return;
  }
  if (typeof window.html2canvas !== 'function') {
    alert('Screenshot library not loaded. Please ensure internet access, then reload the page.');
    return;
  }

  const btn = ev && ev.target;
  const origText = btn ? btn.textContent : null;
  if (btn) btn.textContent = '⏳ Capturing...';

  setTimeout(() => {
    window.html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    }).then((canvas) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Screenshot failed (no blob).');
          if (btn) btn.textContent = origText;
          return;
        }
        try {
          if (!navigator.clipboard || !window.ClipboardItem) {
            throw new Error('Clipboard API not available in this browser');
          }
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          if (btn) {
            btn.textContent = '✓ Copied';
            setTimeout(() => { btn.textContent = origText; }, 1500);
          }
        } catch (clipErr) {
          console.error('Clipboard write failed:', clipErr);
          alert('Copy to clipboard failed: ' + (clipErr.message || 'unknown') +
                '\n\nTip: The browser may require HTTPS or a user gesture.');
          if (btn) btn.textContent = origText;
        }
      }, 'image/png');
    }).catch((err) => {
      console.error('Screenshot error:', err);
      alert('Screenshot failed: ' + (err && err.message ? err.message : 'unknown error'));
      if (btn) btn.textContent = origText;
    });
  }, 100);
}

/* ---------- Make Report: standalone HTML snapshot ---------- */
export async function makeReport(ev) {
  try {
    state.store.reports[state.currentDate] = deepClone(state.currentReport);

    let snapshot = JSON.stringify(state.store);
    snapshot = snapshot
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/<\/script>/gi, '<\\/script>');

    // Close any open transient UI before snapshotting HTML
    try {
      const m = document.getElementById('siteModal'); if (m) m.classList.remove('open');
      const hp = document.getElementById('historyPanel'); if (hp) hp.classList.remove('open');
      const sm = document.getElementById('settingsModal'); if (sm) sm.classList.remove('open');
      const bd = document.getElementById('backdrop'); if (bd) bd.classList.remove('open');
      const tt = document.getElementById('chartTooltip'); if (tt) tt.style.display = 'none';
    } catch (_) {}

    if (state.currentView !== 'preview') setView('preview');

    const coverImage = document.querySelector('.preview-cover img');
    if (coverImage && coverImage.src && !coverImage.src.startsWith('data:')) {
      try {
        const response = await fetch(coverImage.src, { cache: 'force-cache' });
        const blob = await response.blob();
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        coverImage.src = dataUrl;
      } catch (err) {
        console.warn('Could not inline cover image for Make Report:', err);
      }
    }

    const htmlSource = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    const tag = '<' + 'script>';
    const closeTag = '<' + '/' + 'script>';
    const snapshotScript = '\n' + tag + '\n' +
      '/* Hardcoded CEO Daily Report snapshot — generated ' + new Date().toLocaleString() + ' */\n' +
      'window.__REPORT_SNAPSHOT__ = ' + snapshot + ';\n' +
      closeTag + '\n';
    const output = htmlSource.replace('<head>', '<head>' + snapshotScript);

    const blob = new Blob([output], { type: 'text/html;charset=utf-8' });
    const filename = 'SchneiTec_CEO_Daily_Report_' + todayISO() + '.html';

    // Download locally
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    const btn = ev && ev.target;
    const origText = btn ? btn.textContent : '';

    // Check webhook upload
    const webhookUrl = localStorage.getItem('ceoDailyReportWebhookUrl');
    if (webhookUrl && webhookUrl.trim() !== '') {
      if (btn) btn.textContent = '🚀 Sending...';
      try {
        const formData = new FormData();
        formData.append('file', blob, filename);
        const resp = await fetch(webhookUrl.trim(), {
          method: 'POST',
          body: formData
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        if (btn) {
          btn.textContent = '✓ Sent to Dashboard';
          setTimeout(() => { btn.textContent = origText; }, 2000);
        }
      } catch (uploadErr) {
        console.error('Webhook upload failed:', uploadErr);
        alert('Report downloaded, but failed to send to dashboard: ' + uploadErr.message);
        if (btn) {
          btn.textContent = '❌ Send Failed';
          setTimeout(() => { btn.textContent = origText; }, 2000);
        }
      }
    } else {
      if (btn) {
        btn.textContent = '✓ Report Saved';
        setTimeout(() => { btn.textContent = origText; }, 1500);
      }
    }
  } catch (err) {
    console.error('makeReport failed:', err);
    alert('Make Report failed: ' + (err && err.message ? err.message : 'unknown'));
  }
}

/* ---------- Make Preview Report: standalone HTML snapshot containing ONLY preview ---------- */
export async function makePreviewReport(ev) {
  try {
    state.store.reports[state.currentDate] = deepClone(state.currentReport);

    let snapshot = JSON.stringify(state.store);
    snapshot = snapshot
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/<\/script>/gi, '<\\/script>');

    if (state.currentView !== 'preview') setView('preview');

    const coverImage = document.querySelector('.preview-cover img');
    if (coverImage && coverImage.src && !coverImage.src.startsWith('data:')) {
      try {
        const response = await fetch(coverImage.src, { cache: 'force-cache' });
        const blob = await response.blob();
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        coverImage.src = dataUrl;
      } catch (err) {
        console.warn('Could not inline cover image for Make Report:', err);
      }
    }

    // Clone the document to strip out UI
    const clonedHtml = document.documentElement.cloneNode(true);
    
    // Remove unwanted elements
    const toRemove = [
      '.topbar',
      '.toolbar',
      '#editView',
      '#historyPanel',
      '#siteModal',
      '#settingsModal',
      '#backdrop'
    ];
    toRemove.forEach(selector => {
      const el = clonedHtml.querySelector(selector);
      if (el) el.remove();
    });

    // Ensure preview is visible
    const pv = clonedHtml.querySelector('#previewView');
    if (pv) pv.classList.remove('hidden');

    const htmlSource = '<!DOCTYPE html>\n' + clonedHtml.outerHTML;
    const tag = '<' + 'script>';
    const closeTag = '<' + '/' + 'script>';
    const snapshotScript = '\n' + tag + '\n' +
      '/* Hardcoded CEO Daily Report snapshot (Preview-Only) — generated ' + new Date().toLocaleString() + ' */\n' +
      'window.__REPORT_SNAPSHOT__ = ' + snapshot + ';\n' +
      closeTag + '\n';
    const output = htmlSource.replace('<head>', '<head>' + snapshotScript);

    const blob = new Blob([output], { type: 'text/html;charset=utf-8' });
    const filename = 'SchneiTec_CEO_Daily_Report_Preview_' + todayISO() + '.html';

    // Download locally
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    const btn = ev && ev.target;
    const origText = btn ? btn.textContent : '';

    // Check GitHub sync
    const githubToken = localStorage.getItem('ceoDailyReportGithubToken');
    const githubRepo = localStorage.getItem('ceoDailyReportGithubRepo');
    if (githubToken && githubToken.trim() !== '' && githubRepo && githubRepo.trim() !== '') {
      if (btn) btn.textContent = '🚀 Syncing to GitHub...';
      try {
        // Base64 encode the string (handling unicode safely)
        const base64Content = btoa(unescape(encodeURIComponent(output)));
        
        // Add a timestamp to the filename so multiple reports in a day don't clash
        const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
        const ghFilename = `SchneiTec_CEO_Daily_Report_Preview_${timeStr}.html`;
        const apiUrl = `https://api.github.com/repos/${githubRepo.trim()}/contents/reports/${ghFilename}`;
        
        const payload = {
          message: `Add CEO Daily Report Preview for ${state.currentDate}`,
          content: base64Content
        };

        const resp = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken.trim()}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const errData = await resp.json();
          throw new Error(errData.message || `HTTP ${resp.status}`);
        }

        if (btn) {
          btn.textContent = '✓ Synced to GitHub';
          setTimeout(() => { btn.textContent = origText; }, 2000);
        }
      } catch (uploadErr) {
        console.error('GitHub sync failed:', uploadErr);
        alert('Preview downloaded, but failed to sync to GitHub: ' + uploadErr.message);
        if (btn) {
          btn.textContent = '❌ Sync Failed';
          setTimeout(() => { btn.textContent = origText; }, 2000);
        }
      }
    } else {
      if (btn) {
        btn.textContent = '✓ Preview Saved';
        setTimeout(() => { btn.textContent = origText; }, 1500);
      }
    }
  } catch (err) {
    console.error('makePreviewReport failed:', err);
    alert('Make Preview Report failed: ' + (err && err.message ? err.message : 'unknown'));
  }
}


/* ---------- Settings Modal ---------- */
export function openSettings() {
  const token = localStorage.getItem('ceoDailyReportGithubToken') || '';
  const repo = localStorage.getItem('ceoDailyReportGithubRepo') || '';
  const inputToken = document.getElementById('settingGithubToken');
  const inputRepo = document.getElementById('settingGithubRepo');
  
  if (inputToken) inputToken.value = token;
  if (inputRepo) inputRepo.value = repo;
  
  const bd = document.getElementById('backdrop');
  if (bd) bd.classList.add('open');
  const sm = document.getElementById('settingsModal');
  if (sm) sm.classList.add('open');
}

export function closeSettings() {
  const bd = document.getElementById('backdrop');
  if (bd) bd.classList.remove('open');
  const sm = document.getElementById('settingsModal');
  if (sm) sm.classList.remove('open');
}

export function saveSettings() {
  const inputToken = document.getElementById('settingGithubToken');
  const inputRepo = document.getElementById('settingGithubRepo');
  if (inputToken) localStorage.setItem('ceoDailyReportGithubToken', inputToken.value.trim());
  if (inputRepo) localStorage.setItem('ceoDailyReportGithubRepo', inputRepo.value.trim());
  
  closeSettings();
}
