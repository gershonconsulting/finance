// Xero API Service for Cloudflare Workers

import type { XeroInvoice, XeroInvoiceSummary, XeroBankTransaction, XeroReport } from '../types/xero';

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

export class XeroApiService {
  private accessToken: string;
  private tenantId: string;

  constructor(accessToken: string, tenantId: string) {
    this.accessToken = accessToken;
    this.tenantId = tenantId;
  }

  private async fetchXero(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${XERO_API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'xero-tenant-id': this.tenantId,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Xero API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async getProfitAndLossReport(fromDate?: string, toDate?: string): Promise<XeroReport> {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    
    const data = await this.fetchXero('/Reports/ProfitAndLoss', params);
    return data.Reports?.[0] || data;
  }

  async getBalanceSheetReport(date?: string): Promise<XeroReport> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    
    const data = await this.fetchXero('/Reports/BalanceSheet', params);
    return data.Reports?.[0] || data;
  }

  async getInvoices(fromDate?: string, toDate?: string, status?: string): Promise<XeroInvoice[]> {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (status) params.Statuses = status;
    
    const data = await this.fetchXero('/Invoices', params);
    return data.Invoices || [];
  }

  async getInvoiceSummary(): Promise<XeroInvoiceSummary> {
    const invoices = await this.getInvoices();
    
    let draftCount = 0;
    let draftAmount = 0;
    let awaitingCount = 0;
    let awaitingAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    
    const now = new Date();
    
    for (const invoice of invoices) {
      const total = invoice.Total || 0;
      const amountDue = invoice.AmountDue || 0;
      
      if (invoice.Status === 'DRAFT') {
        draftCount++;
        draftAmount += total;
      } else if (invoice.Status === 'AUTHORISED' || invoice.Status === 'SUBMITTED') {
        awaitingCount++;
        awaitingAmount += amountDue;
        
        // Check if overdue
        if (invoice.DueDate) {
          const dueDate = new Date(invoice.DueDate);
          if (dueDate < now && amountDue > 0) {
            overdueCount++;
            overdueAmount += amountDue;
          }
        }
      }
    }
    
    return {
      draftCount,
      draftAmount,
      awaitingCount,
      awaitingAmount,
      overdueCount,
      overdueAmount,
      totalInvoices: invoices.length,
    };
  }

  async getBankTransactions(fromDate?: string, toDate?: string): Promise<XeroBankTransaction[]> {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    
    const data = await this.fetchXero('/BankTransactions', params);
    return data.BankTransactions || [];
  }

  async getTrialBalance(date?: string): Promise<XeroReport> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    
    const data = await this.fetchXero('/Reports/TrialBalance', params);
    return data.Reports?.[0] || data;
  }

  async getBudgetSummary(): Promise<XeroReport> {
    const data = await this.fetchXero('/Reports/BudgetSummary');
    return data.Reports?.[0] || data;
  }
}
