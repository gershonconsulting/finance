import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import services (we'll need to adapt these if they use Cloudflare-specific features)
const app = new Hono()

// Production credentials embedded
const XERO_CREDENTIALS = {
  CLIENT_ID: '0CA378B164364DB0821A6014520913E6',
  CLIENT_SECRET: '-OvY_3_op75SDteQt6tOqvZVyZ3Ihq07aE32QYGOCWiqHhvh',
  getRedirectUri: (host) => {
    if (host.includes('finance.gershoncrm.com')) {
      return 'https://finance.gershoncrm.com/auth/callback'
    } else if (host.includes('sandbox.novita.ai')) {
      return `https://${host}/auth/callback`
    }
    return `https://${host}/auth/callback`
  }
}

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }))

// Session storage
const sessions = new Map()

// Helper functions
function getSession(c) {
  const authHeader = c.req.header('Authorization')
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const session = sessions.get(token)
    if (session) return session
  }
  
  const sessionHeader = c.req.header('X-Session-Token')
  if (sessionHeader) {
    const session = sessions.get(sessionHeader)
    if (session) return session
  }
  
  return null
}

function getSessionId(c) {
  const authHeader = c.req.header('Authorization')
  if (authHeader) {
    return authHeader.replace('Bearer ', '')
  }
  
  const sessionHeader = c.req.header('X-Session-Token')
  if (sessionHeader) {
    return sessionHeader
  }
  
  return null
}

// Xero OAuth Service (simplified for Node.js)
class XeroOAuthService {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.redirectUri = redirectUri
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'accounting.reports.read accounting.transactions.read accounting.contacts.read accounting.settings.read offline_access',
      state: state
    })
    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`
  }

  async exchangeCodeForTokens(code) {
    const tokenUrl = 'https://identity.xero.com/connect/token'
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri
      })
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    }
  }

  async refreshAccessToken(refreshToken) {
    const tokenUrl = 'https://identity.xero.com/connect/token'
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    }
  }

  async getTenantId(accessToken) {
    const response = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get tenant: ${response.statusText}`)
    }

    const connections = await response.json()
    if (connections.length === 0) {
      throw new Error('No Xero organizations connected')
    }

    return connections[0].tenantId
  }
}

// Xero API Service
class XeroApiService {
  constructor(accessToken, tenantId) {
    this.accessToken = accessToken
    this.tenantId = tenantId
    this.baseUrl = 'https://api.xero.com/api.xro/2.0'
  }

  async fetchXero(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key])
      }
    })

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'xero-tenant-id': this.tenantId,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Xero API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getInvoicesSummary() {
    const data = await this.fetchXero('/Invoices', {
      where: 'Status=="AUTHORISED"',
      order: 'DueDate DESC'
    })
    return data.Invoices || []
  }

  async getClientsAwaitingPayment() {
    const invoices = await this.getInvoicesSummary()
    const clientMap = new Map()

    invoices.forEach(invoice => {
      if (invoice.AmountDue > 0) {
        const contactName = invoice.Contact?.Name || 'Unknown'
        if (!clientMap.has(contactName)) {
          clientMap.set(contactName, {
            contactName,
            totalDue: 0,
            invoiceCount: 0,
            oldestInvoiceDate: invoice.DueDate,
            invoices: []
          })
        }
        const client = clientMap.get(contactName)
        client.totalDue += invoice.AmountDue
        client.invoiceCount += 1
        client.invoices.push(invoice)
      }
    })

    return Array.from(clientMap.values())
  }

  async getReports(reportType) {
    const data = await this.fetchXero(`/Reports/${reportType}`)
    return data.Reports?.[0] || data
  }

  async getBankTransactions(fromDate, toDate) {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    
    const data = await this.fetchXero('/BankTransactions', params)
    return data.BankTransactions || []
  }
}

// Routes
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.8.0',
    releaseDate: '2026-04-08T23:58:44Z',
    server: 'nodejs-genspark',
    fixes: [
      'v2.4.2: CRITICAL - Added /api/sheets endpoints for Google Sheets IMPORTDATA',
      'v2.4.1: Remove ALL alert popups - errors only logged to console',
      'v2.4.0: Fix dashboard element IDs mismatch',
      'v2.2.0: Fixed all URLs in src/index.tsx to use finance.gershoncrm.com',
      'v2.1.0: Added demo endpoints with totalOutstanding field',
      'v2.0.0: Converted to Node.js from Cloudflare Workers'
    ]
  })
})

