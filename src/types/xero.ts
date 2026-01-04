// Xero API Types

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Contact: {
    Name: string;
    ContactID?: string;
  };
  Date: string;
  DueDate: string;
  Total: number;
  AmountDue: number;
  AmountPaid?: number;
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  LineItems?: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    LineAmount: number;
  }>;
}

export interface XeroInvoiceSummary {
  draftCount: number;
  draftAmount: number;
  awaitingCount: number;
  awaitingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  totalInvoices: number;
}

export interface XeroBankTransaction {
  BankTransactionID: string;
  Date: string;
  Contact: {
    Name: string;
    ContactID?: string;
  };
  Type: 'RECEIVE' | 'SPEND';
  Total: number;
  Reference: string;
  Status?: string;
}

export interface XeroReportSection {
  Title: string;
  Rows: Array<{
    RowType: string;
    Cells: Array<{
      Value: string;
      Attributes?: Array<{
        Value: string;
        Id: string;
      }>;
    }>;
  }>;
}

export interface XeroReport {
  ReportID: string;
  ReportName: string;
  ReportTitles: string[];
  ReportDate: string;
  UpdatedDateUTC: string;
  Rows?: XeroReportSection[];
  Reports?: Array<{
    ReportID: string;
    ReportName: string;
    ReportDate: string;
    Rows: XeroReportSection[];
  }>;
}

export interface XeroAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface XeroTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  tenant_id?: string;
}
