# 📊 Payment Metrics Guide - New Columns

## 🆕 **2 New Columns Added to Clients Awaiting Payment**

### **Overview**

The **Clients Awaiting Payment** export now includes **5 columns** (was 3):

| Column | Description | Example |
|--------|-------------|---------|
| **Company Name** | Client/customer name | Milvue |
| **Number of Invoices** | Count of outstanding invoices | 3 |
| **Total Outstanding** | Amount owed right now | $17,214.96 |
| **Avg Payment Delay (days)** | 🆕 Average days late they pay | 81 days |
| **Total Paid Overall** | 🆕 Historical payments | $125,000.00 |

---

## 📈 **Column 4: Average Payment Delay (days)**

### **What It Shows:**
How many days **on average** this client pays **after** the due date.

### **How It's Calculated:**

**For clients with payment history:**
1. Look at all **PAID** invoices from this client
2. For each paid invoice: `Payment Date - Due Date = Delay`
3. Average all positive delays (late payments only)
4. Round to nearest day

**For new clients (no payment history):**
1. Look at **current outstanding** invoices
2. For each: `Today's Date - Due Date = Current Delay`
3. Average all positive delays
4. Round to nearest day

### **Example: Milvue (81 days)**

```
Invoice History:
- Invoice #101: Due Jan 1, Paid Mar 22 → 80 days late
- Invoice #102: Due Feb 1, Paid Apr 25 → 83 days late
- Invoice #103: Due Mar 1, Paid May 20 → 80 days late

Average: (80 + 83 + 80) / 3 = 81 days
```

### **Interpretation:**

| Delay | Status | Meaning |
|-------|--------|---------|
| **0-30 days** | 🟢 Good | Pays relatively on time |
| **31-60 days** | 🟡 Moderate | Needs reminders |
| **61-90 days** | 🟠 Poor | Requires escalation |
| **91+ days** | 🔴 Critical | High risk, consider credit hold |

### **Use Cases:**

1. **Credit Decisions**: 
   - 81 days delay → Don't extend more credit
   - Require upfront payment for new work

2. **Cash Flow Forecasting**:
   - Milvue invoice due Jan 1? Expect payment ~Mar 22 (81 days later)
   - Adjust cash flow projections accordingly

3. **Collections Priority**:
   - High delay clients get more frequent follow-ups
   - Set automated reminders earlier

4. **Client Risk Assessment**:
   - Red flag: Increasing delay trend over time
   - Green flag: Decreasing delay (improving)

---

## 💰 **Column 5: Total Paid Overall**

### **What It Shows:**
The **total amount** this client has **ever paid** you (across all invoices, all time).

### **How It's Calculated:**

```
Total Paid = Sum of all AmountPaid from ALL invoices for this client
```

This includes:
- ✅ Fully paid invoices (Status: PAID)
- ✅ Partially paid invoices (AmountPaid > 0)
- ✅ Historical invoices (not just current)

### **Example: Milvue**

```
All Invoices (Historical):
- Invoice #101: Total $10,000, Paid $10,000 ✅
- Invoice #102: Total $15,000, Paid $15,000 ✅
- Invoice #103: Total $20,000, Paid $20,000 ✅
- Invoice #104: Total $25,000, Paid $5,000 (Partial)
- Invoice #105: Total $30,000, Paid $0 (Outstanding)
- Invoice #106: Total $17,214.96, Paid $0 (Outstanding)

Total Paid Overall: $10,000 + $15,000 + $20,000 + $5,000 = $50,000
Total Outstanding: $25,000 + $30,000 + $17,214.96 = $72,214.96
```

### **Use Cases:**

1. **Relationship Value**:
   - Milvue paid $125,000 → High-value client worth keeping
   - Consider tolerance for payment delays

2. **Risk vs. Reward**:
   - Outstanding: $17,214.96
   - Paid Overall: $125,000
   - Risk: 13.7% of total relationship value
   - Decision: Worth pursuing aggressively

3. **Client Lifetime Value (CLV)**:
   - Track revenue per client
   - Identify top revenue generators
   - Focus retention efforts

4. **Negotiation Leverage**:
   - "You've paid us $125,000 over the years"
   - "This $17k is a small portion of our relationship"
   - Stronger position in collections discussions

5. **Credit Limit Decisions**:
   - High Total Paid + Low Delay → Increase credit limit
   - High Total Paid + High Delay → Maintain or reduce limit
   - Low Total Paid + High Delay → No more credit

---

## 📊 **Combined Analysis: Delay + Total Paid**

### **Client Segmentation Matrix:**

| Segment | Delay | Total Paid | Strategy |
|---------|-------|------------|----------|
| **VIP** | Low (0-30d) | High (>$100k) | ⭐ Maintain relationship |
| **Risky VIP** | High (90+d) | High (>$100k) | ⚠️ Escalate but preserve |
| **Growing** | Low (0-30d) | Medium ($10k-$100k) | 🌱 Encourage growth |
| **Problem** | High (90+d) | Low (<$10k) | 🚨 Consider dropping |

