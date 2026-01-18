import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { XeroApiService } from './services/xero-api';
import { ExportService } from './services/export-service';
import { XeroOAuthService } from './services/xero-oauth';
import { PaymentTrendsService } from './services/payment-trends';

type Bindings = {
  XERO_CLIENT_ID: string;
  XERO_CLIENT_SECRET: string;
  XERO_REDIRECT_URI: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for API routes
app.use('/api/*', cors());

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }));

// Session storage (in production, use KV or D1)
interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  expiresAt?: number;
}

// In-memory session store (replace with KV in production)
const sessions = new Map<string, SessionData>();

// Helper to get session from cookie or header
function getSession(c: any): SessionData | null {
  // Check Authorization header first
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const session = sessions.get(token);
    if (session) return session;
  }
  
  // Check X-Session-Token header (from frontend)
  const sessionHeader = c.req.header('X-Session-Token');
  if (sessionHeader) {
    const session = sessions.get(sessionHeader);
    if (session) return session;
  }
  
  return null;
}

// Helper to get session ID from request
function getSessionId(c: any): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    return authHeader.replace('Bearer ', '');
  }
  
  const sessionHeader = c.req.header('X-Session-Token');
  if (sessionHeader) {
    return sessionHeader;
  }
  
  return null;
}

// Helper to refresh expired token
async function getSessionWithRefresh(c: any): Promise<{ session: SessionData | null, sessionId: string | null }> {
  const sessionId = getSessionId(c);
  if (!sessionId) {
    return { session: null, sessionId: null };
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return { session: null, sessionId };
  }
  
  // Check if token is expired or about to expire (within 5 minutes)
  const now = Date.now();
  const expiresAt = session.expiresAt || 0;
  const fiveMinutes = 5 * 60 * 1000;
  
  if (expiresAt > 0 && expiresAt - now < fiveMinutes) {
    // Token expired or about to expire, refresh it
    try {
      const { env } = c;
      const oauth = new XeroOAuthService(
        env.XERO_CLIENT_ID,
        env.XERO_CLIENT_SECRET,
        env.XERO_REDIRECT_URI
      );
      
      if (session.refreshToken) {
        console.log('Refreshing expired token...');
        const newTokens = await oauth.refreshAccessToken(session.refreshToken);
        
        // Update session with new tokens
        session.accessToken = newTokens.accessToken;
        session.refreshToken = newTokens.refreshToken;
        session.expiresAt = newTokens.expiresAt;
        sessions.set(sessionId, session);
        
        console.log('Token refreshed successfully');
        return { session, sessionId };
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Token refresh failed, session is invalid
      sessions.delete(sessionId);
      return { session: null, sessionId };
    }
  }
  
  return { session, sessionId };
}

// Helper to create session
function createSession(data: SessionData): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, data);
  return sessionId;
}

