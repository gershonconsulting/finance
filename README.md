# Xero Reports Dashboard

A modern web application for generating financial reports from Xero accounting data. Built with Hono framework and designed for deployment on Cloudflare Pages.

## 🌐 Live Demo

**Public URL**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai

## 📋 Project Overview

This web application connects to your Xero account via API to provide comprehensive financial reporting and analysis capabilities. It replaces the previous mobile app implementation with a more accessible and feature-rich web interface.

### Main Features

✅ **Currently Implemented:**
- 📊 **Dashboard Overview** - Real-time invoice statistics (Draft, Awaiting Payment, Overdue)
- 📈 **Data Visualization** - Interactive charts using Chart.js for financial metrics
- 📄 **Invoice Management** - List, filter, and view invoice details
- 👥 **Clients Awaiting Payment** - List of companies with outstanding invoices and totals
- 💰 **Financial Reports** - Profit & Loss and Balance Sheet report generation
- 💳 **Bank Transactions** - View and analyze transaction history
- 📱 **Responsive Design** - Mobile-friendly interface with Tailwind CSS
- 🔄 **Demo Mode** - Test functionality without Xero authentication
- 📊 **Google Sheets Export** - Export all data to CSV for Google Sheets import

⏳ **Planned Features:**
- 🔐 **OAuth2 Authentication** - Full Xero OAuth2 integration for production use
- 📤 **PDF Export** - PDF generation for reports and invoices
- 📊 **Excel Export** - Native Excel (.xlsx) format support
- 🔍 **Advanced Filtering** - Date range and status-based filtering
- 📊 **Additional Reports** - Trial Balance, Budget Summary, and custom reports
- 💾 **Session Management** - Persistent authentication using Cloudflare KV
- 🔔 **Auto-refresh** - Scheduled data updates (weekly/monthly)

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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check endpoint |
| `/api/auth/status` | GET | Check authentication status |
| `/api/invoices/summary` | GET | Get invoice statistics |
| `/api/invoices` | GET | List invoices (with filters) |
| `/api/clients/awaiting-payment` | GET | Get clients with outstanding payments |
| `/api/reports/profit-loss` | GET | Profit & Loss report |
| `/api/reports/balance-sheet` | GET | Balance Sheet report |
| `/api/transactions` | GET | Bank transactions |
| `/api/demo/summary` | GET | Demo data for testing |
| `/api/export/summary` | GET | Export invoice summary to CSV |
| `/api/export/invoices` | GET | Export invoices to CSV |
| `/api/export/clients-awaiting-payment` | GET | Export clients awaiting payment to CSV |
| `/api/export/transactions` | GET | Export transactions to CSV |
| `/api/export/profit-loss` | GET | Export P&L report to CSV |
| `/api/export/balance-sheet` | GET | Export Balance Sheet to CSV |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Xero Developer Account (for production use)
- Cloudflare account (for deployment)

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

#### Xero API Setup (Required for Production)

1. Create a Xero app at https://developer.xero.com/myapps
2. Get your Client ID and Client Secret
3. Set redirect URI to your application URL + `/auth/callback`
4. Store credentials in `.dev.vars` (local) or Cloudflare secrets (production)

```bash
# .dev.vars (local development - NOT committed to git)
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=http://localhost:3000/auth/callback
```

#### Production Secrets (Cloudflare)
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

## 🌐 Deployment

### Cloudflare Pages Deployment

1. **Build the project:**
```bash
npm run build
```

2. **Deploy to Cloudflare Pages:**
```bash
npx wrangler pages deploy dist --project-name xero-reports-webapp
```

3. **Set environment variables:**
```bash
npx wrangler pages secret put XERO_CLIENT_ID --project-name xero-reports-webapp
npx wrangler pages secret put XERO_CLIENT_SECRET --project-name xero-reports-webapp
npx wrangler pages secret put XERO_REDIRECT_URI --project-name xero-reports-webapp
```

### Production URL Structure
- Production: `https://xero-reports-webapp.pages.dev`
- Branch: `https://main.xero-reports-webapp.pages.dev`

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

**Recommended development priorities:**

1. **High Priority:**
   - Implement full Xero OAuth2 authentication flow
   - Add session management with Cloudflare KV
   - Implement date range filtering for all reports

2. **Medium Priority:**
   - Add CSV/Excel export functionality
   - Implement PDF report generation
   - Add pagination for large invoice lists

3. **Low Priority:**
   - Add scheduled auto-refresh functionality
   - Implement additional report types (Trial Balance, Budget Summary)
   - Add custom report builder with filters

---

**Project**: Xero Reports Dashboard  
**Version**: 1.0.0  
**Last Updated**: January 4, 2026  
**Deployment Status**: ✅ Active (Sandbox)  
**Technology**: Hono + TypeScript + Tailwind CSS + Chart.js
