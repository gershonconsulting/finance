/* =====================================================================
   Finance - unified Gershon design, behaviour half (v2.19.0, 2026-10-23)
   Loaded right after app.js. Kept separate so the 240 KB app.js is not
   rewritten for a colour change.
   1. Charts: the old brand blues / indigo become Gershon red #CC3333.
      Amber "best month", grey "draft", orange "awaiting" and red
      "overdue" series are left alone (they carry meaning).
   2. Charts that sit in a fixed-height .chart-box fill that box instead
      of keeping a 2:1 ratio (the Invoice Status chart was a sliver on a
      phone).
   3. Demo mode banner: push the page down by the banner's real height
      (it wraps to two lines on a phone and used to cover the top bar).
   4. Demo mode: /api/revenue/metrics canned data had no `calculations`
      block, so Avg Revenue/Client crashed. Fill it from the flat field.
   ===================================================================== */
(function () {
  'use strict';

  // ---- 1 + 2. Chart.js colour + sizing plugin ----------------------------
  var MAP = {
    '#2563eb': '#CC3333', '#3b82f6': '#CC3333', '#1d4ed8': '#a8281f',
    '#6366f1': '#CC3333', '#4f46e5': '#a8281f', '#7c3aed': '#CC3333', '#8b5cf6': '#CC3333',
    'rgb(59, 130, 246)': 'rgb(204, 51, 51)', 'rgb(37, 99, 235)': 'rgb(204, 51, 51)',
    'rgb(99, 102, 241)': 'rgb(110, 110, 115)'   // dashed "projected" line -> neutral grey
  };
  var RGBA = /^rgba\(\s*(59\s*,\s*130\s*,\s*246|37\s*,\s*99\s*,\s*235|99\s*,\s*102\s*,\s*241)\s*,\s*([0-9.]+)\s*\)$/i;

  function swap(c) {
    if (typeof c !== 'string') return c;
    var k = c.trim().toLowerCase();
    if (MAP[k]) return MAP[k];
    var m = k.match(RGBA);
    if (m) return 'rgba(204, 51, 51, ' + m[2] + ')';
    return c;
  }
  function swapAny(v) { return Array.isArray(v) ? v.map(swap) : swap(v); }

  function recolour(chart) {
    var ds = (chart.config && chart.config.data && chart.config.data.datasets) || [];
    ds.forEach(function (d) {
      ['borderColor', 'backgroundColor', 'pointBackgroundColor', 'pointBorderColor'].forEach(function (p) {
        if (d[p] !== undefined) d[p] = swapAny(d[p]);
      });
    });
    try {
      var scales = chart.options && chart.options.scales;
      if (scales) Object.keys(scales).forEach(function (id) {
        var t = scales[id] && scales[id].title;
        if (t && t.color) t.color = swap(t.color);
      });
    } catch (e) { /* option proxies can refuse writes - colours above still apply */ }
  }

  function register() {
    if (!window.Chart || !window.Chart.register) return;
    window.Chart.register({
      id: 'gershonUnified',
      beforeInit: function (chart) {
        var box = chart.canvas && chart.canvas.parentNode;
        if (box && box.classList && box.classList.contains('chart-box')) {
          chart.options.maintainAspectRatio = false;
        }
        recolour(chart);
      },
      beforeUpdate: recolour
    });
  }
  register();

  // ---- 4. Demo-mode data gap ---------------------------------------------
  if (window.axios && window.axios.interceptors) {
    window.axios.interceptors.response.use(function (res) {
      try {
        var url = (res && res.config && res.config.url) || '';
        var d = res && res.data;
        if (/\/api\/(demo\/)?revenue\/metrics/.test(url) && d && typeof d === 'object' && !d.calculations) {
          d.calculations = { avgRevenuePerClient: d.avgRevenuePerClient || 0 };
        }
      } catch (e) { /* never block a response */ }
      return res;
    });
  }

  // ---- 3. Demo banner height ---------------------------------------------
  function fitBanner() {
    var b = document.getElementById('demo-mode-banner');
    if (!b) return;
    b.style.padding = '8px 16px';
    document.body.style.paddingTop = b.offsetHeight + 'px';
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(fitBanner, 0); });
  window.addEventListener('resize', fitBanner);
})();
