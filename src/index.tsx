import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { XeroApiService } from './services/xero-api';

const app = new Hono();

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

// Helper to get session from cookie
function getSession(c: any): SessionData | null {
  const sessionId = c.req.cookie('session_id');
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
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

// Get invoice summary
app.get('/api/invoices/summary', async (c) => {
  try {
    const session = getSession(c);
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
    const session = getSession(c);
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
                        <div class="flex items-center space-x-4">
                            <button onclick="refreshData()" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition">
                                <i class="fas fa-sync-alt mr-2"></i>Refresh
                            </button>
                            <div id="authStatus" class="text-sm"></div>
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
                        <button onclick="showTab('reports')" class="tab-btn border-b-2 border-transparent pb-4 px-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-chart-bar mr-2"></i>Reports
                        </button>
                        <button onclick="showTab('transactions')" class="tab-btn border-b-2 border-transparent pb-4 px-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-exchange-alt mr-2"></i>Transactions
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
                        <h2 class="text-xl font-bold text-gray-800 mb-4">Invoice Status Overview</h2>
                        <canvas id="invoiceChart" height="80"></canvas>
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

                <!-- Reports Tab -->
                <div id="tab-reports" class="tab-content hidden">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-white rounded-lg shadow-md p-6">
                            <h3 class="text-lg font-bold text-gray-800 mb-4">
                                <i class="fas fa-chart-pie text-blue-600 mr-2"></i>Profit & Loss Report
                            </h3>
                            <p class="text-gray-600 mb-4">View detailed income and expense breakdown</p>
                            <button onclick="loadProfitLoss()" class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                Generate Report
                            </button>
                        </div>

                        <div class="bg-white rounded-lg shadow-md p-6">
                            <h3 class="text-lg font-bold text-gray-800 mb-4">
                                <i class="fas fa-balance-scale text-green-600 mr-2"></i>Balance Sheet Report
                            </h3>
                            <p class="text-gray-600 mb-4">View assets, liabilities, and equity</p>
                            <button onclick="loadBalanceSheet()" class="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                                Generate Report
                            </button>
                        </div>
                    </div>
                    
                    <div id="reportData" class="mt-6"></div>
                </div>

                <!-- Transactions Tab -->
                <div id="tab-transactions" class="tab-content hidden">
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-gray-800">Bank Transactions</h2>
                            <button onclick="loadTransactions()" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                                <i class="fas fa-sync-alt mr-2"></i>Load Transactions
                            </button>
                        </div>
                        <div id="transactionList">
                            <p class="text-gray-500 text-center py-8">Click "Load Transactions" to view data</p>
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
