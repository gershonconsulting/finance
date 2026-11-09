// v2.21.0 — Weekly (Mondays, last Mon–Sun) and monthly (1st, last month) e-mail
// reports. Pure: takes ledger data + optional P&L / bank figures, returns
// { subject, html, text, data }. Sending and scheduling live in index.tsx.

import {
  buildOverview, collectPayments, xeroDay, etDay, addDays, addMonths, monthKey, monthLabel,
  daysBetween, fmtMoney, lateLevel, r2, MONTH_NAMES, type OvInvoice, type OvPayment, type ClientRow,
} from './account-overview';

const RED = '#CC3333', DARK = '#a8281f', TEXT = '#1d1d1f', MUTED = '#6e6e73', BORDER = '#e5e7eb', TINT = '#fdf2f2';
const LEVEL = {
  green: { fg: '#15803d', bg: '#dcfce7', label: 'Under 1 month' },
  orange: { fg: '#b45309', bg: '#ffedd5', label: '1–3 months' },
  red: { fg: '#b91c1c', bg: '#fee2e2', label: '3+ months' },
} as const;
const mShort = (ym: string) => `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1].slice(0, 3)} ${ym.slice(0, 4)}`;
const DASH_URL = 'https://finance.gershoncrm.com/app';
const BILLABLE = new Set(['PAID', 'AUTHORISED', 'SUBMITTED']);

export interface PnLSummary { income: number | null; costOfSales: number | null; grossProfit: number | null; expenses: number | null; netProfit: number | null }
export interface BankLine { account: string; opening: number | null; received: number | null; spent: number | null; closing: number | null }

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------
/** The Mon–Sun week that ended before `now` (Eastern). */
export function lastWeek(now: Date) {
  const today = etDay(now);
  const dow = new Date(today + 'T12:00:00Z').getUTCDay(); // 0 Sun … 6 Sat
  const thisMonday = addDays(today, -((dow + 6) % 7));
  const start = addDays(thisMonday, -7), end = addDays(thisMonday, -1);
  return { start, end, key: isoWeekKey(start), label: rangeLabel(start, end) };
}
export function lastMonthPeriod(now: Date) {
  const ym = addMonths(monthKey(etDay(now)), -1);
  const [y, m] = ym.split('-').map(Number);
  const end = `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  return { start: `${ym}-01`, end, key: ym, label: monthLabel(ym) };
}
export function isoWeekKey(day: string) {
  const d = new Date(day + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
function rangeLabel(a: string, b: string) {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  const mn = (m: number) => MONTH_NAMES[m - 1].slice(0, 3);
  if (ya !== yb) return `${mn(ma)} ${da}, ${ya} – ${mn(mb)} ${db}, ${yb}`;
  if (ma !== mb) return `${mn(ma)} ${da} – ${mn(mb)} ${db}, ${yb}`;
  return `${mn(ma)} ${da}–${db}, ${yb}`;
}
const shortDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${dd}`;
};

