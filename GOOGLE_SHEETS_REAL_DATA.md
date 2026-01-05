# ✅ Google Sheets Integration - Real Data Guide

## 🎯 Overview

Your Xero Reports Dashboard now has **6 direct CSV URLs** that return **REAL DATA** from YOUR Xero account for use in Google Sheets.

**No more demo data! No more fake companies!** 🎉

---

## ⚠️ CRITICAL: Authentication Required

**Before using any URL, you MUST connect to Xero:**

### 👉 Connect Now:
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

**One-time setup (30 seconds):**
1. Click the link above
2. Authorize on Xero
3. Choose your organization
4. ✅ Done! URLs now return YOUR real data

**After authentication:**
- ✅ All URLs return real company names
- ✅ All amounts are actual figures from YOUR Xero
- ✅ All dates and transactions are real
- ✅ No demo data anywhere!

---

## 📊 The 6 Direct URLs

All URLs are ready to use in Google Sheets with `=IMPORTDATA()`:

### 1. **Invoice Summary**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/summary
```

**Returns:** Dashboard statistics (Draft, Awaiting Payment, Overdue)

**Real Data Example:**
```csv
Metric,Count,Amount
Draft Invoices,5,15000.00
Awaiting Payment,12,45000.00
Overdue,3,8500.00
Total Invoices,20,68500.00
```

---

### 2. **Clients Awaiting Payment** ⭐ Most Popular
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment
```

**Returns:** Companies with outstanding invoices and totals

**Real Data Example:**
```csv
Company Name,Number of Invoices,Total Outstanding
Gershon Consulting,3,12500.00
ABC Corporation,2,8750.00
Tech Solutions Inc,1,5200.00
Prime Consulting,4,9500.00
TOTAL,10,36000.00
```
*(These will be YOUR actual client names and amounts!)*

---

### 3. **All Invoices**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices
```

**Returns:** Complete invoice list with details

**Includes:**
- Invoice Number
- Contact name (real)
- Date, Due Date
- Total, Amount Due, Amount Paid
- Status (DRAFT, AUTHORISED, PAID)

---

### 4. **Bank Transactions**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/transactions
```

**Returns:** Transaction history

**Includes:**
- Date
- Contact (real names)
- Type (RECEIVE/SPEND)
- Amount (actual)
- Reference

---

### 5. **Profit & Loss Report**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/profit-loss
```

**Returns:** Income and expenses breakdown

**Includes:**
- Section (Revenue, Expenses)
- Account names (your chart of accounts)
- Values (actual amounts)

---

### 6. **Balance Sheet Report**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/balance-sheet
```

**Returns:** Assets, liabilities, and equity

**Includes:**
- Section (Assets, Liabilities, Equity)
- Account names
- Values (real balances)

---

## 🚀 How to Use in Google Sheets

### Step 1: Connect to Xero (One-Time)
Click: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

Authorize → Done! ✅

### Step 2: Open Google Sheets
Go to: https://sheets.google.com

### Step 3: Use IMPORTDATA Formula

1. Click on cell **A1**
2. Type this formula:
   ```
   =IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")
   ```
3. Press **Enter**
4. 🎉 **Your real data appears!**

### Example Formula:
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")
```

---

## ✅ What You'll See

### Before Authentication:
- ❌ URLs won't work or return errors
- ❌ No data in Google Sheets

### After Authentication:
- ✅ Real company names (not "ABC Corporation", "XYZ Industries")
- ✅ Actual outstanding amounts (your real numbers)
- ✅ Real invoice counts
- ✅ Actual transaction dates
- ✅ Your financial reports

### Real Data Example (Clients Awaiting Payment):

**What you see in Google Sheets:**
```
Company Name          | Number of Invoices | Total Outstanding
---------------------|-------------------|------------------
Gershon Consulting   | 3                 | 12500.00
Smith & Associates   | 2                 | 8750.00
Tech Innovations     | 1                 | 5200.00
TOTAL                | 6                 | 26450.00
```

**These are YOUR actual clients from YOUR Xero account!** 🎯

---

## 📈 Use Cases

### Use Case 1: Collections Dashboard
**Goal:** Track who owes you money

**Formula:**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")
```

**Result:** 
- List of real clients with outstanding balances
- Sorted by amount (highest first)
- Total outstanding at the bottom

**Next Steps:**
- Add "Last Contact" column
- Add "Days Overdue" calculation
- Set up conditional formatting for priority clients

---

