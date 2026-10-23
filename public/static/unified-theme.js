/* =====================================================================
   Finance - unified Gershon design, behaviour half (v2.19.1, 2026-10-23)
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
   5. (v2.19.1) Demo mode fixes, all without touching app.js:
      a. "Running NaN% behind projection" - pace vs projection is now
         worked out from ARR and projected end-of-year. The demo "Paid /
         unpaid" and "Late invoices" cards no longer read 0 / 0 and 0.0%.
      b. Status badge: in demo mode it always says DEMO (some tabs used to
         flip it to "Live Data"). Outside demo mode, once any card has
         fallen back to demo data the badge stays "Demo data" instead of
         being flipped back to "Live Data" by a later tab.
      c. Invoices tab: demo mode had no sample invoice list, so it called
         the real API and logged "Error loading invoices". Sample list added.
      d. Valuation tab: demo figures were missing ARR / mid value / growth /
         churn / NRR / LTV / Rule of 40, so it showed $NaN and crashed.
      e. Reports tab: an older Reports renderer still fires on click and
         crashed ("Cannot set properties of null") after the newer one
         replaced its panel. It now writes into a hidden spare panel.
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

  // ---- 5. v2.19.1 demo-mode fixes ------------------------------------------
  var DEMO_ON = false;
  try { DEMO_ON = localStorage.getItem('demo_mode') === '1'; } catch (e) {}

  // 5a + 5d: complete the canned figures before app.js reads them.
  if (window.axios && window.axios.interceptors) {
    window.axios.interceptors.response.use(function (res) {
      try {
        var url = ((res && res.config && res.config.url) || '').split('?')[0];
        var d = res && res.data;
        if (!d || typeof d !== 'object') return res;
        if (/\/api\/(demo\/)?revenue\/metrics$/.test(url)) {
          d.calculations = d.calculations || {};
          if (typeof d.calculations.paceVsProjection !== 'number') {
            var arr = Number(d.arr) || 0, eoy = Number(d.projectedEOY) || 0;
            d.calculations.paceVsProjection = eoy > 0 ? Math.round((arr / eoy - 1) * 1000) / 10 : 0;
          }
          // Demo figures had no paid / unpaid / late counts, so the cards read 0 / 0 and 0.0%.
          if (DEMO_ON && d.paidThisMonth == null) {
            d.paidThisMonth = 38; d.unpaidThisMonth = 9; d.lateThisMonth = 4;
            if (d.collectionRate == null) d.collectionRate = 80.9;
          }
        }
        if (DEMO_ON && /\/api\/(demo\/)?valuation$/.test(url) && d.valuationMid == null) {
          var a = Number(d.arr || d.basis) || 540000, m = Number(d.multiple) || 5;
          d.arr = a; d.multiple = m;
          d.mrr = d.mrr || Math.round(a / 12);
          d.valuationLow = a * (m - 1); d.valuationMid = a * m; d.valuationHigh = a * (m + 2);
          if (typeof d.momGrowth !== 'number') d.momGrowth = 18.5;
          if (typeof d.yoyGrowth !== 'number') d.yoyGrowth = 52.3;
          if (typeof d.monthlyChurnRate !== 'number') d.monthlyChurnRate = 1.8;
          if (typeof d.nrr !== 'number') d.nrr = 112.4;
          if (typeof d.collectionRate !== 'number') d.collectionRate = 96;
          if (typeof d.ltv !== 'number') d.ltv = Math.round((a / 12 / 47) / 0.018);
          if (typeof d.rule40 !== 'number') d.rule40 = 70;
        }
      } catch (e) { /* never block a response */ }
      return res;
    });
  }

  // 5c: sample invoice list (and the right version on /api/health) in demo mode.
  function demoInvoices(status) {
    var names = ['Microsoft Azure Division', 'Accenture Consulting', 'Salesforce Inc.', 'Goldman Sachs',
      'Cisco Systems', 'IBM Global Services', 'BlackRock Asset Management', 'Stripe Payments',
      'Snowflake Computing', 'Shopify Commerce', 'Atlassian Software', 'HubSpot Inc.'];
    var now = Date.now(), dayMs = 86400000, out = [];
    for (var i = 0; i < 24; i++) {
      var total = 2400 + ((i * 3779) % 14000);
      var st = i % 6 === 5 ? 'DRAFT' : (i % 3 === 0 ? 'PAID' : 'AUTHORISED');
      var issued = now - (6 + i * 9) * dayMs;
      var due = issued + 30 * dayMs;
      out.push({
        InvoiceID: 'demo-inv-' + i, InvoiceNumber: 'INV-' + (2401 + i),
        Contact: { Name: names[i % names.length] },
        Date: new Date(issued).toISOString().slice(0, 10),
        DueDate: new Date(due).toISOString().slice(0, 10),
        Total: total, AmountDue: st === 'PAID' ? 0 : total, AmountPaid: st === 'PAID' ? total : 0,
        Status: st
      });
    }
    return status ? out.filter(function (x) { return x.Status === status; }) : out;
  }
  if (DEMO_ON && window.axios && window.axios.interceptors) {
    // Registered after app.js's demo interceptor, so axios runs this one first.
    window.axios.interceptors.request.use(function (config) {
      try {
        var raw = config.url || '';
        var path = raw.split('?')[0];
        var data = null;
        if (path === '/api/invoices') {
          var q = new URLSearchParams(raw.split('?')[1] || '');
          data = demoInvoices(q.get('status'));
        } else if (path === '/api/health') {
          data = { status: 'ok', version: '2.19.1', timestamp: new Date().toISOString(), server: 'demo-mode', fixes: [] };
        }
        if (data !== null) {
          config.adapter = function () {
            return Promise.resolve({ data: data, status: 200, statusText: 'OK',
              headers: { 'content-type': 'application/json' }, config: config, request: {} });
          };
        }
      } catch (e) { /* fall through to the normal request */ }
      return config;
    });
  }

  // 5b: keep the status badge honest.
  function paintDemoBadge() {
    var ind = document.getElementById('liveIndicator');
    var txt = document.getElementById('liveIndicatorText');
    if (!ind || !txt) return;
    ind.className = 'flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-600 text-white';
    var dot = ind.querySelector('span');
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-purple-200 mr-2';
    txt.textContent = 'DEMO';
    ind.title = 'Demo mode - all numbers are sample data.';
    var pill = document.getElementById('signinAgainPill');
    if (pill) pill.remove();
  }
  var origLive = window.updateLiveIndicator;
  var origDemo = window.markDemoActive;
  if (typeof origLive === 'function') {
    window.updateLiveIndicator = function (isLive, lastRefreshISO) {
      if (DEMO_ON) {
        origLive(false, lastRefreshISO);   // keeps the "Last synced" time
        paintDemoBadge();
        return;
      }
      if (window.__hasDemo && typeof origDemo === 'function') {
        origLive(false, lastRefreshISO);
        origDemo('kept after a later live call');
        return;
      }
      origLive(isLive, lastRefreshISO);
    };
  }
  if (DEMO_ON && typeof origDemo === 'function') {
    window.markDemoActive = function () { window.__hasDemo = true; paintDemoBadge(); };
  }

  // 5e: spare hidden panel for the older Reports renderer.
  function addReportsSink() {
    if (document.getElementById('gu-legacy-reports-sink')) return;
    var sink = document.createElement('div');
    sink.id = 'gu-legacy-reports-sink';
    sink.hidden = true;
    sink.setAttribute('aria-hidden', 'true');
    sink.innerHTML = '<select id="reports-role"><option value="cfo" selected>cfo</option></select>' +
      '<p id="reports-narrative"></p><div id="reports-widgets"></div>';
    document.body.appendChild(sink);   // after #tab-reports, so the real panel wins while it exists
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addReportsSink);
  else addReportsSink();

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