app.get('/api/auth/status', (c) => {
  const session = getSession(c)
  return c.json({
    authenticated: !!session?.accessToken,
    hasValidSession: !!session
  })
})

app.get('/auth/login', (c) => {
  const host = c.req.header('host') || ''
  const credentials = {
    clientId: XERO_CREDENTIALS.CLIENT_ID,
    clientSecret: XERO_CREDENTIALS.CLIENT_SECRET,
    redirectUri: XERO_CREDENTIALS.getRedirectUri(host)
  }

  const oauth = new XeroOAuthService(credentials.clientId, credentials.clientSecret, credentials.redirectUri)
  const state = crypto.randomUUID()
  const authUrl = oauth.getAuthorizationUrl(state)

  return c.redirect(authUrl)
})

app.get('/auth/callback', async (c) => {
  try {
    const code = c.req.query('code')
    const host = c.req.header('host') || ''

    if (!code) {
      return c.html('<h1>Error: No authorization code received</h1>')
    }

    const credentials = {
      clientId: XERO_CREDENTIALS.CLIENT_ID,
      clientSecret: XERO_CREDENTIALS.CLIENT_SECRET,
      redirectUri: XERO_CREDENTIALS.getRedirectUri(host)
    }

    const oauth = new XeroOAuthService(credentials.clientId, credentials.clientSecret, credentials.redirectUri)
    const tokens = await oauth.exchangeCodeForTokens(code)
    const tenantId = await oauth.getTenantId(tokens.accessToken)

    // Create session
    const sessionId = crypto.randomUUID()
    sessions.set(sessionId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tenantId: tenantId,
      expiresAt: tokens.expiresAt
    })

    // Return HTML that stores session and redirects
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          localStorage.setItem('xero_session', '${sessionId}');
          window.location.href = '/';
        </script>
      </head>
      <body>
        <p>Authentication successful. Redirecting...</p>
      </body>
      </html>
    `)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return c.html(`<h1>Authentication Error</h1><p>${error.message}</p>`)
  }
})

app.post('/api/auth/logout', (c) => {
  const sessionId = getSessionId(c)
  if (sessionId) {
    sessions.delete(sessionId)
  }
  return c.json({ success: true })
})

app.get('/api/invoices/summary', async (c) => {
  const session = getSession(c)
  if (!session?.accessToken) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const invoices = await xero.getInvoicesSummary()
    return c.json(invoices)
  } catch (error) {
    console.error('Invoice summary error:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/clients/awaiting-payment', async (c) => {
  const session = getSession(c)
  if (!session?.accessToken) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const clients = await xero.getClientsAwaitingPayment()
    return c.json(clients)
  } catch (error) {
    console.error('Clients awaiting payment error:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/reports/:reportType', async (c) => {
  const session = getSession(c)
  if (!session?.accessToken) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const reportType = c.req.param('reportType')
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const report = await xero.getReports(reportType)
    return c.json(report)
  } catch (error) {
    console.error('Report error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Google Sheets export - Client balance due
// Usage: =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/ClientName/due")
app.get('/api/sheets/:clientName/due', async (c) => {
  const session = getSession(c)
  if (!session?.accessToken) {
    // Return CSV format with error for unauthenticated users
    return c.text('Error: Not authenticated', 401, {
      'Content-Type': 'text/csv'
    })
  }

  try {
    const clientName = decodeURIComponent(c.req.param('clientName'))
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    
    // Get all clients awaiting payment
    const clients = await xero.getClientsAwaitingPayment()
    
    // Find the specific client (case-insensitive)
    const client = clients.find(cl => 
      cl.contactName.toLowerCase() === clientName.toLowerCase()
    )
    
    if (!client) {
      // Return 0 if client not found or has no outstanding balance
      return c.text('0', 200, {
        'Content-Type': 'text/csv'
      })
    }
    
    // Return just the amount due (Google Sheets will interpret as number)
    const amountDue = client.totalDue || 0
    return c.text(amountDue.toString(), 200, {
      'Content-Type': 'text/csv'
    })
  } catch (error) {
    console.error('Client balance error:', error)
    return c.text('Error: ' + error.message, 500, {
      'Content-Type': 'text/csv'
    })
  }
})

// List all client names (for reference)
// Usage: =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")
app.get('/api/sheets/clients/list', async (c) => {
  const session = getSession(c)
  if (!session?.accessToken) {
    return c.text('Error: Not authenticated', 401, {
      'Content-Type': 'text/csv'
    })
  }

  try {
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const clients = await xero.getClientsAwaitingPayment()
    
    // Return CSV format: Client Name, Amount Due
    let csv = 'Client Name,Amount Due\n'
    clients.forEach(client => {
      csv += `"${client.contactName}",${client.totalDue}\n`
    })
    
    return c.text(csv, 200, {
      'Content-Type': 'text/csv'
    })
  } catch (error) {
    console.error('Client list error:', error)
    return c.text('Error: ' + error.message, 500, {
      'Content-Type': 'text/csv'
    })
  }
})

// Executive Dashboard: summary KPIs
app.get('/api/executive/summary', async (c) => {
  try {
    const session = getSession(c)
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401)
    }
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const [invoices, bankTransactions] = await Promise.all([
      xero.getInvoices(),
      xero.getBankTransactions(),
    ])
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const totalOutstanding = invoices.filter(i => i.Status === 'AUTHORISED').reduce((s, i) => s + (i.AmountDue || 0), 0)
    const revenueWindow = invoices.filter(i => { const d = i.Date ? new Date(i.Date) : null; return d && d >= ninetyDaysAgo }).reduce((s, i) => s + (i.Total || 0), 0)
    const dso = revenueWindow > 0 ? Math.round((totalOutstanding / revenueWindow) * 90) : 0
    const cashPosition = bankTransactions.filter(tx => { const d = tx.Date ? new Date(tx.Date) : null; return d && d >= ninetyDaysAgo }).reduce((s, tx) => tx.Type === 'RECEIVE' ? s + tx.Total : s - tx.Total, 0)
    const currentMonth = now.getMonth(), currentYear = now.getFullYear()
    const priorMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const priorMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
    const paid = invoices.filter(i => i.Status === 'PAID' && i.Date)
    const sumMonth = (y, m) => paid.filter(i => { const d = new Date(i.Date); return d.getFullYear() === y && d.getMonth() === m }).reduce((s, i) => s + (i.Total || 0), 0)
    const curRev = sumMonth(currentYear, currentMonth)
    const priorRev = sumMonth(priorMonthYear, priorMonth)
    const momGrowth = priorRev > 0 ? Math.round(((curRev - priorRev) / priorRev) * 1000) / 10 : 0
    const overdueAmount = invoices.filter(i => i.Status === 'AUTHORISED' && i.DueDate && new Date(i.DueDate) < now).reduce((s, i) => s + (i.AmountDue || 0), 0)
    return c.json({ dso, grossMarginPct: 0, revenue: curRev, cogs: 0, cashPosition: Math.round(cashPosition * 100) / 100, revenueGrowth: { momGrowth, yoyGrowth: 0, currentMonthRevenue: Math.round(curRev * 100) / 100, priorMonthRevenue: Math.round(priorRev * 100) / 100 }, activeInvoices: invoices.filter(i => i.Status === 'AUTHORISED').length, overdueAmount: Math.round(overdueAmount * 100) / 100 })
  } catch (error) {
    console.error('Executive summary error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Executive Dashboard: 12-month revenue chart
app.get('/api/executive/revenue-chart', async (c) => {
  try {
    const session = getSession(c)
    if (!session?.accessToken || !session?.tenantId) return c.json({ error: 'Not authenticated' }, 401)
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const invoices = await xero.getInvoices()
    const now = new Date()
    const labels = [], data = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))
      data.push(invoices.filter(inv => { if (inv.Status !== 'PAID' || !inv.Date) return false; const id = new Date(inv.Date); return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth() }).reduce((s, inv) => s + (inv.Total || 0), 0))
    }
    return c.json({ labels, datasets: [{ label: 'Revenue', data, backgroundColor: 'rgba(59,130,246,0.6)' }] })
  } catch (error) { return c.json({ error: error.message }, 500) }
})

// Cash Flow: 13-week forecast
app.get('/api/cashflow/forecast', async (c) => {
  try {
    const session = getSession(c)
    if (!session?.accessToken || !session?.tenantId) return c.json({ error: 'Not authenticated' }, 401)
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const [invoices, bankTransactions] = await Promise.all([xero.getInvoices(), xero.getBankTransactions()])
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)
    const recent = invoices.filter(i => { const d = i.Date ? new Date(i.Date) : null; return d && d >= ninetyDaysAgo })
    const paid = recent.filter(i => i.Status === 'PAID').length
    const collectionRate = recent.length > 0 ? paid / recent.length : 0.7
    const avgWeeklySpend = bankTransactions.filter(tx => { const d = tx.Date ? new Date(tx.Date) : null; return d && d >= eightWeeksAgo && tx.Type === 'SPEND' }).reduce((s, tx) => s + tx.Total, 0) / 8
    let balance = bankTransactions.filter(tx => { const d = tx.Date ? new Date(tx.Date) : null; return d && d >= ninetyDaysAgo }).reduce((s, tx) => tx.Type === 'RECEIVE' ? s + tx.Total : s - tx.Total, 0)
    const weeks = Array.from({ length: 13 }, (_, i) => {
      const ws = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000)
      const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000)
      const inflows = invoices.filter(inv => { if (inv.Status !== 'AUTHORISED') return false; const due = inv.DueDate ? new Date(inv.DueDate) : null; return due && due >= ws && due < we }).reduce((s, inv) => s + (inv.AmountDue || 0), 0) * collectionRate
      balance = balance + inflows - avgWeeklySpend
      return { weekLabel: `Week ${i+1} (${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`, weekStart: ws.toISOString().split('T')[0], expectedInflows: Math.round(inflows * 100) / 100, expectedOutflows: Math.round(avgWeeklySpend * 100) / 100, projectedBalance: Math.round(balance * 100) / 100 }
    })
    return c.json(weeks)
  } catch (error) { return c.json({ error: error.message }, 500) }
})

// Cash Flow: trailing 12-week operating cash flow
app.get('/api/cashflow/operating', async (c) => {
  try {
    const session = getSession(c)
    if (!session?.accessToken || !session?.tenantId) return c.json({ error: 'Not authenticated' }, 401)
    const xero = new XeroApiService(session.accessToken, session.tenantId)
    const bankTransactions = await xero.getBankTransactions()
    const now = new Date()
    const result = Array.from({ length: 12 }, (_, i) => {
      const we = new Date(now.getTime() - (11 - i) * 7 * 24 * 60 * 60 * 1000)
      const ws = new Date(we.getTime() - 7 * 24 * 60 * 60 * 1000)
      const weekTx = bankTransactions.filter(tx => { const d = tx.Date ? new Date(tx.Date) : null; return d && d >= ws && d < we })
      const inflows = weekTx.filter(tx => tx.Type === 'RECEIVE').reduce((s, tx) => s + tx.Total, 0)
      const outflows = weekTx.filter(tx => tx.Type === 'SPEND').reduce((s, tx) => s + tx.Total, 0)
      return { weekLabel: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), inflows: Math.round(inflows * 100) / 100, outflows: Math.round(outflows * 100) / 100, netCashFlow: Math.round((inflows - outflows) * 100) / 100 }
    })
    return c.json(result)
  } catch (error) { return c.json({ error: error.message }, 500) }
})

// Demo: executive summary
app.get('/api/demo/executive-summary', (c) => {
  return c.json({ dso: 47, grossMarginPct: 68.5, revenue: 124500, cogs: 39217, cashPosition: 45200, revenueGrowth: { momGrowth: 12.3, yoyGrowth: 28.7, currentMonthRevenue: 24500, priorMonthRevenue: 21815 }, activeInvoices: 38, overdueAmount: 63313 })
})

// Demo: executive revenue chart
app.get('/api/demo/executive-revenue-chart', (c) => {
  const now = new Date()
  const base = [18200, 21500, 19800, 23100, 20400, 22900, 24100, 21700, 25300, 23800, 21815, 24500]
  const labels = [], data = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))
    data.push(base[11 - i])
  }
  return c.json({ labels, datasets: [{ label: 'Revenue', data, backgroundColor: 'rgba(59,130,246,0.6)' }] })
})

// Demo: 13-week cash flow forecast
app.get('/api/demo/cashflow-forecast', (c) => {
  const now = new Date()
  let balance = 45200
  const inflows = [12400, 8900, 15200, 6800, 11300, 9700, 13500, 7200, 10800, 14100, 8300, 11900, 9500]
  const weeks = inflows.map((inflow, i) => {
    const ws = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000)
    balance = balance + inflow - 8200
    return { weekLabel: `Week ${i+1} (${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`, weekStart: ws.toISOString().split('T')[0], expectedInflows: inflow, expectedOutflows: 8200, projectedBalance: Math.round(balance * 100) / 100 }
  })
  return c.json(weeks)
})

// Demo data endpoints (for unauthenticated users)
app.get('/api/demo/summary', (c) => {
  console.log('Demo summary endpoint called')
  return c.json([
    {
      InvoiceNumber: 'DEMO-001',
      Contact: { Name: 'Demo Client A' },
      Date: '/Date(1704067200000)/',
      DueDate: '/Date(1706745600000)/',
      Total: 5000,
      AmountDue: 3000,
      Status: 'AUTHORISED'
    },
    {
      InvoiceNumber: 'DEMO-002',
      Contact: { Name: 'Demo Client B' },
      Date: '/Date(1704067200000)/',
      DueDate: '/Date(1706745600000)/',
      Total: 7500,
      AmountDue: 7500,
      Status: 'AUTHORISED'
    }
  ])
})

app.get('/api/demo/clients-awaiting-payment', (c) => {
  console.log('Demo clients-awaiting-payment endpoint called')
  return c.json([
    {
      contactName: 'Demo Client A',
      totalDue: 3000,
      totalOutstanding: 3000,
      totalPaid: 10000,
      invoiceCount: 1,
      averagePaymentDelay: 45,
      oldestInvoiceDate: '/Date(1704067200000)/',
      invoices: []
    },
    {
      contactName: 'Demo Client B',
      totalDue: 7500,
      totalOutstanding: 7500,
      totalPaid: 25000,
      invoiceCount: 1,
      averagePaymentDelay: 60,
      oldestInvoiceDate: '/Date(1704067200000)/',
      invoices: []
    }
  ])
})

// Default route - serve the dashboard
app.get('/', async (c) => {
  try {
    const htmlPath = path.join(__dirname, 'public', 'index.html')
    const html = await fs.readFile(htmlPath, 'utf-8')
    return c.html(html)
  } catch (error) {
    // If index.html doesn't exist, serve inline HTML
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Gershon Finance Dashboard</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
          <link href="/static/styles.css" rel="stylesheet">
      </head>
      <body class="bg-gray-100">
          <div id="app">
              <nav class="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 shadow-lg">
                  <div class="max-w-7xl mx-auto flex justify-between items-center">
                      <h1 class="text-2xl font-bold">
                          <i class="fas fa-chart-line mr-2"></i>
                          Gershon Finance Dashboard
                      </h1>
                      <button id="logoutBtn" class="hidden bg-red-500 hover:bg-red-600 px-4 py-2 rounded">
                          Logout
                      </button>
                  </div>
              </nav>
              
              <div id="loginScreen" class="flex items-center justify-center min-h-screen">
                  <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                      <h2 class="text-2xl font-bold text-center mb-6">Sign in to access your dashboard</h2>
                      <button onclick="window.location.href='/auth/login'" 
                              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded">
                          <i class="fas fa-sign-in-alt mr-2"></i>
                          Sign in with Xero
                      </button>
                  </div>
              </div>

              <div id="dashboard" class="hidden max-w-7xl mx-auto p-6">
                  <div class="bg-white rounded-lg shadow-lg p-6">
                      <h2 class="text-xl font-bold mb-4">Dashboard</h2>
                      <div id="dashboardContent">
                          <p>Loading...</p>
                      </div>
                  </div>
              </div>
          </div>
          
          <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
          <script src="/static/app.js"></script>
      </body>
      </html>
    `)
  }
})

// Start server
const port = parseInt(process.env.PORT || '3000')
console.log(`Server starting on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
