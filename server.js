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
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
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

// Demo data endpoints (for unauthenticated users)
app.get('/api/demo/summary', (c) => {
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
  return c.json([
    {
      contactName: 'Demo Client A',
      totalDue: 3000,
      invoiceCount: 1,
      oldestInvoiceDate: '/Date(1704067200000)/',
      invoices: []
    },
    {
      contactName: 'Demo Client B',
      totalDue: 7500,
      invoiceCount: 1,
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
