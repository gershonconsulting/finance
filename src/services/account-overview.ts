// v2.21.0 — Account overview: one pure function that turns the Xero ledger into
// everything the Dashboard, Invoices and Clients tabs (and the weekly / monthly
// e-mail reports) need. No Xero calls in here, so it can be tested offline.
//
// Date conventions
//  * Xero's "/Date(ms)/" is midnight UTC standing in for a calendar date, so
//    invoice / due / payment dates are read as UTC calendar days.
//  * "Today" is the Eastern calendar day (the company runs on New York time).
//  * Revenue (invoiced) is recognised on the invoice Date. Collected = payments
//    received (Xero Payments), falling back to FullyPaidOnDate when payments
//    are not available.

export interface OvInvoice {
  InvoiceID?: string;
  InvoiceNumber?: string;
  Reference?: string;
  Date?: string;
  DueDate?: string;
  FullyPaidOnDate?: string;
  Total?: number;
  AmountDue?: number;
  AmountPaid?: number;
  CurrencyCode?: string;
  Status?: string;
  Type?: string;
  Contact?: { Name?: string; ContactID?: string; AccountNumber?: string };
}

export interface OvPayment {
  Date?: string;
  Amount?: number;
  Status?: string;
  PaymentType?: string;
  Invoice?: { InvoiceID?: string; InvoiceNumber?: string; Type?: string; Contact?: { Name?: string; ContactID?: string } };
}

const BILLABLE = new Set(['PAID', 'AUTHORISED', 'SUBMITTED']);
const DAY = 86400000;
export const MONTH_DAYS = 30.44;

export const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
const r1 = (n: number) => Math.round((n || 0) * 10) / 10;

