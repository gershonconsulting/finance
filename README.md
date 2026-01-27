# Gershon Finance Dashboard

A professional Accounts Receivable (AR) dashboard for Xero accounting data. Built with Xero OAuth authentication, payment trends analysis, and real-time financial insights.

## 🌐 Production URL

**🚀 Live Application**: https://finance.gershoncrm.com

## 🔐 Access Control

**Xero OAuth Authentication Required**

- Only users with Xero account access can view the dashboard
- Secure OAuth 2.0 authentication flow
- Session persistence across browser sessions
- One-click logout functionality

## 📊 Key Features

### ✅ Implemented Features

**Authentication & Security:**
- 🔐 **Xero OAuth Gate** - Professional login page with secure authentication
- 🔑 **Session Management** - Persistent sessions with automatic token refresh
- 🚪 **Logout** - Secure sign-out functionality

**Dashboard & Analytics:**
- 📊 **Real-time Metrics** - Draft, Awaiting Payment, and Overdue invoices
- 📈 **Payment Trends** - Weekly, Monthly, and Quarterly AR analysis
- 👥 **Clients Awaiting Payment** - Companies with outstanding invoices
- 💰 **Invoice Aging** - CURRENT (0-99 days), AGED (100-199 days), CRITICAL (200+ days)
- 📉 **Overdue Tracking** - Payment delay analysis and collection rates

**Data Management:**
- 📋 **Sortable Tables** - All columns sortable with arrow indicators
- 🔄 **Automatic Refresh** - Real-time data from Xero API
- 📤 **Google Sheets Export** - Direct CSV export for all data views
- 📱 **Responsive Design** - Mobile-friendly interface

**Navigation Tabs:**
1. **Dashboard** - Key metrics and statistics
2. **Invoices** - Invoice list with filtering
3. **Clients** - Companies awaiting payment with totals
4. **Trends** - Payment trends analysis (Weekly/Monthly/Quarterly)
5. **Sheets Links** - Google Sheets integration URLs
6. **Settings** - Application configuration

## 🏗️ Architecture

### Tech Stack
- **Backend**: Hono (TypeScript) - Lightweight web framework
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Charts**: Chart.js v4
- **HTTP Client**: Axios
- **Deployment**: Cloudflare Pages/Workers

### Data Models

**Invoice Summary:**
```typescript
{
  draftCount: number,
  draftAmount: number,
  awaitingCount: number,
  awaitingAmount: number,
  overdueCount: number,
  overdueAmount: number,
  totalInvoices: number
}
```

**Invoice Details:**
```typescript
{
  InvoiceID: string,
  InvoiceNumber: string,
  Contact: { Name: string },
  Date: string,
  DueDate: string,
  Total: number,
  AmountDue: number,
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED'
}
```

**Bank Transaction:**
```typescript
{
  BankTransactionID: string,
  Date: string,
  Contact: { Name: string },
  Type: 'RECEIVE' | 'SPEND',
  Total: number,
  Reference: string
}
```

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check endpoint |
| `/auth/login` | GET | No | Start Xero OAuth flow |
| `/auth/callback` | GET | No | OAuth callback handler |
| `/api/auth/status` | GET | No | Check authentication status |
| `/api/invoices/summary` | GET | **Yes** | Get invoice statistics (real data) |
| `/api/invoices` | GET | **Yes** | List invoices (with filters) |
| `/api/clients/awaiting-payment` | GET | **Yes** | Get clients with outstanding payments |
| `/api/reports/profit-loss` | GET | **Yes** | Profit & Loss report |
| `/api/reports/balance-sheet` | GET | **Yes** | Balance Sheet report |
| `/api/transactions` | GET | **Yes** | Bank transactions |
| `/api/demo/summary` | GET | No | Demo data for testing |
| `/api/export/summary` | GET | Auto | Export invoice summary to CSV |
| `/api/export/invoices` | GET | Auto | Export invoices to CSV |
| `/api/export/clients-awaiting-payment` | GET | Auto | Export clients awaiting payment to CSV |
| `/api/export/transactions` | GET | Auto | Export transactions to CSV |
| `/api/export/profit-loss` | GET | Auto | Export P&L report to CSV |
| `/api/export/balance-sheet` | GET | Auto | Export Balance Sheet to CSV |