// API Routes

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auto-connect endpoint - automatically authenticate using hardcoded credentials
app.get('/api/auto-connect', async (c) => {
  try {
    const { env } = c;
    
    // Check if already authenticated
    const existingSession = getSession(c);
    if (existingSession?.accessToken && existingSession?.tenantId) {
      return c.json({ 
        success: true, 
        message: 'Already authenticated',
        authenticated: true,
        tenantId: existingSession.tenantId
      });
    }
    
    // Generate auth URL and redirect automatically
    const oauth = new XeroOAuthService(
      env.XERO_CLIENT_ID,
      env.XERO_CLIENT_SECRET,
      env.XERO_REDIRECT_URI
    );
    
    const state = crypto.randomUUID();
    const authUrl = oauth.getAuthorizationUrl(state);
    
    // Return the auth URL for automatic redirection
    return c.json({ 
      success: true,
      authUrl,
      message: 'Please authorize via Xero (one-time setup)'
    });
  } catch (error: any) {
    console.error('Auto-connect error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// OAuth: Start authentication with custom credentials
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const { clientId, clientSecret, redirectUri } = body;
    
    if (!clientId || !clientSecret || !redirectUri) {
      return c.json({ error: 'Missing credentials' }, 400);
    }
    
    // Store credentials in session temporarily for callback
    const tempSessionId = crypto.randomUUID();
    sessions.set(tempSessionId, {
      tempCredentials: {
        clientId,
        clientSecret,
        redirectUri
      }
    } as any);
    
    const oauth = new XeroOAuthService(clientId, clientSecret, redirectUri);
    const authUrl = oauth.getAuthorizationUrl(tempSessionId); // Use as state
    
    return c.json({ authUrl, state: tempSessionId });
  } catch (error: any) {
    console.error('Login initiation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// OAuth: Start authentication (fallback to env vars)
app.get('/auth/login', (c) => {
  const { env } = c;
  const oauth = new XeroOAuthService(
    env.XERO_CLIENT_ID,
    env.XERO_CLIENT_SECRET,
    env.XERO_REDIRECT_URI
  );
  
  const state = crypto.randomUUID();
  const authUrl = oauth.getAuthorizationUrl(state);
  
  return c.redirect(authUrl);
});

// OAuth: Callback handler
app.get('/auth/callback', async (c) => {
  try {
    const { env } = c;
    const code = c.req.query('code');
    const state = c.req.query('state');
    
    if (!code) {
      return c.html('<h1>Error: No authorization code received</h1>');
    }
    
    // Check if we have custom credentials in session (from POST /auth/login)
    let clientId = env.XERO_CLIENT_ID;
    let clientSecret = env.XERO_CLIENT_SECRET;
    let redirectUri = env.XERO_REDIRECT_URI;
    
    if (state) {
      const tempSession = sessions.get(state);
      if (tempSession && (tempSession as any).tempCredentials) {
        const creds = (tempSession as any).tempCredentials;
        clientId = creds.clientId;
        clientSecret = creds.clientSecret;
        redirectUri = creds.redirectUri;
        // Clean up temp session
        sessions.delete(state);
      }
    }
    
    const oauth = new XeroOAuthService(clientId, clientSecret, redirectUri);
    
    // Exchange code for tokens
    const tokens = await oauth.exchangeCodeForTokens(code);
    
    // Get tenant ID
    const tenantId = await oauth.getTenantId(tokens.accessToken);
    tokens.tenantId = tenantId;
    
    // Create session
    const sessionId = createSession({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tenantId: tenantId,
      expiresAt: tokens.expiresAt,
    });
    
    // Redirect to dashboard with session
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          // Store session token
          localStorage.setItem('xero_session', '${sessionId}');
          // Redirect to dashboard
          window.location.href = '/';
        </script>
      </head>
      <body>
        <h1>Authentication successful! Redirecting...</h1>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return c.html(`<h1>Authentication Error</h1><p>${error.message}</p>`);
  }
});

// Get authentication status
app.get('/api/auth/status', (c) => {
  const session = getSession(c);
  return c.json({
    authenticated: session?.accessToken ? true : false,
    tenantId: session?.tenantId || null,
  });
});

// Get invoice summary
app.get('/api/invoices/summary', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const summary = await xero.getInvoiceSummary();
    return c.json(summary);
  } catch (error: any) {
    console.error('Error fetching invoice summary:', error);
    return c.json({ error: error.message || 'Failed to fetch invoice summary' }, 500);
  }
});

// Get invoices
app.get('/api/invoices', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const fromDate = c.req.query('fromDate');
    const toDate = c.req.query('toDate');
    const status = c.req.query('status');

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const invoices = await xero.getInvoices(fromDate, toDate, status);
    return c.json(invoices);
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return c.json({ error: error.message || 'Failed to fetch invoices' }, 500);
  }
});

// Get Profit & Loss report
app.get('/api/reports/profit-loss', async (c) => {
  try {
    const session = getSession(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const fromDate = c.req.query('fromDate');
    const toDate = c.req.query('toDate');

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const report = await xero.getProfitAndLossReport(fromDate, toDate);
    return c.json(report);
  } catch (error: any) {
    console.error('Error fetching P&L report:', error);
    return c.json({ error: error.message || 'Failed to fetch P&L report' }, 500);
  }
});

// Get Balance Sheet report
app.get('/api/reports/balance-sheet', async (c) => {
  try {
    const session = getSession(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const date = c.req.query('date');

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const report = await xero.getBalanceSheetReport(date);
    return c.json(report);
  } catch (error: any) {
    console.error('Error fetching balance sheet:', error);
    return c.json({ error: error.message || 'Failed to fetch balance sheet' }, 500);
  }
});

// Get Bank Transactions
app.get('/api/transactions', async (c) => {
  try {
    const session = getSession(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const fromDate = c.req.query('fromDate');
    const toDate = c.req.query('toDate');

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const transactions = await xero.getBankTransactions(fromDate, toDate);
    return c.json(transactions);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return c.json({ error: error.message || 'Failed to fetch transactions' }, 500);
  }
});

// Get clients awaiting payment (grouped by company)
app.get('/api/clients/awaiting-payment', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const clients = await xero.getClientsAwaitingPayment();
    return c.json(clients);
  } catch (error: any) {
    console.error('Error fetching clients awaiting payment:', error);
    return c.json({ error: error.message || 'Failed to fetch clients awaiting payment' }, 500);
  }
});

// Get invoices by aging (Current, Aged, Critical)
app.get('/api/invoices/by-aging', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const aging = await xero.getInvoicesByAging();
    return c.json(aging);
  } catch (error: any) {
    console.error('Error fetching invoices by aging:', error);
    return c.json({ error: error.message || 'Failed to fetch invoices by aging' }, 500);
  }
});

// Get payment trends analysis
app.get('/api/payment-trends', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const viewType = c.req.query('view') as 'weekly' | 'monthly' | 'quarterly' || 'monthly';
    const periodsBack = parseInt(c.req.query('periods') || '6');

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    
    // Get all invoices (both paid and outstanding)
    const allInvoices = await xero.getInvoices();
    
    // Calculate trends
    const trends = PaymentTrendsService.calculateTrends(allInvoices, viewType, periodsBack);
    
    return c.json(trends);
  } catch (error: any) {
    console.error('Error fetching payment trends:', error);
    return c.json({ error: error.message || 'Failed to fetch payment trends' }, 500);
  }
});

// Auth status check
app.get('/api/auth/status', (c) => {
  const session = getSession(c);
  return c.json({
    authenticated: !!session?.accessToken,
    tenantId: session?.tenantId || null,
  });
});

// Demo mode endpoint - for testing without Xero auth
app.get('/api/demo/summary', (c) => {
  return c.json({
    draftCount: 16,
    draftAmount: 30017.87,
    awaitingCount: 38,
    awaitingAmount: 63313.81,
    overdueCount: 38,
    overdueAmount: 63313.81,
    totalInvoices: 92,
  });
});

