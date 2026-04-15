// CFO Analytics Service - Executive Dashboard and Cash Flow calculations

import type { XeroInvoice, XeroBankTransaction, XeroReport } from '../types/xero';

export interface RevenueGrowth {
  momGrowth: number;
  yoyGrowth: number;
  currentMonthRevenue: number;
  priorMonthRevenue: number;
}

export interface GrossMarginResult {
  grossMarginPct: number;
  revenue: number;
  cogs: number;
}

export interface CashFlowWeek {
  weekLabel: string;
  weekStart: string;
  expectedInflows: number;
  expectedOutflows: number;
  projectedBalance: number;
}

export interface OperatingCashFlowWeek {
  weekLabel: string;
  inflows: number;
  outflows: number;
  netCashFlow: number;
}

export class CfoAnalyticsService {
  /**
   * Days Sales Outstanding = (Total AR Outstanding / Revenue last 90 days) x 90
   */
  static calculateDSO(invoices: XeroInvoice[]): number {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const totalOutstanding = invoices
      .filter(inv => inv.Status === 'AUTHORISED')
      .reduce((sum, inv) => sum + (inv.AmountDue || 0), 0);

    const revenueWindow = invoices
      .filter(inv => {
        const d = inv.DueDate ? new Date(inv.DueDate) : null;
        return d && d >= ninetyDaysAgo && (inv.Status === 'PAID' || inv.Status === 'AUTHORISED');
      })
      .reduce((sum, inv) => sum + (inv.Total || 0), 0);

    if (revenueWindow === 0) return 0;
    return Math.round((totalOutstanding / revenueWindow) * 90);
  }