**Note:** Export endpoints marked "Auto" return real data when authenticated, demo data otherwise.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Xero account with API access
- Cloudflare account (for deployment)

### Quick Start (Connect Real Xero Data)

**🎯 Two ways to connect:**

#### **Option 1: Use Pre-configured Credentials (Fastest)**
1. **Open the dashboard:**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
```

2. **Click "Connect to Xero"** (green button in top-right)

3. **Authorize the app** with your Xero credentials

4. **Start using real data!**

#### **Option 2: Use Your Own API Credentials**
1. **Go to Settings tab** in the dashboard

2. **Enter your Client ID and Client Secret** (from https://developer.xero.com/myapps)

3. **Save configuration**

4. **Click "Connect to Xero"** and authorize

**📖 See [SETTINGS_GUIDE.md](SETTINGS_GUIDE.md) for detailed setup instructions.**  
**📖 See [REAL_DATA_SETUP.md](REAL_DATA_SETUP.md) for authentication guide.**

### Local Development

1. **Clone the repository:**
```bash
cd /home/user/webapp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the application:**
```bash
npm run build
```

4. **Start development server:**
```bash
# Using PM2 (recommended for sandbox)
pm2 start ecosystem.config.cjs

# Or using wrangler directly
npm run dev:sandbox
```

5. **Access the application:**
```
http://localhost:3000
```

### Configuration

#### Xero API Setup

**✅ Two configuration options available:**

**Option 1: Use Pre-configured Credentials (Default)**
```
Client ID: 0CA378B164364DB0821A6014520913E6
Client Secret: 1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
Redirect URI: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

**Option 2: Use Your Own Credentials (Recommended for Production)**
1. Go to **Settings** tab in the dashboard
2. Click "Load Default Configuration" or enter your own:
   - Get credentials from https://developer.xero.com/myapps
   - Enter Client ID and Client Secret
   - Add Redirect URI to your Xero app
3. Click "Save Configuration"
4. Click "Test Connection" to verify

**📖 Complete guide:** See [SETTINGS_GUIDE.md](SETTINGS_GUIDE.md)

**Scopes Requested:**
- `accounting.reports.read` - Financial reports
- `accounting.transactions.read` - Invoices & transactions
- `accounting.contacts.read` - Client information
- `accounting.settings.read` - Organization settings
- `offline_access` - Token refresh

#### Production Secrets (For Cloudflare Deployment)
```bash
npx wrangler pages secret put XERO_CLIENT_ID
npx wrangler pages secret put XERO_CLIENT_SECRET
npx wrangler pages secret put XERO_REDIRECT_URI
```

## 📊 User Guide

### Dashboard View
The main dashboard displays three key metrics:
- **Draft Invoices**: Invoices not yet sent to customers
- **Awaiting Payment**: Authorised invoices pending payment
- **Overdue**: Invoices past due date with outstanding balances

### Invoices Tab
- Click filter buttons to view invoices by status (Draft, Awaiting, Paid, All)
- View detailed invoice information in table format
- See contact name, dates, amounts, and payment status

### Clients Tab (NEW!)
- View companies with outstanding invoices (awaiting payment)
- See the number of invoices per company
- View total outstanding amount per company
- Companies sorted by highest outstanding amount
- Summary shows: Total Companies, Total Invoices, Total Outstanding
- Export to CSV with automatic totals row

### Reports Tab
- Generate **Profit & Loss** reports to view income vs expenses
- Generate **Balance Sheet** reports to view assets, liabilities, and equity
- Export reports to CSV or PDF (coming soon)

### Transactions Tab
- View bank transaction history
- See receive vs spend transactions with color coding
- Filter by date range (coming soon)

## 🔧 Development Commands

```bash
# Development
npm run dev                 # Vite development server
npm run dev:sandbox         # Wrangler dev server (sandbox)
npm run build               # Build for production

# Deployment
npm run deploy              # Deploy to Cloudflare Pages
npm run deploy:prod         # Deploy with project name

