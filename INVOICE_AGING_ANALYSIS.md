# Invoice Aging Analysis - 3 Groups

## 📊 **Overview**

The Invoice Aging Analysis categorizes all outstanding invoices (Awaiting Payment) into **3 strategic groups** based on how many days old they are:

### **The 3 Aging Groups:**

| Group | Age Range | Description | Icon |
|-------|-----------|-------------|------|
| **🟢 CURRENT** | 0-99 days | Recent invoices in normal collection period | ✅ Good standing |
| **🟡 AGED** | 100-199 days | Older invoices requiring focused attention | ⚠️ Needs follow-up |
| **🔴 CRITICAL** | 200+ days | Legal negotiation stage | 🚨 Legal action |

---

## 🎯 **Why These 3 Groups?**

### **🟢 CURRENT (0-99 days old)**
- **Status**: Normal collection period
- **Action**: Standard follow-up procedures
- **Risk Level**: Low
- **Typical Payment**: Within 30-90 days of invoice date

### **🟡 AGED (100-199 days old)**
- **Status**: Requires attention
- **Action**: Escalated reminders, phone calls, payment plans
- **Risk Level**: Medium
- **Strategy**: Negotiate payment arrangements before escalation

### **🔴 CRITICAL (200+ days old)**
- **Status**: Legal negotiation stage
- **Action**: Legal demand letters, attorney involvement, collections
- **Risk Level**: High
- **Strategy**: Formal legal proceedings or settlement negotiations

---

## 📋 **How to Use in Google Sheets**

### **IMPORTDATA Formula:**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices-by-aging")
```

### **What You'll See (CSV Format):**
```csv
Category,Age Range,Invoice Count,Total Outstanding
CURRENT,0-99 days,15,25000.00
AGED,100-199 days,20,35000.00
CRITICAL,200+ days (Legal),13,23239.41
TOTAL,All Ages,48,83239.41
```

---

## 💡 **Example: Using Your Real Data**

Based on your Gershon Consulting LLC data (Total: $83,239.41, 48 invoices), the breakdown might look like:

### **Scenario Example:**

| Category | Age Range | Count | Amount | % of Total | Action Priority |
|----------|-----------|-------|--------|------------|----------------|
| 🟢 CURRENT | 0-99 days | 15 | $25,000 | 30% | ✅ Standard follow-up |
| 🟡 AGED | 100-199 days | 20 | $35,000 | 42% | ⚠️ **Escalate now** |
| 🔴 CRITICAL | 200+ days | 13 | $23,239 | 28% | 🚨 **Legal action** |
| **TOTAL** | All Ages | **48** | **$83,239** | 100% | |

---

## 📊 **How Aging is Calculated**

The system calculates aging from the **Invoice Date** (not Due Date):

```
Days Old = Today's Date - Invoice Date
```

### **Example:**
- **Invoice Date**: January 5, 2024
- **Today's Date**: January 5, 2026
- **Days Old**: 730 days
- **Category**: 🔴 CRITICAL (200+ days)

---

## 🔍 **API Endpoints**

### **1. JSON API (for developers)**
```
GET https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/invoices/by-aging
```

**Response:**
```json
{
  "current": {
    "count": 15,
    "total": 25000.00,
    "invoices": [ /* array of invoice objects */ ]
  },
  "aged": {
    "count": 20,
    "total": 35000.00,
    "invoices": [ /* array of invoice objects */ ]
  },
  "critical": {
    "count": 13,
    "total": 23239.41,
    "invoices": [ /* array of invoice objects */ ]
  }
}
```

### **2. CSV Export (for Google Sheets)**
```
GET https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices-by-aging
```

**Response:**
```csv
Category,Age Range,Invoice Count,Total Outstanding
CURRENT,0-99 days,15,25000.00
AGED,100-199 days,20,35000.00
CRITICAL,200+ days (Legal),13,23239.41
TOTAL,All Ages,48,83239.41
```

---

## 📈 **Strategic Use Cases**

### **1. Collections Priority Matrix**
Use aging to prioritize collection efforts:

| Priority | Group | Strategy |
|----------|-------|----------|
| 🔴 **HIGH** | CRITICAL | Legal demand letters, attorney involvement |
| 🟡 **MEDIUM** | AGED | Payment plans, escalated calls, settlement offers |
| 🟢 **LOW** | CURRENT | Standard reminders, email follow-ups |

### **2. Cash Flow Forecasting**
- **CURRENT**: High likelihood of collection within 30-60 days
- **AGED**: Moderate likelihood, may require payment plans
- **CRITICAL**: Low likelihood, may result in write-offs or settlements

### **3. Financial Reporting**
- Track aging trends month-over-month
- Set internal thresholds (e.g., keep CRITICAL below 15% of total)
- Report to stakeholders on collection effectiveness

### **4. Legal Decision Making**
- **CRITICAL group** → Automatic trigger for legal review
- Determine which accounts warrant legal action vs. write-off
- Track legal negotiation outcomes

---

## 🎨 **Google Sheets Dashboard Ideas**

### **Option 1: Simple Summary**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices-by-aging")
```

