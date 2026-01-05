# Google Sheets Direct Links - Usage Guide

## 🔗 Overview

The Xero Reports Dashboard provides **direct CSV URLs** that can be used in Google Sheets with the `=IMPORTDATA()` function. This allows your Google Sheets to automatically pull and refresh **REAL DATA** from your Xero account without manual downloads.

## ⚠️ IMPORTANT: Authentication Required

**These URLs return YOUR actual Xero data, NOT demo data!**

Before using these URLs, you MUST:
1. Connect to Xero via OAuth: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
2. Authorize the application to access your Xero data
3. Then the URLs will return real CSV data from YOUR Xero account

**What you'll get:**
- ✅ Real company names from your Xero contacts
- ✅ Actual outstanding invoice amounts
- ✅ Real transaction history and dates
- ✅ Your organization's financial reports
- ✅ Live data - updates when you refresh

## 🚀 Quick Start

### Step 1: Connect to Xero (One-Time Setup)

**REQUIRED:** Before using any URLs, you must authenticate:

1. Go to: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
2. Click to authorize the app
3. Choose your Xero organization
4. Done! Now the URLs will return your real data

### Step 2: Get Your URL

1. Open your dashboard: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
2. Click the **"Sheets Links"** tab in the navigation
3. Find the data source you want (e.g., "Clients Awaiting Payment")
4. Click the **"Copy"** button to copy the URL to clipboard

### Step 3: Use in Google Sheets