# Utilities
npm run clean-port          # Kill process on port 3000
npm run test                # Test with curl
npm run git:status          # Check git status
npm run git:commit "msg"    # Quick commit with message
```

## 📦 Project Structure

```
webapp/
├── src/
│   ├── index.tsx              # Main Hono application
│   ├── services/
│   │   └── xero-api.ts        # Xero API service layer
│   └── types/
│       └── xero.ts            # TypeScript type definitions
├── public/
│   └── static/
│       ├── app.js             # Frontend JavaScript
│       └── styles.css         # Custom CSS styles
├── dist/                      # Build output (generated)
├── ecosystem.config.cjs       # PM2 configuration
├── wrangler.jsonc            # Cloudflare configuration
├── vite.config.ts            # Vite build configuration
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## 🔐 Security Notes

- **Never commit** `.dev.vars` or `.env` files to git
- Store API credentials in Cloudflare secrets for production
- Use HTTPS for all production deployments
- Implement CSRF protection for OAuth flow (recommended)
- Validate all API responses before displaying

## 🚀 Deployment

### GenSpark Hosted Deploy

**Target URL**: https://finance.gershoncrm.com

**3-Step Deployment:**

1. **Configure in GenSpark Deploy Tab:**
   - Set environment variables (XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI)
   - Configure custom domain: finance.gershoncrm.com

2. **Update Xero OAuth:**
   - Add redirect URI: https://finance.gershoncrm.com/auth/callback
   - At: https://developer.xero.com/app/manage

3. **Click Deploy:**
   - Go to Deploy tab in GenSpark
   - Click Deploy button
   - Done! ✅

### Documentation
- **Quick Start**: [DEPLOY_QUICK.md](DEPLOY_QUICK.md) - 3-step deployment
- **Full Guide**: [GENSPARK_DEPLOY.md](GENSPARK_DEPLOY.md) - Complete deployment guide

### What GenSpark Handles
- ✅ Build process (`npm run build`)
- ✅ Web hosting
- ✅ SSL certificate (HTTPS)
- ✅ Custom domain setup
- ✅ Environment variables
- ✅ Deployment logs
- ✅ Automatic updates

## 📈 Performance

- **Build size**: ~44 KB (gzipped)
- **First load**: < 1s
- **API response**: < 500ms (Xero API dependent)
- **Chart rendering**: < 200ms

## 🤝 Contributing

This is a private project for GC Invoices Dashboard. For feature requests or bug reports, please contact the development team.

## 📊 Google Sheets Direct Links (NEW!)

**Connect your Google Sheets directly to Xero data with live URLs!**

No downloads needed - use `=IMPORTDATA()` in Google Sheets to automatically pull data:

**Available Data Sources:**
- **Invoice Summary**: Dashboard statistics
- **Clients Awaiting Payment**: Companies with outstanding invoices + totals
- **All Invoices**: Complete invoice list  
- **Bank Transactions**: Transaction history
- **Profit & Loss Report**: Financial performance
- **Balance Sheet Report**: Financial position

**How to Use**:
1. Go to the **"Sheets Links"** tab in the navigation
2. Click **"Copy"** button next to any data source
3. In Google Sheets, use: `=IMPORTDATA("paste-url-here")`
4. Data automatically imports and refreshes!

**Example:**
```
=IMPORTDATA("https://your-domain.com/api/export/clients-awaiting-payment")
```

**See [GOOGLE_SHEETS_LINKS.md](GOOGLE_SHEETS_LINKS.md) for complete documentation and examples.**

## 📝 License

Proprietary - All rights reserved

## 🆘 Support

For technical support or questions:
- Review the API documentation at https://developer.xero.com/documentation
- Check PM2 logs: `pm2 logs xero-reports-webapp --nostream`
- Verify Cloudflare deployment status in dashboard

## 📅 Version History

### Version 2.0.0 (2026-01-18) - CURRENT ✨
- ✅ **NEW**: Xero OAuth authentication gate with professional login page
- ✅ **NEW**: Payment Trends Analysis (Weekly/Monthly/Quarterly)
- ✅ **NEW**: Sortable columns with arrow indicators
- ✅ **NEW**: Logout functionality
- ✅ **IMPROVED**: Automatic token refresh for expired sessions
- ✅ **IMPROVED**: Backend date parsing for Xero date format
- ✅ **REMOVED**: Bank Transactions tab
- ✅ **REMOVED**: Reports tab
- ✅ **REMOVED**: Demo mode banners
- ✅ **FIXED**: Transaction sorting (newest first)
- ✅ **FIXED**: Invoice aging distribution (CURRENT/AGED/CRITICAL)
- ✅ **FIXED**: Overdue calculation accuracy
- 🚀 **DEPLOYED**: Production at finance.gershoncrm.com
- 📖 See [XERO_AUTH_GATE.md](XERO_AUTH_GATE.md) and [PAYMENT_TRENDS_FEATURE.md](PAYMENT_TRENDS_FEATURE.md)