// Demo endpoint for clients awaiting payment
app.get('/api/demo/clients-awaiting-payment', (c) => {
  // Simulated demo data based on real invoice structure
  // In production, this would come from actual Xero API
  const demoClients = [
    {
      contactName: 'ABC Corporation',
      contactId: 'c1',
      invoiceCount: 3,
      totalOutstanding: 24500.00,
      averagePaymentDelay: 65,
      totalPaid: 45000.00,
    },
    {
      contactName: 'XYZ Industries Ltd',
      contactId: 'c2',
      invoiceCount: 2,
      totalOutstanding: 18750.00,
      averagePaymentDelay: 72,
      totalPaid: 38000.00,
    },
    {
      contactName: 'Tech Solutions Inc',
      contactId: 'c3',
      invoiceCount: 2,
      totalOutstanding: 15200.00,
      averagePaymentDelay: 45,
      totalPaid: 52000.00,
    },
    {
      contactName: 'Global Services Co',
      contactId: 'c4',
      invoiceCount: 1,
      totalOutstanding: 12800.00,
      averagePaymentDelay: 90,
      totalPaid: 28000.00,
    },
    {
      contactName: 'Prime Consulting',
      contactId: 'c5',
      invoiceCount: 3,
      totalOutstanding: 9500.00,
      averagePaymentDelay: 55,
      totalPaid: 61000.00,
    },
  ];
  
  // Return demo clients (already sorted by outstanding amount)
  return c.json(demoClients);
});

// Export endpoints for Google Sheets

// Export invoice summary to CSV
app.get('/api/export/summary', async (c) => {
  try {
    const session = getSession(c);
    let summary;
    
    if (!session?.accessToken || !session?.tenantId) {
      // Use demo data
      summary = {
        draftCount: 16,
        draftAmount: 30017.87,
        awaitingCount: 38,
        awaitingAmount: 63313.81,
        overdueCount: 38,
        overdueAmount: 63313.81,
        totalInvoices: 92,
      };
    } else {
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      summary = await xero.getInvoiceSummary();
    }
    
    const csv = ExportService.invoiceSummaryToCSV(summary);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="invoice-summary.csv"',
      },
    });
  } catch (error: any) {
    console.error('Error exporting summary:', error);
    return c.json({ error: error.message || 'Failed to export summary' }, 500);
  }
});

// Export invoices to CSV
app.get('/api/export/invoices', async (c) => {
  try {
    const session = getSession(c);
    let invoices;
    
    if (!session?.accessToken || !session?.tenantId) {
      // Use demo data
      invoices = [
        {
          InvoiceNumber: 'INV-2024-001',
          Contact: { Name: 'ABC Company' },
          Date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          DueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
          Total: 15000.00,
          AmountDue: 15000.00,
          Status: 'AUTHORISED'
        },
        {
          InvoiceNumber: 'INV-2024-002',
          Contact: { Name: 'XYZ Corporation' },
          Date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          DueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          Total: 8500.00,
          AmountDue: 0.00,
          Status: 'PAID'
        },
        {
          InvoiceNumber: 'INV-2024-003',
          Contact: { Name: 'Tech Solutions Ltd' },
          Date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          DueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          Total: 12000.00,
          AmountDue: 12000.00,
          Status: 'DRAFT'
        }
      ];
    } else {
      const status = c.req.query('status');
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      invoices = await xero.getInvoices(undefined, undefined, status);
    }
    
    const csv = ExportService.invoicesToCSV(invoices as any);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="invoices.csv"',
      },
    });
  } catch (error: any) {
    console.error('Error exporting invoices:', error);
    return c.json({ error: error.message || 'Failed to export invoices' }, 500);
  }
});

// Export transactions to CSV
app.get('/api/export/transactions', async (c) => {
  try {
    const session = getSession(c);
    let transactions;
    
    if (!session?.accessToken || !session?.tenantId) {
      // Use demo data
      transactions = [
        {
          Date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          Contact: { Name: 'Office Supplies Co' },
          Type: 'SPEND',
          Total: -1500.00,
          Reference: 'Office supplies purchase'
        },
        {
          Date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          Contact: { Name: 'Client Payment' },
          Type: 'RECEIVE',
          Total: 8500.00,
          Reference: 'Invoice payment'
        },
        {
          Date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          Contact: { Name: 'Utility Company' },
          Type: 'SPEND',
          Total: -450.00,
          Reference: 'Monthly utilities'
        }
      ];
    } else {
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      transactions = await xero.getBankTransactions();
    }
    
    const csv = ExportService.transactionsToCSV(transactions as any);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="transactions.csv"',
      },
    });
  } catch (error: any) {
    console.error('Error exporting transactions:', error);
    return c.json({ error: error.message || 'Failed to export transactions' }, 500);
  }
});

// Export Profit & Loss report to CSV
app.get('/api/export/profit-loss', async (c) => {
  try {
    const session = getSession(c);
    let report;
    
    if (!session?.accessToken || !session?.tenantId) {
      // Use demo data structure
      report = {
        ReportName: 'Profit and Loss (Demo)',
        ReportDate: new Date().toISOString(),
        Rows: []
      };
    } else {
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      report = await xero.getProfitAndLossReport();
    }
    
    const csv = ExportService.profitLossToCSV(report);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="profit-loss.csv"',
      },
    });
  } catch (error: any) {
    console.error('Error exporting P&L:', error);
    return c.json({ error: error.message || 'Failed to export P&L report' }, 500);
  }
});

