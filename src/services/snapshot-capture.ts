import { XeroApiService } from './xero-api';
import { CfoAnalyticsService } from './cfo-analytics';
import { PaymentTrendsService } from './payment-trends';

interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  expiresAt?: number;
}

function lastDayOf(period: string): string {
  // period = 'YYYY-MM'
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last of this
  return `${period}-${String(last).padStart(2, '0')}`;
}

export async function captureBundle(period: string, session: SessionData): Promise<Record<string, any>> {
  if (!session.accessToken || !session.tenantId) {
    throw new Error('No Xero session — auth required to capture');
  }
  const xero = new XeroApiService(session.accessToken, session.tenantId);
  const start = `${period}-01`;
  const end   = lastDayOf(period);

  const [pnl, , invoices, txns] = await Promise.all([
    xero.getProfitAndLossReport(start, end),
    xero.getBalanceSheetReport(end),
    xero.getInvoices(start, end),
    xero.getBankTransactions(start, end),
  ]);

  const trendsBundle = PaymentTrendsService.calculateTrends(invoices, 'monthly', 1);
  const grossMargin  = CfoAnalyticsService.calculateGrossMargin(pnl);

  // Aging buckets — cumulative outstanding
  const now = new Date();
  const ageDays = (d: any) => {
    const due = d ? new Date(typeof d === 'string' && d.includes('/Date(')
      ? Number((d.match(/\/Date\((\d+)/) || [])[1])
      : d) : null;
    return due ? Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  };
  const auth = invoices.filter((i: any) => i.Status === 'AUTHORISED' && (i.AmountDue || 0) > 0);
  const bucket = (lo: number, hi: number) =>
    auth.filter((i: any) => { const a = ageDays(i.DueDate); return a > lo && a <= hi; })
        .reduce((s: number, i: any) => s + (i.AmountDue || 0), 0);

  const overdueCount = auth.filter((i: any) => ageDays(i.DueDate) > 0).length;
  const arOverdue    = auth.filter((i: any) => ageDays(i.DueDate) > 0)
                           .reduce((s: number, i: any) => s + (i.AmountDue || 0), 0);

  const paidThisPeriod = invoices.filter((i: any) => i.Status === 'PAID');
  const sumTotal = (arr: any[]) => arr.reduce((s, i) => s + (i.Total || 0), 0);

  // Active vs new clients
  const seenContactIds = new Set<string>();
  for (const i of invoices) {
    const id = i.Contact?.ContactID || i.Contact?.Name;
    if (id) seenContactIds.add(id);
  }

  return {
    period,
    revenue_paid:        Math.round(sumTotal(paidThisPeriod) * 100) / 100,
    revenue_invoiced:    Math.round(invoices.reduce((s: number, i: any) => s + (i.Total || 0), 0) * 100) / 100,
    active_clients:      seenContactIds.size,
    new_clients:         null,                       // requires longer history; left null for now
    cash_position:       CfoAnalyticsService.calculateCashPosition(txns),
    gross_margin_pct:    grossMargin.grossMarginPct,
    dso_days:            CfoAnalyticsService.calculateDSO(invoices),
    collection_rate_pct: trendsBundle.periods[0]?.collectionRate ?? null,
    payment_velocity_days: trendsBundle.averagePaymentVelocity,

    ar_total:            auth.reduce((s: number, i: any) => s + (i.AmountDue || 0), 0),
    ar_overdue:          arOverdue,
    ar_aging_current:    bucket(-9999, 0),
    ar_aging_30_60:      bucket(0, 60),
    ar_aging_60_90:      bucket(60, 90),
    ar_aging_90plus:     bucket(90, 1e9),
    overdue_count:       overdueCount,

    ap_total:            null,                       // not in current Worker scope
    net_cash_flow:       txns.reduce((s: number, t: any) => s + (t.Type === 'RECEIVE' ? (t.Total || 0) : -(t.Total || 0)), 0),

    // Bank-tab fields populated lazily — placeholder for now; the /api/bank
    // endpoint can fill these in a follow-up.
    loc_recommended:     null,
    loc_dscr:            null,
    borrowing_base:      null,
    bank_score_community: null,
    bank_score_sba:      null,
    bank_score_fintech:  null,

    // Goals snapshot — populated by caller from KV.
    goal_revenue_target: null,
    goal_clients_target: null,
    goal_collection_pct: null,

    payload: {
      invoices_count: invoices.length,
      transactions_count: txns.length,
      pnl_revenue: grossMargin.revenue,
      pnl_cogs:    grossMargin.cogs,
    },
  };
}