### Version 1.4.0 (2026-01-05)
- ✅ **NEW**: Settings page for custom API credentials configuration
- ✅ **NEW**: Support for user-provided Client ID and Client Secret
- ✅ **NEW**: Pre-configured credentials quick load option
- ✅ **NEW**: Visual status indicators for connection state
- ✅ **NEW**: Secure client-side credential storage
- 📖 See [SETTINGS_GUIDE.md](SETTINGS_GUIDE.md)

### Version 1.3.0 (2026-01-05)
- ✅ **NEW**: Real Xero API data integration
- ✅ **NEW**: OAuth2 authentication flow
- ✅ **NEW**: "Connect to Xero" button with automatic session management
- ✅ **NEW**: Real-time data from actual Xero account
- ✅ **NEW**: Google Sheets IMPORTDATA URLs return real data
- ✅ Session token management with automatic refresh
- ✅ Pre-configured with working Xero credentials
- 📖 See [REAL_DATA_SETUP.md](REAL_DATA_SETUP.md) and [XERO_AUTHENTICATION_GUIDE.md](XERO_AUTHENTICATION_GUIDE.md)

### Version 1.2.0 (2026-01-04)
- ✅ **NEW**: Clients Awaiting Payment report
- ✅ Groups invoices by company/contact
- ✅ Shows totals per company
- ✅ Export to CSV with automatic totals row
- ✅ Sorted by highest outstanding amount

### Version 1.1.0 (2026-01-04)
- ✅ Google Sheets export functionality
- ✅ Export all data views to CSV
- ✅ Comprehensive export documentation

### Version 1.0.0 (2026-01-04)
- ✅ Initial web application release
- ✅ Dashboard with invoice statistics
- ✅ Interactive data visualization with Chart.js
- ✅ Invoice listing and filtering
- ✅ Profit & Loss and Balance Sheet reports
- ✅ Bank transaction history
- ✅ Demo mode for testing
- ✅ Responsive design with Tailwind CSS
- ✅ Cloudflare Pages deployment ready

## 🎯 Next Steps

**Ready to use real data:**
1. ✅ **Click "Connect to Xero"** in the dashboard
2. ✅ **Authorize** with your Xero account
3. ✅ **Start using** real financial data!

**Recommended future development:**

1. **High Priority:**
   - Implement date range filtering for all reports
   - Add persistent session storage with Cloudflare KV
   - Implement user accounts and multi-organization support

2. **Medium Priority:**
   - Add native Excel (.xlsx) export functionality
   - Implement PDF report generation
   - Add pagination for large invoice lists
   - Email scheduled reports

3. **Low Priority:**
   - Add scheduled auto-refresh functionality
   - Implement additional report types (Trial Balance, Budget Summary)
   - Add custom report builder with filters
   - Dashboard customization

---

**Project**: Gershon Finance Dashboard  
**Version**: 2.0.0  
**Last Updated**: January 18, 2026  
**Deployment**: GenSpark Hosted Deploy → finance.gershoncrm.com  
**Technology**: Hono + TypeScript + Tailwind CSS + Chart.js + OAuth2  

**🔗 Production:**
- **URL**: https://finance.gershoncrm.com
- **Login**: https://finance.gershoncrm.com/auth/login

**📚 Deployment Guides:**
- **Quick Deploy**: [DEPLOY_QUICK.md](DEPLOY_QUICK.md) - 3-step guide
- **Full Guide**: [GENSPARK_DEPLOY.md](GENSPARK_DEPLOY.md) - Complete deployment
- **Features**: [XERO_AUTH_GATE.md](XERO_AUTH_GATE.md) - Authentication
- **Trends**: [PAYMENT_TRENDS_FEATURE.md](PAYMENT_TRENDS_FEATURE.md) - Analytics