export function xeroDay(d: any): string | null {
  if (!d) return null;
  if (typeof d === 'string' && d.includes('/Date(')) {
    const m = d.match(/\/Date\((-?\d+)/);
    return m ? new Date(parseInt(m[1], 10)).toISOString().slice(0, 10) : null;
  }
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

/** Eastern-time calendar date (YYYY-MM-DD) for an instant. */
export function etDay(now: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const g = (t: string) => p.find(x => x.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
export function etHour(now: Date): number {
  return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(now), 10) % 24;
}

const dayNum = (s: string) => Date.parse(s + 'T00:00:00Z') / DAY;
export const daysBetween = (a: string, b: string) => Math.round(dayNum(b) - dayNum(a));
export const addDays = (s: string, n: number) => new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
export const monthKey = (s: string) => s.slice(0, 7);
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
const monthsInclusive = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
};
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (ym: string, short = false) => {
  const [y, m] = ym.split('-').map(Number);
  const n = MONTH_NAMES[m - 1];
  return short ? `${n.slice(0, 3)} ${String(y).slice(2)}` : `${n} ${y}`;
};

/** Late colour rule Olivier set: under 1 month green, 1–3 months orange, 3+ months red. */
export function lateLevel(daysOverdue: number): 'green' | 'orange' | 'red' {
  if (daysOverdue < 30) return 'green';
  if (daysOverdue < 90) return 'orange';
  return 'red';
}

export interface ClientRow {
  contactId: string;
  name: string;
  clientKey: string | null;
  active: boolean;
  firstInvoice: string | null;
  lastInvoice: string | null;
  monthsTogether: number;       // first invoice month → this month (active) / last invoice month (inactive)
  monthsBilled: number;         // distinct months with an invoice
  invoiceCount: number;
  invoicesPaid: number;         // fully paid invoices
  totalInvoiced: number;
  totalPaid: number;
  avgPerMonth: number;          // total invoiced ÷ months billed
  avgInvoice: number;
  avgDaysToPay: number | null;  // invoice date → fully paid
  avgDaysLate: number | null;   // paid date − due date, floored at 0
  onTimeRate: number | null;    // share of paid invoices paid by the due date (+3 days grace)
  paymentGrade: 'A' | 'B' | 'C' | 'D' | '—';
  paymentLabel: string;
  owed: number;                 // all open balances
  overdue: number;              // open balances past due
  overdueCount: number;
  oldestOverdueDays: number;    // 0 when nothing is overdue
  monthsLate: number;           // oldestOverdueDays ÷ 30.44, one decimal
  lateLevel: 'green' | 'orange' | 'red';
  lastPayment: string | null;
  sharePct: number;             // share of trailing-12-month billing
  inLegal: boolean;             // v2.22.0 — open balance handed to legal, excluded from collections
}

export interface OpenInvoice {
  invoiceId: string;
  number: string;
  reference: string;
  contactId: string;
  client: string;
  date: string | null;
  dueDate: string | null;
  total: number;
  amountDue: number;
  status: string;
  daysOverdue: number;          // negative = due in N days
  lateLevel: 'green' | 'orange' | 'red';
}

/** v2.22.0 — Long unpaid cases handed to legal. Collection on them is unlikely,
 *  so they are kept out of every collection figure (owed, overdue, ageing, DSO,
 *  collection rate, late alerts) and shown in a section of their own.
 *  A client is "in legal" when any of its open invoices is at least
 *  `thresholdDays` past due, or when it is listed in `include`; `exclude`
 *  overrides both. Entries match a ContactID or a client name (case-insensitive). */
export interface LegalSettings { thresholdDays: number; include: string[]; exclude: string[] }
export const DEFAULT_LEGAL: LegalSettings = { thresholdDays: 180, include: [], exclude: [] };

export interface LegalCase {
  contactId: string;
  client: string;
  reason: 'auto' | 'manual';
  amountDue: number;
  invoiceCount: number;
  oldestDays: number;
  monthsLate: number;
  firstDue: string | null;
  lastPayment: string | null;
}

export interface Overview {
  generatedAt: string;
  today: string;
  currency: string;
  kpis: Record<string, any>;
  monthly: Array<{ month: string; label: string; invoiced: number; collected: number; invoices: number; activeClients: number }>;
  aging: Array<{ key: string; label: string; amount: number; count: number; level: string }>;
  openInvoices: OpenInvoice[];
  clients: ClientRow[];
  recentPayments: Array<{ date: string; client: string; number: string; amount: number }>;
  upcomingDue: OpenInvoice[];
  alerts: Array<{ level: 'red' | 'orange' | 'info'; text: string }>;
  drafts: { count: number; amount: number };
  collectedSource: 'payments' | 'fully-paid-date';
  legal: { settings: LegalSettings; amount: number; count: number; cases: LegalCase[]; invoices: OpenInvoice[] };
}

export function gradePayment(avgDaysLate: number | null, onTimeRate: number | null, oldestOverdueDays: number): { grade: ClientRow['paymentGrade']; label: string } {
  if (avgDaysLate == null && oldestOverdueDays <= 0) return { grade: '—', label: 'No payment history yet' };
  // Current lateness counts as much as past behaviour.
  const late = Math.max(avgDaysLate ?? 0, oldestOverdueDays > 0 ? oldestOverdueDays * 0.75 : 0);
  const ot = onTimeRate ?? 1;
  if (late <= 7 && ot >= 0.75) return { grade: 'A', label: 'Pays on time' };
  if (late <= 20) return { grade: 'B', label: 'Usually a little late' };
  if (late <= 45) return { grade: 'C', label: 'Often late' };
  return { grade: 'D', label: 'Very late payer' };
}

export function buildOverview(
  invoicesIn: OvInvoice[],
  paymentsIn: OvPayment[] | null,
  now: Date = new Date(),
  opts: { clientKeys?: (name: string, accountNumber?: string) => string | null; legal?: Partial<LegalSettings> | null } = {},
): Overview {
  const legalSettings: LegalSettings = {
    thresholdDays: Number(opts.legal?.thresholdDays) > 0 ? Math.round(Number(opts.legal!.thresholdDays)) : DEFAULT_LEGAL.thresholdDays,
    include: Array.isArray(opts.legal?.include) ? opts.legal!.include!.map(String) : [],
    exclude: Array.isArray(opts.legal?.exclude) ? opts.legal!.exclude!.map(String) : [],
  };
  const today = etDay(now);
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);
  const invoices = invoicesIn.filter(i => !i.Type || i.Type === 'ACCREC');
  const billable = invoices.filter(i => BILLABLE.has(String(i.Status)));
  const drafts = invoices.filter(i => i.Status === 'DRAFT');
  const currency = billable.find(i => i.CurrencyCode)?.CurrencyCode || 'USD';

  // ---- payments (cash in) ---------------------------------------------------
  const { pays, source: collectedSource } = collectPayments(invoices, paymentsIn);

  // ---- monthly series (13 months: 12 complete + current) --------------------
  const months: string[] = [];
  for (let k = 12; k >= 0; k--) months.push(addMonths(thisMonth, -k));
  const mIdx = new Map(months.map((m, i) => [m, i]));
  const monthly = months.map(m => ({ month: m, label: monthLabel(m, true), invoiced: 0, collected: 0, invoices: 0, activeClients: 0, _c: new Set<string>() }));
  for (const i of billable) {
    const d = xeroDay(i.Date); if (!d) continue;
    const ix = mIdx.get(monthKey(d)); if (ix == null) continue;
    monthly[ix].invoiced += i.Total || 0;
    monthly[ix].invoices += 1;
    monthly[ix]._c.add(i.Contact?.ContactID || i.Contact?.Name || '?');
  }
  for (const p of pays) {
    const ix = mIdx.get(monthKey(p.date)); if (ix != null) monthly[ix].collected += p.amount;
  }
  const monthlyOut = monthly.map(m => ({ month: m.month, label: m.label, invoiced: r2(m.invoiced), collected: r2(m.collected), invoices: m.invoices, activeClients: m._c.size }));

  // ---- open invoices ----------------------------------------------------------
  const allOpen: OpenInvoice[] = billable
    .filter(i => (i.AmountDue || 0) > 0.005 && i.Status !== 'PAID')
    .map(i => {
      const due = xeroDay(i.DueDate);
      const daysOverdue = due ? daysBetween(due, today) : 0;
      return {
        invoiceId: i.InvoiceID || '', number: i.InvoiceNumber || '', reference: i.Reference || '',
        contactId: i.Contact?.ContactID || '', client: i.Contact?.Name || 'Unknown',
        date: xeroDay(i.Date), dueDate: due, total: r2(i.Total || 0), amountDue: r2(i.AmountDue || 0),
        status: String(i.Status), daysOverdue, lateLevel: lateLevel(Math.max(0, daysOverdue)),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // ---- legal: split long-unpaid cases out of collections ---------------------
  const keyOf = (o: { contactId: string; client: string }) => o.contactId || 'name:' + o.client;
  const listed = (list: string[], o: { contactId: string; client: string }) =>
    list.some(x => { const v = x.trim().toLowerCase(); return !!v && (v === o.contactId.toLowerCase() || v === o.client.trim().toLowerCase()); });
  const legalReason = new Map<string, 'auto' | 'manual'>();
  for (const o of allOpen) {
    const k = keyOf(o);
    if (legalReason.has(k) || listed(legalSettings.exclude, o)) continue;
    if (listed(legalSettings.include, o)) legalReason.set(k, 'manual');
    else if (o.daysOverdue >= legalSettings.thresholdDays) legalReason.set(k, 'auto');
  }
  const legalInvoices = allOpen.filter(o => legalReason.has(keyOf(o)));
  const openInvoices = allOpen.filter(o => !legalReason.has(keyOf(o)));
  const overdueInv = openInvoices.filter(o => o.daysOverdue > 0);
  const outstanding = openInvoices.reduce((s, o) => s + o.amountDue, 0);
  const overdueAmt = overdueInv.reduce((s, o) => s + o.amountDue, 0);

  const bucket = (key: string, label: string, level: string, f: (d: number) => boolean) => {
    const xs = openInvoices.filter(o => f(o.daysOverdue));
    return { key, label, level, amount: r2(xs.reduce((s, o) => s + o.amountDue, 0)), count: xs.length };
  };
  const aging = [
    bucket('notdue', 'Not yet due', 'blue', d => d <= 0),
    bucket('d1_30', '1–30 days late', 'green', d => d > 0 && d < 30),
    bucket('d30_60', '30–60 days late', 'orange', d => d >= 30 && d < 60),
    bucket('d60_90', '60–90 days late', 'orange', d => d >= 60 && d < 90),
    bucket('d90', '90+ days late', 'red', d => d >= 90),
  ];

  // ---- clients ----------------------------------------------------------------
  const ttmStart = addMonths(thisMonth, -12) + '-01';
  const ttmBilled = billable.reduce((s, i) => { const d = xeroDay(i.Date); return d && d >= ttmStart ? s + (i.Total || 0) : s; }, 0);
  const groups = new Map<string, OvInvoice[]>();
  for (const i of billable) {
    const id = i.Contact?.ContactID || 'name:' + (i.Contact?.Name || 'Unknown');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(i);
  }
  const lastPayByClient = new Map<string, string>();
  for (const p of pays) if (p.contactId && !lastPayByClient.has(p.contactId)) lastPayByClient.set(p.contactId, p.date);

  const clients: ClientRow[] = [];
  for (const [id, invs] of groups) {
    const name = invs[0].Contact?.Name || 'Unknown';
    const dates = invs.map(i => xeroDay(i.Date)).filter(Boolean).sort() as string[];
    const first = dates[0] || null, last = dates[dates.length - 1] || null;
    const open = allOpen.filter(o => (o.contactId || 'name:' + o.client) === id);
    const inLegal = legalReason.has(id);
    const hasFutureDue = open.some(o => o.daysOverdue <= 0);
    const active = !!last && (daysBetween(last, today) <= 62 || hasFutureDue);
    const monthsTogether = first ? monthsInclusive(monthKey(first), active ? thisMonth : monthKey(last!)) : 0;
    const monthsBilled = new Set(dates.map(monthKey)).size;
    const totalInvoiced = invs.reduce((s, i) => s + (i.Total || 0), 0);
    const totalPaid = invs.reduce((s, i) => s + (i.AmountPaid || 0), 0);
    const paidRows = invs.filter(i => i.Status === 'PAID' && xeroDay(i.FullyPaidOnDate)).map(i => {
      const d = xeroDay(i.Date)!, due = xeroDay(i.DueDate), paid = xeroDay(i.FullyPaidOnDate)!;
      return { toPay: Math.max(0, daysBetween(d, paid)), late: due ? daysBetween(due, paid) : 0 };
    });
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    const avgDaysToPay = avg(paidRows.map(p => p.toPay));
    const avgDaysLate = avg(paidRows.map(p => Math.max(0, p.late)));
    const onTimeRate = paidRows.length ? paidRows.filter(p => p.late <= 3).length / paidRows.length : null;
    const od = open.filter(o => o.daysOverdue > 0);
    const oldest = od.length ? Math.max(...od.map(o => o.daysOverdue)) : 0;
    const g = gradePayment(avgDaysLate, onTimeRate, oldest);
    const ttm = invs.reduce((s, i) => { const d = xeroDay(i.Date); return d && d >= ttmStart ? s + (i.Total || 0) : s; }, 0);
    clients.push({
      contactId: id.startsWith('name:') ? '' : id,
      name,
      clientKey: opts.clientKeys ? opts.clientKeys(name, invs[0].Contact?.AccountNumber) : null,
      active,
      firstInvoice: first, lastInvoice: last,
      monthsTogether, monthsBilled,
      invoiceCount: invs.length,
      invoicesPaid: invs.filter(i => i.Status === 'PAID').length,
      totalInvoiced: r2(totalInvoiced), totalPaid: r2(totalPaid),
      avgPerMonth: r2(monthsBilled ? totalInvoiced / monthsBilled : 0),
      avgInvoice: r2(invs.length ? totalInvoiced / invs.length : 0),
      avgDaysToPay: avgDaysToPay == null ? null : Math.round(avgDaysToPay),
      avgDaysLate: avgDaysLate == null ? null : Math.round(avgDaysLate),
      onTimeRate: onTimeRate == null ? null : Math.round(onTimeRate * 100) / 100,
      paymentGrade: g.grade, paymentLabel: g.label,
      owed: r2(open.reduce((s, o) => s + o.amountDue, 0)),
      overdue: r2(od.reduce((s, o) => s + o.amountDue, 0)),
      overdueCount: od.length,
      oldestOverdueDays: oldest,
      monthsLate: r1(oldest / MONTH_DAYS),
      lateLevel: lateLevel(oldest),
      lastPayment: lastPayByClient.get(id) || invs.map(i => xeroDay(i.FullyPaidOnDate)).filter(Boolean).sort().pop() || null,
      sharePct: ttmBilled > 0 ? r1((ttm / ttmBilled) * 100) : 0,
      inLegal,
    });
  }
  clients.sort((a, b) => (Number(b.active) - Number(a.active)) || (b.avgPerMonth - a.avgPerMonth));
  const activeClients = clients.filter(c => c.active);

  // ---- KPIs ---------------------------------------------------------------------
  const mo = (m: string) => monthlyOut.find(x => x.month === m) || { invoiced: 0, collected: 0, invoices: 0, activeClients: 0 };
  const cur = mo(thisMonth), prev = mo(lastMonth);
  const complete12 = monthlyOut.slice(0, 12);
  const ttmInvoiced = complete12.reduce((s, m) => s + m.invoiced, 0);
  // Invoices in legal are taken out of the collection-rate base.
  const ttmFrom = complete12[0].month + '-01', ttmTo = complete12[11].month + '-31';
  const legalTtmInvoiced = legalInvoices.reduce((s, o) => (o.date && o.date >= ttmFrom && o.date <= ttmTo ? s + o.total : s), 0);
  const collectibleInvoiced = Math.max(0, ttmInvoiced - legalTtmInvoiced);
  const ttmCollected = complete12.reduce((s, m) => s + m.collected, 0);
  const since90 = addDays(today, -90);
  const recentPaid = billable.filter(i => i.Status === 'PAID' && (xeroDay(i.FullyPaidOnDate) || '') >= since90);
  const avgDaysToPay90 = recentPaid.length
    ? Math.round(recentPaid.reduce((s, i) => s + Math.max(0, daysBetween(xeroDay(i.Date)!, xeroDay(i.FullyPaidOnDate)!)), 0) / recentPaid.length)
    : null;
  const dayOfMonth = parseInt(today.slice(8, 10), 10);
  const [ty, tm] = thisMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const recurring = activeClients.reduce((s, c) => s + c.avgPerMonth, 0);
  const kpis = {
    thisMonth, lastMonth, dayOfMonth, daysInMonth,
    invoicedThisMonth: r2(cur.invoiced), invoicedLastMonth: r2(prev.invoiced),
    collectedThisMonth: r2(cur.collected), collectedLastMonth: r2(prev.collected),
    invoicesThisMonth: cur.invoices,
    outstanding: r2(outstanding), outstandingCount: openInvoices.length,
    overdue: r2(overdueAmt), overdueCount: overdueInv.length,
    overdueShare: outstanding > 0 ? Math.round((overdueAmt / outstanding) * 100) : 0,
    activeClients: activeClients.length, inactiveClients: clients.length - activeClients.length,
    clientsRed: clients.filter(c => !c.inLegal && c.lateLevel === 'red').length,
    clientsOrange: clients.filter(c => !c.inLegal && c.lateLevel === 'orange').length,
    recurringMonthly: r2(recurring),
    ttmInvoiced: r2(ttmInvoiced), ttmCollected: r2(ttmCollected),
    avgMonthlyInvoiced: r2(ttmInvoiced / 12),
    collectionRate: collectibleInvoiced > 0 ? Math.round((ttmCollected / collectibleInvoiced) * 100) : null,
    legalAmount: 0, legalCount: 0, legalClients: 0,
    avgDaysToPay90,
    dso: ttmInvoiced > 0 ? Math.round(outstanding / (ttmInvoiced / 365)) : null,
    topClientShare: clients.length ? Math.max(...clients.map(c => c.sharePct)) : 0,
    ytdInvoiced: r2(billable.reduce((s, i) => { const d = xeroDay(i.Date); return d && d.slice(0, 4) === today.slice(0, 4) ? s + (i.Total || 0) : s; }, 0)),
    ytdCollected: r2(pays.reduce((s, p) => (p.date.slice(0, 4) === today.slice(0, 4) ? s + p.amount : s), 0)),
  };

  // ---- lists ----------------------------------------------------------------------
  const recentPayments = pays.slice(0, 10).map(p => ({ date: p.date, client: p.client, number: p.number, amount: r2(p.amount) }));
  const upcomingDue = openInvoices.filter(o => o.daysOverdue <= 0 && o.daysOverdue >= -30).sort((a, b) => b.daysOverdue - a.daysOverdue);

  const alerts: Overview['alerts'] = [];
  for (const c of clients.filter(c => !c.inLegal && c.lateLevel === 'red').sort((a, b) => b.overdue - a.overdue)) {
    alerts.push({ level: 'red', text: `${c.name} owes ${fmtMoney(c.overdue, currency)} — ${c.monthsLate} months late${c.active ? '' : ' (inactive client)'}` });
  }
  for (const c of clients.filter(c => !c.inLegal && c.lateLevel === 'orange').sort((a, b) => b.overdue - a.overdue)) {
    alerts.push({ level: 'orange', text: `${c.name} owes ${fmtMoney(c.overdue, currency)} — ${c.monthsLate} months late` });
  }
  // legal cases
  const cases: LegalCase[] = [];
  for (const [k, reason] of legalReason) {
    const xs = legalInvoices.filter(o => keyOf(o) === k);
    const oldest = Math.max(0, ...xs.map(o => o.daysOverdue));
    const dues = xs.map(o => o.dueDate).filter(Boolean).sort() as string[];
    cases.push({
      contactId: xs[0].contactId, client: xs[0].client, reason,
      amountDue: r2(xs.reduce((s, o) => s + o.amountDue, 0)), invoiceCount: xs.length,
      oldestDays: oldest, monthsLate: r1(oldest / MONTH_DAYS), firstDue: dues[0] || null,
      lastPayment: clients.find(c => (c.contactId || 'name:' + c.name) === k)?.lastPayment || null,
    });
  }
  cases.sort((a, b) => b.amountDue - a.amountDue);
  const legalAmount = r2(legalInvoices.reduce((s, o) => s + o.amountDue, 0));
  Object.assign(kpis, { legalAmount, legalCount: legalInvoices.length, legalClients: cases.length });
  if (cases.length) alerts.push({ level: 'info', text: `${cases.length} case${cases.length > 1 ? 's' : ''} in legal (${fmtMoney(legalAmount, currency)}) — kept out of collections` });

  if (drafts.length) alerts.push({ level: 'info', text: `${drafts.length} draft invoice${drafts.length > 1 ? 's' : ''} (${fmtMoney(drafts.reduce((s, i) => s + (i.Total || 0), 0), currency)}) not yet sent` });

  return {
    generatedAt: now.toISOString(), today, currency, kpis,
    monthly: monthlyOut, aging, openInvoices, clients,
    recentPayments, upcomingDue, alerts,
    drafts: { count: drafts.length, amount: r2(drafts.reduce((s, i) => s + (i.Total || 0), 0)) },
    collectedSource,
    legal: { settings: legalSettings, amount: legalAmount, count: legalInvoices.length, cases, invoices: legalInvoices },
  };
}

export type Pay = { date: string; amount: number; client: string; contactId: string; number: string };

/** Cash received against receivables, newest first. Uses Xero Payments when
 *  available, otherwise FullyPaidOnDate (which misses part-payments). */
export function collectPayments(invoicesIn: OvInvoice[], paymentsIn: OvPayment[] | null): { pays: Pay[]; source: 'payments' | 'fully-paid-date' } {
  const invoices = invoicesIn.filter(i => !i.Type || i.Type === 'ACCREC');
  const pays: Pay[] = [];
  let source: 'payments' | 'fully-paid-date' = 'payments';
  const invById = new Map(invoices.map(i => [i.InvoiceID || '', i]));
  if (paymentsIn && paymentsIn.length) {
    for (const p of paymentsIn) {
      if (p.Status && p.Status !== 'AUTHORISED') continue;
      if (p.Invoice?.Type && p.Invoice.Type !== 'ACCREC') continue;
      if (p.PaymentType && !/^ACCREC/.test(p.PaymentType)) continue;
      const d = xeroDay(p.Date); if (!d) continue;
      const inv = invById.get(p.Invoice?.InvoiceID || '');
      pays.push({
        date: d, amount: p.Amount || 0,
        client: p.Invoice?.Contact?.Name || inv?.Contact?.Name || 'Unknown',
        contactId: p.Invoice?.Contact?.ContactID || inv?.Contact?.ContactID || '',
        number: p.Invoice?.InvoiceNumber || inv?.InvoiceNumber || '',
      });
    }
  } else {
    source = 'fully-paid-date';
    for (const i of invoices) {
      if (!BILLABLE.has(String(i.Status))) continue;
      const d = xeroDay(i.FullyPaidOnDate);
      if (d && (i.AmountPaid || 0) > 0) pays.push({ date: d, amount: i.AmountPaid || 0, client: i.Contact?.Name || 'Unknown', contactId: i.Contact?.ContactID || '', number: i.InvoiceNumber || '' });
    }
  }
  pays.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { pays, source };
}

export function fmtMoney(n: number, currency = 'USD'): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n || 0);
  const s = v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${sign}${currency === 'USD' ? '$' : currency + ' '}${s}`;
}
