# Correct URL Mapping for Google Sheets

## 📊 Current Xero Data (from screenshots)

### Invoice Statistics:
- **Draft Invoices**: 8 invoices, $22,592.27
- **Awaiting Payment**: 57 invoices, $119,839.41
- **Overdue**: (from previous screenshot) 38 invoices, $63,313.81

### Top Clients Owing:
1. Milvue: $17,214.96
2. Duorooq Engineering: $10,941.77
3. HSSDR: $8,181.12
4. CONNECT INNOV: $7,995.30
5. Finance Montreal: $6,096.60

---

## 🔗 Available Export Endpoints

### 1. `/api/export/summary`
**Returns**: Invoice summary statistics
- Draft count & amount
- Awaiting Payment count & amount
- Overdue count & amount
- Total invoices

**CSV Format:**
```csv
Metric,Count,Amount
Draft Invoices,8,22592.27
Awaiting Payment,57,119839.41
Overdue,38,63313.81
Total Invoices,103,206045.49
```

---

### 2. `/api/export/clients-awaiting-payment`
**Returns**: Clients with outstanding invoices
- Company names
- Number of invoices per client
- Total outstanding per client
- TOTAL row

**CSV Format:**
```csv
Company Name,Number of Invoices,Total Outstanding
Milvue,X,17214.96
Duorooq Engineering,X,10941.77
HSSDR,X,8181.12
CONNECT INNOV,X,7995.30
Finance Montreal,X,6096.60
...
TOTAL,57,119839.41
```

---

### 3. `/api/export/invoices`
**Returns**: All invoices list
- Invoice Number
- Contact Name
- Date, Due Date
- Total, Amount Due, Amount Paid
- Status (DRAFT, AUTHORISED, PAID, etc.)

**CSV Format:**
```csv
Invoice Number,Contact,Date,Due Date,Total,Amount Due,Amount Paid,Status
INV-001,Milvue,2024-01-15,2024-02-15,5000.00,5000.00,0.00,AUTHORISED
INV-002,Duorooq Engineering,2024-01-20,2024-02-20,3500.00,3500.00,0.00,AUTHORISED
...
```

---

### 4. `/api/export/transactions`
**Returns**: Bank transactions
- Date
- Contact
- Type (RECEIVE/SPEND)
- Amount
- Reference

**CSV Format:**
```csv
Date,Contact,Type,Amount,Reference
2024-01-15,Milvue,RECEIVE,2500.00,Payment - INV-001
2024-01-20,Office Supplies Inc,SPEND,350.00,Office supplies
...
```

---

### 5. `/api/export/profit-loss`
**Returns**: Profit & Loss report
- Section (Revenue, Expenses, etc.)
- Account Name
- Values

**CSV Format:**
```csv
Section,Account,Value
Revenue,Sales,250000.00
Revenue,Service Income,50000.00
Expenses,Salaries,120000.00
Expenses,Rent,24000.00
...
```

---

### 6. `/api/export/balance-sheet`
**Returns**: Balance Sheet report
- Section (Assets, Liabilities, Equity)
- Account Name
- Values

**CSV Format:**
```csv
Section,Account,Value
Assets,Bank Account,45000.00
Assets,Accounts Receivable,119839.41
Liabilities,Accounts Payable,35000.00
Equity,Retained Earnings,85000.00
...
```

---

## ✅ Correct Mapping for Sheets Links Page

### General Metrics
- **Total Boxes** → `/api/export/summary` ✅

### By Stage (Active Stages)
- **Closing** → `/api/export/clients-awaiting-payment` ✅ (clients close to paying)
- **Negotiating** → `/api/export/invoices` ✅ (all invoices, can filter by status)
- **Nurturing** → `/api/export/clients-awaiting-payment` ⚠️ (same as Closing?)
- **Proposal Sent** → `/api/export/invoices?status=DRAFT` ⚠️ (draft invoices = proposals?)

### By FIT
- **High FIT** → `/api/export/clients-awaiting-payment` (top clients)
- **Medium FIT** → `/api/export/invoices`
- **Low FIT** → `/api/export/transactions`

### By INTEREST
- **High INTEREST** → `/api/export/clients-awaiting-payment` (clients with high outstanding)
- **Medium INTEREST** → `/api/export/invoices`
- **Low INTEREST** → `/api/export/profit-loss`

---

## 🎯 Recommended Mapping

For a CRM-like system tracking sales pipeline, here's what makes sense:

### General Metrics
✅ **Total Boxes** = Invoice Summary

### By Stage (Sales Pipeline)
✅ **Closing** = Clients Awaiting Payment (deals about to close)
✅ **Negotiating** = All Invoices (deals in negotiation)
✅ **Nurturing** = Bank Transactions (ongoing relationships)
✅ **Proposal Sent** = Profit & Loss (proposals sent = revenue potential)

### By FIT (Client Quality)
✅ **High FIT** = Clients Awaiting Payment (best clients)
✅ **Medium FIT** = All Invoices (regular clients)
✅ **Low FIT** = Transactions (occasional clients)

### By INTEREST (Client Engagement)
✅ **High INTEREST** = Clients Awaiting Payment (highly engaged)
✅ **Medium INTEREST** = All Invoices (moderately engaged)
✅ **Low INTEREST** = Balance Sheet (low engagement)

---

## 📋 All Available URLs

Base URL: `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai`

1. `/api/export/summary` - Invoice summary statistics
2. `/api/export/clients-awaiting-payment` - Clients with outstanding payments
3. `/api/export/invoices` - All invoices
4. `/api/export/transactions` - Bank transactions
5. `/api/export/profit-loss` - Profit & Loss report
6. `/api/export/balance-sheet` - Balance Sheet report

**Note**: We only have 6 export endpoints, but the Sheets Links page shows many more categories. We need to decide which endpoint maps to which category.

---

## ⚠️ Issue Identified

**Problem**: The Sheets Links page has ~13 different labels but we only have 6 unique export endpoints.

**Solution Options**:
1. Use the same endpoint for multiple categories (current approach)
2. Create additional filtered endpoints (e.g., `/api/export/invoices?status=DRAFT`)
3. Simplify the Sheets Links page to show only 6 categories matching our 6 endpoints

---

## 🎯 Recommendation

**Best approach**: Simplify the Sheets Links page to show our actual 6 data sources clearly:

1. **Invoice Summary** → Summary stats
2. **Clients Awaiting Payment** → Top clients owing money
3. **All Invoices** → Complete invoice list
4. **Bank Transactions** → Transaction history
5. **Profit & Loss** → P&L report
6. **Balance Sheet** → Balance sheet report

This is clearer, more accurate, and matches what the API actually provides.

---

**Last Updated**: 2026-01-05
**Status**: Needs correction - current mapping is confusing
**Action Required**: Simplify Sheets Links page to match actual 6 endpoints
