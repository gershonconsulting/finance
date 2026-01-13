# Google Sheets - EXACT Copy & Paste URLs

## ✅ **ALL 7 IMPORTDATA FORMULAS - READY TO USE**

These are the **EXACT URLs** to copy and paste into Google Sheets. No variables, no substitution needed.

**🆕 NEW: Invoice Aging Analysis** - Categorize invoices into 3 groups (CURRENT, AGED, CRITICAL)

---

## 📋 **Copy These Formulas Directly Into Google Sheets:**

### 1. **Invoice Summary** (Draft, Awaiting Payment, Overdue)
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/summary")
```
**What you'll see:**
- Draft Invoices: 6 invoices, $8,792.27
- Awaiting Payment: 48 invoices, $83,239.41
- Overdue: 38 invoices, $63,313.81

---

### 2. **Clients Awaiting Payment** (Top customers owing money)
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")
```
**What you'll see (5 columns):**
- **Company Name**: Milvue, Duorooq Engineering, HSSDR, etc.
- **Number of Invoices**: Count of outstanding invoices per client
- **Total Outstanding**: Amount owed now (e.g., Milvue: $17,214.96)
- **Avg Payment Delay (days)**: 🆕 Average days late (e.g., Milvue: 81 days)
- **Total Paid Overall**: 🆕 Historical payments from this client
- **TOTAL**: 48 clients, $83,239.41 outstanding

---

### 3. **All Invoices** (Complete invoice list)
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices")
```
**What you'll see:**
- Invoice Number, Contact, Date, Due Date, Total, Amount Due, Status
- All 54 invoices from Gershon Consulting LLC

---

### 4. **Bank Transactions** (Cash flow)
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/transactions")
```
**What you'll see:**
- Date, Contact, Type (RECEIVE/SPEND), Amount, Reference
- Transaction history for your bank accounts

---

### 5. **Profit & Loss Report**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/profit-loss")
```
**What you'll see:**
- Revenue accounts and amounts
- Expense accounts and amounts
- Net profit calculation

---

### 6. **Balance Sheet Report**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/balance-sheet")
```
**What you'll see:**
- Assets (Current, Fixed)
- Liabilities (Current, Long-term)
- Equity
- Net Assets

---

### 7. **Invoice Aging Analysis** 🆕 **NEW!**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices-by-aging")
```
**What you'll see:**
- 🟢 **CURRENT** (0-99 days): Normal collection period
- 🟡 **AGED** (100-199 days): Requires attention  
- 🔴 **CRITICAL** (200+ days): Legal negotiation stage
- **TOTAL**: Combined totals across all aging groups

**Example output:**
```csv
Category,Age Range,Invoice Count,Total Outstanding
CURRENT,0-99 days,15,25000.00
AGED,100-199 days,20,35000.00
CRITICAL,200+ days (Legal),13,23239.41
TOTAL,All Ages,48,83239.41
```

📖 **Full guide**: [INVOICE_AGING_ANALYSIS.md](./INVOICE_AGING_ANALYSIS.md)

---

## 🚀 **How to Use (3 Simple Steps):**

### **STEP 1: Authenticate (ONE TIME - 30 seconds)**
👉 Click here to connect: **https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login**

1. You'll be redirected to Xero
2. Select **"Gershon Consulting LLC"**
3. Click **"Continue with 3 organisations"**
4. Done! ✅

### **STEP 2: Verify Authentication**
👉 Check status: **https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/auth/status**

Should show:
```json
{
  "authenticated": true,
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### **STEP 3: Use in Google Sheets**
1. Open Google Sheets
2. Click on any cell (e.g., A1)
3. Copy one of the 7 formulas above
4. Paste into the cell
5. Press **Enter**
6. **Your real Xero data appears!** 🎉

---

## 💡 **Example: Create a Dashboard in Google Sheets**

### **Sheet 1: Invoice Summary**
- Cell A1: `=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/summary")`
- Result: Metrics, Count, Amount columns

### **Sheet 2: Clients Awaiting Payment**
- Cell A1: `=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")`
- Result: Company Name, Number of Invoices, Total Outstanding

### **Sheet 3: All Invoices**
- Cell A1: `=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices")`
- Result: Full invoice details

---

## ⚠️ **IMPORTANT NOTES:**

### **1. Authentication Required**
- These URLs **only work after you authenticate** (Step 1 above)
- Without auth, you'll get an error: `#REF! (Could not fetch url)`
- Authentication lasts for your session (tokens are stored)

### **2. Data is REAL from Gershon Consulting LLC**
- The app filters to **only Gershon Consulting LLC** data
- Ignores other organizations (Demo Company, etc.)
- Shows actual company names, real amounts, live data

### **3. Data Updates**
- Google Sheets auto-refreshes periodically
- Manual refresh: Data → Refresh all (Cmd+R or Ctrl+R)
- Changes in Xero appear in Sheets within minutes

### **4. Security**
- Your credentials are hardcoded in `.dev.vars` (not in git)
- URLs are public but require authentication
- Session tokens expire after inactivity

---

## 🎯 **Quick Access Links:**

| Action | URL |
|--------|-----|
| **Dashboard** | https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai |
| **Authenticate** | https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login |
| **Check Status** | https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/auth/status |
| **Sheets Links Tab** | https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai (then click "Sheets Links") |

---

## 📊 **Expected Data (After Authentication):**

### **Invoice Summary CSV:**
```csv
Metric,Count,Amount
Draft Invoices,6,8792.27
Awaiting Payment,48,83239.41
Overdue,38,63313.81
Total Invoices,54,91031.68
```

### **Clients Awaiting Payment CSV:**
```csv
Company Name,Number of Invoices,Total Outstanding
Milvue,X,17214.96
Duorooq Engineering,X,10941.77
HSSDR,X,8181.12
CONNECT INNOV,X,7995.30
Finance Montreal,X,6096.60
...
TOTAL,48,83239.41
```

---

## ✅ **Status: READY TO USE**

- ✅ Credentials configured (hardcoded in `.dev.vars`)
- ✅ OAuth endpoints working
- ✅ Gershon Consulting LLC filter active
- ✅ All 6 export endpoints ready
- ✅ URLs are exact (no variables)
- ⏳ **You need to authenticate once** (30 seconds)

---

**Next Step:** 
👉 **Click here to authenticate:** https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

Then use any of the 6 IMPORTDATA formulas above! 🚀
