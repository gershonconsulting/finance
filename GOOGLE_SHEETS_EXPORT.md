# Google Sheets Export Guide

## Overview

The Xero Reports Dashboard now includes **Google Sheets export functionality** for all data views. You can export your financial data to CSV format and easily import it into Google Sheets for further analysis, collaboration, and reporting.

## 🚀 Quick Start

### Export Options Available

1. **Dashboard Summary** - Invoice statistics (Draft, Awaiting, Overdue)
2. **Invoice List** - Detailed invoice data with all fields
3. **Bank Transactions** - Complete transaction history
4. **Profit & Loss Report** - Financial performance report
5. **Balance Sheet Report** - Assets, liabilities, and equity

## 📊 How to Export Data

### Method 1: Using Export Buttons (Recommended)

Each section of the dashboard has a green **"Export to Google Sheets"** button:

#### Dashboard Tab
1. Go to the **Dashboard** tab
2. Scroll to the "Invoice Status Overview" section
3. Click **"Export to Google Sheets"** button (green)
4. CSV file will download automatically
5. Follow the import instructions (see below)

#### Invoices Tab
1. Go to the **Invoices** tab
2. Click a filter button (Draft, Awaiting, Paid, or All)
3. Click **"Export"** button (green, top right)
4. CSV file will download with current invoice list

#### Transactions Tab
1. Go to the **Transactions** tab
2. Click **"Load"** to fetch transactions
3. Click **"Export"** button (green)
4. CSV file downloads with all transactions

#### Reports Tab
1. Go to the **Reports** tab
2. Click **"Generate Report"** for Profit & Loss or Balance Sheet
3. Once report loads, click **"Export to Google Sheets"** (green button)
4. CSV file downloads with report data

### Method 2: Direct API Access

You can also access export endpoints directly via URL:

```
Dashboard Summary:
https://your-domain.com/api/export/summary

All Invoices:
https://your-domain.com/api/export/invoices

Draft Invoices Only:
https://your-domain.com/api/export/invoices?status=DRAFT

Bank Transactions:
https://your-domain.com/api/export/transactions

Profit & Loss Report:
https://your-domain.com/api/export/profit-loss

Balance Sheet Report:
https://your-domain.com/api/export/balance-sheet
```

## 📥 Importing to Google Sheets

### Option A: Direct Import (Easiest)

1. **Download the CSV** file from the dashboard
2. **Go to Google Sheets**: https://sheets.google.com
3. **Click** "Blank" to create a new spreadsheet
4. **Click** File → Import
5. **Select** "Upload" tab
6. **Drag and drop** your CSV file or click "Select a file from your device"
7. **Choose** import settings:
   - Import location: "Replace spreadsheet" or "Insert new sheet(s)"
   - Separator type: "Comma"
   - Convert text to numbers: Yes (recommended)
8. **Click** "Import data"

### Option B: Google Drive Import

1. **Upload CSV** to Google Drive
2. **Right-click** on the file
3. **Select** "Open with" → "Google Sheets"
4. Google Sheets will automatically convert the CSV

### Option C: IMPORTDATA Function

You can use Google Sheets' `IMPORTDATA()` function if your CSV is hosted publicly:

```
=IMPORTDATA("https://your-domain.com/api/export/summary")
```

**Note**: This requires the CSV URL to be publicly accessible and may have CORS restrictions.

## 📋 Export Data Formats

### Invoice Summary Export

```csv
Metric,Count,Amount
Draft Invoices,16,30017.87
Awaiting Payment,38,63313.81
Overdue,38,63313.81
Total Invoices,92,
```

### Invoices Export

```csv
Invoice Number,Contact,Date,Due Date,Total,Amount Due,Amount Paid,Status
INV-2024-001,ABC Company,2024-01-01,2024-01-31,15000.00,15000.00,0.00,AUTHORISED
INV-2024-002,XYZ Corp,2024-01-05,2024-02-05,8500.00,0.00,8500.00,PAID
```

### Transactions Export

```csv
Date,Contact,Type,Amount,Reference
2024-01-04,Office Supplies Co,SPEND,-1500.00,Office supplies purchase
2024-01-03,Client Payment,RECEIVE,8500.00,Invoice payment
```

### Report Exports (P&L and Balance Sheet)