  /**
   * Parse Xero P&L report nested Rows structure to extract gross margin
   */
  static calculateGrossMargin(plReport: XeroReport): GrossMarginResult {
    try {
      let rows: any[] = [];

      // Handle both report formats
      if (plReport.Reports && plReport.Reports.length > 0) {
        rows = plReport.Reports[0].Rows || [];
      } else if (plReport.Rows) {
        rows = plReport.Rows as any[];
      }

      let revenue = 0;
      let cogs = 0;

      for (const section of rows) {
        if (!section.Title || !section.Rows) continue;

        const title = (section.Title as string).toLowerCase();
        const isRevenue = title.includes('revenue') || title.includes('income') || title.includes('trading income');
        const isCogs = title.includes('cost') || title.includes('less cost') || title.includes('direct cost');

        if (!isRevenue && !isCogs) continue;

        // Find SummaryRow for the section total
        for (const row of section.Rows) {
          if (row.RowType === 'SummaryRow' && row.Cells && row.Cells.length >= 2) {
            const val = parseFloat((row.Cells[1]?.Value || '0').replace(/[,$]/g, '')) || 0;
            if (isRevenue) revenue += Math.abs(val);
            if (isCogs) cogs += Math.abs(val);
          }
        }
      }

      const grossMarginPct = revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 1000) / 10 : 0;
      return { grossMarginPct, revenue: Math.round(revenue * 100) / 100, cogs: Math.round(cogs * 100) / 100 };
    } catch {
      return { grossMarginPct: 0, revenue: 0, cogs: 0 };
    }
  }

  /**
   * Net cash position from bank transactions (last 90 days)
   */
  static calculateCashPosition(bankTransactions: XeroBankTransaction[]): number {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return bankTransactions
      .filter(tx => {
        const d = tx.Date ? new Date(tx.Date) : null;
        return d && d >= ninetyDaysAgo;
      })
      .reduce((sum, tx) => {
        const amount = tx.Total || 0;
        return tx.Type === 'RECEIVE' ? sum + amount : sum - amount;
      }, 0);
  }

  /**
   * Month-over-month and year-over-year revenue growth from paid invoices
   */
  static calculateRevenueGrowth(invoices: XeroInvoice[]): RevenueGrowth {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const priorMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const priorMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastYear = currentYear - 1;

    const paidInvoices = invoices.filter(inv => inv.Status === 'PAID' && inv.DueDate);

    const sumForPeriod = (year: number, month: number): number =>
      paidInvoices
        .filter(inv => {
          const d = new Date(inv.DueDate);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum, inv) => sum + (inv.Total || 0), 0);

    const currentMonthRevenue = sumForPeriod(currentYear, currentMonth);
    const priorMonthRevenue = sumForPeriod(priorMonthYear, priorMonth);
    const sameMonthLastYear = sumForPeriod(lastYear, currentMonth);

    const momGrowth = priorMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - priorMonthRevenue) / priorMonthRevenue) * 1000) / 10
      : 0;

    const yoyGrowth = sameMonthLastYear > 0
      ? Math.round(((currentMonthRevenue - sameMonthLastYear) / sameMonthLastYear) * 1000) / 10
      : 0;

    return {
      momGrowth,
      yoyGrowth,
      currentMonthRevenue: Math.round(currentMonthRevenue * 100) / 100,
      priorMonthRevenue: Math.round(priorMonthRevenue * 100) / 100,
    };
  }

  /**
   * Build a 13-week forward cash flow forecast
   */
  static build13WeekForecast(
    invoices: XeroInvoice[],
    bankTransactions: XeroBankTransaction[]
  ): CashFlowWeek[] {
    const now = new Date();

    // Historical collection rate (last 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const recentInvoices = invoices.filter(inv => {
      const d = inv.DueDate ? new Date(inv.DueDate) : null;
      return d && d >= ninetyDaysAgo && (inv.Status === 'PAID' || inv.Status === 'AUTHORISED');
    });
    const paid = recentInvoices.filter(inv => inv.Status === 'PAID').length;
    const collectionRate = recentInvoices.length > 0 ? paid / recentInvoices.length : 0.7;

    // Average weekly spend (last 8 weeks)
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
    const recentSpend = bankTransactions
      .filter(tx => {
        const d = tx.Date ? new Date(tx.Date) : null;
        return d && d >= eightWeeksAgo && tx.Type === 'SPEND';
      })
      .reduce((sum, tx) => sum + (tx.Total || 0), 0);
    const avgWeeklySpend = recentSpend / 8;

    // Current cash position as starting balance
    let balance = this.calculateCashPosition(bankTransactions);

    const forecast: CashFlowWeek[] = [];

    for (let week = 0; week < 13; week++) {
      const weekStart = new Date(now.getTime() + week * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Expected inflows: authorised invoices due this week × collection rate
      const expectedInflows = invoices
        .filter(inv => {
          if (inv.Status !== 'AUTHORISED') return false;
          const due = inv.DueDate ? new Date(inv.DueDate) : null;
          return due && due >= weekStart && due < weekEnd;
        })
        .reduce((sum, inv) => sum + (inv.AmountDue || 0), 0) * collectionRate;

      const expectedOutflows = avgWeeklySpend;
      balance = balance + expectedInflows - expectedOutflows;

      const label = `Week ${week + 1} (${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;

      forecast.push({
        weekLabel: label,
        weekStart: weekStart.toISOString().split('T')[0],
        expectedInflows: Math.round(expectedInflows * 100) / 100,
        expectedOutflows: Math.round(expectedOutflows * 100) / 100,
        projectedBalance: Math.round(balance * 100) / 100,
      });
    }

    return forecast;
  }

  /**
   * Build trailing operating cash flow by week
   */
  static buildOperatingCashFlow(
    bankTransactions: XeroBankTransaction[],
    weeks: number = 12
  ): OperatingCashFlowWeek[] {
    const now = new Date();
    const result: OperatingCashFlowWeek[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      const weekTx = bankTransactions.filter(tx => {
        const d = tx.Date ? new Date(tx.Date) : null;
        return d && d >= weekStart && d < weekEnd;
      });

      const inflows = weekTx
        .filter(tx => tx.Type === 'RECEIVE')
        .reduce((sum, tx) => sum + (tx.Total || 0), 0);

      const outflows = weekTx
        .filter(tx => tx.Type === 'SPEND')
        .reduce((sum, tx) => sum + (tx.Total || 0), 0);

      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      result.push({
        weekLabel: label,
        inflows: Math.round(inflows * 100) / 100,
        outflows: Math.round(outflows * 100) / 100,
        netCashFlow: Math.round((inflows - outflows) * 100) / 100,
      });
    }

    return result;
  }

  /**
   * Build monthly revenue time series for the last 12 months (Chart.js format)
   */
  static buildRevenueChart(invoices: XeroInvoice[]): { labels: string[], datasets: Array<{ label: string, data: number[], backgroundColor: string }> } {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();

      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      labels.push(monthLabel);

      const monthRevenue = invoices
        .filter(inv => {
          if (inv.Status !== 'PAID' || !inv.DueDate) return false;
          const d = new Date(inv.DueDate);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum, inv) => sum + (inv.Total || 0), 0);

      data.push(Math.round(monthRevenue * 100) / 100);
    }

    return {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
      }],
    };
  }
}