1. Open [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet or open an existing one
3. Click on cell **A1** (or any cell where you want the data)
4. Type the formula: `=IMPORTDATA("paste-url-here")`
5. Press **Enter**

**Example:**
```
=IMPORTDATA("https://your-domain.com/api/export/clients-awaiting-payment")
```

### Step 3: Automatic Updates

Google Sheets will automatically refresh the data periodically. You can also manually refresh:
- Click **Data** → **Refresh all** in Google Sheets menu

## 📊 Available Data Sources

### 1. Invoice Summary
**URL:** `/api/export/summary`

**What it includes:**
- Metric column (Draft Invoices, Awaiting Payment, Overdue, Total)
- Count of invoices
- Total amount

**Use case:** Dashboard overview, summary statistics

### 2. Clients Awaiting Payment ⭐
**URL:** `/api/export/clients-awaiting-payment`

**What it includes:**
- Company Name
- Number of Invoices per company
- Total Outstanding per company
- **TOTAL row** at the bottom with grand totals

**Use case:** 
- Collections management
- Identify top debtors
- Payment follow-up prioritization
- Accounts receivable aging

### 3. All Invoices
**URL:** `/api/export/invoices`

**What it includes:**
- Invoice Number
- Contact name
- Date, Due Date
- Total, Amount Due, Amount Paid
- Status (DRAFT, AUTHORISED, PAID, etc.)

**Use case:** Complete invoice list, detailed analysis

### 4. Bank Transactions
**URL:** `/api/export/transactions`

**What it includes:**
- Date
- Contact
- Type (RECEIVE/SPEND)
- Amount
- Reference

**Use case:** Cash flow analysis, transaction tracking

### 5. Profit & Loss Report
**URL:** `/api/export/profit-loss`

**What it includes:**
- Section (Revenue, Expenses, etc.)
- Account names
- Values

**Use case:** Financial performance, income vs expenses

### 6. Balance Sheet Report
**URL:** `/api/export/balance-sheet`

**What it includes:**
- Section (Assets, Liabilities, Equity)
- Account names
- Values

**Use case:** Financial position, asset tracking

## 📊 Real Data Examples

### Example 1: Clients Awaiting Payment (Real Data)

After authentication, this URL:
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment
```

Returns YOUR actual data like:
```csv
Company Name,Number of Invoices,Total Outstanding
Gershon Consulting,3,12500.00
ABC Corporation,2,8750.00
Tech Solutions Inc,1,5200.00
TOTAL,6,26450.00
```

**Key points:**
- ✅ Real company names from YOUR Xero contacts
- ✅ Actual invoice counts
- ✅ Real outstanding amounts in your currency
- ✅ Automatic TOTAL row for quick reference

### Example 2: Invoice Summary (Real Data)

```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/summary
```

Returns:
```csv
Metric,Count,Amount
Draft Invoices,5,15000.00
Awaiting Payment,12,45000.00
Overdue,3,8500.00
Total Invoices,20,68500.00
```

**All numbers are from YOUR actual Xero account!**

## 💡 Example Use Cases

### Use Case 1: Collections Dashboard

**Goal:** Track which clients owe money and prioritize follow-ups

**Google Sheets Formula:**
```
=IMPORTDATA("https://your-domain.com/api/export/clients-awaiting-payment")
```

**What you get:**
- List of all clients with outstanding payments
- Sorted by amount (highest first)
- Total row showing overall outstanding

**Next steps in Sheets:**
- Add a "Last Contact" column
- Add "Days Overdue" calculation
- Create conditional formatting for high-priority clients
- Set up email reminders

### Use Case 2: Monthly Financial Report

**Sheet Tab 1: Invoice Summary**
```
=IMPORTDATA("https://your-domain.com/api/export/summary")
```

**Sheet Tab 2: Detailed Invoices**
```
=IMPORTDATA("https://your-domain.com/api/export/invoices")
```

**Sheet Tab 3: Transactions**
```
=IMPORTDATA("https://your-domain.com/api/export/transactions")
```

**Sheet Tab 4: P&L Report**
```
=IMPORTDATA("https://your-domain.com/api/export/profit-loss")
```

### Use Case 3: Client Payment Tracker

1. Import clients awaiting payment
2. Add columns: "Days Outstanding", "Priority", "Status"
3. Use formulas to calculate aging
4. Apply conditional formatting (red for >30 days)
5. Share with collections team

**Formula for Days Outstanding:**
```
=TODAY()-B2  // Assuming B2 has the invoice date
```

## 🔄 Data Refresh Behavior

### Automatic Refresh
- Google Sheets refreshes `IMPORTDATA()` automatically
- Typical refresh interval: Every 1-2 hours
- Depends on Google Sheets' caching policy

### Manual Refresh
1. Click **Data** menu in Google Sheets
2. Select **Refresh all**
3. Or use keyboard shortcut: `Ctrl+Alt+Shift+R` (Windows) or `⌘+Option+Shift+R` (Mac)

### Force Refresh
If data doesn't update:
1. Delete the cell content
2. Re-enter the `=IMPORTDATA()` formula
3. Press Enter

## 🎨 Formatting Tips

### Format Currency Columns
1. Select the amount column
2. Click **Format** → **Number** → **Currency**
3. Choose your currency (USD, EUR, etc.)

### Add Headers
Since IMPORTDATA includes headers, you can:
- Bold the first row
- Freeze the header row (View → Freeze → 1 row)
- Apply background color to headers

### Conditional Formatting

**Highlight high-value clients:**
1. Select the "Total Outstanding" column
2. Format → Conditional formatting
3. Format cells if... Greater than 10000
4. Choose red background

**Highlight overdue:**
1. Add a status column
2. Format cells if... Text contains "OVERDUE"
3. Choose red text

## 📈 Advanced Features

### Combine Multiple Sources

**Create a master dashboard:**
```
Sheet 1: Summary       =IMPORTDATA(summary_url)
Sheet 2: Clients       =IMPORTDATA(clients_url)
Sheet 3: Invoices      =IMPORTDATA(invoices_url)
Sheet 4: Transactions  =IMPORTDATA(transactions_url)
Sheet 5: Analysis      =Your calculations using data from other sheets
```

### Create Pivot Tables

1. Import data using IMPORTDATA
2. Select the data range
3. Data → Pivot table
4. Analyze by client, status, date, etc.

### Use with Google Apps Script

Automate data processing:
```javascript
function refreshXeroData() {
  var sheet = SpreadsheetApp.getActiveSheet();
  // Data automatically refreshes via IMPORTDATA
  // Add your custom processing here
}
```

### Link to Other Sheets

Reference data across sheets:
```
='Clients'!B2  // Reference cell from Clients sheet
```

## 🔒 Security & Authentication

### Current Status
- **Demo Mode**: URLs return sample data (no authentication required)
- **Production Mode**: URLs require authentication

### Authentication Flow (When Implemented)
1. Log in to dashboard once
2. Session maintained for data access
3. URLs work only while authenticated
4. Automatic token refresh

### Data Privacy
- URLs are specific to your deployment
- No public access without your domain
- Data transmitted over HTTPS
- Google Sheets caches data temporarily

## ⚠️ Limitations

### Google Sheets Limits
- **Max cell size**: 50,000 characters
- **Import size**: ~1 MB per import
- **Refresh rate**: Controlled by Google (typically 1-2 hours)
- **Cell limit**: 10 million cells per spreadsheet

### If Data Doesn't Load
1. **Check URL**: Ensure it's copied correctly
2. **Check Authentication**: Make sure you're logged in to dashboard
3. **Check Data Size**: Very large datasets may time out
4. **Use Filters**: Add query parameters to limit data

## 🆘 Troubleshooting

### Error: "Could not fetch URL"
- **Cause**: URL is incorrect or server is down
- **Fix**: Copy URL again from Sheets Links tab

### Error: "Resource not accessible"
- **Cause**: Authentication required
- **Fix**: Log in to the dashboard first

### Data Not Updating
- **Fix 1**: Manual refresh (Data → Refresh all)
- **Fix 2**: Re-enter the formula
- **Fix 3**: Clear cache (delete and re-add formula)

### Data Appears Garbled
- **Cause**: CSV encoding issue
- **Fix**: The data is CSV format, Google Sheets should handle automatically

### Too Much Data
- **Cause**: Response is too large for Google Sheets
- **Fix**: Use filtered endpoints (add query parameters)

## 📞 Support

### Documentation
- Main README: See project documentation
- Export Guide: GOOGLE_SHEETS_EXPORT.md (for download approach)
- This Guide: Direct links approach

### Example URLs

**Replace with your actual domain:**
```
https://your-domain.pages.dev/api/export/summary
https://your-domain.pages.dev/api/export/clients-awaiting-payment
https://your-domain.pages.dev/api/export/invoices
```

**Current sandbox URL:**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/summary
```

## 🎯 Best Practices

1. **One Sheet per Data Source**: Create separate tabs for each import
2. **Name Your Sheets**: Use descriptive names (e.g., "Xero - Clients Awaiting Payment")
3. **Document URLs**: Keep a reference sheet with all your URLs
4. **Regular Refresh**: Set a reminder to manually refresh before important meetings
5. **Backup Data**: Download as Excel periodically for records
6. **Share Wisely**: Be careful when sharing sheets with sensitive financial data
7. **Use Templates**: Create template sheets for recurring reports

## 📊 Sample Template Sheet Structure

**Tab 1: Dashboard**
- Summary cards with key metrics
- Links to other tabs

**Tab 2: Clients Awaiting Payment**
```
=IMPORTDATA("url-here")
```
- Add columns: Priority, Last Contact, Notes
- Conditional formatting for high amounts

**Tab 3: All Invoices**
```
=IMPORTDATA("url-here")
```
- Filter views for different statuses
- Pivot table for analysis

**Tab 4: Transactions**
```
=IMPORTDATA("url-here")
```
- Monthly grouping
- Income vs Expenses chart

**Tab 5: Analysis**
- Custom calculations
- Charts and graphs
- Summary statistics

---

**Ready to use!** Go to the Sheets Links tab and start copying URLs for your Google Sheets integration.
