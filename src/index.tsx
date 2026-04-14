// BUILD TIMESTAMP: 1771032719 - Force rebuild v2.4.4
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { XeroApiService } from './services/xero-api';
import { ExportService } from './services/export-service';
import { XeroOAuthService } from './services/xero-oauth';
import { PaymentTrendsService } from './services/payment-trends';
import { CfoAnalyticsService } from './services/cfo-analytics';

type Bindings = {
  XERO_CLIENT_ID: string;
  XERO_CLIENT_SECRET: string;
  XERO_REDIRECT_URI: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Production credentials with fallbacks
const PRODUCTION_CREDENTIALS = {
  XERO_CLIENT_ID: '0CA378B164364DB0821A6014520913E6',
  XERO_CLIENT_SECRET: 'Mq75ulsu-AJPj80E5NOFV7aaZfgh898xEqjnplXPMYL9SdNE',
  // Dynamically set redirect URI based on host
  getRedirectUri: (host: string) => {
    if (host.includes('finance.gershoncrm.com')) {
      return 'https://finance.gershoncrm.com/auth/callback';
    } else if (host.includes('sandbox.novita.ai')) {
      return `https://${host}/auth/callback`;
    }
    return `https://${host}/auth/callback`;
  }
};

// Helper to get credentials with fallbacks
function getCredentials(c: any) {
  const { env } = c;
  const host = c.req.header('host') || '';
  
  return {
    clientId: env?.XERO_CLIENT_ID || PRODUCTION_CREDENTIALS.XERO_CLIENT_ID,
    clientSecret: env?.XERO_CLIENT_SECRET || PRODUCTION_CREDENTIALS.XERO_CLIENT_SECRET,
    redirectUri: env?.XERO_REDIRECT_URI || PRODUCTION_CREDENTIALS.getRedirectUri(host)
  };
}

// Enable CORS for API routes
app.use('/api/*', cors());

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }));

// Session storage - Using client-side tokens instead of server-side Map
interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  expiresAt?: number;
}

// Simple Base64 encoding/decoding for session data
function encodeSession(session: SessionData): string {
  try {
    return btoa(JSON.stringify(session));
  } catch (e) {
    console.error('Session encode error:', e);
    return '';
  }
}

function decodeSession(encoded: string): SessionData | null {
  try {
    if (!encoded) return null;
    return JSON.parse(atob(encoded));
  } catch (e) {
    console.error('Session decode error:', e);
    return null;
  }
}

// Helper to get session from cookie or header
function getSession(c: any): SessionData | null {
  // Check X-Session-Token header (from frontend)
  const sessionHeader = c.req.header('X-Session-Token');
  if (sessionHeader) {
    return decodeSession(sessionHeader);
  }
  
  // Check Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    return decodeSession(token);
  }
  
  return null;
}

// Helper to get session token from request (for refresh)
function getSessionToken(c: any): string | null {
  const sessionHeader = c.req.header('X-Session-Token');
  if (sessionHeader) {
    return sessionHeader;
  }
  
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    return authHeader.replace('Bearer ', '');
  }
  
  return null;
}

