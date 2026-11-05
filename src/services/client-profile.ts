// v2.20.0 — Client profile: everything worth knowing about one client before a call.
// Pure function so it can be tested without Xero. `now` is injectable.

export interface ProfileInvoice {
  InvoiceID?: string;
  InvoiceNumber?: string;
  Reference?: string;
  Date?: string;
  DueDate?: string;
  FullyPaidOnDate?: string;
  Total?: number;
  AmountDue?: number;
  AmountPaid?: number;
  AmountCredited?: number;
  CurrencyCode?: string;
  Status?: string;
  Type?: string;
  Contact?: { Name?: string; ContactID?: string };
  LineItems?: Array<{ Description?: string; LineAmount?: number; Quantity?: number; UnitAmount?: number }>;
}

export interface ProfileContact {
  ContactID?: string;
  Name?: string;
  AccountNumber?: string;
  ContactNumber?: string;
  EmailAddress?: string;
  FirstName?: string;
  LastName?: string;
  Phones?: Array<{ PhoneType?: string; PhoneNumber?: string; PhoneAreaCode?: string; PhoneCountryCode?: string }>;
  PaymentTerms?: any;
}

export interface CompanyContext {
  netMarginPct: number | null;   // company net profit / income, trailing 12 months, from Xero P&L
  marginSource: string;
  totalRevenueAllClients: number; // TTM-agnostic: all billable invoices, all clients
  clientRank: number | null;      // 1 = biggest client by lifetime invoiced
  clientCount: number;
}

// Canonical Gershon client key numbers (same number on every Gershon platform).
// Xero's AccountNumber wins when it is filled in; this list is the fallback.
export const KNOWN_CLIENT_KEYS: Array<{ key: string; match: string }> = [
  { key: '175', match: 'finance montreal' },
  { key: '200', match: 'mabsilico' },
  { key: '212', match: 'wallix' },
  { key: '229', match: 'altavia' },
  { key: '233', match: 'valos' },
  { key: '245', match: 'phitech' },
  { key: '246', match: 'enzymicals' },
  { key: '247', match: 'flying secoya' },
  { key: '248', match: 'meteor biotech' },
  { key: '250', match: 'amphasys' },
];

const BILLABLE = ['PAID', 'AUTHORISED', 'SUBMITTED'];
const DAY = 86400000;
const FEE_WORDS = /\b(late fee|late payment|interest|penalt|surcharge|collection fee|admin(istration)? fee|reminder fee)/i;