// Export Balance Sheet to CSV
app.get('/api/export/balance-sheet', async (c) => {
  try {
    const session = getSession(c);
    let report;
    
    if (!session?.accessToken || !session?.tenantId) {
      // Use demo data structure
      report = {
        ReportName: 'Balance Sheet (Demo)',
        ReportDate: new Date().toISOString(),
        Rows: []
      };
    } else {
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      report = await xero.getBalanceSheetReport();
    }
    
    const csv = ExportService.balanceSheetToCSV(report);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="balance-sheet.csv"',
      },
    });
  } catch (error: any) {
    console.error('Error exporting balance sheet:', error);
    return c.json({ error: error.message || 'Failed to export balance sheet' }, 500);
  }
});

// Export clients awaiting payment to CSV
app.get('/api/export/clients-awaiting-payment', async (c) => {
  try {
    const session = getSession(c);
    let clients;
    
    if (!session?.accessToken || !session?.tenantId) {
      // Use realistic demo data - matching the demo endpoint logic
      clients = [
        {
          contactName: 'ABC Corporation',
          contactId: 'c1',
          invoiceCount: 3,
          totalOutstanding: 24500.00,
          averagePaymentDelay: 65,
          totalPaid: 45000.00,
        },
        {
          contactName: 'XYZ Industries Ltd',
          contactId: 'c2',
          invoiceCount: 2,
          totalOutstanding: 18750.00,
          averagePaymentDelay: 72,
          totalPaid: 38000.00,
        },
        {
          contactName: 'Tech Solutions Inc',
          contactId: 'c3',
          invoiceCount: 2,
          totalOutstanding: 15200.00,
          averagePaymentDelay: 45,
          totalPaid: 52000.00,
        },
        {
          contactName: 'Global Services Co',
          contactId: 'c4',
          invoiceCount: 1,
          totalOutstanding: 12800.00,
          averagePaymentDelay: 90,
          totalPaid: 28000.00,
        },
        {
          contactName: 'Prime Consulting',
          contactId: 'c5',
          invoiceCount: 3,
          totalOutstanding: 9500.00,
          averagePaymentDelay: 55,
          totalPaid: 61000.00,
        }
      ];
    } else {
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      clients = await xero.getClientsAwaitingPayment();
    }
    
    const csv = ExportService.clientsAwaitingPaymentToCSV(clients);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="clients-awaiting-payment.csv"',
      },
    });
  } catch (error: any) {
    console.error('Error exporting clients awaiting payment:', error);
    return c.json({ error: error.message || 'Failed to export clients awaiting payment' }, 500);
  }
});

// Export invoices by aging to CSV
app.get('/api/export/invoices-by-aging', async (c) => {
  try {
    const session = getSession(c);
    let aging;
    
    if (!session?.accessToken || !session?.tenantId) {
      // Use demo data
      aging = {
        current: { count: 15, total: 25000.00, invoices: [] },
        aged: { count: 20, total: 35000.00, invoices: [] },
        critical: { count: 13, total: 23239.41, invoices: [] },
      };
    } else {
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      aging = await xero.getInvoicesByAging();
    }
    
    // Generate CSV with aging breakdown
    let csv = 'Category,Age Range,Invoice Count,Total Outstanding\n';
    csv += `CURRENT,0-99 days,${aging.current.count},${aging.current.total.toFixed(2)}\n`;
    csv += `AGED,100-199 days,${aging.aged.count},${aging.aged.total.toFixed(2)}\n`;
    csv += `CRITICAL,200+ days (Legal),${aging.critical.count},${aging.critical.total.toFixed(2)}\n`;
    csv += `TOTAL,All Ages,${aging.current.count + aging.aged.count + aging.critical.count},${(aging.current.total + aging.aged.total + aging.critical.total).toFixed(2)}\n`;
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="invoices-by-aging.csv"',
      },
    });
  } catch (error: any) {
    console.error('Error exporting invoices by aging:', error);
    return c.json({ error: error.message || 'Failed to export invoices by aging' }, 500);
  }
});

// Export payment trends to CSV
app.get('/api/export/payment-trends', async (c) => {
  try {
    const session = getSession(c);
    
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const viewType = c.req.query('view') as 'weekly' | 'monthly' | 'quarterly' || 'monthly';
    const periodsBack = parseInt(c.req.query('periods') || '6');

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const allInvoices = await xero.getInvoices();
    const trends = PaymentTrendsService.calculateTrends(allInvoices, viewType, periodsBack);
    
    // Generate CSV
    let csv = 'Period,Total Outstanding,Overdue Amount,Overdue Count,Payments Received,Payment Count,Current (0-99d),Aged (100-199d),Critical (200+d),Overdue Reduction,Payment Velocity (days),Collection Rate (%)\n';
    
    for (const period of trends.periods) {
      csv += `${period.periodLabel},`;
      csv += `${period.totalOutstanding.toFixed(2)},`;
      csv += `${period.overdueAmount.toFixed(2)},`;
      csv += `${period.overdueCount},`;
      csv += `${period.paymentsReceived.toFixed(2)},`;
      csv += `${period.paymentsCount},`;
      csv += `${period.currentAmount.toFixed(2)},`;
      csv += `${period.agedAmount.toFixed(2)},`;
      csv += `${period.criticalAmount.toFixed(2)},`;
      csv += `${period.overdueReduction.toFixed(2)},`;
      csv += `${period.paymentVelocity},`;
      csv += `${period.collectionRate.toFixed(2)}\n`;
    }
    
    const filename = `payment-trends-${viewType}.csv`;
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting payment trends:', error);
    return c.json({ error: error.message || 'Failed to export payment trends' }, 500);
  }
});

