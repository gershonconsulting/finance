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

  async getClientsAwaitingPayment(): Promise<Array<{
    contactName: string;
    contactId: string;
    invoiceCount: number;
    totalOutstanding: number;
    invoices: XeroInvoice[];
  }>> {
    // Get all AUTHORISED invoices (awaiting payment)
    const invoices = await this.getInvoices(undefined, undefined, 'AUTHORISED');
    
    // Group by contact
    const clientMap = new Map<string, {
      contactName: string;
      contactId: string;
      invoiceCount: number;
      totalOutstanding: number;
      invoices: XeroInvoice[];
    }>();
    
    for (const invoice of invoices) {
      const contactId = invoice.Contact?.ContactID || 'unknown';
      const contactName = invoice.Contact?.Name || 'Unknown Contact';
      const amountDue = invoice.AmountDue || 0;
      
      if (amountDue > 0) { // Only include invoices with outstanding amounts
        if (!clientMap.has(contactId)) {
          clientMap.set(contactId, {
            contactName,
            contactId,
            invoiceCount: 0,
            totalOutstanding: 0,
            invoices: [],
          });
        }
        
        const client = clientMap.get(contactId)!;
        client.invoiceCount++;
        client.totalOutstanding += amountDue;
        client.invoices.push(invoice);
      }
    }
    
    // Convert to array and sort by total outstanding (highest first)
    return Array.from(clientMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }

  async getInvoicesByAging(): Promise<{
    current: { count: number; total: number; invoices: XeroInvoice[] };
    aged: { count: number; total: number; invoices: XeroInvoice[] };
    critical: { count: number; total: number; invoices: XeroInvoice[] };
  }> {
    // Get all AUTHORISED invoices (awaiting payment)
    const invoices = await this.getInvoices(undefined, undefined, 'AUTHORISED');
    
    const now = new Date();
    const result = {
      current: { count: 0, total: 0, invoices: [] as XeroInvoice[] },
      aged: { count: 0, total: 0, invoices: [] as XeroInvoice[] },
      critical: { count: 0, total: 0, invoices: [] as XeroInvoice[] },
    };
    
    for (const invoice of invoices) {
      const amountDue = invoice.AmountDue || 0;
      if (amountDue <= 0) continue; // Skip paid invoices
      
      // Calculate days old from invoice date
      const invoiceDate = invoice.Date ? new Date(invoice.Date) : null;
      if (!invoiceDate) continue;
      
      const daysOld = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOld < 100) {
        // CURRENT: 0-99 days old
        result.current.count++;
        result.current.total += amountDue;
        result.current.invoices.push(invoice);
      } else if (daysOld < 200) {
        // AGED: 100-199 days old
        result.aged.count++;
        result.aged.total += amountDue;
        result.aged.invoices.push(invoice);
      } else {
        // CRITICAL: 200+ days old (legal negotiation)
        result.critical.count++;
        result.critical.total += amountDue;
        result.critical.invoices.push(invoice);
      }
    }
    
    return result;
  }
}
