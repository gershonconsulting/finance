// Export Service for Google Sheets Integration

import type { XeroInvoice, XeroBankTransaction } from '../types/xero';

export class ExportService {
  
  // Convert data to CSV format
  static toCSV(data: any[], headers: string[]): string {
    const headerRow = headers.join(',');
    const dataRows = data.map(row => {
      return headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value).replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      }).join(',');
    });
    
    return [headerRow, ...dataRows].join('\n');
  }

  // Convert invoices to CSV
  static invoicesToCSV(invoices: XeroInvoice[]): string {
    const data = invoices.map(inv => ({
      'Invoice Number': inv.InvoiceNumber,
      'Contact': inv.Contact?.Name || '',
      'Date': inv.Date,
      'Due Date': inv.DueDate,
      'Total': inv.Total,
      'Amount Due': inv.AmountDue,
      'Amount Paid': inv.Total - inv.AmountDue,
      'Status': inv.Status,
    }));
    
    const headers = ['Invoice Number', 'Contact', 'Date', 'Due Date', 'Total', 'Amount Due', 'Amount Paid', 'Status'];
    return this.toCSV(data, headers);
  }

  // Convert invoice summary to CSV
  static invoiceSummaryToCSV(summary: any): string {
    const data = [
      { 'Metric': 'Draft Invoices', 'Count': summary.draftCount, 'Amount': summary.draftAmount },
      { 'Metric': 'Awaiting Payment', 'Count': summary.awaitingCount, 'Amount': summary.awaitingAmount },
      { 'Metric': 'Overdue', 'Count': summary.overdueCount, 'Amount': summary.overdueAmount },
      { 'Metric': 'Total Invoices', 'Count': summary.totalInvoices, 'Amount': '' },
    ];
    
    const headers = ['Metric', 'Count', 'Amount'];
    return this.toCSV(data, headers);
  }

  // Convert transactions to CSV
  static transactionsToCSV(transactions: XeroBankTransaction[]): string {
    const data = transactions.map(tx => ({
      'Date': tx.Date,
      'Contact': tx.Contact?.Name || '',
      'Type': tx.Type,
      'Amount': tx.Total,
      'Reference': tx.Reference || '',
    }));
    
    const headers = ['Date', 'Contact', 'Type', 'Amount', 'Reference'];
    return this.toCSV(data, headers);
  }

  // Convert Profit & Loss report to CSV
  static profitLossToCSV(report: any): string {
    const rows: any[] = [];
    
    rows.push({
      'Section': 'Report Information',
      'Account': 'Report Name',
      'Value': report.ReportName || 'Profit & Loss'
    });
    
    rows.push({
      'Section': 'Report Information',
      'Account': 'Report Date',
      'Value': report.ReportDate || new Date().toISOString()
    });
    
    rows.push({ 'Section': '', 'Account': '', 'Value': '' }); // Empty row
    
    // Parse report rows if available
    if (report.Rows && Array.isArray(report.Rows)) {
      report.Rows.forEach((section: any) => {
        if (section.Rows) {
          section.Rows.forEach((row: any) => {
            if (row.Cells && row.Cells.length > 0) {
              rows.push({
                'Section': section.Title || '',
                'Account': row.Cells[0]?.Value || '',
                'Value': row.Cells[1]?.Value || ''
              });
            }
          });
        }
      });
    }
    
    const headers = ['Section', 'Account', 'Value'];
    return this.toCSV(rows, headers);
  }

  // Convert Balance Sheet to CSV
  static balanceSheetToCSV(report: any): string {
    const rows: any[] = [];
    
    rows.push({
      'Section': 'Report Information',
      'Account': 'Report Name',
      'Value': report.ReportName || 'Balance Sheet'
    });
    
    rows.push({
      'Section': 'Report Information',
      'Account': 'Report Date',
      'Value': report.ReportDate || new Date().toISOString()
    });
    
    rows.push({ 'Section': '', 'Account': '', 'Value': '' }); // Empty row
    
    // Parse report rows if available
    if (report.Rows && Array.isArray(report.Rows)) {
      report.Rows.forEach((section: any) => {
        if (section.Rows) {
          section.Rows.forEach((row: any) => {
            if (row.Cells && row.Cells.length > 0) {
              rows.push({
                'Section': section.Title || '',
                'Account': row.Cells[0]?.Value || '',
                'Value': row.Cells[1]?.Value || ''
              });
            }
          });
        }
      });
    }
    
    const headers = ['Section', 'Account', 'Value'];
    return this.toCSV(rows, headers);
  }

  // Generate Google Sheets import URL
  static generateGoogleSheetsURL(csvData: string, title: string = 'Xero Export'): string {
    // Convert CSV to Google Sheets compatible format
    const encoded = encodeURIComponent(csvData);
    
    // Create a data URL that Google Sheets can import
    // Note: This creates a downloadable CSV that users can then import to Google Sheets
    return `data:text/csv;charset=utf-8,${encoded}`;
  }

  // Convert clients awaiting payment to CSV
  static clientsAwaitingPaymentToCSV(clients: any[]): string {
    const data = clients.map(client => ({
      'Company Name': client.contactName,
      'Number of Invoices': client.invoiceCount,
      'Total Outstanding': client.totalOutstanding.toFixed(2),
      'Avg Payment Delay (days)': client.averagePaymentDelay || 0,
      'Total Paid Overall': client.totalPaid.toFixed(2),
    }));
    
    // Add totals row
    const totalInvoices = clients.reduce((sum, c) => sum + c.invoiceCount, 0);
    const totalOutstanding = clients.reduce((sum, c) => sum + c.totalOutstanding, 0);
    const totalPaid = clients.reduce((sum, c) => sum + c.totalPaid, 0);
    const avgDelay = clients.length > 0 
      ? Math.round(clients.reduce((sum, c) => sum + (c.averagePaymentDelay || 0), 0) / clients.length)
      : 0;
    
    data.push({
      'Company Name': 'TOTAL',
      'Number of Invoices': totalInvoices,
      'Total Outstanding': totalOutstanding.toFixed(2),
      'Avg Payment Delay (days)': avgDelay,
      'Total Paid Overall': totalPaid.toFixed(2),
    });
    
    const headers = ['Company Name', 'Number of Invoices', 'Total Outstanding', 'Avg Payment Delay (days)', 'Total Paid Overall'];
    return this.toCSV(data, headers);
  }

  // Create downloadable blob
  static createDownloadLink(csvData: string, filename: string): string {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    return URL.createObjectURL(blob);
  }
}