```csv
Section,Account,Value
Report Information,Report Name,Profit and Loss
Report Information,Report Date,2024-01-04
[blank line]
Revenue,Sales,100000.00
Revenue,Service Revenue,25000.00
```

## 🎨 Working with Exported Data in Google Sheets

### Formatting Tips

1. **Freeze Header Row**:
   - View → Freeze → 1 row

2. **Format Currency Columns**:
   - Select amount columns
   - Format → Number → Currency

3. **Create Pivot Tables**:
   - Data → Pivot table
   - Analyze invoices by status, contact, or date

4. **Add Charts**:
   - Insert → Chart
   - Visualize your financial data

### Advanced Analysis Examples

#### Invoice Aging Report
```
=DAYS(TODAY(), DueDate)
```

#### Summary Statistics
```
=SUMIF(Status, "AUTHORISED", AmountDue)
=COUNTIF(Status, "OVERDUE")
=AVERAGE(Total)
```

#### Monthly Breakdown
```
=QUERY(A:H, "SELECT MONTH(C), SUM(E) GROUP BY MONTH(C)")
```

## 🔄 Automated Updates

### Manual Refresh
To update your Google Sheets with latest data:
1. Export new CSV from dashboard
2. File → Import → Replace current sheet

### Scheduled Updates (Advanced)
Use Google Apps Script to fetch data automatically:

```javascript
function importXeroData() {
  var url = 'https://your-domain.com/api/export/summary';
  var response = UrlFetchApp.fetch(url);
  var csv = response.getContentText();
  
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = Utilities.parseCsv(csv);
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}
```

Set up a time-driven trigger to run this daily/weekly.

## 🔐 Security Notes

- **Demo Mode**: Exports sample data for testing
- **Authenticated Mode**: Exports your real Xero data (requires login)
- **Private URLs**: Export endpoints respect your authentication status
- **No Storage**: CSV files are generated on-demand, not stored on server

## 📱 Mobile Export

The export functionality works on mobile devices:
1. Tap the export button
2. CSV file downloads to your device
3. Open with Google Sheets mobile app
4. Or upload to Google Drive and open on desktop

## 🆘 Troubleshooting

### Export Button Not Working
- Check browser console for errors (F12)
- Ensure popup blockers are disabled
- Try a different browser

### CSV Not Downloading
- Check browser download settings
- Disable download restrictions
- Check available disk space

### Import Errors in Google Sheets
- Ensure CSV file is not corrupted
- Check file encoding (should be UTF-8)
- Try "Comma" as separator instead of "Detect automatically"

### Data Not Showing
- Ensure you've loaded the data first (click load/filter buttons)
- Check that you're in the correct tab
- Refresh the page and try again

### Formatting Issues
- After import, select columns and format as needed
- Use Format → Number → Currency for amounts
- Use Format → Number → Date for date columns

## 💡 Use Cases

### Financial Reporting
- Export P&L and Balance Sheet
- Create custom charts in Google Sheets
- Share with accountants or stakeholders

### Invoice Analysis
- Export all invoices
- Create pivot tables by customer, status, or date
- Calculate aging reports

### Cash Flow Tracking
- Export transactions
- Categorize by type (RECEIVE vs SPEND)
- Create cash flow projections

### Client Billing
- Export invoices filtered by status
- Send to clients as spreadsheet
- Track payment timelines

### Budget Planning
- Export historical data
- Analyze spending patterns
- Create budget forecasts

## 🎯 Best Practices

1. **Regular Exports**: Export data weekly/monthly for backup
2. **Organized Storage**: Create a Google Drive folder for exports
3. **Version Control**: Include dates in filenames
4. **Data Validation**: Cross-check exported data with Xero
5. **Shared Access**: Use Google Sheets sharing for collaboration
6. **Templates**: Create template sheets with formulas ready

## 🔗 Quick Links

- **Live Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **Google Sheets**: https://sheets.google.com
- **Google Drive**: https://drive.google.com

## 📞 Support

For issues with exports:
1. Check the browser console for errors
2. Verify authentication status (Demo vs Connected)
3. Try exporting from a different tab/section
4. Review the troubleshooting section above

---

**Last Updated**: January 4, 2026  
**Version**: 1.1.0  
**Feature**: Google Sheets Export