// ---------------------------------------------------------------------------
// HTML building blocks (inline styles only — e-mail clients ignore <style>)
// ---------------------------------------------------------------------------
function shell(title: string, eyebrow: string, preheader: string, body: string, footer: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 10px;"><tr><td align="center">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
<tr><td style="border-top:5px solid ${RED};padding:22px 28px 6px 28px;">
  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${RED};">${esc(eyebrow)}</div>
  <div style="font-size:22px;font-weight:800;letter-spacing:-.01em;padding-top:4px;">${esc(title)}</div>
</td></tr>
${body}
<tr><td style="padding:20px 28px 8px 28px;"><a href="${DASH_URL}" style="display:inline-block;background:${RED};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">Open the Finance dashboard</a></td></tr>
<tr><td style="padding:16px 28px 22px 28px;border-top:1px solid ${BORDER};font-size:11px;line-height:1.6;color:${MUTED};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}
const section = (title: string, inner: string) =>
  `<tr><td style="padding:22px 28px 0 28px;"><div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};padding-bottom:10px;">${esc(title)}</div>${inner}</td></tr>`;

function tiles(items: Array<{ label: string; value: string; sub?: string; color?: string }>) {
  const cells = items.map(t => `<td width="${Math.floor(100 / items.length)}%" valign="top" style="padding:4px;">
    <div style="border:1px solid ${BORDER};border-left:4px solid ${t.color || RED};border-radius:8px;padding:12px 12px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${MUTED};">${esc(t.label)}</div>
      <div style="font-size:20px;font-weight:800;padding-top:3px;color:${TEXT};white-space:nowrap;">${esc(t.value)}</div>
      ${t.sub ? `<div style="font-size:12px;color:${MUTED};padding-top:3px;line-height:1.4;">${t.sub}</div>` : ''}
    </div></td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}
function table(head: string[], rows: string[][], align: Array<'left' | 'right' | 'center'> = []) {
  if (!rows.length) return `<div style="font-size:13px;color:${MUTED};padding:6px 0;">Nothing to report.</div>`;
  const th = head.map((h, i) => `<th align="${align[i] || 'left'}" style="padding:8px 10px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:${MUTED};font-weight:700;background:#f8fafc;border-bottom:1px solid ${BORDER};">${esc(h)}</th>`).join('');
  const tr = rows.map((r, ri) => `<tr style="background:${ri % 2 ? '#fcfcfd' : '#ffffff'};">${r.map((c, i) => `<td align="${align[i] || 'left'}" style="padding:8px 10px;font-size:13px;border-bottom:1px solid #f1f5f9;${align[i] === 'right' ? 'white-space:nowrap;font-variant-numeric:tabular-nums;' : ''}">${c}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;overflow:hidden;"><tr>${th}</tr>${tr}</table>`;
}
const pill = (level: 'green' | 'orange' | 'red', text: string) =>
  `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;color:${LEVEL[level].fg};background:${LEVEL[level].bg};white-space:nowrap;">${esc(text)}</span>`;
const callout = (level: 'red' | 'orange' | 'green' | 'info', html: string) => {
  const c = level === 'info' ? { fg: '#1d4ed8', bg: '#eff6ff' } : LEVEL[level];
  return `<div style="background:${c.bg};border-left:4px solid ${c.fg};border-radius:6px;padding:10px 14px;font-size:13px;line-height:1.55;color:${TEXT};margin-bottom:8px;">${html}</div>`;
};
function delta(cur: number, prev: number, cur$ = 'USD', goodUp = true) {
  if (!prev && !cur) return 'no change';
  const d = cur - prev;
  if (Math.abs(d) < 0.5) return 'no change';
  const up = d > 0;
  const color = (up === goodUp) ? '#15803d' : '#b91c1c';
  const pct = prev ? ` (${up ? '+' : ''}${Math.round((d / prev) * 100)}%)` : '';
  return `<span style="color:${color};font-weight:600;">${up ? '▲' : '▼'} ${fmtMoney(Math.abs(d), cur$)}${pct}</span>`;
}
const lateText = (c: ClientRow) => c.oldestOverdueDays > 0 ? `${c.monthsLate} mo` : 'On time';

function clientLateTable(clients: ClientRow[], cur: string, onlyLate = false) {
  const xs = clients.filter(c => !onlyLate || c.overdue > 0.005).sort((a, b) => b.oldestOverdueDays - a.oldestOverdueDays || b.owed - a.owed);
  return table(['Client', 'Owes us', 'Overdue', 'Late', 'Payer'],
    xs.map(c => [
      `<strong>${esc(c.name)}</strong>${c.active ? '' : ` <span style="color:${MUTED};font-size:11px;">(inactive)</span>`}`,
      fmtMoney(c.owed, cur), fmtMoney(c.overdue, cur),
      pill(c.lateLevel, lateText(c)),
      `${c.paymentGrade} <span style="color:${MUTED};font-size:11px;">${esc(c.paymentLabel)}</span>`,
    ]), ['left', 'right', 'right', 'center', 'left']);
}

// ---------------------------------------------------------------------------
// Weekly
// ---------------------------------------------------------------------------
export function buildWeeklyReport(invoices: OvInvoice[], payments: OvPayment[] | null, now: Date = new Date()) {
  const wk = lastWeek(now);
  const ov = buildOverview(invoices, payments, now);
  const cur = ov.currency;
  const { pays } = collectPayments(invoices, payments);
  const inRange = (d: string | null, a: string, b: string) => !!d && d >= a && d <= b;
  const billable = invoices.filter(i => (!i.Type || i.Type === 'ACCREC') && BILLABLE.has(String(i.Status)));

  const weekPays = pays.filter(p => inRange(p.date, wk.start, wk.end));
  const weekInv = billable.filter(i => inRange(xeroDay(i.Date), wk.start, wk.end));
  const prevStart = addDays(wk.start, -7), prevEnd = addDays(wk.end, -7);
  const prevPaid = pays.filter(p => inRange(p.date, prevStart, prevEnd)).reduce((s, p) => s + p.amount, 0);
  const prevInvd = billable.filter(i => inRange(xeroDay(i.Date), prevStart, prevEnd)).reduce((s, i) => s + (i.Total || 0), 0);
  const avg4Paid = pays.filter(p => inRange(p.date, addDays(wk.start, -28), addDays(wk.start, -1))).reduce((s, p) => s + p.amount, 0) / 4;
  const collected = weekPays.reduce((s, p) => s + p.amount, 0);
  const invoiced = weekInv.reduce((s, i) => s + (i.Total || 0), 0);

  const mtdMonth = monthKey(wk.end);
  const mtd = ov.monthly.find(m => m.month === mtdMonth);
  const late = ov.clients.filter(c => c.overdue > 0.005);
  const red = late.filter(c => c.lateLevel === 'red'), orange = late.filter(c => c.lateLevel === 'orange');
  const dueSoon = ov.openInvoices.filter(o => o.daysOverdue <= 0 && o.daysOverdue >= -7);

  const status: Array<[('red' | 'orange' | 'green' | 'info'), string]> = [];
  if (red.length) status.push(['red', `<strong>${red.length} client${red.length > 1 ? 's are' : ' is'} more than 3 months late</strong> — ${red.map(c => `${esc(c.name)} (${fmtMoney(c.overdue, cur)})`).join(', ')}.`]);
  if (orange.length) status.push(['orange', `<strong>${orange.length} client${orange.length > 1 ? 's are' : ' is'} 1–3 months late</strong> — ${orange.map(c => `${esc(c.name)} (${fmtMoney(c.overdue, cur)})`).join(', ')}.`]);
  if (!red.length && !orange.length) status.push(['green', '<strong>No client is more than a month late.</strong>']);
  if (ov.drafts.count) status.push(['info', `${ov.drafts.count} draft invoice${ov.drafts.count > 1 ? 's' : ''} (${fmtMoney(ov.drafts.amount, cur)}) waiting to be sent.`]);

  const body = [
    `<tr><td style="padding:14px 28px 0 28px;">${status.map(([l, h]) => callout(l, h)).join('')}</td></tr>`,
    section('Last week', tiles([
      { label: 'Collected', value: fmtMoney(collected, cur), sub: `${weekPays.length} payment${weekPays.length === 1 ? '' : 's'} · ${delta(collected, prevPaid, cur)} vs week before`, color: '#15803d' },
      { label: 'Invoiced', value: fmtMoney(invoiced, cur), sub: `${weekInv.length} invoice${weekInv.length === 1 ? '' : 's'} · ${delta(invoiced, prevInvd, cur)} vs week before` },
      { label: 'Owed to us now', value: fmtMoney(ov.kpis.outstanding, cur), sub: `${ov.kpis.outstandingCount} open invoices`, color: '#0369a1' },
      { label: 'Overdue now', value: fmtMoney(ov.kpis.overdue, cur), sub: `${ov.kpis.overdueCount} invoices · ${ov.kpis.overdueShare}% of what is owed`, color: '#b91c1c' },
    ])),
    section('Payments received', table(['Date', 'Client', 'Invoice', 'Amount'],
      weekPays.map(p => [shortDate(p.date), esc(p.client), esc(p.number), `<strong>${fmtMoney(p.amount, cur)}</strong>`]), ['left', 'left', 'left', 'right'])),
    section('Invoices issued', table(['Date', 'Client', 'Invoice', 'Amount', 'Due'],
      weekInv.sort((a, b) => (xeroDay(a.Date)! < xeroDay(b.Date)! ? -1 : 1)).map(i => [shortDate(xeroDay(i.Date)), esc(i.Contact?.Name), esc(i.InvoiceNumber), fmtMoney(i.Total || 0, cur), shortDate(xeroDay(i.DueDate))]),
      ['left', 'left', 'left', 'right', 'left'])),
    section('Who is late', clientLateTable(ov.clients, cur, true) + `<div style="font-size:11px;color:${MUTED};padding-top:6px;">Late = oldest unpaid invoice past its due date. ${pill('green', 'under 1 month')} ${pill('orange', '1–3 months')} ${pill('red', '3+ months')}</div>`),
    section('Due in the next 7 days', table(['Due', 'Client', 'Invoice', 'Amount'],
      dueSoon.map(o => [shortDate(o.dueDate), esc(o.client), esc(o.number), fmtMoney(o.amountDue, cur)]), ['left', 'left', 'left', 'right'])),
    section(`${monthLabel(mtdMonth)} so far`, tiles([
      { label: 'Invoiced', value: fmtMoney(mtd?.invoiced || 0, cur), sub: `${mtd?.invoices || 0} invoices` },
      { label: 'Collected', value: fmtMoney(mtd?.collected || 0, cur), color: '#15803d' },
      { label: 'Active clients', value: String(ov.kpis.activeClients), sub: `recurring ≈ ${fmtMoney(ov.kpis.recurringMonthly, cur)}/mo`, color: '#0369a1' },
    ])),
  ].join('');

  const subject = `Gershon.AI Finance Weekly Report — ${wk.label}${red.length ? ` · ${red.length} client${red.length > 1 ? 's' : ''} 3+ months late` : ''}`;
  const pre = `${fmtMoney(collected, cur)} collected · ${fmtMoney(invoiced, cur)} invoiced · ${fmtMoney(ov.kpis.overdue, cur)} overdue`;
  const footer = `Week ${wk.key}: Monday ${wk.start} to Sunday ${wk.end} (New York time). Collected = payments recorded in Xero${ov.collectedSource === 'payments' ? '' : ' (dates from “fully paid on”, part-payments not dated)'}; invoiced = invoices dated in the week (drafts and voids excluded). Balances are as of ${ov.today}.<br>Generated ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC by finance.gershoncrm.com — this report is a feature of the Finance app, no other system has to run for it to arrive.`;

  const text = [
    subject, '',
    `Collected last week: ${fmtMoney(collected, cur)} (${weekPays.length} payments)`,
    `Invoiced last week: ${fmtMoney(invoiced, cur)} (${weekInv.length} invoices)`,
    `Owed to us now: ${fmtMoney(ov.kpis.outstanding, cur)} · overdue ${fmtMoney(ov.kpis.overdue, cur)}`, '',
    'Who is late:',
    ...late.sort((a, b) => b.oldestOverdueDays - a.oldestOverdueDays).map(c => `  [${c.lateLevel.toUpperCase()}] ${c.name}: ${fmtMoney(c.overdue, cur)} overdue, ${c.monthsLate} months`),
    '', `Dashboard: ${DASH_URL}`,
  ].join('\n');

  return { type: 'weekly' as const, period: wk, subject, html: shell(`Weekly report — ${wk.label}`, 'Gershon.AI Finance', pre, body, footer), text,
    data: { collected: r2(collected), invoiced: r2(invoiced), payments: weekPays.length, invoices: weekInv.length, outstanding: ov.kpis.outstanding, overdue: ov.kpis.overdue, red: red.length, orange: orange.length } };
}

// ---------------------------------------------------------------------------
// Monthly
// ---------------------------------------------------------------------------
export function buildMonthlyReport(
  invoices: OvInvoice[], payments: OvPayment[] | null, now: Date = new Date(),
  extra: { pnl?: PnLSummary | null; pnlPrev?: PnLSummary | null; pnlYtd?: PnLSummary | null; bank?: BankLine[] | null; goals?: { revenue?: number | null } | null } = {},
) {
  const mp = lastMonthPeriod(now);
  const ov = buildOverview(invoices, payments, now);
  const cur = ov.currency;
  const { pays } = collectPayments(invoices, payments);
  const billable = invoices.filter(i => (!i.Type || i.Type === 'ACCREC') && BILLABLE.has(String(i.Status)));
  const inMonth = (d: string | null, ym: string) => !!d && d.slice(0, 7) === ym;
  const prevYm = addMonths(mp.key, -1), lyYm = addMonths(mp.key, -12);
  const sumInv = (ym: string) => billable.filter(i => inMonth(xeroDay(i.Date), ym)).reduce((s, i) => s + (i.Total || 0), 0);
  const sumPay = (ym: string) => pays.filter(p => inMonth(p.date, ym)).reduce((s, p) => s + p.amount, 0);
  const clientsIn = (ym: string) => new Set(billable.filter(i => inMonth(xeroDay(i.Date), ym)).map(i => i.Contact?.ContactID || i.Contact?.Name || '?'));

  const invoiced = sumInv(mp.key), invoicedPrev = sumInv(prevYm), invoicedLY = sumInv(lyYm);
  const collected = sumPay(mp.key), collectedPrev = sumPay(prevYm), collectedLY = sumPay(lyYm);
  const monthInv = billable.filter(i => inMonth(xeroDay(i.Date), mp.key));
  const monthPays = pays.filter(p => inMonth(p.date, mp.key));

  // Clients billed this month vs last month, and first-ever invoices.
  const billedNow = clientsIn(mp.key), billedPrev = clientsIn(prevYm);
  const firstInvoice = new Map<string, string>();
  for (const i of billable) {
    const id = i.Contact?.ContactID || i.Contact?.Name || '?', d = xeroDay(i.Date);
    if (d && (!firstInvoice.has(id) || d < firstInvoice.get(id)!)) firstInvoice.set(id, d);
  }
  const nameOf = (id: string) => billable.find(i => (i.Contact?.ContactID || i.Contact?.Name) === id)?.Contact?.Name || id;
  const newClients = [...billedNow].filter(id => (firstInvoice.get(id) || '').slice(0, 7) === mp.key).map(nameOf);
  const notBilled = [...billedPrev].filter(id => !billedNow.has(id)).map(nameOf);

  // Concentration this month.
  const byClient = new Map<string, number>();
  for (const i of monthInv) { const n = i.Contact?.Name || '?'; byClient.set(n, (byClient.get(n) || 0) + (i.Total || 0)); }
  const ranked = [...byClient.entries()].sort((a, b) => b[1] - a[1]);
  const top3 = ranked.slice(0, 3).reduce((s, [, v]) => s + v, 0);

  // Per-client table for active clients, with the month's own figures.
  const act = ov.clients.filter(c => c.active || byClient.has(c.name));
  const paidBy = new Map<string, number>();
  for (const p of monthPays) paidBy.set(p.client, (paidBy.get(p.client) || 0) + p.amount);

  const late = ov.clients.filter(c => c.overdue > 0.005);
  const red = late.filter(c => c.lateLevel === 'red'), orange = late.filter(c => c.lateLevel === 'orange');
  const pnl = extra.pnl || null;
  const goal = extra.goals?.revenue || null;

  const watch: string[] = [];
  for (const c of red) watch.push(callout('red', `<strong>${esc(c.name)}</strong> owes ${fmtMoney(c.overdue, cur)} and is <strong>${c.monthsLate} months late</strong>${c.active ? '' : ' (no longer billed)'} — escalate.`));
  for (const c of orange) watch.push(callout('orange', `<strong>${esc(c.name)}</strong> owes ${fmtMoney(c.overdue, cur)}, ${c.monthsLate} months late — follow up this week.`));
  if (notBilled.length) watch.push(callout('info', `Billed in ${monthLabel(prevYm)} but not in ${monthLabel(mp.key)}: ${notBilled.map(esc).join(', ')}.`));
  if (ranked.length && invoiced > 0 && ranked[0][1] / invoiced > 0.35) watch.push(callout('orange', `${esc(ranked[0][0])} was ${Math.round((ranked[0][1] / invoiced) * 100)}% of ${monthLabel(mp.key)} billing — concentration risk.`));
  if (ov.drafts.count) watch.push(callout('info', `${ov.drafts.count} draft invoice${ov.drafts.count > 1 ? 's' : ''} (${fmtMoney(ov.drafts.amount, cur)}) not yet sent.`));
  if (!watch.length) watch.push(callout('green', '<strong>Nothing needs attention:</strong> no client is more than a month late.'));

  const pl = (v: number | null | undefined) => (v == null ? '—' : fmtMoney(v, cur));
  const pnlBlock = pnl && pnl.income != null
    ? table(['', mp.label, extra.pnlPrev ? monthLabel(prevYm) : '', extra.pnlYtd ? `${mp.key.slice(0, 4)} to date` : ''].filter((x, i) => i < 2 || x),
      ([
        ['Income', pnl.income, extra.pnlPrev?.income, extra.pnlYtd?.income],
        ['Cost of sales', pnl.costOfSales, extra.pnlPrev?.costOfSales, extra.pnlYtd?.costOfSales],
        ['Gross profit', pnl.grossProfit, extra.pnlPrev?.grossProfit, extra.pnlYtd?.grossProfit],
        ['Operating expenses', pnl.expenses, extra.pnlPrev?.expenses, extra.pnlYtd?.expenses],
        ['Net profit', pnl.netProfit, extra.pnlPrev?.netProfit, extra.pnlYtd?.netProfit],
      ] as Array<[string, number | null, number | null | undefined, number | null | undefined]>)
        .map(([l, a, b, c]) => [l === 'Net profit' ? `<strong>${l}</strong>` : l, l === 'Net profit' ? `<strong>${pl(a)}</strong>` : pl(a), ...(extra.pnlPrev ? [pl(b)] : []), ...(extra.pnlYtd ? [pl(c)] : [])]),
      ['left', 'right', 'right', 'right'])
      + (pnl.netProfit != null && pnl.income ? `<div style="font-size:12px;color:${MUTED};padding-top:6px;">Net margin ${Math.round((pnl.netProfit / pnl.income) * 100)}% · from the Xero Profit &amp; Loss (accrual basis).</div>` : '')
    : `<div style="font-size:13px;color:${MUTED};">The Xero Profit &amp; Loss could not be read for this month, so income and expenses are not shown.</div>`;

  const bank = extra.bank && extra.bank.length ? table(['Account', 'Opening', 'Received', 'Spent', 'Closing'],
    extra.bank.map(b => [esc(b.account), pl(b.opening), pl(b.received), pl(b.spent), `<strong>${pl(b.closing)}</strong>`]), ['left', 'right', 'right', 'right', 'right'])
    + (extra.bank.length > 1 ? `<div style="font-size:12px;color:${MUTED};padding-top:6px;">Total closing cash ${fmtMoney(extra.bank.reduce((s, b) => s + (b.closing || 0), 0), cur)}.</div>` : '')
    : `<div style="font-size:13px;color:${MUTED};">Bank balances could not be read from Xero.</div>`;

  const trendRows = ov.monthly.filter(m => m.month <= mp.key).slice(-12).map(m => [
    m.month === mp.key ? `<strong>${esc(m.label)}</strong>` : esc(m.label), fmtMoney(m.invoiced, cur), fmtMoney(m.collected, cur), String(m.activeClients),
  ]);

  const body = [
    `<tr><td style="padding:14px 28px 0 28px;"><div style="font-size:14px;line-height:1.6;color:${TEXT};">${esc(mp.label)}: <strong>${fmtMoney(invoiced, cur)}</strong> invoiced to <strong>${billedNow.size}</strong> clients and <strong>${fmtMoney(collected, cur)}</strong> collected. We are owed <strong>${fmtMoney(ov.kpis.outstanding, cur)}</strong>, of which <strong style="color:#b91c1c;">${fmtMoney(ov.kpis.overdue, cur)}</strong> is overdue.${pnl?.netProfit != null ? ` Net profit for the month: <strong>${fmtMoney(pnl.netProfit, cur)}</strong>.` : ''}</div></td></tr>`,
    section('The month', tiles([
      { label: 'Invoiced', value: fmtMoney(invoiced, cur), sub: `${delta(invoiced, invoicedPrev, cur)} vs ${mShort(prevYm)}<br>${delta(invoiced, invoicedLY, cur)} vs ${mShort(lyYm)}` },
      { label: 'Collected', value: fmtMoney(collected, cur), sub: `${delta(collected, collectedPrev, cur)} vs ${mShort(prevYm)}<br>${delta(collected, collectedLY, cur)} vs ${mShort(lyYm)}`, color: '#15803d' },
      { label: 'Clients billed', value: String(billedNow.size), sub: `${billedPrev.size} in ${mShort(prevYm)} · ${newClients.length} new`, color: '#0369a1' },
      { label: 'Net profit', value: pl(pnl?.netProfit ?? null), sub: pnl?.income ? `on ${fmtMoney(pnl.income, cur)} income` : 'Xero P&amp;L', color: '#6d28d9' },
    ])),
    `<tr><td style="padding:8px 28px 0 28px;">${tiles([
      { label: 'Owed to us', value: fmtMoney(ov.kpis.outstanding, cur), sub: `${ov.kpis.outstandingCount} open invoices`, color: '#0369a1' },
      { label: 'Overdue', value: fmtMoney(ov.kpis.overdue, cur), sub: `${ov.kpis.overdueShare}% of what is owed`, color: '#b91c1c' },
      { label: 'Days to get paid', value: ov.kpis.avgDaysToPay90 == null ? '—' : `${ov.kpis.avgDaysToPay90} d`, sub: `DSO ${ov.kpis.dso ?? '—'} d · last 90 days`, color: '#b45309' },
      { label: 'Collection rate', value: ov.kpis.collectionRate == null ? '—' : `${ov.kpis.collectionRate}%`, sub: 'collected ÷ invoiced, 12 months', color: '#15803d' },
    ])}</td></tr>`,
    goal ? section('Revenue goal', `<div style="font-size:14px;">${fmtMoney(invoiced, cur)} of ${fmtMoney(goal, cur)} target — <strong style="color:${invoiced >= goal ? '#15803d' : '#b91c1c'};">${Math.round((invoiced / goal) * 100)}%</strong></div>`) : '',
    section('Needs attention', watch.join('')),
    section('Profit & loss', pnlBlock),
    section('Cash in the bank', bank),
    section('Active clients', table(['Client', 'Months with us', `Billed ${MONTH_NAMES[Number(mp.key.slice(5, 7)) - 1].slice(0, 3)}`, `Paid ${MONTH_NAMES[Number(mp.key.slice(5, 7)) - 1].slice(0, 3)}`, 'Avg / month', 'Owes us', 'Late', 'Payer'],
      act.map(c => [
        `<strong>${esc(c.name)}</strong>${c.clientKey ? ` <span style="color:${MUTED};font-size:11px;">#${esc(c.clientKey)}</span>` : ''}`,
        String(c.monthsTogether), fmtMoney(byClient.get(c.name) || 0, cur), fmtMoney(paidBy.get(c.name) || 0, cur),
        fmtMoney(c.avgPerMonth, cur), fmtMoney(c.owed, cur), pill(c.lateLevel, lateText(c)), c.paymentGrade,
      ]), ['left', 'center', 'right', 'right', 'right', 'right', 'center', 'center'])
      + `<div style="font-size:11px;color:${MUTED};padding-top:6px;">Payer grade: A pays on time · B a little late · C often late · D very late. ${newClients.length ? `New this month: ${newClients.map(esc).join(', ')}.` : ''}</div>`),
    section('Who owes us', clientLateTable(ov.clients.filter(c => c.owed > 0.005), cur, false)),
    section('Ageing of what is owed', table(['Bucket', 'Invoices', 'Amount'],
      ov.aging.map(a => [esc(a.label), String(a.count), fmtMoney(a.amount, cur)]), ['left', 'center', 'right'])),
    section('Concentration', `<div style="font-size:13px;line-height:1.6;">Top client: <strong>${esc(ranked[0]?.[0] || '—')}</strong> (${invoiced ? Math.round(((ranked[0]?.[1] || 0) / invoiced) * 100) : 0}% of the month). Top 3: ${invoiced ? Math.round((top3 / invoiced) * 100) : 0}%. Over 12 months the largest client is ${ov.kpis.topClientShare}% of billing.</div>`),
    section('Last 12 months', table(['Month', 'Invoiced', 'Collected', 'Clients'], trendRows, ['left', 'right', 'right', 'center'])
      + `<div style="font-size:12px;color:${MUTED};padding-top:6px;">12-month total: ${fmtMoney(ov.monthly.filter(m => m.month <= mp.key).slice(-12).reduce((s, m) => s + m.invoiced, 0), cur)} invoiced, ${fmtMoney(ov.monthly.filter(m => m.month <= mp.key).slice(-12).reduce((s, m) => s + m.collected, 0), cur)} collected.</div>`),
  ].join('');

  const subject = `Gershon.AI Finance Monthly Report — ${mp.label}`;
  const pre = `${fmtMoney(invoiced, cur)} invoiced · ${fmtMoney(collected, cur)} collected · ${fmtMoney(ov.kpis.overdue, cur)} overdue`;
  const footer = `${mp.label}: ${mp.start} to ${mp.end}. Invoiced = invoices dated in the month (drafts and voids excluded); collected = payments recorded in Xero in the month. Balances (owed, overdue, ageing, late) are as of ${ov.today}, the day the report was generated. Profit &amp; loss and bank figures come straight from Xero reports.<br>Generated ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC by finance.gershoncrm.com.`;
  const text = [
    subject, '',
    `Invoiced: ${fmtMoney(invoiced, cur)} (prev month ${fmtMoney(invoicedPrev, cur)}, last year ${fmtMoney(invoicedLY, cur)})`,
    `Collected: ${fmtMoney(collected, cur)} (prev month ${fmtMoney(collectedPrev, cur)})`,
    `Clients billed: ${billedNow.size}${newClients.length ? ` · new: ${newClients.join(', ')}` : ''}`,
    pnl?.netProfit != null ? `Net profit: ${fmtMoney(pnl.netProfit, cur)} on income ${fmtMoney(pnl.income || 0, cur)}` : 'Net profit: not available',
    `Owed to us: ${fmtMoney(ov.kpis.outstanding, cur)} · overdue ${fmtMoney(ov.kpis.overdue, cur)}`, '',
    'Late clients:',
    ...late.map(c => `  [${c.lateLevel.toUpperCase()}] ${c.name}: ${fmtMoney(c.overdue, cur)} overdue, ${c.monthsLate} months`),
    '', `Dashboard: ${DASH_URL}`,
  ].join('\n');

  return { type: 'monthly' as const, period: mp, subject, html: shell(`Monthly report — ${mp.label}`, 'Gershon.AI Finance', pre, body, footer), text,
    data: { invoiced: r2(invoiced), collected: r2(collected), clients: billedNow.size, newClients, outstanding: ov.kpis.outstanding, overdue: ov.kpis.overdue, netProfit: pnl?.netProfit ?? null, red: red.length, orange: orange.length } };
}

// ---------------------------------------------------------------------------
// Xero report parsing
// ---------------------------------------------------------------------------
export function parsePnL(report: any): PnLSummary | null {
  try {
    const rows: any[] = [];
    const walk = (rs: any[]) => (rs || []).forEach(r => { rows.push(r); if (r.Rows) walk(r.Rows); });
    walk(report?.Rows || []);
    const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? null : n; };
    const val = (...res: RegExp[]) => {
      for (const re of res) {
        const row = rows.find(r => r.Cells && re.test(String(r.Cells[0]?.Value || '').trim()));
        if (row) return num(row.Cells[1]?.Value);
      }
      return null;
    };
    const income = val(/^total (trading |operating )?income$/i, /^total revenue$/i, /^total sales$/i);
    const costOfSales = val(/^total cost of (sales|goods sold)$/i, /^total direct costs$/i);
    const grossProfit = val(/^gross profit$/i);
    const expenses = val(/^total operating expenses$/i, /^total expenses$/i, /^total overheads$/i);
    const netProfit = val(/^net profit$/i, /^net income$/i, /^net (loss|profit\/\(loss\))$/i);
    if (income == null && netProfit == null) return null;
    return { income, costOfSales, grossProfit: grossProfit ?? (income != null ? income - (costOfSales || 0) : null), expenses, netProfit };
  } catch { return null; }
}

export function parseBankSummary(report: any): BankLine[] | null {
  try {
    const out: BankLine[] = [];
    const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? null : n; };
    const walk = (rs: any[]) => (rs || []).forEach(r => {
      if (r.RowType === 'Row' && r.Cells?.length >= 5) {
        const name = String(r.Cells[0]?.Value || '').trim();
        if (name && !/^total/i.test(name)) out.push({ account: name, opening: num(r.Cells[1]?.Value), received: num(r.Cells[2]?.Value), spent: num(r.Cells[3]?.Value), closing: num(r.Cells[4]?.Value) });
      }
      if (r.Rows) walk(r.Rows);
    });
    walk(report?.Rows || []);
    return out.length ? out : null;
  } catch { return null; }
}

/** Is it time for this job, and which period is it for? */
export function dueReport(job: 'weekly' | 'monthly', now: Date, hourET: number): { due: boolean; key: string; reason: string } {
  const today = etDay(now);
  if (job === 'weekly') {
    const wk = lastWeek(now);
    const dow = new Date(today + 'T12:00:00Z').getUTCDay();
    // Monday from 6am ET; Tuesday and Wednesday are catch-up days if Monday was missed.
    const due = (dow === 1 && hourET >= 6) || dow === 2 || dow === 3;
    return { due, key: wk.key, reason: due ? `week ${wk.key}` : 'weekly report goes out on Mondays' };
  }
  const mp = lastMonthPeriod(now);
  const d = parseInt(today.slice(8, 10), 10);
  const due = (d === 1 && hourET >= 6) || (d >= 2 && d <= 5);
  return { due, key: mp.key, reason: due ? `month ${mp.key}` : 'monthly report goes out on the 1st' };
}
export { lateLevel, daysBetween };