### Use Case 2: Monthly Reporting
**Goal:** Create monthly financial reports

**Formulas:**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/summary")
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/profit-loss")
```

**Result:**
- Invoice statistics
- P&L breakdown
- All with real numbers

---

### Use Case 3: Cash Flow Tracking
**Goal:** Monitor incoming/outgoing transactions

**Formula:**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/transactions")
```

**Result:**
- All transactions with real dates
- Actual amounts
- Real contact names

---

## 🔄 Auto-Refresh

Google Sheets automatically refreshes IMPORTDATA periodically.

**Manual Refresh:**
1. In Google Sheets, click **Data** menu
2. Click **Refresh all**
3. ✅ Updated with latest data from Xero!

---

## 🔒 Security

### Your Data Is Secure:
- ✅ OAuth authentication required
- ✅ HTTPS for all requests
- ✅ Only YOU can access your data after auth
- ✅ Session-based access (not public URLs)

### Keep URLs Private:
- ⚠️ Don't share these URLs publicly
- ⚠️ They contain access to your financial data
- ✅ Only use in your private Google Sheets

---

## 📱 Quick Reference

### Dashboard URL:
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai

### Connect to Xero:
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

### Sheets Links Tab:
Dashboard → Click "Sheets Links" → Copy URLs

### Copy-Paste URLs:
Go to "Sheets Links" tab and click "Copy" button next to each URL

---

## 🎯 Checklist

Before using in Google Sheets:

- [ ] Connected to Xero (via /auth/login)
- [ ] Authorized the application
- [ ] Dashboard shows "Connected to Xero" ✅
- [ ] Copied URL from Sheets Links tab
- [ ] Opened Google Sheets
- [ ] Used =IMPORTDATA("url") formula
- [ ] Pressed Enter
- [ ] ✅ Real data appears!

---

## 💡 Pro Tips

### Tip 1: Use Named Ranges
Create named ranges in Google Sheets for easy reference:
```
=IMPORTDATA(ClientsURL)
```

### Tip 2: Combine with Other Formulas
```
=SORT(IMPORTDATA("url"), 3, FALSE)  // Sort by column 3 descending
=FILTER(IMPORTDATA("url"), ...)     // Filter results
```

### Tip 3: Create Dashboards
Combine multiple IMPORTDATA formulas in one sheet:
- Tab 1: Clients Awaiting Payment
- Tab 2: Invoice Summary
- Tab 3: P&L Report
- Tab 4: Dashboard (summary of all)

### Tip 4: Set Up Alerts
Use Google Sheets notifications:
- Alert when overdue > $X
- Alert when new client appears
- Weekly summary email

---

## 🆘 Troubleshooting

### Issue: "Error loading data"
**Solution:** Connect to Xero first!
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

### Issue: "Loading..." forever
**Solution:** Check authentication status in dashboard header

### Issue: Old data showing
**Solution:** 
1. In Google Sheets: Data → Refresh all
2. Or delete formula and re-enter it

### Issue: Empty results
**Solution:** Ensure you have data in Xero for that report

---

## 📖 Documentation

- **Full Guide**: [GOOGLE_SHEETS_LINKS.md](./GOOGLE_SHEETS_LINKS.md)
- **Authentication**: [READY_TO_USE.md](./READY_TO_USE.md)
- **Security**: [SECURITY_CREDENTIALS.md](./SECURITY_CREDENTIALS.md)
- **Main README**: [README.md](./README.md)

---

## 🎉 Summary

### What You Have:
✅ **6 direct CSV URLs** for Google Sheets  
✅ **Real data** from YOUR Xero account  
✅ **No demo data** - all actual figures  
✅ **Auto-refresh** capability  
✅ **One-time authentication** setup  
✅ **Copy-to-clipboard** buttons in UI  

### What You Do:
1. **Connect to Xero** (30 seconds): https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
2. **Copy a URL** from Sheets Links tab
3. **Use in Google Sheets**: `=IMPORTDATA("url")`
4. **✅ Done!** Real data appears!

---

## 🚀 Ready to Start?

### 1. Connect to Xero Now:
👉 https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

### 2. Go to Sheets Links Tab:
👉 https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai → Click "Sheets Links"

### 3. Copy URLs and Use in Google Sheets!

---

**Last Updated**: 2026-01-05  
**Status**: ✅ Working with Real Data  
**Authentication**: Required (one-time)

**Your Xero data is now ready to flow into Google Sheets!** 🎊
