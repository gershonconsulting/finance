/* =============================================================================
 * v2.21.0 — Account overview
 *   Dashboard  : full-width cockpit of what is going on with the account
 *   Invoices   : opens on the invoices waiting for payment, summary on top
 *   Clients    : active / inactive clients, one row each, late colour rule
 *   Reports    : weekly (Mondays) + monthly (1st) e-mail reports — status,
 *                preview and send-now
 * One request (/api/overview) feeds the first three screens.
 * ============================================================================= */
(function () {
  'use strict';
  const RED = '#CC3333';
  const LV = {
    green:  { fg: '#15803d', bg: '#dcfce7', bd: '#86efac' },
    orange: { fg: '#b45309', bg: '#ffedd5', bd: '#fdba74' },
    red:    { fg: '#b91c1c', bg: '#fee2e2', bd: '#fca5a5' },
    blue:   { fg: '#0369a1', bg: '#e0f2fe', bd: '#7dd3fc' },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let CUR = 'USD';
  const money = (n) => (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: CUR, maximumFractionDigits: 0 }).format(n);
  const moneyK = (n) => { if (n == null || isNaN(n)) return '—'; const a = Math.abs(n); return a >= 100000 ? (n < 0 ? '-' : '') + '$' + Math.round(a / 1000) + 'k' : money(n); };
  const fdate = (d) => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';
  const fdateShort = (d) => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';
  const link = (name, id) => window.clientLink ? window.clientLink(name, id) : esc(name);
  const pill = (level, text) => { const c = LV[level] || LV.blue; return `<span class="ov-pill" style="color:${c.fg};background:${c.bg};border-color:${c.bd}">${esc(text)}</span>`; };
  const lateTxt = (days) => days <= 0 ? 'On time' : days < 30 ? `${days} d` : `${(days / 30.44).toFixed(1)} mo`;
  const deltaHtml = (cur, prev, goodUp = true) => {
    if (!prev && !cur) return '<span class="ov-muted">—</span>';
    const d = cur - prev; if (Math.abs(d) < 0.5) return '<span class="ov-muted">no change</span>';
    const up = d > 0, good = up === goodUp;
    const pct = prev ? ` ${up ? '+' : ''}${Math.round((d / prev) * 100)}%` : '';
    return `<span style="color:${good ? '#15803d' : '#b91c1c'};font-weight:600">${up ? '▲' : '▼'} ${moneyK(Math.abs(d))}${pct}</span>`;
  };

  // ---------------------------------------------------------------------------
  // Session rotation: the server hands back a refreshed Xero session on
  // X-Session-Refresh; keep it so the browser never holds a dead token.
  // ---------------------------------------------------------------------------
  function keep(h) { if (h && typeof h === 'string' && h.length > 20) { try { localStorage.setItem('xero_session', h); } catch (e) {} } }
  if (window.axios) {
    window.axios.interceptors.response.use((r) => { keep(r?.headers?.['x-session-refresh']); return r; }, (e) => { keep(e?.response?.headers?.['x-session-refresh']); return Promise.reject(e); });
  }
  const __f = window.fetch.bind(window);
  window.fetch = async function (input, opts) { const r = await __f(input, opts); try { keep(r.headers.get('X-Session-Refresh')); } catch (e) {} return r; };

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  let OV = null, loading = null;
  const isDemo = () => { try { return localStorage.getItem('demo_mode') === '1'; } catch (e) { return false; } };
  async function getOverview(force) {
    if (OV && !force) return OV;
    if (loading && !force) return loading;
    loading = (async () => {
      if (isDemo()) { OV = demoOverview(); return OV; }
      const r = await axios.get('/api/overview');
      OV = r.data; CUR = OV.currency || 'USD';
      return OV;
    })();
    try { return await loading; } finally { loading = null; }
  }
  window.ovRefresh = async function () { await getOverview(true); renderAll(); };

  function loadingBox(msg) { return `<div class="ov-card" style="padding:40px;text-align:center;color:#6e6e73"><i class="fas fa-spinner fa-spin mr-2" style="color:${RED}"></i>${esc(msg || 'Reading your Xero ledger…')}</div>`; }
  function errorBox(e) {
    const msg = e?.response?.status === 401 ? 'Your Xero session has expired. Click Logout in the sidebar and sign in again.' : (e?.response?.data?.error || e?.message || 'Could not read Xero');
    return `<div class="ov-card" style="padding:18px;border-left:4px solid #b91c1c;color:#7f1d1d">${esc(msg)} <button class="ov-btn" onclick="ovRefresh()">Retry</button></div>`;
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------------------------
  let chart = null;
  async function renderDashboard() {
    const el = document.getElementById('ovDashboard'); if (!el) return;
    if (!OV) el.innerHTML = loadingBox();
    let o; try { o = await getOverview(); } catch (e) { el.innerHTML = errorBox(e); return; }
    const k = o.kpis;
    const monthName = new Date(k.thisMonth + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    const lastName = new Date(k.lastMonth + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const alerts = (o.alerts || []).slice(0, 6).map(a => `<div class="ov-alert ov-alert--${a.level}"><i class="fas ${a.level === 'info' ? 'fa-circle-info' : 'fa-triangle-exclamation'}"></i>${esc(a.text)}</div>`).join('');
    const debtors = o.clients.filter(c => c.owed > 0.005).sort((a, b) => b.oldestOverdueDays - a.oldestOverdueDays || b.owed - a.owed);
    const agingTotal = o.aging.reduce((s, a) => s + a.amount, 0) || 1;
    const agingColors = { notdue: '#0ea5e9', d1_30: '#22c55e', d30_60: '#f59e0b', d60_90: '#ea580c', d90: '#dc2626' };

    el.innerHTML = `
      <div class="ov-head">
        <div><div class="ov-eyebrow">Account overview · ${esc(fdate(o.today))}</div>
          <div class="ov-title">${esc(monthName)}: ${money(k.invoicedThisMonth)} invoiced, ${money(k.collectedThisMonth)} collected — ${money(k.outstanding)} owed to us</div></div>
        <div class="ov-head-actions"><span class="ov-muted" style="font-size:12px">Updated ${new Date(o.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button class="ov-btn" onclick="ovRefresh()"><i class="fas fa-rotate"></i> Refresh</button></div>
      </div>
      ${alerts ? `<div class="ov-alerts">${alerts}</div>` : ''}
      <div class="ov-kpis">
        ${kpi('Collected · ' + monthName, money(k.collectedThisMonth), `${lastName}: ${money(k.collectedLastMonth)}`, '#15803d')}
        ${kpi('Invoiced · ' + monthName, money(k.invoicedThisMonth), `${k.invoicesThisMonth} invoices · ${lastName}: ${money(k.invoicedLastMonth)}`, RED)}
        ${kpi('Owed to us', money(k.outstanding), `${k.outstandingCount} open invoices`, '#0369a1')}
        ${kpi('Overdue', money(k.overdue), `${k.overdueCount} invoices · ${k.overdueShare}% of owed`, '#b91c1c')}
        ${kpi('Active clients', String(k.activeClients), `≈ ${money(k.recurringMonthly)} / month recurring`, '#6d28d9')}
        ${kpi('Days to get paid', k.avgDaysToPay90 == null ? '—' : k.avgDaysToPay90 + ' days', `DSO ${k.dso ?? '—'} d · collection ${k.collectionRate ?? '—'}%`, '#b45309')}
      </div>
      <div class="ov-grid ov-grid--main">
        <div class="ov-card">
          <div class="ov-card-h"><span>Invoiced vs collected — last 13 months</span><span class="ov-muted">12-month total ${money(k.ttmInvoiced)} invoiced · ${money(k.ttmCollected)} collected</span></div>
          <div style="position:relative;height:290px"><canvas id="ovChart"></canvas></div>
        </div>
        <div class="ov-card">
          <div class="ov-card-h"><span>Who owes us</span><span class="ov-muted">${money(k.outstanding)}</span></div>
          <div class="ov-list">${debtors.length ? debtors.slice(0, 9).map(c => `
            <div class="ov-row"><div class="ov-row-main">${link(c.name, c.contactId)}<div class="ov-muted" style="font-size:11px">${c.overdueCount ? `${c.overdueCount} overdue · ` : ''}${c.active ? 'active' : 'inactive'} · payer ${c.paymentGrade}</div></div>
              <div style="text-align:right"><div class="ov-num">${money(c.owed)}</div>${pill(c.lateLevel, lateTxt(c.oldestOverdueDays))}</div></div>`).join('') : '<div class="ov-muted" style="padding:10px 0">Nobody owes us anything.</div>'}
          </div>
          <div class="ov-legend">${pill('green', 'under 1 month')} ${pill('orange', '1–3 months')} ${pill('red', '3+ months')}</div>
        </div>
      </div>
      <div class="ov-grid ov-grid--3">
        <div class="ov-card">
          <div class="ov-card-h"><span>Ageing of what is owed</span><a class="ov-a" data-goto="invoices">Invoices →</a></div>
          <div class="ov-stack">${o.aging.map(a => a.amount > 0 ? `<span title="${esc(a.label)}: ${money(a.amount)}" style="width:${(a.amount / agingTotal) * 100}%;background:${agingColors[a.key]}"></span>` : '').join('')}</div>
          ${o.aging.map(a => `<div class="ov-row ov-row--tight"><div><span class="ov-dot" style="background:${agingColors[a.key]}"></span>${esc(a.label)} <span class="ov-muted">(${a.count})</span></div><div class="ov-num">${money(a.amount)}</div></div>`).join('')}
        </div>
        <div class="ov-card">
          <div class="ov-card-h"><span>Latest payments received</span></div>
          ${o.recentPayments.length ? o.recentPayments.slice(0, 8).map(p => `<div class="ov-row ov-row--tight"><div><span class="ov-muted" style="display:inline-block;width:52px">${fdateShort(p.date)}</span>${esc(p.client)}</div><div class="ov-num" style="color:#15803d">${money(p.amount)}</div></div>`).join('') : '<div class="ov-muted">No payments recorded yet.</div>'}
        </div>
        <div class="ov-card">
          <div class="ov-card-h"><span>Coming due — next 30 days</span><span class="ov-muted">${money(o.upcomingDue.reduce((s, x) => s + x.amountDue, 0))}</span></div>
          ${o.upcomingDue.length ? o.upcomingDue.slice(0, 8).map(x => `<div class="ov-row ov-row--tight"><div><span class="ov-muted" style="display:inline-block;width:52px">${fdateShort(x.dueDate)}</span>${esc(x.client)}</div><div class="ov-num">${money(x.amountDue)}</div></div>`).join('') : '<div class="ov-muted">Nothing falls due in the next 30 days.</div>'}
        </div>
      </div>
      <div class="ov-kpis ov-kpis--small">
        ${kpi('Invoiced ' + k.thisMonth.slice(0, 4) + ' to date', money(k.ytdInvoiced), '', RED, true)}
        ${kpi('Collected ' + k.thisMonth.slice(0, 4) + ' to date', money(k.ytdCollected), '', '#15803d', true)}
        ${kpi('Average month (12 mo)', money(k.avgMonthlyInvoiced), 'invoiced', '#0369a1', true)}
        ${kpi('Largest client', k.topClientShare + '%', 'of 12-month billing', '#b45309', true)}
        ${kpi('Inactive clients', String(k.inactiveClients), 'no invoice in 2 months', '#64748b', true)}
        ${kpi('Drafts not sent', String(o.drafts.count), money(o.drafts.amount), '#64748b', true)}
      </div>
      <div class="ov-foot">Invoiced = invoices dated in the month (drafts and voids excluded). Collected = ${o.collectedSource === 'payments' ? 'payments recorded in Xero' : 'invoices fully paid in the month'}. Late colour: under 1 month green, 1–3 months orange, 3 months or more red.</div>`;

    el.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', () => document.querySelector(`.tab-button[data-tab="${a.dataset.goto}"]`)?.click()));
    drawChart(o);
  }
  function kpi(label, value, sub, color, small) {
    return `<div class="ov-kpi${small ? ' ov-kpi--small' : ''}" style="--c:${color}"><div class="ov-kpi-l">${esc(label)}</div><div class="ov-kpi-v">${esc(value)}</div>${sub ? `<div class="ov-kpi-s">${esc(sub)}</div>` : ''}</div>`;
  }
  function drawChart(o) {
    const cv = document.getElementById('ovChart'); if (!cv || !window.Chart) return;
    if (chart) { try { chart.destroy(); } catch (e) {} }
    chart = new Chart(cv, {
      type: 'bar',
      data: { labels: o.monthly.map(m => m.label), datasets: [
        { label: 'Invoiced', data: o.monthly.map(m => m.invoiced), backgroundColor: '#CC3333', borderRadius: 4, maxBarThickness: 34 },
        { label: 'Collected', data: o.monthly.map(m => m.collected), backgroundColor: '#94a3b8', borderRadius: 4, maxBarThickness: 34 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` } } },
        scales: { y: { ticks: { callback: (v) => moneyK(v) }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } },
    });
  }

  // ---------------------------------------------------------------------------
  // INVOICES — default view: waiting for payment
  // ---------------------------------------------------------------------------
  let invFilter = 'waiting', invSort = { k: 'daysOverdue', d: -1 };
  async function renderInvoicesSummary() {
    const el = document.getElementById('ovInvoicesSummary'); if (!el) return;
    if (!OV) el.innerHTML = loadingBox();
    let o; try { o = await getOverview(); } catch (e) { el.innerHTML = errorBox(e); return; }
    const open = o.openInvoices, od = open.filter(x => x.daysOverdue > 0), notDue = open.filter(x => x.daysOverdue <= 0);
    const due7 = notDue.filter(x => x.daysOverdue >= -7);
    const oldest = od[0];
    const avgLate = od.length ? Math.round(od.reduce((s, x) => s + x.daysOverdue, 0) / od.length) : 0;
    const tot = open.reduce((s, x) => s + x.amountDue, 0) || 1;
    const col = { notdue: '#0ea5e9', d1_30: '#22c55e', d30_60: '#f59e0b', d60_90: '#ea580c', d90: '#dc2626' };
    el.innerHTML = `
      <div class="ov-kpis">
        ${kpi('Waiting for payment', money(o.kpis.outstanding), `${open.length} invoices`, '#0369a1')}
        ${kpi('Overdue', money(od.reduce((s, x) => s + x.amountDue, 0)), `${od.length} invoices`, '#b91c1c')}
        ${kpi('Not yet due', money(notDue.reduce((s, x) => s + x.amountDue, 0)), `${notDue.length} invoices`, '#15803d')}
        ${kpi('Due in the next 7 days', money(due7.reduce((s, x) => s + x.amountDue, 0)), `${due7.length} invoices`, '#b45309')}
        ${kpi('Oldest overdue', oldest ? lateTxt(oldest.daysOverdue) : '—', oldest ? `${oldest.client} · ${money(oldest.amountDue)}` : 'nothing overdue', '#b91c1c')}
        ${kpi('Average lateness', od.length ? avgLate + ' days' : '—', 'across overdue invoices', '#6d28d9')}
      </div>
      <div class="ov-card" style="margin-bottom:14px">
        <div class="ov-stack" style="height:14px">${o.aging.map(a => a.amount > 0 ? `<span title="${esc(a.label)}: ${money(a.amount)}" style="width:${(a.amount / tot) * 100}%;background:${col[a.key]}"></span>` : '').join('')}</div>
        <div class="ov-aging-legend">${o.aging.map(a => `<span><span class="ov-dot" style="background:${col[a.key]}"></span>${esc(a.label)} <strong>${money(a.amount)}</strong> <span class="ov-muted">(${a.count})</span></span>`).join('')}</div>
      </div>`;
  }
  window.ovShowWaitingInvoices = async function (filter) {
    invFilter = filter || 'waiting';
    document.querySelectorAll('[data-inv-filter]').forEach(b => b.classList.toggle('ov-chip--on', b.dataset.invFilter === invFilter));
    const listEl = document.getElementById('invoiceList'); if (!listEl) return;
    if (invFilter === 'draft') return window.loadInvoices && window.loadInvoices('DRAFT');
    if (invFilter === 'paid') return window.loadInvoices && window.loadInvoices('PAID');
    if (invFilter === 'all') return window.loadInvoices && window.loadInvoices();
    if (!OV) listEl.innerHTML = loadingBox();
    let o; try { o = await getOverview(); } catch (e) { listEl.innerHTML = errorBox(e); return; }
    let rows = o.openInvoices.slice();
    if (invFilter === 'overdue') rows = rows.filter(x => x.daysOverdue > 0);
    const k = invSort.k, d = invSort.d;
    rows.sort((a, b) => { const x = a[k], y = b[k]; return (typeof x === 'number' ? x - y : String(x || '').localeCompare(String(y || ''))) * d; });
    const th = (key, label, right) => `<th data-sort="${key}" class="${right ? 'r' : ''}">${label}${invSort.k === key ? (invSort.d > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    listEl.innerHTML = rows.length ? `
      <table class="ov-table"><thead><tr>${th('number', 'Invoice')}${th('client', 'Client')}${th('date', 'Issued')}${th('dueDate', 'Due')}${th('total', 'Total', 1)}${th('amountDue', 'Still owed', 1)}${th('daysOverdue', 'Late', 1)}</tr></thead>
      <tbody>${rows.map(x => `<tr><td><strong>${esc(x.number)}</strong>${x.reference ? `<div class="ov-muted" style="font-size:11px">${esc(x.reference)}</div>` : ''}</td><td>${link(x.client, x.contactId)}</td><td>${fdate(x.date)}</td><td>${fdate(x.dueDate)}</td><td class="r">${money(x.total)}</td><td class="r"><strong>${money(x.amountDue)}</strong></td>
        <td class="r">${x.daysOverdue > 0 ? pill(x.lateLevel, lateTxt(x.daysOverdue)) : pill('blue', x.daysOverdue === 0 ? 'Due today' : `Due in ${-x.daysOverdue} d`)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">${rows.length} invoices</td><td class="r">${money(rows.reduce((s, x) => s + x.total, 0))}</td><td class="r"><strong>${money(rows.reduce((s, x) => s + x.amountDue, 0))}</strong></td><td></td></tr></tfoot></table>`
      : '<p class="ov-muted" style="text-align:center;padding:30px">No invoice is waiting for payment. 🎉</p>';
    listEl.querySelectorAll('th[data-sort]').forEach(h => h.addEventListener('click', () => { const key = h.dataset.sort; invSort = { k: key, d: invSort.k === key ? -invSort.d : (key === 'daysOverdue' || key === 'amountDue' || key === 'total' ? -1 : 1) }; ovShowWaitingInvoices(invFilter); }));
  };

  // ---------------------------------------------------------------------------
  // CLIENTS — active / inactive table
  // ---------------------------------------------------------------------------
  let cliView = 'active', cliSort = { k: 'avgPerMonth', d: -1 }, cliQ = '';
  async function renderClients() {
    const el = document.getElementById('ovClients'); if (!el) return;
    if (!OV) el.innerHTML = loadingBox();
    let o; try { o = await getOverview(); } catch (e) { el.innerHTML = errorBox(e); return; }
    const act = o.clients.filter(c => c.active), ina = o.clients.filter(c => !c.active);
    let rows = cliView === 'active' ? act : cliView === 'inactive' ? ina : o.clients.slice();
    if (cliQ) rows = rows.filter(c => c.name.toLowerCase().includes(cliQ.toLowerCase()) || String(c.clientKey || '').includes(cliQ));
    const k = cliSort.k, d = cliSort.d;
    const gradeN = { A: 1, B: 2, C: 3, D: 4, '—': 0 };
    rows = rows.slice().sort((a, b) => { let x = a[k], y = b[k]; if (k === 'paymentGrade') { x = gradeN[x]; y = gradeN[y]; } if (x == null) x = -1; if (y == null) y = -1; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * d; });
    const sum = (f) => rows.reduce((s, c) => s + (c[f] || 0), 0);
    const th = (key, label, cls, title) => `<th data-sort="${key}" class="${cls || ''}"${title ? ` title="${esc(title)}"` : ''}>${label}${cliSort.k === key ? (cliSort.d > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const gradeColor = { A: 'green', B: 'blue', C: 'orange', D: 'red' };
    const actOwed = act.reduce((s, c) => s + c.owed, 0), actOver = act.reduce((s, c) => s + c.overdue, 0);
    el.innerHTML = `
      <div class="ov-kpis">
        ${kpi('Active clients', String(act.length), 'invoiced in the last 2 months', '#6d28d9')}
        ${kpi('Recurring per month', money(act.reduce((s, c) => s + c.avgPerMonth, 0)), 'sum of their monthly average', RED)}
        ${kpi('Active clients owe us', money(actOwed), `${money(actOver)} overdue`, '#0369a1')}
        ${kpi('Late 1–3 months', String(act.filter(c => c.lateLevel === 'orange').length), 'active clients in orange', '#b45309')}
        ${kpi('Late 3+ months', String(act.filter(c => c.lateLevel === 'red').length), 'active clients in red', '#b91c1c')}
        ${kpi('Inactive clients', String(ina.length), ina.filter(c => c.owed > 0).length ? `${ina.filter(c => c.owed > 0).length} still owe ${money(ina.reduce((s, c) => s + c.owed, 0))}` : 'nothing owed', '#64748b')}
      </div>
      <div class="ov-card" style="padding:0">
        <div class="ov-toolbar">
          <div class="ov-seg">
            <button data-cv="active" class="${cliView === 'active' ? 'on' : ''}">Active <b>${act.length}</b></button>
            <button data-cv="inactive" class="${cliView === 'inactive' ? 'on' : ''}">Inactive <b>${ina.length}</b></button>
            <button data-cv="all" class="${cliView === 'all' ? 'on' : ''}">All <b>${o.clients.length}</b></button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="ovCliSearch" class="ov-input" placeholder="Search client or #" value="${esc(cliQ)}">
            <button class="ov-btn" onclick="ovExportClients()"><i class="fas fa-download"></i> CSV</button>
            <button class="ov-btn" onclick="ovRefresh()"><i class="fas fa-rotate"></i></button>
          </div>
        </div>
        <div style="overflow-x:auto">
        <table class="ov-table ov-table--clients"><thead><tr>
          ${th('name', 'Client')}${th('monthsTogether', 'Months together', 'c', 'From the first invoice to this month')}
          ${th('invoicesPaid', 'Invoices paid', 'c')}${th('totalPaid', 'Total paid', 'r')}${th('avgPerMonth', 'Avg / month', 'r', 'Total invoiced ÷ months billed')}
          ${th('paymentGrade', 'How they pay', '', 'A on time · B a little late · C often late · D very late')}${th('owed', 'Owes us', 'r')}${th('overdue', 'Overdue', 'r')}
          ${th('oldestOverdueDays', 'Months late', 'c', 'Oldest unpaid invoice past its due date')}
        </tr></thead><tbody>
        ${rows.map(c => `<tr class="ov-lvl-${c.lateLevel}">
          <td><div class="ov-cname">${link(c.name, c.contactId)}</div><div class="ov-muted" style="font-size:11px">${c.clientKey ? '#' + esc(c.clientKey) + ' · ' : ''}since ${fdate(c.firstInvoice)}${c.active ? '' : ' · last invoice ' + fdate(c.lastInvoice)}${c.lastPayment ? ' · last paid ' + fdate(c.lastPayment) : ''}</div></td>
          <td class="c"><strong>${c.monthsTogether}</strong><div class="ov-muted" style="font-size:11px">${c.monthsBilled} billed</div></td>
          <td class="c">${c.invoicesPaid}<span class="ov-muted"> / ${c.invoiceCount}</span></td>
          <td class="r">${money(c.totalPaid)}<div class="ov-muted" style="font-size:11px">of ${money(c.totalInvoiced)}</div></td>
          <td class="r"><strong>${money(c.avgPerMonth)}</strong></td>
          <td>${pill(gradeColor[c.paymentGrade] || 'blue', c.paymentGrade)} <span style="font-size:12px">${esc(c.paymentLabel)}</span>
            <div class="ov-muted" style="font-size:11px;white-space:nowrap">${c.avgDaysToPay != null ? `pays in ${c.avgDaysToPay} d` : ''}${c.onTimeRate != null ? ` · ${Math.round(c.onTimeRate * 100)}% on time` : ''}</div></td>
          <td class="r"><strong>${money(c.owed)}</strong></td>
          <td class="r" style="color:${c.overdue > 0 ? '#b91c1c' : 'inherit'}">${money(c.overdue)}${c.overdueCount ? `<div class="ov-muted" style="font-size:11px">${c.overdueCount} invoice${c.overdueCount > 1 ? 's' : ''}</div>` : ''}</td>
          <td class="c">${pill(c.lateLevel, c.oldestOverdueDays > 0 ? c.monthsLate.toFixed(1) + ' mo' : 'On time')}</td>
        </tr>`).join('') || `<tr><td colspan="9" class="ov-muted" style="text-align:center;padding:24px">No clients match.</td></tr>`}
        </tbody><tfoot><tr><td>${rows.length} clients</td><td></td><td></td><td class="r">${money(sum('totalPaid'))}</td><td class="r">${money(sum('avgPerMonth'))}</td><td></td><td class="r">${money(sum('owed'))}</td><td class="r">${money(sum('overdue'))}</td><td></td></tr></tfoot></table>
        </div>
        <div class="ov-legend" style="padding:10px 14px">Months late: ${pill('green', 'under 1 month')} ${pill('orange', '1 to 3 months')} ${pill('red', '3 months or more')} · Active = invoiced in the last 2 months, or an invoice not yet due. Click a client for the full profile.</div>
      </div>`;
    el.querySelectorAll('[data-cv]').forEach(b => b.addEventListener('click', () => { cliView = b.dataset.cv; renderClients(); }));
    el.querySelectorAll('th[data-sort]').forEach(h => h.addEventListener('click', () => { const key = h.dataset.sort; cliSort = { k: key, d: cliSort.k === key ? -cliSort.d : (key === 'name' || key === 'paymentGrade' ? 1 : -1) }; renderClients(); }));
    const s = document.getElementById('ovCliSearch');
    if (s) s.addEventListener('input', () => { cliQ = s.value; clearTimeout(s._t); s._t = setTimeout(() => { renderClients().then(() => { const n = document.getElementById('ovCliSearch'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }, 250); });
  }
  window.ovExportClients = function () {
    if (!OV) return;
    const cols = ['name', 'clientKey', 'active', 'firstInvoice', 'lastInvoice', 'monthsTogether', 'monthsBilled', 'invoiceCount', 'invoicesPaid', 'totalInvoiced', 'totalPaid', 'avgPerMonth', 'avgDaysToPay', 'avgDaysLate', 'onTimeRate', 'paymentGrade', 'owed', 'overdue', 'monthsLate', 'lateLevel', 'lastPayment'];
    const csv = [cols.join(',')].concat(OV.clients.map(c => cols.map(k => { const v = c[k] == null ? '' : String(c[k]); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `clients-${OV.today}.csv`; a.click();
  };

  // ---------------------------------------------------------------------------
  // EMAIL REPORTS tab
  // ---------------------------------------------------------------------------
  async function renderReportsTab() {
    const el = document.getElementById('ovReports'); if (!el) return;
    el.innerHTML = loadingBox('Checking the report schedule…');
    let st; try { st = (await axios.get('/api/reports/email/status')).data; } catch (e) { el.innerHTML = errorBox(e); return; }
    const health = (ok, text) => `<div class="ov-row ov-row--tight"><div>${ok ? '<i class="fas fa-circle-check" style="color:#15803d"></i>' : '<i class="fas fa-circle-xmark" style="color:#b91c1c"></i>'} ${text}</div></div>`;
    el.innerHTML = `
      <div class="ov-grid ov-grid--2">
        <div class="ov-card">
          <div class="ov-card-h"><span><i class="fas fa-calendar-week" style="color:${RED}"></i> Weekly report</span>${st.lastWeekSent ? pill('green', 'Sent ' + fdateShort(st.lastWeekSent.at.slice(0, 10))) : ''}</div>
          <p style="font-size:13px;line-height:1.6">Every <strong>Monday</strong> about the week that just ended: cash collected, invoices issued, who is late (green / orange / red), what falls due this week, month to date.</p>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="ov-btn ov-btn--red" onclick="ovPreviewReport('weekly')"><i class="fas fa-eye"></i> Preview</button><button class="ov-btn" onclick="ovSendReport('weekly')"><i class="fas fa-paper-plane"></i> Send now</button></div>
        </div>
        <div class="ov-card">
          <div class="ov-card-h"><span><i class="fas fa-calendar" style="color:${RED}"></i> Monthly report</span>${st.lastMonthSent ? pill('green', 'Sent ' + fdateShort(st.lastMonthSent.at.slice(0, 10))) : ''}</div>
          <p style="font-size:13px;line-height:1.6">On the <strong>1st of every month</strong> about the month that ended: invoiced and collected vs last month and last year, profit &amp; loss, cash in the bank, every active client, who owes us, ageing, concentration, 12-month trend.</p>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="ov-btn ov-btn--red" onclick="ovPreviewReport('monthly')"><i class="fas fa-eye"></i> Preview</button><button class="ov-btn" onclick="ovSendReport('monthly')"><i class="fas fa-paper-plane"></i> Send now</button></div>
        </div>
      </div>
      <div class="ov-grid ov-grid--2">
        <div class="ov-card">
          <div class="ov-card-h"><span>Delivery</span></div>
          ${health(st.credential.present, st.credential.present ? `Xero connected for automatic runs (renewed ${fdate((st.credential.updatedAt || '').slice(0, 10))})` : 'Xero not yet connected for automatic runs — it connects by itself the next time the dashboard is open')}
          ${st.credential.warning ? health(false, esc(st.credential.warning)) : ''}
          ${health(st.resendConfigured, st.resendConfigured ? 'E-mail sending configured' : 'E-mail sending not configured yet')}
          <div class="ov-row ov-row--tight"><div><i class="fas fa-envelope" style="color:#6e6e73"></i> From ${esc(st.from)} to <strong>${st.recipients.map(esc).join(', ')}</strong></div></div>
          <div class="ov-muted" style="font-size:12px;margin-top:8px">${esc(st.schedule.weekly)}. ${esc(st.schedule.monthly)}.</div>
        </div>
        <div class="ov-card">
          <div class="ov-card-h"><span>Recent runs</span></div>
          ${(st.runlog || []).length ? st.runlog.slice(0, 8).map(r => `<div class="ov-row ov-row--tight"><div>${r.ok ? '<i class="fas fa-check" style="color:#15803d"></i>' : '<i class="fas fa-xmark" style="color:#b91c1c"></i>'} ${esc(r.job)} ${esc(r.period || '')} <span class="ov-muted">· ${esc(r.trigger)}${r.error ? ' · ' + esc(r.error) : ''}</span></div><div class="ov-muted" style="font-size:12px">${new Date(r.at).toLocaleString()}</div></div>`).join('') : '<div class="ov-muted">No report sent yet.</div>'}
        </div>
      </div>
      <div id="ovReportPreview"></div>`;
  }
  window.ovPreviewReport = async function (type) {
    const box = document.getElementById('ovReportPreview'); if (!box) return;
    box.innerHTML = loadingBox('Building the ' + type + ' report…');
    try {
      const r = await fetch('/api/reports/email/preview?type=' + type, { headers: { 'X-Session-Token': localStorage.getItem('xero_session') || '' } });
      const html = await r.text();
      if (!r.ok) throw new Error(html.slice(0, 200));
      box.innerHTML = `<div class="ov-card" style="padding:0;overflow:hidden"><iframe id="ovPrevFrame" style="width:100%;height:1400px;border:0;background:#f5f5f7"></iframe></div>`;
      const fr = document.getElementById('ovPrevFrame');
      fr.onload = () => { try { fr.style.height = (fr.contentDocument.documentElement.scrollHeight + 20) + 'px'; } catch (e) {} };
      fr.srcdoc = html;
    } catch (e) { box.innerHTML = errorBox(e); }
  };
  window.ovSendReport = async function (type) {
    const box = document.getElementById('ovReportPreview');
    if (box) box.innerHTML = loadingBox('Sending the ' + type + ' report…');
    try {
      const r = await axios.post('/api/reports/email/send?type=' + type);
      if (box) box.innerHTML = `<div class="ov-alert ov-alert--info"><i class="fas fa-paper-plane"></i>Sent “${esc(r.data.subject)}” to ${r.data.to.map(esc).join(', ')}.</div>`;
    } catch (e) {
      if (box) box.innerHTML = `<div class="ov-alert ov-alert--red"><i class="fas fa-triangle-exclamation"></i>Not sent: ${esc(e?.response?.data?.error || e.message)}</div>`;
    }
    renderReportsTab().then(() => {});
  };

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------
  function renderAll() {
    const active = document.querySelector('.tab-button.active')?.dataset.tab || 'dashboard';
    if (active === 'dashboard') renderDashboard();
    if (active === 'invoices') { renderInvoicesSummary(); ovShowWaitingInvoices(invFilter); }
    if (active === 'clients') renderClients();
  }
  window.ovRenderDashboard = renderDashboard;
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-button').forEach(btn => btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      const title = document.getElementById('pageTitle'); if (title) title.textContent = btn.textContent.trim();
      if (t === 'dashboard') renderDashboard();
      else if (t === 'invoices') { renderInvoicesSummary(); }
      else if (t === 'clients') renderClients();
      else if (t === 'email-reports') renderReportsTab();
    }));
    document.querySelectorAll('[data-inv-filter]').forEach(b => b.addEventListener('click', () => ovShowWaitingInvoices(b.dataset.invFilter)));
    // Render the dashboard as soon as the session check has shown the app.
    const wait = setInterval(() => {
      const app = document.getElementById('mainApp');
      if (app && !app.classList.contains('hidden')) {
        clearInterval(wait); renderDashboard();
        // Self-healing scheduler: opening the dashboard on a Monday / the 1st
        // sends a report that a missed scheduler run did not. Idempotent.
        if (!isDemo()) { try { __f('/api/cron/run?job=auto', { method: 'POST' }).catch(() => {}); } catch (e) {} }
      }
    }, 300);
    setTimeout(() => clearInterval(wait), 60000);
  });

  // ---------------------------------------------------------------------------
  // Demo data (Demo Mode only — fake names and numbers)
  // ---------------------------------------------------------------------------
  function demoOverview() {
    const today = new Date().toISOString().slice(0, 10);
    const ym = today.slice(0, 7);
    const mk = (n) => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 7); };
    const lbl = (m) => new Date(m + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const monthly = Array.from({ length: 13 }, (_, i) => { const m = mk(12 - i); const inv = 38000 + i * 1900 + (i % 3) * 2500; return { month: m, label: lbl(m), invoiced: i === 12 ? 21400 : inv, collected: i === 12 ? 14800 : inv * 0.92, invoices: 14 + (i % 4), activeClients: 11 + Math.floor(i / 4) }; });
    const names = ['Northwind Labs', 'Brightline Robotics', 'Atlas Biotech', 'Helios Energy', 'Corvid Analytics', 'Lumen Health', 'Quanta Systems', 'Riverstone Foods', 'Orbital Freight', 'Pinecrest Media', 'Vantage Medical', 'Silverleaf AI', 'Driftwood Labs', 'Kestrel Security'];
    const clients = names.map((n, i) => {
      const active = i < 12, late = [0, 0, 12, 0, 45, 0, 0, 102, 0, 20, 0, 0, 0, 130][i];
      const fee = [6500, 5200, 4800, 4200, 3900, 3600, 3300, 3000, 2800, 2500, 2200, 1800, 2400, 2000][i];
      const mt = [26, 22, 19, 17, 15, 14, 12, 11, 9, 7, 4, 2, 14, 10][i];
      const owed = late ? fee * Math.ceil(late / 30) : (active ? fee : 0);
      return { contactId: '', name: n, clientKey: String(200 + i * 3), active, firstInvoice: mk(mt - 1) + '-03', lastInvoice: active ? ym + '-01' : mk(5) + '-01', monthsTogether: mt, monthsBilled: mt, invoiceCount: mt, invoicesPaid: mt - Math.ceil(owed / fee), totalInvoiced: fee * mt, totalPaid: fee * mt - owed, avgPerMonth: fee, avgInvoice: fee, avgDaysToPay: 18 + late / 3, avgDaysLate: Math.round(late / 4), onTimeRate: late ? 0.5 : 0.95, paymentGrade: late > 90 ? 'D' : late > 30 ? 'C' : late > 10 ? 'B' : 'A', paymentLabel: late > 90 ? 'Very late payer' : late > 30 ? 'Often late' : late > 10 ? 'Usually a little late' : 'Pays on time', owed, overdue: late ? owed - (active ? fee : 0) : 0, overdueCount: late ? Math.ceil(late / 30) : 0, oldestOverdueDays: late, monthsLate: Math.round(late / 30.44 * 10) / 10, lateLevel: late >= 90 ? 'red' : late >= 30 ? 'orange' : 'green', lastPayment: mk(late ? Math.ceil(late / 30) : 0) + '-10', sharePct: Math.round(fee / 470) };
    });
    const openInvoices = []; clients.forEach((c, i) => { if (c.owed > 0) { const n = Math.max(1, c.overdueCount + (c.active ? 1 : 0)); for (let j = 0; j < n; j++) { const days = j === n - 1 && c.active ? -10 : c.oldestOverdueDays - j * 30; openInvoices.push({ invoiceId: 'd' + i + j, number: 'INV-' + (4100 + i * 7 + j), reference: '', contactId: '', client: c.name, date: today, dueDate: new Date(Date.now() - days * 864e5).toISOString().slice(0, 10), total: c.avgPerMonth, amountDue: c.avgPerMonth, status: 'AUTHORISED', daysOverdue: days, lateLevel: days >= 90 ? 'red' : days >= 30 ? 'orange' : 'green' }); } } });
    openInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);
    const b = (f) => { const xs = openInvoices.filter(x => f(x.daysOverdue)); return { amount: xs.reduce((s, x) => s + x.amountDue, 0), count: xs.length }; };
    const out = openInvoices.reduce((s, x) => s + x.amountDue, 0), od = openInvoices.filter(x => x.daysOverdue > 0);
    return { generatedAt: new Date().toISOString(), today, currency: 'USD', collectedSource: 'payments', drafts: { count: 2, amount: 4100 },
      kpis: { thisMonth: ym, lastMonth: mk(1), invoicedThisMonth: 21400, invoicedLastMonth: 61200, collectedThisMonth: 14800, collectedLastMonth: 56300, invoicesThisMonth: 9, outstanding: out, outstandingCount: openInvoices.length, overdue: od.reduce((s, x) => s + x.amountDue, 0), overdueCount: od.length, overdueShare: Math.round(od.reduce((s, x) => s + x.amountDue, 0) / out * 100), activeClients: 12, inactiveClients: 2, recurringMonthly: 43800, ttmInvoiced: 612000, ttmCollected: 571000, avgMonthlyInvoiced: 51000, collectionRate: 93, avgDaysToPay90: 27, dso: 41, topClientShare: 13, ytdInvoiced: 498000, ytdCollected: 461000 },
      monthly, clients, openInvoices,
      aging: [['notdue', 'Not yet due', 'blue', d => d <= 0], ['d1_30', '1–30 days late', 'green', d => d > 0 && d < 30], ['d30_60', '30–60 days late', 'orange', d => d >= 30 && d < 60], ['d60_90', '60–90 days late', 'orange', d => d >= 60 && d < 90], ['d90', '90+ days late', 'red', d => d >= 90]].map(([key, label, level, f]) => ({ key, label, level, ...b(f) })),
      recentPayments: names.slice(0, 8).map((n, i) => ({ date: new Date(Date.now() - i * 2 * 864e5).toISOString().slice(0, 10), client: n, number: 'INV-' + (4000 + i), amount: clients[i].avgPerMonth })),
      upcomingDue: openInvoices.filter(x => x.daysOverdue <= 0),
      alerts: [{ level: 'red', text: 'Kestrel Security owes $10,000 — 4.3 months late (inactive client)' }, { level: 'red', text: 'Riverstone Foods owes $9,000 — 3.4 months late' }, { level: 'orange', text: 'Corvid Analytics owes $7,800 — 1.5 months late' }, { level: 'info', text: '2 draft invoices ($4,100) not yet sent' }] };
  }
})();