### **Option 2: With Charts**
1. Import the aging data into Sheet1
2. Create a pie chart showing distribution by category
3. Create a bar chart showing amounts by aging group
4. Add conditional formatting:
   - 🟢 Green for CURRENT
   - 🟡 Yellow for AGED
   - 🔴 Red for CRITICAL

### **Option 3: Combined Dashboard**
```
Sheet "Overview":
=IMPORTDATA("...invoices-by-aging")

Sheet "Clients":
=IMPORTDATA("...clients-awaiting-payment")

Sheet "Details":
=IMPORTDATA("...invoices")
```

Then use formulas to cross-reference:
- Which clients are in the CRITICAL category?
- What's the average aging per client?
- Which aging group has the most clients?

---

## ⚠️ **Important Notes**

### **1. Authentication Required**
Like all export endpoints, this requires you to authenticate first:
👉 https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

### **2. Real Data from Gershon Consulting LLC**
The app filters to only show data from **Gershon Consulting LLC** (your company).

### **3. Only Counts AUTHORISED Invoices**
- Only invoices with status "AUTHORISED" (awaiting payment) are included
- DRAFT invoices are excluded
- PAID invoices are excluded

### **4. Aging Based on Invoice Date**
- Calculation uses **Invoice Date**, not Due Date
- This shows the true age of the invoice
- More accurate for legal purposes

---

## 🚀 **Quick Start**

### **Step 1: Authenticate (if not already)**
Click: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

### **Step 2: Open Google Sheets**
Create a new sheet or open existing

### **Step 3: Paste Formula**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/invoices-by-aging")
```

### **Step 4: View Your Data**
You'll see:
- 🟢 CURRENT: X invoices, $XX,XXX.XX
- 🟡 AGED: X invoices, $XX,XXX.XX
- 🔴 CRITICAL: X invoices, $XX,XXX.XX
- TOTAL: XX invoices, $XX,XXX.XX

---

## 📞 **Next Steps**

### **For CRITICAL Invoices (200+ days):**
1. Review each invoice in this group
2. Determine if legal action is warranted
3. Send formal demand letters
4. Engage collection attorneys if needed
5. Consider settlement negotiations

### **For AGED Invoices (100-199 days):**
1. Make direct phone calls to clients
2. Offer payment plans
3. Send escalated reminder emails
4. Document all communication
5. Set internal deadline before moving to CRITICAL

### **For CURRENT Invoices (0-99 days):**
1. Continue standard follow-up procedures
2. Monitor closely to prevent moving to AGED
3. Send reminder emails at 30, 60, 90 days

---

## 📖 **Related Documentation**

- **[GOOGLE_SHEETS_EXACT_URLS.md](./GOOGLE_SHEETS_EXACT_URLS.md)** - All 7 Google Sheets URLs
- **[READY_FOR_GOOGLE_SHEETS.md](./READY_FOR_GOOGLE_SHEETS.md)** - Quick start guide
- **[EXPECTED_REAL_DATA.md](./EXPECTED_REAL_DATA.md)** - Sample data from your account
- **[README.md](./README.md)** - Project overview

---

## ✅ **Status**

- ✅ API endpoint created: `/api/invoices/by-aging`
- ✅ CSV export endpoint: `/api/export/invoices-by-aging`
- ✅ Added to Sheets Links tab
- ✅ Gershon Consulting LLC filter active
- ✅ Documentation complete
- ⏳ Awaiting your authentication to pull real data

---

**Ready to use!** Just authenticate and start analyzing your invoice aging! 🎉