// Default route - main dashboard
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xero Reports Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="app">
            <!-- Navigation -->
            <nav class="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-16">
                        <div class="flex items-center">
                            <i class="fas fa-chart-line text-2xl mr-3"></i>
                            <h1 class="text-xl font-bold">Xero Reports Dashboard</h1>
                        </div>
                    </div>
                </div>
            </nav>

            <!-- Main Content -->
            <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <!-- Navigation Tabs -->
                <div class="mb-6 border-b border-gray-200">
                    <nav class="flex space-x-8" id="tabs">
                        <button onclick="showTab('dashboard')" class="tab-btn active border-b-2 border-blue-600 pb-4 px-1 text-blue-600 font-medium">
                            <i class="fas fa-home mr-2"></i>Dashboard
                        </button>
                        <button onclick="showTab('invoices')" class="tab-btn border-b-2 border-transparent pb-4 px-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-file-invoice mr-2"></i>Invoices
                        </button>
                        <button onclick="showTab('clients')" class="tab-btn border-b-2 border-transparent pb-4 px-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-users mr-2"></i>Clients
                        </button>
                        <button onclick="showTab('trends')" class="tab-btn border-b-2 border-transparent pb-4 px-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-chart-line mr-2"></i>Trends
                        </button>
                        <button onclick="showTab('sheets-links')" class="tab-btn border-b-2 border-transparent pb-4 px-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-link mr-2"></i>Sheets Links
                        </button>
                        <button onclick="showTab('settings')" class="tab-btn border-b-2 border-transparent pb-4 px-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-cog mr-2"></i>Settings
                        </button>
                    </nav>
                </div>

                <!-- Dashboard Tab -->
                <div id="tab-dashboard" class="tab-content">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="bg-white rounded-lg shadow-md p-6">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-3 bg-gray-100 rounded-lg">
                                    <i class="fas fa-edit text-gray-600 text-2xl"></i>
                                </div>
                                <div class="text-right">
                                    <p id="draftCount" class="text-3xl font-bold text-gray-800">--</p>
                                    <p class="text-sm text-gray-500">invoices</p>
                                </div>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-700">Draft Invoices</h3>
                            <p id="draftAmount" class="text-2xl font-bold text-gray-600 mt-2">$0.00</p>
                        </div>

                        <div class="bg-white rounded-lg shadow-md p-6">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-3 bg-orange-100 rounded-lg">
                                    <i class="fas fa-clock text-orange-600 text-2xl"></i>
                                </div>
                                <div class="text-right">
                                    <p id="awaitingCount" class="text-3xl font-bold text-orange-600">--</p>
                                    <p class="text-sm text-gray-500">invoices</p>
                                </div>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-700">Awaiting Payment</h3>
                            <p id="awaitingAmount" class="text-2xl font-bold text-orange-600 mt-2">$0.00</p>
                        </div>

                        <div class="bg-white rounded-lg shadow-md p-6">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-3 bg-red-100 rounded-lg">
                                    <i class="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
                                </div>
                                <div class="text-right">
                                    <p id="overdueCount" class="text-3xl font-bold text-red-600">--</p>
                                    <p class="text-sm text-gray-500">invoices</p>
                                </div>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-700">Overdue</h3>
                            <p id="overdueAmount" class="text-2xl font-bold text-red-600 mt-2">$0.00</p>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-xl font-bold text-gray-800">Invoice Status Overview</h2>
                            <button onclick="exportToGoogleSheets('summary')" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center">
                                <i class="fas fa-table mr-2"></i>Export to Google Sheets
                            </button>
                        </div>
                        <canvas id="invoiceChart" height="80"></canvas>
                    </div>

                    <!-- Invoice Aging Groups -->
                    <div class="mb-8">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-xl font-bold text-gray-800">
                                <i class="fas fa-hourglass-half text-yellow-600 mr-2"></i>
                                Invoice Aging Analysis
                            </h2>
                            <button onclick="loadAgingData()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                <i class="fas fa-sync-alt mr-2"></i>Load Aging Data
                            </button>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <!-- CURRENT Group -->
                            <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-6 border-l-4 border-green-500">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="p-3 bg-green-500 rounded-lg">
                                        <i class="fas fa-check-circle text-white text-2xl"></i>
                                    </div>
                                    <div class="text-right">
                                        <p id="currentCount" class="text-3xl font-bold text-green-700">--</p>
                                        <p class="text-sm text-green-600">invoices</p>
                                    </div>
                                </div>
                                <h3 class="text-lg font-semibold text-green-800 mb-1">🟢 CURRENT</h3>
                                <p class="text-xs text-green-600 mb-2">0-99 days old</p>
                                <p id="currentAmount" class="text-2xl font-bold text-green-700 mt-2">$0.00</p>
                                <p class="text-xs text-green-600 mt-1">Normal collection period</p>
                            </div>

                            <!-- AGED Group -->
                            <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="p-3 bg-yellow-500 rounded-lg">
                                        <i class="fas fa-exclamation-triangle text-white text-2xl"></i>
                                    </div>
                                    <div class="text-right">
                                        <p id="agedCount" class="text-3xl font-bold text-yellow-700">--</p>
                                        <p class="text-sm text-yellow-600">invoices</p>
                                    </div>
                                </div>
                                <h3 class="text-lg font-semibold text-yellow-800 mb-1">🟡 AGED</h3>
                                <p class="text-xs text-yellow-600 mb-2">100-199 days old</p>
                                <p id="agedAmount" class="text-2xl font-bold text-yellow-700 mt-2">$0.00</p>
                                <p class="text-xs text-yellow-600 mt-1">⚠️ Requires attention</p>
                            </div>

                            <!-- CRITICAL Group -->
                            <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-md p-6 border-l-4 border-red-500">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="p-3 bg-red-500 rounded-lg">
                                        <i class="fas fa-gavel text-white text-2xl"></i>
                                    </div>
                                    <div class="text-right">
                                        <p id="criticalCount" class="text-3xl font-bold text-red-700">--</p>
                                        <p class="text-sm text-red-600">invoices</p>
                                    </div>
                                </div>
                                <h3 class="text-lg font-semibold text-red-800 mb-1">🔴 CRITICAL</h3>
                                <p class="text-xs text-red-600 mb-2">200+ days old</p>
                                <p id="criticalAmount" class="text-2xl font-bold text-red-700 mt-2">$0.00</p>
                                <p class="text-xs text-red-600 mt-1">🚨 Legal negotiation</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div class="flex items-start">
                            <i class="fas fa-info-circle text-blue-600 text-xl mr-3 mt-1"></i>
                            <div>
                                <h3 class="text-lg font-semibold text-blue-900 mb-2">About This Dashboard</h3>
                                <p class="text-blue-800 mb-2">This dashboard connects to your Xero account to provide real-time financial insights and reporting capabilities.</p>
                                <ul class="list-disc list-inside text-blue-700 space-y-1">
                                    <li>View invoice summaries and payment status</li>
                                    <li>Generate Profit & Loss and Balance Sheet reports</li>
                                    <li>Track bank transactions and cash flow</li>
                                    <li>Export data to CSV, Excel, or PDF formats</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Invoices Tab -->
                <div id="tab-invoices" class="tab-content hidden">
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-gray-800">Invoice List</h2>
                            <div class="flex space-x-2">
                                <button onclick="exportToGoogleSheets('invoices')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">
                                    <i class="fas fa-table mr-2"></i>Export
                                </button>
                                <button onclick="loadInvoices('DRAFT')" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                                    Draft
                                </button>
                                <button onclick="loadInvoices('AUTHORISED')" class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
                                    Awaiting
                                </button>
                                <button onclick="loadInvoices('PAID')" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                                    Paid
                                </button>
                                <button onclick="loadInvoices()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                                    All
                                </button>
                            </div>
                        </div>
                        <div id="invoiceList" class="overflow-x-auto">
                            <p class="text-gray-500 text-center py-8">Click a button above to load invoices</p>
                        </div>
                    </div>
                </div>

                <!-- Clients Tab -->
                <div id="tab-clients" class="tab-content hidden">
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <h2 class="text-xl font-bold text-gray-800">Clients Awaiting Payment</h2>
                                <p class="text-sm text-gray-500 mt-1">Companies with outstanding invoices</p>
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="exportToGoogleSheets('clients-awaiting-payment')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">
                                    <i class="fas fa-table mr-2"></i>Export
                                </button>
                                <button onclick="loadClientsAwaitingPayment()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                    <i class="fas fa-sync-alt mr-2"></i>Load Clients
                                </button>
                            </div>
                        </div>
                        <div id="clientsList">
                            <p class="text-gray-500 text-center py-8">Click "Load Clients" to view companies awaiting payment</p>
                        </div>
                    </div>
                </div>

                <!-- Payment Trends Tab -->
                <div id="tab-trends" class="tab-content hidden">
                    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-gray-800">
                                <i class="fas fa-chart-line mr-2 text-blue-600"></i>
                                Payment Trends Analysis
                            </h2>
                            <div class="flex space-x-2">
                                <select id="trendsViewType" class="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="weekly">Weekly (8 weeks)</option>
                                    <option value="monthly" selected>Monthly (6 months)</option>
                                    <option value="quarterly">Quarterly (4 quarters)</option>
                                </select>
                                <button onclick="exportToGoogleSheets('payment-trends')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">
                                    <i class="fas fa-table mr-2"></i>Export
                                </button>
                                <button onclick="loadPaymentTrends()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                    <i class="fas fa-sync-alt mr-2"></i>Load Trends
                                </button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                                <div class="flex items-center justify-between">
                                    <i class="fas fa-arrow-down text-green-600 text-2xl"></i>
                                    <div class="text-right">
                                        <p id="totalImprovement" class="text-2xl font-bold text-green-700">$0</p>
                                        <p class="text-xs text-green-600">Total Improvement</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                                <div class="flex items-center justify-between">
                                    <i class="fas fa-tachometer-alt text-blue-600 text-2xl"></i>
                                    <div class="text-right">
                                        <p id="avgPaymentVelocity" class="text-2xl font-bold text-blue-700">0</p>
                                        <p class="text-xs text-blue-600">Avg Payment Days</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                                <div class="flex items-center justify-between">
                                    <i class="fas fa-trophy text-purple-600 text-2xl"></i>
                                    <div class="text-right">
                                        <p id="bestPeriodLabel" class="text-lg font-bold text-purple-700">--</p>
                                        <p class="text-xs text-purple-600">Best Period</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                                <div class="flex items-center justify-between">
                                    <i class="fas fa-chart-line text-orange-600 text-2xl"></i>
                                    <div class="text-right">
                                        <p id="trendsDirection" class="text-lg font-bold text-orange-700">--</p>
                                        <p class="text-xs text-orange-600">Trend Direction</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="trendsData" class="overflow-x-auto">
                            <p class="text-gray-500 text-center py-8">Click "Load Trends" to see payment trends analysis</p>
                        </div>
                    </div>
                </div>

                <!-- Google Sheets Links Tab -->
                <div id="tab-sheets-links" class="tab-content hidden">
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500 p-6 mb-6 rounded-lg">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <i class="fas fa-table text-green-600 text-3xl mr-4"></i>
                                <div>
                                    <h2 class="text-xl font-bold text-gray-800">Google Sheets Integration</h2>
                                    <p class="text-sm text-gray-600 mt-1">Direct URLs ready to use with =IMPORTDATA() formula</p>
                                </div>
                            </div>
                            <div id="sheetsAuthStatus" class="text-right">
                                <!-- Status will be updated by JS -->
                            </div>
                        </div>
                    </div>

                    <!-- Usage Instructions -->
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg">
                        <div class="flex items-start">
                            <i class="fas fa-info-circle text-blue-500 text-lg mr-3 mt-1"></i>
                            <div class="flex-1">
                                <p class="text-sm text-blue-900 font-semibold mb-2">How to use these URLs:</p>
                                <ol class="text-sm text-blue-800 space-y-1 ml-4">
                                    <li>1. Copy any full URL below (click to select all)</li>
                                    <li>2. Open Google Sheets and select a cell</li>
                                    <li>3. Paste: <code class="bg-white px-2 py-1 rounded text-xs">=IMPORTDATA("url")</code></li>
                                    <li>4. Press Enter - Your Xero data appears!</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    <!-- Grid Layout for Categories -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Invoice Summary -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <h3 class="text-base font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-chart-pie text-blue-600 mr-2"></i>
                                Invoice Summary
                            </h3>
                            <p class="text-xs text-gray-600 mb-3">Draft, Awaiting Payment, Overdue counts & amounts</p>
                            <div class="bg-blue-50 p-3 rounded border border-blue-200">
                                <code class="text-xs text-gray-800 break-all select-all">=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/summary")</code>
                            </div>
                        </div>

                        <!-- Clients Awaiting Payment -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <h3 class="text-base font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-users text-purple-600 mr-2"></i>
                                Clients Awaiting Payment
                            </h3>
                            <p class="text-xs text-gray-600 mb-3">Companies with outstanding invoices (Milvue, Duorooq, HSSDR, etc.)</p>
                            <div class="bg-purple-50 p-3 rounded border border-purple-200">
                                <code class="text-xs text-gray-800 break-all select-all">=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")</code>
                            </div>
                        </div>

                        <!-- All Invoices -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <h3 class="text-base font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-file-invoice text-orange-600 mr-2"></i>
                                All Invoices
                            </h3>
                            <p class="text-xs text-gray-600 mb-3">Complete invoice list with numbers, dates, amounts, status</p>
                            <div class="bg-orange-50 p-3 rounded border border-orange-200">
                                <code class="text-xs text-gray-800 break-all select-all">=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices")</code>
                            </div>
                        </div>

                        <!-- Bank Transactions -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <h3 class="text-base font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-exchange-alt text-green-600 mr-2"></i>
                                Bank Transactions
                            </h3>
                            <p class="text-xs text-gray-600 mb-3">Transaction history (receive/spend) with dates and amounts</p>
                            <div class="bg-green-50 p-3 rounded border border-green-200">
                                <code class="text-xs text-gray-800 break-all select-all">=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/transactions")</code>
                            </div>
                        </div>

                        <!-- Profit & Loss Report -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <h3 class="text-base font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-chart-line text-red-600 mr-2"></i>
                                Profit & Loss Report
                            </h3>
                            <p class="text-xs text-gray-600 mb-3">Revenue and expenses breakdown by account</p>
                            <div class="bg-red-50 p-3 rounded border border-red-200">
                                <code class="text-xs text-gray-800 break-all select-all">=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/profit-loss")</code>
                            </div>
                        </div>

                        <!-- Balance Sheet Report -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <h3 class="text-base font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-balance-scale text-indigo-600 mr-2"></i>
                                Balance Sheet Report
                            </h3>
                            <p class="text-xs text-gray-600 mb-3">Assets, liabilities, and equity breakdown</p>
                            <div class="bg-indigo-50 p-3 rounded border border-indigo-200">
                                <code class="text-xs text-gray-800 break-all select-all">=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/balance-sheet")</code>
                            </div>
                        </div>

                        <!-- Invoice Aging Analysis -->
                        <div class="bg-white rounded-lg shadow-sm border border-yellow-300 p-5 border-2">
                            <h3 class="text-base font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-hourglass-half text-yellow-600 mr-2"></i>
                                Invoice Aging Analysis ⭐ NEW
                            </h3>
                            <p class="text-xs text-gray-600 mb-3">
                                3 aging groups: <strong>CURRENT</strong> (0-99 days), 
                                <strong>AGED</strong> (100-199 days), 
                                <strong>CRITICAL</strong> (200+ days - legal negotiation)
                            </p>
                            <div class="bg-yellow-50 p-3 rounded border border-yellow-200">
                                <code class="text-xs text-gray-800 break-all select-all">=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices-by-aging")</code>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Settings Tab -->
                <div id="tab-settings" class="tab-content hidden">
                    <div class="max-w-4xl mx-auto">
                        <!-- Xero API Settings -->
                        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                            <div class="flex items-start mb-6">
                                <div class="flex-shrink-0">
                                    <div class="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                                        <i class="fas fa-key text-2xl"></i>
                                    </div>
                                </div>
                                <div class="ml-4 flex-1">
                                    <h2 class="text-2xl font-bold text-gray-900">Xero API Configuration</h2>
                                    <p class="mt-2 text-sm text-gray-600">
                                        Configure your Xero API credentials to connect your organization.
                                    </p>
                                </div>
                            </div>

                            <div class="space-y-6">
                                <!-- Current Status -->
                                <div id="settingsStatus" class="p-4 rounded-lg border">
                                    <!-- Status will be populated by JavaScript -->
                                </div>

                                <!-- Client ID -->
                                <div>
                                    <label for="clientId" class="block text-sm font-medium text-gray-700 mb-2">
                                        <i class="fas fa-id-badge mr-2 text-blue-600"></i>Client ID
                                    </label>
                                    <input
                                        type="text"
                                        id="clientId"
                                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="0C••••••••••••••••••••••••••E6"
                                    />
                                    <p class="mt-1 text-xs text-gray-500">
                                        Your Xero application Client ID from 
                                        <a href="https://developer.xero.com/myapps" target="_blank" class="text-blue-600 hover:underline">
                                            developer.xero.com/myapps
                                        </a>
                                    </p>
                                </div>

                                <!-- Client Secret -->
                                <div>
                                    <label for="clientSecret" class="block text-sm font-medium text-gray-700 mb-2">
                                        <i class="fas fa-lock mr-2 text-blue-600"></i>Client Secret
                                    </label>
                                    <div class="relative">
                                        <input
                                            type="password"
                                            id="clientSecret"
                                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="••••••••••••••••••••••••••••"
                                        />
                                        <button
                                            onclick="toggleSecretVisibility()"
                                            class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <i id="secretIcon" class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                    <p class="mt-1 text-xs text-gray-500">
                                        Your Xero application Client Secret (keep this secure)
                                    </p>
                                </div>

                                <!-- Redirect URI (Read-only) -->
                                <div>
                                    <label for="redirectUri" class="block text-sm font-medium text-gray-700 mb-2">
                                        <i class="fas fa-link mr-2 text-blue-600"></i>Redirect URI
                                    </label>
                                    <div class="flex gap-2">
                                        <input
                                            type="text"
                                            id="redirectUri"
                                            readonly
                                            class="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600"
                                            value=""
                                        />
                                        <button
                                            onclick="copyRedirectUri()"
                                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                                        >
                                            <i class="fas fa-copy mr-2"></i>Copy
                                        </button>
                                    </div>
                                    <p class="mt-1 text-xs text-gray-500">
                                        Add this redirect URI to your Xero app configuration
                                    </p>
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex gap-4 pt-4">
                                    <button
                                        onclick="saveSettings()"
                                        class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center font-medium"
                                    >
                                        <i class="fas fa-save mr-2"></i>Save Configuration
                                    </button>
                                    <button
                                        onclick="testConnection()"
                                        class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center font-medium"
                                    >
                                        <i class="fas fa-plug mr-2"></i>Test Connection
                                    </button>
                                </div>

                                <div class="flex gap-4">
                                    <button
                                        onclick="loadCurrentSettings()"
                                        class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center justify-center"
                                    >
                                        <i class="fas fa-redo mr-2"></i>Load Current
                                    </button>
                                    <button
                                        onclick="clearSettings()"
                                        class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center"
                                    >
                                        <i class="fas fa-trash mr-2"></i>Clear & Disconnect
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Help Section -->
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <h3 class="text-lg font-semibold text-blue-900 mb-3">
                                <i class="fas fa-info-circle mr-2"></i>How to Get Your Xero API Credentials
                            </h3>
                            <ol class="list-decimal list-inside space-y-2 text-sm text-blue-800">
                                <li>Go to <a href="https://developer.xero.com/myapps" target="_blank" class="font-medium underline hover:text-blue-600">developer.xero.com/myapps</a></li>
                                <li>Click "New app" or select an existing app</li>
                                <li>Copy the <strong>Client ID</strong> and click "Generate a secret" for the <strong>Client Secret</strong></li>
                                <li>Add the <strong>Redirect URI</strong> shown above to your Xero app's OAuth 2.0 redirect URIs</li>
                                <li>Save your credentials in this form</li>
                                <li>Click "Test Connection" to verify the setup</li>
                                <li>Click "Connect to Xero" in the header to authorize</li>
                            </ol>
                            
                            <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <p class="text-xs text-yellow-800">
                                    <i class="fas fa-exclamation-triangle mr-2"></i>
                                    <strong>Security Note:</strong> Your credentials are stored securely in your browser's localStorage 
                                    and are only sent to your Xero account during authentication. Never share your Client Secret with anyone.
                                </p>
                            </div>
                        </div>

                        <!-- Pre-configured Info -->
                        <div class="bg-green-50 border border-green-200 rounded-lg p-6 mt-6">
                            <h3 class="text-lg font-semibold text-green-900 mb-3">
                                <i class="fas fa-check-circle mr-2"></i>Pre-configured Credentials Available
                            </h3>
                            <p class="text-sm text-green-800 mb-3">
                                This app comes with pre-configured Xero API credentials. If you don't have your own credentials yet, 
                                you can use the default configuration:
                            </p>
                            <button
                                onclick="loadDefaultSettings()"
                                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center"
                            >
                                <i class="fas fa-magic mr-2"></i>Load Default Configuration
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `);
});

export default app;