### **Example Matrix Using Your Data:**

```
Client                    Delay    Total Paid    Outstanding    Segment
─────────────────────────────────────────────────────────────────────────
Milvue                    81d      $125,000      $17,214       Risky VIP
Duorooq Engineering       45d      $89,000       $10,941       Growing
HSSDR                     120d     $15,000       $8,181        Problem
CONNECT INNOV             95d      $42,000       $7,995        Risky
Finance Montreal          25d      $180,000      $6,096        VIP
```

### **Strategic Actions:**

**Milvue (Risky VIP):**
- Status: High value ($125k paid) but slow payer (81d)
- Action: 
  - Send personalized reminder (not generic)
  - Offer payment plan for $17k
  - Require 50% upfront on next project
  - Schedule quarterly check-in calls

**HSSDR (Problem):**
- Status: Low value ($15k paid) and very slow (120d)
- Action:
  - Send final demand letter
  - Consider legal action for $8k
  - Place on credit hold
  - Require 100% upfront payment

**Finance Montreal (VIP):**
- Status: High value ($180k paid) and fast payer (25d)
- Action:
  - Thank you note
  - Offer extended terms (Net 60)
  - Priority support
  - Cross-sell opportunities

---

## 📈 **Google Sheets Formulas**

### **Example CSV Output:**
```csv
Company Name,Number of Invoices,Total Outstanding,Avg Payment Delay (days),Total Paid Overall
Milvue,3,17214.96,81,125000.00
Duorooq Engineering,2,10941.77,45,89000.00
HSSDR,1,8181.12,120,15000.00
CONNECT INNOV,1,7995.30,95,42000.00
Finance Montreal,1,6096.60,25,180000.00
TOTAL,48,83239.41,73,2450000.00
```

### **Useful Google Sheets Formulas:**

**1. Calculate Risk Ratio:**
```
=C2/E2  // Outstanding ÷ Total Paid
```
Example: Milvue = $17,214.96 / $125,000 = 13.7% risk

**2. Segment Clients:**
```
=IF(AND(D2<31,E2>100000),"VIP",
  IF(AND(D2>90,E2>100000),"Risky VIP",
  IF(AND(D2<31,E2>10000),"Growing","Problem")))
```

**3. Priority Score (lower = higher priority):**
```
=D2 * (C2/E2) * 100
```
Combines delay and risk ratio

**4. Conditional Formatting:**
- Delay < 30: Green
- Delay 31-60: Yellow
- Delay 61-90: Orange
- Delay 91+: Red

---

## 🎯 **Action Plan Based on Metrics**

### **Weekly Review Process:**

**Monday Morning:**
1. Open Google Sheets with Clients Awaiting Payment data
2. Sort by "Avg Payment Delay (days)" DESC (highest first)
3. Review top 10 slowest payers

**For Each Client:**
1. Check **Total Paid Overall** → Is this a valuable client?
2. Check **Total Outstanding** → How much is at risk?
3. Decide action:
   - Risky VIP → Personal call from senior manager
   - Problem → Escalate to legal
   - Growing → Standard reminder email

**Thursday Follow-up:**
1. Track responses from Monday outreach
2. Update internal notes
3. Adjust credit limits as needed

---

## 📊 **Example Use Case: Milvue**

### **Scenario:**
- **Total Outstanding**: $17,214.96
- **Avg Payment Delay**: 81 days
- **Total Paid Overall**: $125,000

### **Analysis:**

**Positive Factors:**
- ✅ High total paid ($125k) → Valuable client
- ✅ Risk ratio: 13.7% (low)
- ✅ Consistent payer (just slow)

**Negative Factors:**
- ❌ 81-day delay (poor)
- ❌ Pattern of late payment
- ❌ Cash flow impact

### **Recommended Action:**

**Short-term (This Week):**
1. Personal email from account manager
2. "We value your $125k relationship"
3. Offer payment plan: $8,600 now, $8,614 in 30 days
4. Set follow-up call for Friday

**Medium-term (Next Quarter):**
1. Implement milestone billing on next project
2. Require 25% upfront payment
3. Invoice every 2 weeks (not monthly)
4. Set up automated reminders at day 15, 30, 45

**Long-term (Next Year):**
1. Offer 2% discount for payment within 15 days
2. Penalty: 1.5% monthly interest after 45 days
3. Update contract terms
4. Quarterly business review meetings

---

## ✅ **Summary**

### **New Columns:**
1. **Avg Payment Delay (days)**: How late they pay
2. **Total Paid Overall**: Lifetime value

### **Benefits:**
- ✅ Better credit decisions
- ✅ Accurate cash flow forecasting
- ✅ Risk-based client segmentation
- ✅ Data-driven collections strategy
- ✅ Identify high-value vs. problem clients

### **Access:**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")
```

### **Next Steps:**
1. Authenticate: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
2. Import to Google Sheets
3. Analyze your top 10 clients by delay
4. Create segmentation strategy
5. Implement credit policies

---

**Your payment data now tells a complete story: Who pays slow, who pays much, and how to manage each relationship!** 🎉
