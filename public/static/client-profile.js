/* =============================================================================
 * v2.20.0 — Client profile drawer
 * Click any client name (anything carrying data-client-name / data-client-id)
 * and a side panel opens with the client's full picture from Xero:
 * key number, invoices, tenure, averages, estimated profit, payment speed,
 * lateness, overdue list, what we bill them for, fees, grade and call prep.
 * ============================================================================= */
(function () {
  const RED = '#FE1B04';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let currency = 'USD';
  const money = (n) => (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  const num = (n, suffix = '') => (n == null || isNaN(n)) ? '—' : (Math.round(n * 10) / 10).toLocaleString('en-US') + suffix;
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  // Render helper other modules use: makes a client name clickable.
  window.clientLink = function (name, contactId) {
    if (!name) return '';
    return `<a href="#" class="client-link" data-client-name="${esc(name)}"${contactId ? ` data-client-id="${esc(contactId)}"` : ''} title="Open client profile" style="color:inherit;text-decoration:underline;text-decoration-color:${RED}66;text-underline-offset:3px;cursor:pointer">${esc(name)}</a>`;
  };

  function ensureDrawer() {
    let el = document.getElementById('clientProfileDrawer');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'clientProfileDrawer';
    el.innerHTML = `
      <div data-cp-close style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9990"></div>
      <aside role="dialog" aria-modal="true" aria-label="Client profile"
        style="position:fixed;top:0;right:0;bottom:0;width:min(760px,100vw);background:#f8fafc;z-index:9991;overflow-y:auto;box-shadow:-12px 0 32px rgba(0,0,0,.18);font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        <div id="cpBody"></div>
      </aside>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-cp-close]')) closeDrawer(); });
    return el;
  }
  function closeDrawer() { const el = document.getElementById('clientProfileDrawer'); if (el) el.remove(); document.body.style.overflow = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  async function openClientProfile(name, contactId) {
    ensureDrawer();
    document.body.style.overflow = 'hidden';
    const body = document.getElementById('cpBody');
    body.innerHTML = header(name, null) + `<div style="padding:48px;text-align:center;color:#64748b"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:${RED}"></i><p style="margin-top:12px">Reading every invoice for ${esc(name)} from Xero…</p></div>`;
    try {
      const qs = contactId && !String(contactId).startsWith('demo-') ? `contactId=${encodeURIComponent(contactId)}` : `name=${encodeURIComponent(name)}`;
      const res = await axios.get(`/api/client-profile?${qs}`);
      render(res.data);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Could not load the profile';
      body.innerHTML = header(name, null) + `<div style="margin:24px;padding:18px;background:#fee2e2;border-radius:10px;color:#7f1d1d">${esc(msg)}</div>`;
    }
  }
  window.openClientProfile = openClientProfile;

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-client-name]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    openClientProfile(a.getAttribute('data-client-name'), a.getAttribute('data-client-id'));
  }, true);

  function header(name, p) {
    const key = p?.client?.key;
    const g = p?.grade;
    const gColor = g ? ({ A: '#15803d', B: '#0369a1', C: '#b45309', D: '#b91c1c' }[g.letter]) : '#64748b';
    return `
      <div style="background:#fff;border-bottom:1px solid #e2e8f0;padding:20px 24px;position:sticky;top:0;z-index:2;display:flex;gap:16px;align-items:center">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Client profile${key ? ` · #${esc(key)}` : ''}</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
          ${p ? `<div style="font-size:13px;color:#475569;padding-top:2px">${[p.client.contactPerson, p.client.email, p.client.phone].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div>` : ''}
        </div>
        ${g ? `<div title="${esc(g.reasons.join('; '))}" style="text-align:center;padding:8px 14px;border-radius:12px;border:2px solid ${gColor}">
          <div style="font-size:28px;font-weight:900;color:${gColor};line-height:1">${g.letter}</div>
          <div style="font-size:11px;font-weight:700;color:${gColor}">${esc(g.label)}</div></div>` : ''}
        <button data-cp-close aria-label="Close" style="border:0;background:#f1f5f9;border-radius:9999px;width:36px;height:36px;cursor:pointer;color:#334155"><i class="fas fa-times"></i></button>
      </div>`;
  }

  const card = (title, inner, extra = '') => `
    <section style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:16px 18px;margin:14px 24px;${extra}">
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;padding-bottom:10px">${title}</div>${inner}</section>`;
  const tile = (label, value, sub, color = '#0f172a') => `
    <div style="background:#f8fafc;border-radius:10px;padding:10px 12px">
      <div style="font-size:11px;color:#64748b">${label}</div>
      <div style="font-size:18px;font-weight:800;color:${color};padding-top:2px">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#64748b;padding-top:2px">${sub}</div>` : ''}</div>`;
  const grid = (tiles) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">${tiles.join('')}</div>`;

  function render(p) {
    currency = p.client.currency || 'USD';
    const m = p.money, r = p.relationship, pay = p.payment;
    const statusColor = { Active: '#15803d', 'Slowing down': '#b45309', Inactive: '#b91c1c' }[r.status] || '#64748b';
    const lateColor = pay.avgDaysLate == null ? '#0f172a' : pay.avgDaysLate <= 3 ? '#15803d' : pay.avgDaysLate <= 15 ? '#b45309' : '#b91c1c';
    const trendTxt = { faster: '↑ paying faster lately', slower: '↓ paying slower lately', steady: 'steady', 'not enough history': 'not enough history yet' }[pay.trend];

    const html = [
      header(p.client.name, p),

      card('Before the call', `<ul style="margin:0;padding-left:18px;color:#0f172a;font-size:14px;line-height:1.6">${p.callPrep.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div style="font-size:12px;color:#64748b;padding-top:8px">Grade ${p.grade.letter} (${p.grade.score}/100): ${esc(p.grade.reasons.join('; '))}.</div>`,
        m.overdueCount ? 'border-left:5px solid #b91c1c' : 'border-left:5px solid #15803d'),

      card('Identity', grid([
        tile('Client number', p.client.key ? '#' + esc(p.client.key) : '—', esc(p.client.keySource)),
        tile('Status', esc(r.status), r.daysSinceLastInvoice != null ? `last invoice ${r.daysSinceLastInvoice} days ago` : '', statusColor),
        tile('Rank', r.rank ? `#${r.rank} of ${r.clientCount}` : '—', r.sharePct != null ? `${r.sharePct}% of all revenue billed` : ''),
        tile('Client since', fmtDate(r.firstInvoice), `${r.monthsSinceFirst} months ago`),
      ])),

      card('Relationship & averages', grid([
        tile('Invoices', m.invoiceCount, [m.draftCount ? `${m.draftCount} draft` : '', m.voidedCount ? `${m.voidedCount} voided` : ''].filter(Boolean).join(' · ')),
        tile('Months with us', r.tenureMonths, `${r.billedMonths} months actually billed`),
        tile('Total billed', money(m.totalInvoiced), `${money(m.totalPaid)} paid`),
        tile('Average invoice', money(m.avgInvoice)),
        tile('Average per billed month', money(m.avgPerBilledMonth)),
        tile('Average per month (tenure)', money(m.avgPerMonthOfTenure)),
      ])),

      card('Profit', p.profit.estimated != null
        ? grid([tile('Estimated profit', money(p.profit.estimated), `${p.profit.marginPct}% company net margin`, p.profit.estimated >= 0 ? '#15803d' : '#b91c1c'),
                tile('Revenue billed', money(m.totalInvoiced))]) + `<div style="font-size:12px;color:#64748b;padding-top:8px">${esc(p.profit.source)}</div>`
        : `<div style="font-size:14px;color:#475569">${esc(p.profit.source)}.</div>`),

      card('Do they pay — and how fast?', grid([
        tile('Owed now', money(m.outstanding), m.outstanding > 0 ? 'open balance' : 'nothing open', m.outstanding > 0 ? '#0f172a' : '#15803d'),
        tile('Overdue', money(m.overdueAmount), m.overdueCount ? `${m.overdueCount} invoice(s), oldest ${m.oldestOverdueDays}d` : 'none', m.overdueCount ? '#b91c1c' : '#15803d'),
        tile('Avg days to pay', num(pay.avgDaysToPay, ' d'), `terms ${pay.termsDays ?? '—'} days · ${trendTxt}`),
        tile('Avg days late', num(pay.avgDaysLate, ' d'), pay.worstDaysLate != null ? `worst: ${pay.worstDaysLate} days` : '', lateColor),
        tile('Paid on time', pay.onTimeRatePct != null ? pay.onTimeRatePct + '%' : '—', `${pay.paidInvoices} paid invoices`),
        tile('Last payment', fmtDate(pay.lastPaymentDate), pay.lastPaidDaysLate != null ? (pay.lastPaidDaysLate > 0 ? `${pay.lastPaidDaysLate} days late` : 'on time') : ''),
      ])),

      card('What we bill them for · fees', (p.fees.services.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="color:#64748b;text-align:left"><th style="padding:6px 4px">Line item</th><th style="padding:6px 4px;text-align:right">Times</th><th style="padding:6px 4px;text-align:right">Amount</th></tr>
          ${p.fees.services.map(s => `<tr style="border-top:1px solid #f1f5f9"><td style="padding:6px 4px">${esc(s.label)}</td><td style="padding:6px 4px;text-align:right">${s.count}</td><td style="padding:6px 4px;text-align:right;font-weight:600">${money(s.amount)}</td></tr>`).join('')}
        </table>` : `<div style="font-size:14px;color:#475569">No line-item detail returned by Xero.</div>`) +
        `<div style="font-size:13px;padding-top:10px;color:${p.fees.feeLines.length ? '#b45309' : '#475569'}">${p.fees.feeLines.length
          ? `Late/interest fees charged: ${p.fees.feeLines.map(f => `${esc(f.invoice)} ${esc(f.description)} (${money(f.amount)})`).join('; ')}`
          : 'No late-payment, interest or penalty fees charged to this client.'}</div>`),

      p.monthly.length ? card('Billing by month', chartBox()) : '',

      card(`All invoices (${p.invoices.length})`, `
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap">
          <tr style="color:#64748b;text-align:left"><th style="padding:6px 4px">Invoice</th><th style="padding:6px 4px">Date</th><th style="padding:6px 4px">Due</th><th style="padding:6px 4px">Paid</th><th style="padding:6px 4px;text-align:right">Total</th><th style="padding:6px 4px;text-align:right">Owed</th><th style="padding:6px 4px;text-align:right">Late</th><th style="padding:6px 4px">Status</th></tr>
          ${p.invoices.map(i => {
            const late = i.daysLate == null ? '—' : i.daysLate > 0 ? `<span style="color:#b91c1c;font-weight:600">${i.daysLate}d</span>` : '<span style="color:#15803d">on time</span>';
            const st = i.overdue ? '<span style="color:#b91c1c;font-weight:700">OVERDUE</span>' : esc(i.status);
            return `<tr style="border-top:1px solid #f1f5f9${i.overdue ? ';background:#fef2f2' : ''}"><td style="padding:6px 4px;font-weight:600">${esc(i.number)}</td><td style="padding:6px 4px">${fmtDate(i.date)}</td><td style="padding:6px 4px">${fmtDate(i.dueDate)}</td><td style="padding:6px 4px">${fmtDate(i.paidDate)}</td><td style="padding:6px 4px;text-align:right">${money(i.total)}</td><td style="padding:6px 4px;text-align:right">${i.amountDue ? money(i.amountDue) : '—'}</td><td style="padding:6px 4px;text-align:right">${late}</td><td style="padding:6px 4px">${st}</td></tr>`;
          }).join('')}
        </table></div>`),

      `<div style="font-size:11px;color:#94a3b8;padding:4px 24px 28px">Live from Xero · ${new Date(p.generatedAt).toLocaleString()} · Days late = paid date minus due date. Months with us = first to latest invoice, inclusive.</div>`,
    ].join('');
    document.getElementById('cpBody').innerHTML = html;
    drawChart(p.monthly);
  }

  function chartBox() { return `<div style="position:relative;height:200px"><canvas id="cpChart" role="img" aria-label="Amount billed per month"></canvas></div>`; }
  function drawChart(series) {
    const cv = document.getElementById('cpChart');
    if (!cv || !window.Chart) return;
    const last = series.slice(-24);
    new Chart(cv, {
      type: 'bar',
      data: { labels: last.map(s => s.month), datasets: [{ label: 'Billed', data: last.map(s => s.invoiced), backgroundColor: RED, borderRadius: 4, maxBarThickness: 28 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => money(c.parsed.y) } } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => money(v) }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } },
    });
  }

  // ---- demo mode: a plausible profile for any demo client -----------------
  window.__demoClientProfile = function (name) {
    const seed = [...String(name || 'x')].reduce((s, c) => s + c.charCodeAt(0), 0);
    const now = new Date();
    const invs = [];
    for (let k = 17; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 5);
      const due = new Date(d.getTime() + 30 * 86400000);
      const total = 4500 + ((seed + k * 37) % 9) * 250;
      const late = ((seed + k) % 5) * 4 - 4;
      const isOpen = k <= 1;
      const paid = isOpen ? null : new Date(due.getTime() + late * 86400000);
      const iso = (x) => x ? x.toISOString().split('T')[0] : null;
      invs.push({ number: 'INV-' + (1200 + 18 - k), status: isOpen ? 'AUTHORISED' : 'PAID', date: iso(d), dueDate: iso(due), paidDate: iso(paid),
        total, amountDue: isOpen ? total : 0, daysToPay: paid ? Math.round((paid - d) / 86400000) : null,
        daysLate: paid ? late : (due < now ? Math.floor((now - due) / 86400000) : null), overdue: isOpen && due < now });
    }
    invs.reverse();
    const billed = invs.reduce((s, i) => s + i.total, 0), owed = invs.reduce((s, i) => s + i.amountDue, 0);
    const over = invs.filter(i => i.overdue);
    return {
      client: { name, contactId: 'demo', key: String(200 + (seed % 60)), keySource: 'demo', email: 'ap@' + String(name).toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) + '.com', contactPerson: 'Accounts Payable', phone: null, currency: 'USD' },
      grade: { letter: over.length ? 'B' : 'A', label: over.length ? 'Good client' : 'Excellent client', score: over.length ? 78 : 92, reasons: ['usually a few days late', '18-month relationship'] },
      relationship: { status: 'Active', firstInvoice: invs[invs.length - 1].date, lastInvoice: invs[0].date, tenureMonths: 18, monthsSinceFirst: 18, billedMonths: 18, daysSinceLastInvoice: 0, rank: 1 + (seed % 12), clientCount: 47, sharePct: 6.4 },
      money: { invoiceCount: 18, draftCount: 0, voidedCount: 0, totalInvoiced: billed, totalPaid: billed - owed, totalCredited: 0, outstanding: owed, overdueAmount: over.reduce((s, i) => s + i.amountDue, 0), overdueCount: over.length, oldestOverdueDays: over[0]?.daysLate ?? null, avgInvoice: Math.round(billed / 18), avgPerBilledMonth: Math.round(billed / 18), avgPerMonthOfTenure: Math.round(billed / 18) },
      payment: { paidInvoices: 16, avgDaysToPay: 34.5, avgDaysLate: 5.2, onTimeRatePct: 44, worstDaysLate: 12, termsDays: 30, trend: 'steady', recentAvgDaysToPay: 35, lastPaymentDate: invs[2].paidDate, lastPaidDaysLate: invs[2].daysLate },
      profit: { estimated: Math.round(billed * 0.31), basis: 'invoiced', marginPct: 31, source: 'Demo figures — company net margin applied to this client\'s billing (estimate).', exact: false },
      fees: { services: [{ label: 'US market entry retainer', amount: Math.round(billed * 0.8), count: 18 }, { label: 'LinkedIn outbound campaign', amount: Math.round(billed * 0.2), count: 6 }], feeLines: [], lineItemsAvailable: true },
      callPrep: [over.length ? `Ask about ${over.length} overdue invoice(s).` : 'Nothing overdue — account is clean.', 'They usually pay 35 days after the invoice date (terms 30 days); 44% of invoices paid on time.'],
      monthly: invs.slice().reverse().map(i => ({ month: i.date.slice(0, 7), invoiced: i.total, paid: i.total - i.amountDue, count: 1 })),
      invoices: invs,
      generatedAt: now.toISOString(),
    };
  };
})();
