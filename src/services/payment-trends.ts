// Payment Trends Service for tracking AR improvements over time

import type { XeroInvoice } from '../types/xero';

export interface PaymentTrendPeriod {
  periodStart: string;      // ISO date
  periodEnd: string;        // ISO date
  periodLabel: string;      // "Week 1", "Jan 2025", "Q1 2025"
  
  // Key metrics
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
  
  // Payments received
  paymentsReceived: number;
  paymentsCount: number;
  
  // Aging breakdown
  currentAmount: number;     // 0-99 days
  agedAmount: number;        // 100-199 days
  criticalAmount: number;    // 200+ days
  
  // Improvement metrics
  overdueReduction: number;   // vs previous period
  paymentVelocity: number;    // days to pay on average
  collectionRate: number;     // % of outstanding collected
}

export interface PaymentTrendsAnalysis {
  viewType: 'weekly' | 'monthly' | 'quarterly';
  periods: PaymentTrendPeriod[];
  
  // Overall trends
  totalImprovement: number;        // Total overdue reduction
  averagePaymentVelocity: number;  // Average days to pay
  bestPeriod: PaymentTrendPeriod;  // Period with most improvement
  worstPeriod: PaymentTrendPeriod; // Period with least improvement
}

export class PaymentTrendsService {
  /**
   * Calculate payment trends for a given period type
   * @param invoices All invoices (PAID + AUTHORISED)
   * @param viewType 'weekly' | 'monthly' | 'quarterly'
   * @param periodsBack Number of periods to look back (e.g., 8 weeks, 6 months, 4 quarters)
   */
  static calculateTrends(
    invoices: XeroInvoice[],
    viewType: 'weekly' | 'monthly' | 'quarterly',
    periodsBack: number
  ): PaymentTrendsAnalysis {
    const periods: PaymentTrendPeriod[] = [];
    const now = new Date();
    
    // Generate period boundaries
    for (let i = periodsBack - 1; i >= 0; i--) {
      const { start, end, label } = this.getPeriodBoundaries(now, viewType, i);
      
      // Filter invoices for this period
      const periodInvoices = this.getInvoicesForPeriod(invoices, start, end);
      
      // Calculate metrics
      const period = this.calculatePeriodMetrics(periodInvoices, start, end, label);
      periods.push(period);
    }
    
    // Calculate improvement metrics (period-over-period)
    for (let i = 1; i < periods.length; i++) {
      const current = periods[i];
      const previous = periods[i - 1];
      
      current.overdueReduction = previous.overdueAmount - current.overdueAmount;
      current.collectionRate = previous.totalOutstanding > 0
        ? (current.paymentsReceived / previous.totalOutstanding) * 100
        : 0;
    }
    
    // Find best and worst periods
    const periodsWithData = periods.filter(p => p.totalOutstanding > 0);
    const bestPeriod = periodsWithData.reduce((best, curr) => 
      curr.overdueReduction > best.overdueReduction ? curr : best
    , periodsWithData[0] || periods[0]);
    
    const worstPeriod = periodsWithData.reduce((worst, curr) => 
      curr.overdueReduction < worst.overdueReduction ? curr : worst
    , periodsWithData[0] || periods[0]);
    
    // Calculate overall trends
    const totalImprovement = periods.reduce((sum, p) => sum + p.overdueReduction, 0);
    const avgPaymentVelocity = periods.reduce((sum, p) => sum + p.paymentVelocity, 0) / periods.length;
    
    return {
      viewType,
      periods,
      totalImprovement,
      averagePaymentVelocity: Math.round(avgPaymentVelocity),
      bestPeriod,
      worstPeriod,
    };
  }
  