export function parseXeroDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d === 'string' && d.includes('/Date(')) {
    const m = d.match(/\/Date\((-?\d+)/);
    return m ? new Date(parseInt(m[1], 10)) : null;
  }
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

const iso = (d: Date | null) => (d ? d.toISOString().split('T')[0] : null);
const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function resolveClientKey(contact: ProfileContact | null, name: string): { key: string | null; source: string } {
  if (contact?.AccountNumber) return { key: String(contact.AccountNumber).trim(), source: 'Xero account number' };
  const n = norm(name);
  const hit = KNOWN_CLIENT_KEYS.find(k => n.includes(k.match));
  if (hit) return { key: hit.key, source: 'Gershon client list' };
  if (contact?.ContactNumber) return { key: String(contact.ContactNumber).trim(), source: 'Xero contact number' };
  return { key: null, source: 'not set — add an Account Number on the Xero contact' };
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildClientProfile(
  invoicesIn: ProfileInvoice[],
  contact: ProfileContact | null,
  company: CompanyContext,
  now: Date = new Date(),
) {
  const all = invoicesIn.filter(i => !i.Type || i.Type === 'ACCREC');
  const name = contact?.Name || all[0]?.Contact?.Name || 'Unknown client';
  const billable = all.filter(i => BILLABLE.includes(String(i.Status)));
  const drafts = all.filter(i => i.Status === 'DRAFT');
  const voided = all.filter(i => i.Status === 'VOIDED' || i.Status === 'DELETED');
  const currency = billable.find(i => i.CurrencyCode)?.CurrencyCode || 'USD';

  // ---- money ----------------------------------------------------------------
  const totalInvoiced = billable.reduce((s, i) => s + (i.Total || 0), 0);
  const totalPaid = billable.reduce((s, i) => s + (i.AmountPaid || 0), 0);
  const totalCredited = billable.reduce((s, i) => s + (i.AmountCredited || 0), 0);
  const open = billable.filter(i => (i.AmountDue || 0) > 0.005);
  const outstanding = open.reduce((s, i) => s + (i.AmountDue || 0), 0);
  const overdueList = open
    .map(i => ({ inv: i, due: parseXeroDate(i.DueDate) }))
    .filter(x => x.due && x.due.getTime() < now.getTime() - DAY / 2)
    .map(x => ({ inv: x.inv, daysOverdue: Math.floor((now.getTime() - (x.due as Date).getTime()) / DAY) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  const overdueAmount = overdueList.reduce((s, x) => s + (x.inv.AmountDue || 0), 0);

  // ---- relationship ---------------------------------------------------------
  const dated = billable.map(i => ({ i, d: parseXeroDate(i.Date) })).filter(x => x.d) as Array<{ i: ProfileInvoice; d: Date }>;
  dated.sort((a, b) => a.d.getTime() - b.d.getTime());
  const first = dated[0]?.d || null;
  const last = dated[dated.length - 1]?.d || null;
  const billedMonthKeys = new Set(dated.map(x => `${x.d.getFullYear()}-${String(x.d.getMonth() + 1).padStart(2, '0')}`));
  const tenureMonths = first && last ? monthsBetween(first, last) : 0;
  const monthsSinceFirst = first ? monthsBetween(first, now) : 0;
  const daysSinceLastInvoice = last ? Math.floor((now.getTime() - last.getTime()) / DAY) : null;
  const status = daysSinceLastInvoice == null ? 'No invoices'
    : daysSinceLastInvoice <= 45 ? 'Active'
    : daysSinceLastInvoice <= 120 ? 'Slowing down'
    : 'Inactive';

  // ---- monthly series (by invoice date) -------------------------------------
  const monthly: Record<string, { invoiced: number; paid: number; count: number }> = {};
  for (const x of dated) {
    const k = `${x.d.getFullYear()}-${String(x.d.getMonth() + 1).padStart(2, '0')}`;
    monthly[k] = monthly[k] || { invoiced: 0, paid: 0, count: 0 };
    monthly[k].invoiced += x.i.Total || 0;
    monthly[k].paid += x.i.AmountPaid || 0;
    monthly[k].count += 1;
  }
  const monthlySeries = Object.keys(monthly).sort().map(k => ({ month: k, invoiced: r2(monthly[k].invoiced), paid: r2(monthly[k].paid), count: monthly[k].count }));

  // ---- payment behaviour ----------------------------------------------------
  const paidRows = billable
    .filter(i => i.Status === 'PAID' && i.FullyPaidOnDate)
    .map(i => {
      const d = parseXeroDate(i.Date), due = parseXeroDate(i.DueDate), paid = parseXeroDate(i.FullyPaidOnDate);
      if (!d || !paid) return null;
      return {
        date: d,
        daysToPay: Math.max(0, Math.round((paid.getTime() - d.getTime()) / DAY)),
        daysLate: due ? Math.round((paid.getTime() - due.getTime()) / DAY) : 0,
      };
    })
    .filter(Boolean) as Array<{ date: Date; daysToPay: number; daysLate: number }>;
  paidRows.sort((a, b) => a.date.getTime() - b.date.getTime());
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const avgDaysToPay = avg(paidRows.map(p => p.daysToPay));
  const avgDaysLate = avg(paidRows.map(p => Math.max(0, p.daysLate)));
  const onTime = paidRows.filter(p => p.daysLate <= 0).length;
  const onTimeRate = paidRows.length ? onTime / paidRows.length : null;
  const worstLate = paidRows.length ? Math.max(...paidRows.map(p => p.daysLate)) : null;
  const recent = paidRows.slice(-3), earlier = paidRows.slice(0, -3);
  const recentAvgToPay = avg(recent.map(p => p.daysToPay));
  const earlierAvgToPay = avg(earlier.map(p => p.daysToPay));
  let trend: 'faster' | 'slower' | 'steady' | 'not enough history' = 'not enough history';
  if (recentAvgToPay != null && earlierAvgToPay != null && earlier.length >= 2) {
    const diff = recentAvgToPay - earlierAvgToPay;
    trend = diff <= -5 ? 'faster' : diff >= 5 ? 'slower' : 'steady';
  }
  const termsDays = median(billable
    .map(i => { const d = parseXeroDate(i.Date), due = parseXeroDate(i.DueDate); return d && due ? Math.round((due.getTime() - d.getTime()) / DAY) : null; })
    .filter((x): x is number => x != null));
  const lastPaid = paidRows.length ? paidRows[paidRows.length - 1] : null;
  const lastPaymentDate = billable
    .map(i => parseXeroDate(i.FullyPaidOnDate))
    .filter(Boolean)
    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] || null;

  // ---- what we bill them for (fees) -----------------------------------------
  const lineMap = new Map<string, { label: string; amount: number; count: number }>();
  let lineItemsSeen = 0;
  const feeLines: Array<{ invoice: string; description: string; amount: number }> = [];
  for (const inv of billable) {
    for (const li of inv.LineItems || []) {
      lineItemsSeen++;
      const label = (li.Description || 'No description').split('\n')[0].trim().slice(0, 80) || 'No description';
      const k = norm(label).replace(/\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g, '').trim() || label;
      const clean = label.replace(/\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\b/gi, '').replace(/[\s\-–—:,/]+$/, '').replace(/\s{2,}/g, ' ').trim() || label;
      const cur = lineMap.get(k) || { label: clean, amount: 0, count: 0 };
      cur.amount += li.LineAmount || 0;
      cur.count += 1;
      lineMap.set(k, cur);
      if (FEE_WORDS.test(li.Description || '')) feeLines.push({ invoice: inv.InvoiceNumber || '', description: label, amount: r2(li.LineAmount || 0) });
    }
  }
  const services = Array.from(lineMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 10)
    .map(s => ({ label: s.label, amount: r2(s.amount), count: s.count }));

  // ---- profit (estimate) ----------------------------------------------------
  const profit = company.netMarginPct != null
    ? { estimated: r2(totalInvoiced * company.netMarginPct / 100), basis: 'invoiced', marginPct: r1(company.netMarginPct), source: company.marginSource, exact: false }
    : { estimated: null, basis: 'invoiced', marginPct: null, source: company.marginSource, exact: false };

  // ---- grade -----------------------------------------------------------------
  const reasons: string[] = [];
  let score = 100;
  if (avgDaysLate != null) {
    if (avgDaysLate > 30) { score -= 35; reasons.push(`pays ${Math.round(avgDaysLate)} days late on average`); }
    else if (avgDaysLate > 10) { score -= 20; reasons.push(`pays ${Math.round(avgDaysLate)} days late on average`); }
    else if (avgDaysLate > 3) { score -= 8; reasons.push(`usually a few days late`); }
    else reasons.push('pays on time');
  } else reasons.push('no paid invoices yet to judge payment speed');
  if (overdueList.length) {
    const oldest = overdueList[0].daysOverdue;
    score -= oldest > 60 ? 30 : oldest > 30 ? 18 : 8;
    reasons.push(`${overdueList.length} invoice${overdueList.length > 1 ? 's' : ''} overdue, oldest ${oldest} days`);
  }
  if (totalInvoiced > 0 && outstanding / totalInvoiced > 0.5) { score -= 10; reasons.push('more than half of everything billed is still unpaid'); }
  if (tenureMonths >= 12) { score += 5; reasons.push(`${tenureMonths}-month relationship`); }
  if (trend === 'slower') { score -= 7; reasons.push('paying slower than before'); }
  if (trend === 'faster') { score += 3; reasons.push('paying faster than before'); }
  if (status === 'Inactive') reasons.push(`no invoice in ${daysSinceLastInvoice} days`);
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  const gradeLabel = { A: 'Excellent client', B: 'Good client', C: 'Needs follow-up', D: 'At risk' }[grade];

  const sharePct = company.totalRevenueAllClients > 0 ? (totalInvoiced / company.totalRevenueAllClients) * 100 : null;

  // ---- call prep --------------------------------------------------------------
  const callPrep: string[] = [];
  if (overdueList.length) {
    callPrep.push(`Ask about ${overdueList.length} overdue invoice${overdueList.length > 1 ? 's' : ''} totalling ${fmt(overdueAmount, currency)}: ` +
      overdueList.slice(0, 4).map(x => `${x.inv.InvoiceNumber || 'n/a'} (${fmt(x.inv.AmountDue || 0, currency)}, ${x.daysOverdue}d late)`).join(', ') + '.');
  } else if (outstanding > 0) {
    callPrep.push(`${fmt(outstanding, currency)} open but not yet due — nothing to chase.`);
  } else {
    callPrep.push('Nothing owed right now — account is clean.');
  }
  if (avgDaysToPay != null) callPrep.push(`They usually pay ${Math.round(avgDaysToPay)} days after the invoice date (terms ${termsDays ?? '?'} days); ${onTimeRate != null ? Math.round(onTimeRate * 100) : 0}% of invoices paid on time.`);
  if (trend === 'slower') callPrep.push('Payments are getting slower — worth asking if anything changed on their side.');
  if (status !== 'Active' && daysSinceLastInvoice != null) callPrep.push(`Last invoice was ${daysSinceLastInvoice} days ago — check whether the engagement is still running.`);
  if (feeLines.length) callPrep.push(`${feeLines.length} fee/interest line${feeLines.length > 1 ? 's' : ''} already charged (${fmt(feeLines.reduce((s, f) => s + f.amount, 0), currency)}).`);
  if (sharePct != null && sharePct >= 20) callPrep.push(`They are ${Math.round(sharePct)}% of all revenue billed — a key account.`);

  const key = resolveClientKey(contact, name);
  const phone = (contact?.Phones || []).find(p => p.PhoneNumber);

  const invoices = [...all]
    .map(i => {
      const d = parseXeroDate(i.Date), due = parseXeroDate(i.DueDate), paid = parseXeroDate(i.FullyPaidOnDate);
      const open = BILLABLE.includes(String(i.Status)) && (i.AmountDue || 0) > 0.005;
      const daysLate = paid && due ? Math.round((paid.getTime() - due.getTime()) / DAY)
        : open && due && due.getTime() < now.getTime() ? Math.floor((now.getTime() - due.getTime()) / DAY) : null;
      return {
        number: i.InvoiceNumber || '', reference: i.Reference || '', status: i.Status || '',
        date: iso(d), dueDate: iso(due), paidDate: iso(paid),
        total: r2(i.Total || 0), amountDue: r2(i.AmountDue || 0),
        daysToPay: paid && d ? Math.round((paid.getTime() - d.getTime()) / DAY) : null,
        daysLate, overdue: open && daysLate != null && daysLate > 0,
      };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    client: {
      name, contactId: contact?.ContactID || all[0]?.Contact?.ContactID || null,
      key: key.key, keySource: key.source,
      email: contact?.EmailAddress || null,
      contactPerson: [contact?.FirstName, contact?.LastName].filter(Boolean).join(' ') || null,
      phone: phone ? [phone.PhoneCountryCode, phone.PhoneAreaCode, phone.PhoneNumber].filter(Boolean).join(' ') : null,
      currency,
    },
    grade: { letter: grade, label: gradeLabel, score, reasons },
    relationship: {
      status, firstInvoice: iso(first), lastInvoice: iso(last),
      tenureMonths, monthsSinceFirst, billedMonths: billedMonthKeys.size, daysSinceLastInvoice,
      rank: company.clientRank, clientCount: company.clientCount, sharePct: sharePct != null ? r1(sharePct) : null,
    },
    money: {
      invoiceCount: billable.length, draftCount: drafts.length, voidedCount: voided.length,
      totalInvoiced: r2(totalInvoiced), totalPaid: r2(totalPaid), totalCredited: r2(totalCredited),
      outstanding: r2(outstanding), overdueAmount: r2(overdueAmount), overdueCount: overdueList.length,
      oldestOverdueDays: overdueList[0]?.daysOverdue ?? null,
      avgInvoice: billable.length ? r2(totalInvoiced / billable.length) : 0,
      avgPerBilledMonth: billedMonthKeys.size ? r2(totalInvoiced / billedMonthKeys.size) : 0,
      avgPerMonthOfTenure: tenureMonths ? r2(totalInvoiced / tenureMonths) : 0,
    },
    payment: {
      paidInvoices: paidRows.length,
      avgDaysToPay: avgDaysToPay != null ? r1(avgDaysToPay) : null,
      avgDaysLate: avgDaysLate != null ? r1(avgDaysLate) : null,
      onTimeRatePct: onTimeRate != null ? Math.round(onTimeRate * 100) : null,
      worstDaysLate: worstLate, termsDays, trend,
      recentAvgDaysToPay: recentAvgToPay != null ? r1(recentAvgToPay) : null,
      lastPaymentDate: iso(lastPaymentDate as Date | null),
      lastPaidDaysLate: lastPaid ? lastPaid.daysLate : null,
    },
    profit,
    fees: { services, feeLines, lineItemsAvailable: lineItemsSeen > 0 },
    callPrep,
    monthly: monthlySeries,
    invoices,
    generatedAt: now.toISOString(),
  };
}

function fmt(n: number, cur: string) {
  const sym = cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : cur === 'CAD' ? 'CA$' : '$';
  return sym + Math.round(n).toLocaleString('en-US');
}

// Pull Net Profit and Total Income out of a Xero ProfitAndLoss report.
export function marginFromPnL(report: any): number | null {
  try {
    const rows: any[] = [];
    const walk = (rs: any[]) => (rs || []).forEach(r => { rows.push(r); if (r.Rows) walk(r.Rows); });
    walk(report?.Rows || []);
    const val = (re: RegExp) => {
      const row = rows.find(r => r.Cells && re.test(String(r.Cells[0]?.Value || '')));
      if (!row) return null;
      const v = parseFloat(String(row.Cells[1]?.Value || '').replace(/,/g, ''));
      return isNaN(v) ? null : v;
    };
    const income = val(/^total (trading )?income$/i) ?? val(/^total revenue$/i);
    const net = val(/^net profit$/i) ?? val(/^net income$/i);
    if (income == null || net == null || income <= 0) return null;
    return (net / income) * 100;
  } catch { return null; }
}