// Helper to refresh expired token
async function getSessionWithRefresh(c: any): Promise<{ session: SessionData | null, sessionToken: string | null }> {
  const sessionToken = getSessionToken(c);
  if (!sessionToken) {
    return { session: null, sessionToken: null };
  }
  
  const session = decodeSession(sessionToken);
  if (!session) {
    return { session: null, sessionToken: null };
  }
  
  // Check if token is expired or about to expire (within 5 minutes)
  const now = Date.now();
  const expiresAt = session.expiresAt || 0;
  const fiveMinutes = 5 * 60 * 1000;
  
  if (expiresAt > 0 && expiresAt - now < fiveMinutes) {
    // Token expired or about to expire, refresh it
    try {
      const credentials = getCredentials(c);
      const oauth = new XeroOAuthService(
        credentials.clientId,
        credentials.clientSecret,
        credentials.redirectUri
      );
      
      if (session.refreshToken) {
        console.log('Refreshing expired token...');
        const newTokens = await oauth.refreshAccessToken(session.refreshToken);
        
        // Update session with new tokens
        session.accessToken = newTokens.accessToken;
        session.refreshToken = newTokens.refreshToken;
        session.expiresAt = newTokens.expiresAt;
        
        // Return updated session token
        const updatedToken = encodeSession(session);
        
        console.log('Token refreshed successfully');
        return { session, sessionToken: updatedToken };
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Token refresh failed, session is invalid
      return { session: null, sessionToken: null };
    }
  }
  
  return { session, sessionToken: sessionToken };
}

// Helper to create session token
function createSessionToken(data: SessionData): string {
  return encodeSession(data);
}

// API Routes

// Health check with version info
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.8.0',
    releaseDate: '2026-04-08T23:58:44Z',
    server: 'cloudflare-workers',
    fixes: [
      'v2.8.0: Fix Avg Revenue/Client (ContactID fallback to Name), move Refresh Data to nav, per-client IMPORTDATA on Sheets tab, period sort by month',
      'v2.6.1: Stability improvements',
      'v2.4.2: CRITICAL - Added /api/sheets endpoints for Google Sheets IMPORTDATA',
      'v2.4.1: Remove ALL alert popups - errors only logged to console',
      'v2.3.3: QA tested - removed duplicate auth endpoint, verified all features',
      'v2.3.0: Built dist with demo endpoints and correct URLs',
      'v2.2.0: Fixed URLs in src/index.tsx',
      'v2.0.0: Node.js conversion',
    ]
  });
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
    const credentials = getCredentials(c);
    const oauth = new XeroOAuthService(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
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

// Temporary credential storage for OAuth flow (only used during redirect)
const tempCredentials = new Map<string, any>();

// OAuth: Start authentication with custom credentials
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const { clientId, clientSecret, redirectUri } = body;
    
    if (!clientId || !clientSecret || !redirectUri) {
      return c.json({ error: 'Missing credentials' }, 400);
    }
    
    // Store credentials temporarily (will be cleaned up in callback)
    const state = crypto.randomUUID();
    tempCredentials.set(state, {
      clientId,
      clientSecret,
      redirectUri,
      timestamp: Date.now()
    });
    
    // Clean up old temp credentials (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of tempCredentials.entries()) {
      if (value.timestamp < tenMinutesAgo) {
        tempCredentials.delete(key);
      }
    }
    
    const oauth = new XeroOAuthService(clientId, clientSecret, redirectUri);
    const authUrl = oauth.getAuthorizationUrl(state);
    
    return c.json({ authUrl, state });
  } catch (error: any) {
    console.error('Login initiation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// OAuth: Start authentication (fallback to env vars)
app.get('/auth/login', (c) => {
  const credentials = getCredentials(c);
  const oauth = new XeroOAuthService(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri
  );
  
  const state = crypto.randomUUID();
  const authUrl = oauth.getAuthorizationUrl(state);
  
  return c.redirect(authUrl);
});

// OAuth: Callback handler
app.get('/auth/callback', async (c) => {
  try {
    const credentials = getCredentials(c);
    const code = c.req.query('code');
    const state = c.req.query('state');
    
    if (!code) {
      return c.html('<h1>Error: No authorization code received</h1>');
    }
    
    // Get credentials with fallbacks (already declared above)
    let clientId = credentials.clientId;
    let clientSecret = credentials.clientSecret;
    let redirectUri = credentials.redirectUri;
    
    // Check if we have custom credentials (from POST /auth/login)
    if (state) {
      const tempCreds = tempCredentials.get(state);
      if (tempCreds) {
        clientId = tempCreds.clientId;
        clientSecret = tempCreds.clientSecret;
        redirectUri = tempCreds.redirectUri;
        // Clean up temp credentials
        tempCredentials.delete(state);
      }
    }
    
    const oauth = new XeroOAuthService(clientId, clientSecret, redirectUri);
    
    // Exchange code for tokens
    const tokens = await oauth.exchangeCodeForTokens(code);
    
    // Get tenant ID
    const tenantId = await oauth.getTenantId(tokens.accessToken);
    tokens.tenantId = tenantId;
    
    // Create session token
    const sessionToken = createSessionToken({
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
        <style>
          body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
          .status { padding: 15px; margin: 10px 0; border-radius: 5px; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
          .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
          .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
          code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
          button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; }
          button:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        <h1>🔐 Authentication Debug</h1>
        <div id="status"></div>
        <button onclick="goToDashboard()" id="continueBtn" style="display:none;">Continue to Dashboard</button>
        
        <script>
          const statusDiv = document.getElementById('status');
          const sessionToken = '${sessionToken}';
          
          function addStatus(message, type = 'info') {
            const div = document.createElement('div');
            div.className = 'status ' + type;
            div.innerHTML = message;
            statusDiv.appendChild(div);
          }
          
          function goToDashboard() {
            window.location.href = '/';
          }
          
          // Start diagnostic
          addStatus('✅ OAuth callback successful', 'success');
          addStatus('📦 Session token received from server (length: ' + sessionToken.length + ' chars)', 'success');
          
          try {
            // Store token
            localStorage.setItem('xero_session', sessionToken);
            addStatus('✅ Session token stored in localStorage', 'success');
            
            // Verify
            const stored = localStorage.getItem('xero_session');
            if (stored) {
              addStatus('✅ Verified: Token retrieved from localStorage (length: ' + stored.length + ' chars)', 'success');
              addStatus('<strong>Token preview:</strong> <code>' + stored.substring(0, 80) + '...</code>', 'info');
              
              // Show continue button
              document.getElementById('continueBtn').style.display = 'inline-block';
              
              // Auto-redirect after 3 seconds
              addStatus('🔄 Auto-redirecting to dashboard in 3 seconds...', 'info');
              setTimeout(goToDashboard, 3000);
            } else {
              addStatus('❌ ERROR: Token not found in localStorage after storing!', 'error');
              addStatus('This indicates a browser security issue or localStorage is disabled', 'error');
            }
          } catch (error) {
            addStatus('❌ ERROR storing token: ' + error.message, 'error');
            addStatus('Error details: ' + error.stack, 'error');
          }
        </script>
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

// Get revenue metrics (ARR/MRR)
app.get('/api/revenue/metrics', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const allInvoices = await xero.getInvoices();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const monthsRemaining = 11 - currentMonth;

    // Helper: parse Xero date strings
    const parseDate = (d: any): Date | null => {
      if (!d) return null;
      if (typeof d === 'string' && d.includes('/Date(')) {
        const m = d.match(/\/Date\((\d+)/);
        return m ? new Date(parseInt(m[1])) : null;
      }
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt;
    };

    const validStatuses = ['PAID', 'AUTHORISED', 'SUBMITTED'];

    // Current month: total invoiced (all non-void invoices issued this month)
    const thisMonthInvoices = allInvoices.filter(inv => {
      const d = parseDate(inv.Date);
      return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth
        && validStatuses.includes(inv.Status);
    });
    const thisMonthInvoiced = thisMonthInvoices.reduce((s, i) => s + (i.Total || 0), 0);

    // Previous month
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthInvoices = allInvoices.filter(inv => {
      const d = parseDate(inv.Date);
      return d && d.getFullYear() === prevMonthYear && d.getMonth() === prevMonth
        && validStatuses.includes(inv.Status);
    });
    const prevMonthInvoiced = prevMonthInvoices.reduce((s, i) => s + (i.Total || 0), 0);

    // MRR = actual invoiced this month (Option A: simple actual billing MRR)
    const mrr = thisMonthInvoiced;
    const arr = mrr * 12;

    // YTD Revenue: paid invoices this year
    const ytdPaidInvoices = allInvoices.filter(inv => {
      const d = parseDate(inv.Date);
      return d && d.getFullYear() === currentYear && inv.Status === 'PAID';
    });
    const ytdRevenue = ytdPaidInvoices.reduce((s, i) => s + (i.Total || 0), 0);

    // Projected EOY from YTD paid pace
    const monthsElapsed = currentMonth + 1;
    const projectedEOY = monthsElapsed > 0 ? (ytdRevenue / monthsElapsed) * 12 : 0;

    // MoM growth
    const momGrowth = prevMonthInvoiced > 0
      ? ((thisMonthInvoiced - prevMonthInvoiced) / prevMonthInvoiced) * 100 : 0;

    // Active clients this month (unique clients with at least one invoice)
    const activeClientIds = new Set<string>();
    thisMonthInvoices.forEach(inv => {
      if (inv.Contact?.ContactID) activeClientIds.add(inv.Contact.ContactID);
    });
    const activeClients = activeClientIds.size;

    // Paid/unpaid/late this month
    const paidThisMonth = thisMonthInvoices.filter(i => i.Status === 'PAID').length;
    const unpaidThisMonth = thisMonthInvoices.filter(i => i.Status !== 'PAID').length;
    const lateThisMonth = thisMonthInvoices.filter(i => {
      const due = parseDate(i.DueDate);
      return i.Status !== 'PAID' && due && due < now;
    }).length;

    // Collection rate (paid amount / total invoiced this month)
    const paidAmountThisMonth = thisMonthInvoices
      .filter(i => i.Status === 'PAID')
      .reduce((s, i) => s + (i.Total || 0), 0);
    const collectionRate = thisMonthInvoiced > 0
      ? Math.round((paidAmountThisMonth / thisMonthInvoiced) * 1000) / 10 : 0;

    return c.json({
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      ytdRevenue: Math.round(ytdRevenue * 100) / 100,
      projectedEOY: Math.round(projectedEOY * 100) / 100,
      thisMonthInvoiced: Math.round(thisMonthInvoiced * 100) / 100,
      prevMonthInvoiced: Math.round(prevMonthInvoiced * 100) / 100,
      momGrowth: Math.round(momGrowth * 10) / 10,
      growthRate: Math.round(momGrowth * 10) / 10,
      activeClients,
      currentMonth: currentMonth + 1,
      monthsRemaining,
      mrrFormula: 'MRR = Total invoiced in current month (actual billing)',
      paidThisMonth,
      unpaidThisMonth,
      lateThisMonth,
      collectionRate,
      calculations: {
        avgRevenuePerClient: activeClients > 0 ? Math.round((mrr / activeClients) * 100) / 100 : 0,
        runRateARR: Math.round(arr * 100) / 100,
        paceVsProjection: projectedEOY > 0 ? Math.round((arr / projectedEOY - 1) * 100 * 10) / 10 : 0,
        invoiceCount2026: allInvoices.filter(i => { const d = parseDate(i.Date); return d && d.getFullYear() === currentYear; }).length,
        ytdInvoiceCount: ytdPaidInvoices.length
      }
    });
  } catch (error: any) {
    console.error('Error calculating revenue metrics:', error);
    return c.json({ error: error.message || 'Failed to calculate revenue metrics' }, 500);
  }
});

// Monthly trends: month-by-month breakdown for the past 12 months
app.get('/api/monthly/trends', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const allInvoices = await xero.getInvoices();
    const now = new Date();

    const parseDate = (d: any): Date | null => {
      if (!d) return null;
      if (typeof d === 'string' && d.includes('/Date(')) {
        const m = d.match(/\/Date\((\d+)/);
        return m ? new Date(parseInt(m[1])) : null;
      }
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt;
    };

    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();

      const monthInvoices = allInvoices.filter(inv => {
        const id = parseDate(inv.Date);
        return id && id.getFullYear() === yr && id.getMonth() === mo
          && ['PAID', 'AUTHORISED', 'SUBMITTED'].includes(inv.Status);
      });

      const totalInvoiced = monthInvoices.reduce((s, i) => s + (i.Total || 0), 0);
      const invoiceCount = monthInvoices.length;

      const activeClientSet = new Set<string>();
      monthInvoices.forEach(inv => {
        if (inv.Contact?.ContactID) activeClientSet.add(inv.Contact.ContactID);
      });
      const activeClients = activeClientSet.size;

      const paidInvoices = monthInvoices.filter(i => i.Status === 'PAID');
      const paidAmount = paidInvoices.reduce((s, i) => s + (i.Total || 0), 0);
      const unpaidInvoices = monthInvoices.filter(i => i.Status !== 'PAID');
      const lateInvoices = monthInvoices.filter(i => {
        const due = parseDate(i.DueDate);
        return i.Status !== 'PAID' && due && due < now;
      });

      const collectionRate = totalInvoiced > 0
        ? Math.round((paidAmount / totalInvoiced) * 1000) / 10 : 0;

      months.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        year: yr,
        monthNum: mo + 1,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        invoiceCount,
        activeClients,
        avgPerClient: activeClients > 0 ? Math.round((totalInvoiced / activeClients) * 100) / 100 : 0,
        paidCount: paidInvoices.length,
        paidAmount: Math.round(paidAmount * 100) / 100,
        unpaidCount: unpaidInvoices.length,
        unpaidAmount: Math.round(unpaidInvoices.reduce((s, i) => s + (i.AmountDue || i.Total || 0), 0) * 100) / 100,
        lateCount: lateInvoices.length,
        lateAmount: Math.round(lateInvoices.reduce((s, i) => s + (i.AmountDue || i.Total || 0), 0) * 100) / 100,
        collectionRate,
      });
    }

    return c.json({ months, lastRefresh: now.toISOString() });
  } catch (error: any) {
    console.error('Monthly trends error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Client lifetime: retention metrics per client
app.get('/api/clients/lifetime', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const allInvoices = await xero.getInvoices();
    const now = new Date();

    const parseDate = (d: any): Date | null => {
      if (!d) return null;
      if (typeof d === 'string' && d.includes('/Date(')) {
        const m = d.match(/\/Date\((\d+)/);
        return m ? new Date(parseInt(m[1])) : null;
      }
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt;
    };

    const clientMap = new Map<string, any>();

    for (const inv of allInvoices) {
      if (!['PAID', 'AUTHORISED', 'SUBMITTED'].includes(inv.Status)) continue;
      const contactId = inv.Contact?.ContactID;
      const contactName = inv.Contact?.Name || 'Unknown';
      if (!contactId) continue;

      const invDate = parseDate(inv.Date);
      if (!invDate) continue;

      const monthKey = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`;

      if (!clientMap.has(contactId)) {
        clientMap.set(contactId, {
          contactId,
          contactName,
          firstInvoiceDate: invDate,
          latestInvoiceDate: invDate,
          billedMonths: new Set([monthKey]),
          totalInvoiced: 0,
          latestInvoiceAmount: 0,
          invoiceCount: 0,
        });
      }

      const client = clientMap.get(contactId);
      if (invDate < client.firstInvoiceDate) client.firstInvoiceDate = invDate;
      if (invDate >= client.latestInvoiceDate) {
        client.latestInvoiceDate = invDate;
        client.latestInvoiceAmount = inv.Total || 0;
      }
      client.billedMonths.add(monthKey);
      client.totalInvoiced += inv.Total || 0;
      client.invoiceCount += 1;
    }

    const clients = Array.from(clientMap.values()).map(c => {
      const firstDate = c.firstInvoiceDate as Date;
      const latestDate = c.latestInvoiceDate as Date;
      // Elapsed lifetime: months between first and latest, inclusive
      const elapsedMonths = (latestDate.getFullYear() - firstDate.getFullYear()) * 12
        + (latestDate.getMonth() - firstDate.getMonth()) + 1;
      return {
        contactName: c.contactName,
        firstInvoiceDate: firstDate.toISOString().split('T')[0],
        latestInvoiceDate: latestDate.toISOString().split('T')[0],
        elapsedMonths,
        billedMonths: c.billedMonths.size,
        totalInvoiced: Math.round(c.totalInvoiced * 100) / 100,
        latestInvoiceAmount: Math.round(c.latestInvoiceAmount * 100) / 100,
        invoiceCount: c.invoiceCount,
      };
    }).sort((a, b) => b.totalInvoiced - a.totalInvoiced);

    return c.json({ clients, lastRefresh: now.toISOString() });
  } catch (error: any) {
    console.error('Client lifetime error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Executive Dashboard: combined KPI summary
app.get('/api/executive/summary', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const [invoices, plReport, bankTransactions] = await Promise.all([
      xero.getInvoices(),
      xero.getProfitAndLossReport(),
      xero.getBankTransactions(),
    ]);

    const dso = CfoAnalyticsService.calculateDSO(invoices);
    const grossMargin = CfoAnalyticsService.calculateGrossMargin(plReport);
    const cashPosition = CfoAnalyticsService.calculateCashPosition(bankTransactions);
    const revenueGrowth = CfoAnalyticsService.calculateRevenueGrowth(invoices);

    const activeInvoices = invoices.filter(inv => inv.Status === 'AUTHORISED').length;
    const overdueAmount = invoices
      .filter(inv => inv.Status === 'AUTHORISED' && inv.DueDate && new Date(inv.DueDate) < new Date())
      .reduce((sum, inv) => sum + (inv.AmountDue || 0), 0);

    return c.json({
      dso,
      grossMarginPct: grossMargin.grossMarginPct,
      revenue: grossMargin.revenue,
      cogs: grossMargin.cogs,
      cashPosition: Math.round(cashPosition * 100) / 100,
      revenueGrowth,
      activeInvoices,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
    });
  } catch (error: any) {
    console.error('Error fetching executive summary:', error);
    return c.json({ error: error.message || 'Failed to fetch executive summary' }, 500);
  }
});

// Executive Dashboard: monthly revenue chart data
app.get('/api/executive/revenue-chart', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const invoices = await xero.getInvoices();
    return c.json(CfoAnalyticsService.buildRevenueChart(invoices));
  } catch (error: any) {
    console.error('Error fetching revenue chart:', error);
    return c.json({ error: error.message || 'Failed to fetch revenue chart' }, 500);
  }
});

// Cash Flow: 13-week forecast
app.get('/api/cashflow/forecast', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const [invoices, bankTransactions] = await Promise.all([
      xero.getInvoices(),
      xero.getBankTransactions(),
    ]);
    return c.json(CfoAnalyticsService.build13WeekForecast(invoices, bankTransactions));
  } catch (error: any) {
    console.error('Error fetching cash flow forecast:', error);
    return c.json({ error: error.message || 'Failed to fetch cash flow forecast' }, 500);
  }
});

// Cash Flow: trailing 12-week operating cash flow
app.get('/api/cashflow/operating', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const bankTransactions = await xero.getBankTransactions();
    return c.json(CfoAnalyticsService.buildOperatingCashFlow(bankTransactions, 12));
  } catch (error: any) {
    console.error('Error fetching operating cash flow:', error);
    return c.json({ error: error.message || 'Failed to fetch operating cash flow' }, 500);
  }
});

// Demo: executive summary
app.get('/api/demo/executive-summary', (c) => {
  return c.json({
    dso: 47,
    grossMarginPct: 68.5,
    revenue: 124500,
    cogs: 39217,
    cashPosition: 45200,
    revenueGrowth: {
      momGrowth: 12.3,
      yoyGrowth: 28.7,
      currentMonthRevenue: 24500,
      priorMonthRevenue: 21815,
    },
    activeInvoices: 38,
    overdueAmount: 63313,
  });
});

// Demo: executive revenue chart
app.get('/api/demo/executive-revenue-chart', (c) => {
  const now = new Date();
  const labels = [];
  const data = [];
  const base = [18200, 21500, 19800, 23100, 20400, 22900, 24100, 21700, 25300, 23800, 21815, 24500];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    data.push(base[11 - i]);
  }
  return c.json({
    labels,
    datasets: [{ label: 'Revenue', data, backgroundColor: 'rgba(59, 130, 246, 0.6)' }],
  });
});

// Demo: 13-week cash flow forecast
app.get('/api/demo/cashflow-forecast', (c) => {
  const now = new Date();
  let balance = 45200;
  const inflows = [12400, 8900, 15200, 6800, 11300, 9700, 13500, 7200, 10800, 14100, 8300, 11900, 9500];
  const outflows = [8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200];
  const weeks = inflows.map((inflow, i) => {
    const weekStart = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    balance = balance + inflow - outflows[i];
    return {
      weekLabel: `Week ${i + 1} (${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      weekStart: weekStart.toISOString().split('T')[0],
      expectedInflows: inflow,
      expectedOutflows: outflows[i],
      projectedBalance: Math.round(balance * 100) / 100,
    };
  });
  return c.json(weeks);
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

// Demo endpoint for revenue metrics
app.get('/api/demo/revenue/metrics', (c) => {
  const currentMonth = new Date().getMonth() + 1;
  // Demo: this month invoiced (realistic — NOT averaged with prior months)
  const thisMonthInvoiced = 18200;
  const prevMonthInvoiced = 21500;
  const mrr = thisMonthInvoiced;
  const arr = mrr * 12;
  const ytdRevenue = 62954.73;
  const monthsElapsed = currentMonth;
  const projectedEOY = (ytdRevenue / monthsElapsed) * 12;
  const momGrowth = prevMonthInvoiced > 0
    ? ((thisMonthInvoiced - prevMonthInvoiced) / prevMonthInvoiced) * 100 : 0;
  const activeClients = 8;

  return c.json({
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    ytdRevenue: Math.round(ytdRevenue * 100) / 100,
    projectedEOY: Math.round(projectedEOY * 100) / 100,
    thisMonthInvoiced,
    prevMonthInvoiced,
    momGrowth: Math.round(momGrowth * 10) / 10,
    growthRate: Math.round(momGrowth * 10) / 10,
    activeClients,
    currentMonth,
    monthsRemaining: 12 - currentMonth,
    mrrFormula: 'MRR = Total invoiced in current month (actual billing)',
    paidThisMonth: 5,
    unpaidThisMonth: 3,
    lateThisMonth: 1,
    collectionRate: 62.5,
    calculations: {
      avgRevenuePerClient: Math.round((mrr / activeClients) * 100) / 100,
      runRateARR: Math.round(arr * 100) / 100,
      paceVsProjection: projectedEOY > 0 ? Math.round((arr / projectedEOY - 1) * 100 * 10) / 10 : 0,
      invoiceCount2026: 92,
      ytdInvoiceCount: 72
    }
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

// Google Sheets IMPORTDATA endpoints - return plain text or CSV

// Get specific client balance due
app.get('/api/sheets/:clientName/due', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    const clientName = c.req.param('clientName');
    
    if (!session?.accessToken || !session?.tenantId) {
      // Demo data for testing
      const demoBalances: Record<string, number> = {
        'Urban Factory': 2055.20,
        'Milvue': 17512.33,
        'Acme Corp': 5000.00
      };
      const balance = demoBalances[clientName] || 0;
      return c.text(balance.toFixed(2));
    }

    const xero = new XeroApiService(session.accessToken, session.tenantId);
    const clients = await xero.getClientsAwaitingPayment();
    
    // Find matching client (case-insensitive)
    const client = clients.find(
      (c: any) => c.contactName.toLowerCase() === clientName.toLowerCase()
    );
    
    const balance = client?.totalOutstanding || 0;
    return c.text(balance.toFixed(2));
  } catch (error: any) {
    console.error(`Error fetching balance for ${c.req.param('clientName')}:`, error);
    return c.text('0.00');
  }
});

// Get all clients with balances as CSV
app.get('/api/sheets/clients/list', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    
    let clients;
    if (!session?.accessToken || !session?.tenantId) {
      // Demo data
      clients = [
        { contactName: 'Urban Factory', totalOutstanding: 2055.20 },
        { contactName: 'Milvue', totalOutstanding: 17512.33 },
        { contactName: 'Acme Corp', totalOutstanding: 5000.00 }
      ];
    } else {
      const xero = new XeroApiService(session.accessToken, session.tenantId);
      clients = await xero.getClientsAwaitingPayment();
    }
    
    // Generate CSV: Client Name,Balance
    let csv = 'Client Name,Balance Due\n';
    for (const client of clients) {
      csv += `${client.contactName},${client.totalOutstanding.toFixed(2)}\n`;
    }
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Error generating clients list:', error);
    return c.text('Client Name,Balance Due\nError,0.00');
  }
});

// Default route - serve static index.html
app.get('/', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/index.html';
  return (c.env as any).ASSETS.fetch(new Request(url.toString()));
});

export default app;