  /**
   * Get period boundaries based on view type
   */
  private static getPeriodBoundaries(
    now: Date,
    viewType: 'weekly' | 'monthly' | 'quarterly',
    periodsBack: number
  ): { start: Date; end: Date; label: string } {
    const start = new Date(now);
    const end = new Date(now);
    let label = '';
    
    switch (viewType) {
      case 'weekly':
        // Go back N weeks
        start.setDate(now.getDate() - (7 * (periodsBack + 1)));
        end.setDate(now.getDate() - (7 * periodsBack));
        label = `Week ${periodsBack + 1}`;
        break;
        
      case 'monthly':
        // Go back N months
        start.setMonth(now.getMonth() - (periodsBack + 1));
        start.setDate(1);
        end.setMonth(now.getMonth() - periodsBack);
        end.setDate(0); // Last day of previous month
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
        break;
        
      case 'quarterly':
        // Go back N quarters
        const quarter = Math.floor(now.getMonth() / 3);
        const startQuarter = quarter - periodsBack - 1;
        const startYear = now.getFullYear() + Math.floor(startQuarter / 4);
        const normalizedQuarter = ((startQuarter % 4) + 4) % 4;
        
        start.setFullYear(startYear);
        start.setMonth(normalizedQuarter * 3);
        start.setDate(1);
        
        end.setFullYear(startYear);
        end.setMonth((normalizedQuarter + 1) * 3);
        end.setDate(0);
        
        label = `Q${normalizedQuarter + 1} ${startYear}`;
        break;
    }
    
    return { start, end, label };
  }
  
  /**
   * Get invoices that were outstanding or paid during this period
   */
  private static getInvoicesForPeriod(
    invoices: XeroInvoice[],
    periodStart: Date,
    periodEnd: Date
  ): XeroInvoice[] {
    return invoices.filter(inv => {
      // Include if invoice was outstanding during this period
      const invoiceDate = this.parseDate(inv.Date);
      const dueDate = this.parseDate(inv.DueDate);
      const paidDate = this.parseDate(inv.FullyPaidOnDate);
      
      // Invoice was created in or before this period
      if (invoiceDate && invoiceDate <= periodEnd) {
        // Either still outstanding or paid during/after this period
        if (!paidDate || paidDate >= periodStart) {
          return true;
        }
      }
      
      return false;
    });
  }
  
  /**
   * Calculate metrics for a specific period
   */
  private static calculatePeriodMetrics(
    invoices: XeroInvoice[],
    periodStart: Date,
    periodEnd: Date,
    label: string
  ): PaymentTrendPeriod {
    let totalOutstanding = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let paymentsReceived = 0;
    let paymentsCount = 0;
    let currentAmount = 0;
    let agedAmount = 0;
    let criticalAmount = 0;
    
    let totalPaymentDelay = 0;
    let paymentDelayCount = 0;
    
    for (const inv of invoices) {
      const amountDue = inv.AmountDue || 0;
      const amountPaid = inv.AmountPaid || 0;
      const dueDate = this.parseDate(inv.DueDate);
      const paidDate = this.parseDate(inv.FullyPaidOnDate);
      
      // Count payments made in this period
      if (paidDate && paidDate >= periodStart && paidDate <= periodEnd) {
        paymentsReceived += amountPaid;
        paymentsCount++;
        
        // Calculate payment velocity
        if (dueDate) {
          const delay = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (delay > 0) {
            totalPaymentDelay += delay;
            paymentDelayCount++;
          }
        }
      }
      
      // Count outstanding at end of period
      if (inv.Status === 'AUTHORISED' && amountDue > 0) {
        // If not paid by end of period, include in outstanding
        if (!paidDate || paidDate > periodEnd) {
          totalOutstanding += amountDue;
          
          // Calculate age at end of period
          if (dueDate) {
            const daysOverdue = Math.floor((periodEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysOverdue > 0) {
              overdueAmount += amountDue;
              overdueCount++;
              
              // Aging breakdown
              if (daysOverdue < 100) {
                currentAmount += amountDue;
              } else if (daysOverdue < 200) {
                agedAmount += amountDue;
              } else {
                criticalAmount += amountDue;
              }
            } else {
              currentAmount += amountDue; // Not yet due
            }
          }
        }
      }
    }
    
    const paymentVelocity = paymentDelayCount > 0 
      ? Math.round(totalPaymentDelay / paymentDelayCount)
      : 0;
    
    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      periodLabel: label,
      totalOutstanding,
      overdueAmount,
      overdueCount,
      paymentsReceived,
      paymentsCount,
      currentAmount,
      agedAmount,
      criticalAmount,
      overdueReduction: 0, // Calculated later
      paymentVelocity,
      collectionRate: 0, // Calculated later
    };
  }
  
  /**
   * Parse Xero date format
   */
  private static parseDate(dateStr: string | undefined | null): Date | null {
    if (!dateStr) return null;
    
    if (typeof dateStr === 'string' && dateStr.includes('/Date(')) {
      const match = dateStr.match(/\/Date\((\d+)([+-]\d+)?\)\//);
      if (match) {
        return new Date(parseInt(match[1]));
      }
    }
    
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }
}
