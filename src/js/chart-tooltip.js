/* =============================================================================
   CHART TOOLTIP · Hover interactions for charts
   ---------------------------------------------------------------------------
   Attaches mousemove handlers to each chart panel. For line charts, snaps
   to the nearest date and shows all series values at that x. For bars,
   falls back to the rect's data-info attribute.
   ============================================================================= */

import { __chartState } from './charts.js';
import { escapeHtml } from './utils.js';

export function attachChartTooltips() {
  const tooltip = document.getElementById('chartTooltip');
  if (!tooltip) return;

  document.querySelectorAll('.chart-panel').forEach((panel) => {
    if (panel.dataset.tooltipWired) return;
    panel.dataset.tooltipWired = '1';

    panel.addEventListener('mousemove', (e) => {
      // Line chart: snap via invisible overlay rect
      const overlay = e.target && e.target.closest && e.target.closest('[data-chart-key]');
      if (overlay) {
        const key = overlay.dataset.chartKey || overlay.getAttribute('data-chart-key');
        const st = __chartState[key];
        if (st) {
          const svg = overlay.ownerSVGElement;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const m = svg.getScreenCTM();
          if (!m) return;
          const sp = pt.matrixTransform(m.inverse());

          // Nearest date in x-axis domain
          let nearest = st.xs[0];
          let minDist = Infinity;
          st.xs.forEach((d) => {
            const t = new Date(d + 'T00:00:00').getTime();
            const x = st.pad.left + ((t - st.xMin) / st.xRange) * st.innerW;
            const dist = Math.abs(sp.x - x);
            if (dist < minDist) {
              minDist = dist;
              nearest = d;
            }
          });

          const values = st.dateMap[nearest] || [];
          if (values.length) {
            let html = `<div style="font-weight:700;margin-bottom:4px;color:#fbbf24">${nearest}</div>`;
            values.forEach((v) => {
              const valStr = Number(v.value).toFixed(v.value > 10 ? 2 : 3);
              const unit = st.yLabel ? ' ' + st.yLabel : '';
              html += `<div style="display:flex;align-items:center;gap:6px;margin-top:2px">` +
                      `<span style="display:inline-block;width:10px;height:3px;background:${v.color};border-radius:1px"></span>` +
                      `<span>${escapeHtml(v.label)}: <b>${valStr}${unit}</b></span></div>`;
            });
            tooltip.innerHTML = html;
            tooltip.style.display = 'block';
            const rect = panel.getBoundingClientRect();
            tooltip.style.left = e.clientX - rect.left + panel.offsetLeft + 'px';
            tooltip.style.top  = e.clientY - rect.top  + panel.offsetTop  + 'px';
            return;
          }
        }
      }

      // Bar chart fallback: single data-info attr
      const info = e.target.getAttribute && e.target.getAttribute('data-info');
      if (info) {
        tooltip.innerHTML = info.replace(/·/g, '<b style="color:#fbbf24">·</b>');
        tooltip.style.display = 'block';
        const rect = panel.getBoundingClientRect();
        tooltip.style.left = e.clientX - rect.left + panel.offsetLeft + 'px';
        tooltip.style.top  = e.clientY - rect.top  + panel.offsetTop  + 'px';
        return;
      }

      tooltip.style.display = 'none';
    });

    panel.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}
