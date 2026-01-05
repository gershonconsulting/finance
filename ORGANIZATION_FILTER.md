# Organization Filter - Gershon Consulting LLC Only

## 🎯 Configuration

The application is configured to extract data **ONLY** from:

### **Gershon Consulting LLC**

All other organizations are ignored, even if you authorize them during OAuth.

---

## 🔧 How It Works

### During OAuth Authorization:

When you click "Connect to Xero" and authorize, you may see multiple organizations:
- ✅ **Gershon Consulting LLC** (THIS ONE IS USED)
- ❌ Gershon Consulting (ignored)
- ❌ Demo Company (US) (ignored)

### After Authorization:

The application will:
1. Retrieve the list of authorized organizations
2. **Filter for "Gershon Consulting LLC" specifically**
3. Use ONLY that organization's tenant ID
4. Pull ALL data from Gershon Consulting LLC
5. Ignore data from other organizations completely

---

## 📊 What Data Is Collected (Gershon Consulting LLC Only)

All data comes from **Gershon Consulting LLC** organization:

### Invoice Data:
- Draft invoices and amounts
- Awaiting payment invoices and amounts
- Overdue invoices and amounts
- Total invoice counts

### Client Data:
- Company names (clients of Gershon Consulting LLC)
- Outstanding amounts per client
- Invoice counts per client
- Sorted by highest outstanding

### Financial Reports:
- Profit & Loss for Gershon Consulting LLC
- Balance Sheet for Gershon Consulting LLC
- Bank Transactions for Gershon Consulting LLC

### Expected Top Clients (from your screenshot):
1. Milvue
2. Duorooq Engineering
3. HSSDR
4. CONNECT INNOV
5. Finance Montreal

All these are clients of **Gershon Consulting LLC**.

---

## ✅ Expected Results After Authentication

### Dashboard Will Show:
```
Organization: Gershon Consulting LLC
Total Invoices: 54
Draft: $8,792.27 (6)
Awaiting Payment: $83,239.41 (48)
Overdue: $63,313.81 (38)
```

### Clients Tab Will Show:
```
Clients of Gershon Consulting LLC:
────────────────────────────────────────
Milvue                    $17,214.96
Duorooq Engineering       $10,941.77
HSSDR                     $8,181.12
CONNECT INNOV             $7,995.30
Finance Montreal          $6,096.60
(... more clients ...)
────────────────────────────────────────
TOTAL                     $83,239.41
```

### Google Sheets CSV:
```csv
Company Name,Number of Invoices,Total Outstanding
Milvue,X,17214.96
Duorooq Engineering,X,10941.77
HSSDR,X,8181.12
...
TOTAL,48,83239.41
```

All data is from **Gershon Consulting LLC** clients only.

---

## 🔍 Technical Implementation

### Code Location:
`src/services/xero-oauth.ts` - `getTenantId()` method

### Filter Logic:
```typescript
// Filter for "Gershon Consulting LLC" organization only
const gershonOrg = connections.find((conn: any) => 
  conn.tenantName === 'Gershon Consulting LLC'
);

if (!gershonOrg) {
  console.log('Available organizations:', connections.map((c: any) => c.tenantName));
  throw new Error('Gershon Consulting LLC organization not found.');
}

return gershonOrg.tenantId;
```

### What Happens:
1. After OAuth, Xero returns all authorized organizations
2. Code searches for exact match: `tenantName === 'Gershon Consulting LLC'`
3. If found, uses that organization's tenant ID
4. If NOT found, throws an error with list of available organizations
5. All subsequent API calls use only that tenant ID

---

## ⚠️ Important Notes

### Organization Name Must Match Exactly:
- ✅ **"Gershon Consulting LLC"** (with LLC)
- ❌ "Gershon Consulting" (without LLC)
- ❌ "gershon consulting llc" (wrong case)

The name must match EXACTLY as it appears in Xero.

### During Authorization:
When you see the authorization screen with multiple organizations:
- You CAN select all 3 organizations ("Continue with 3 organisations")
- The app will automatically filter for Gershon Consulting LLC
- Other organizations will be ignored

### If Organization Not Found:
If you see an error like:
```
Gershon Consulting LLC organization not found
```

This means:
1. You didn't authorize Gershon Consulting LLC during OAuth
2. The organization name in Xero is different
3. Check the console logs to see available organization names

---

## 🚀 How to Connect

### Step 1: Start OAuth
Click: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

### Step 2: Authorize Organizations
On Xero's authorization page:
- You'll see multiple organizations listed
- **Ensure "Gershon Consulting LLC" is included**
- Click "Continue with 3 organisations" (or however many are shown)

### Step 3: Automatic Filtering
- Application receives authorization for all selected organizations
- **Automatically filters for "Gershon Consulting LLC"**
- Uses only that organization's data
- Ignores other organizations

### Step 4: Success!
- Dashboard shows Gershon Consulting LLC data
- Clients tab shows clients of Gershon Consulting LLC
- All amounts and invoices are from that organization only

---

## 📊 Data Sources (All from Gershon Consulting LLC)

### Invoices:
- All invoices in DRAFT, AUTHORISED, PAID status
- From Gershon Consulting LLC organization only

### Clients:
- All contacts with outstanding invoices
- From Gershon Consulting LLC organization only
- Examples: Milvue, Duorooq Engineering, HSSDR, etc.

### Financial Reports:
- Profit & Loss report for Gershon Consulting LLC
- Balance Sheet for Gershon Consulting LLC
- Bank transactions for Gershon Consulting LLC

### Bank Transactions:
- All RECEIVE and SPEND transactions
- From Gershon Consulting LLC bank accounts only

---

## ✅ Verification Checklist

After authentication, verify:

- [ ] Dashboard header shows organization name (if displayed)
- [ ] Invoice totals match Gershon Consulting LLC in Xero
- [ ] Client names are recognizable (Milvue, Duorooq, etc.)
- [ ] Amounts match your Xero dashboard screenshot
- [ ] No data from other organizations appears
- [ ] Google Sheets URLs return Gershon Consulting LLC clients only

---

## 🔧 Troubleshooting

### Issue: "Organization not found" error

**Solution 1**: Check the exact organization name in Xero
1. Log in to Xero
2. Switch organizations (top-right corner)
3. Verify the exact name of the organization you want
4. If it's NOT "Gershon Consulting LLC", let me know the exact name

**Solution 2**: Ensure you authorized the correct organization
1. During OAuth, make sure you select Gershon Consulting LLC
2. Click "Continue" to authorize

### Issue: Seeing data from wrong organization

**Check tenant ID in logs:**
```bash
pm2 logs xero-reports-webapp --nostream | grep "Using organization"
```

Should show:
```
Using organization: Gershon Consulting LLC Tenant ID: xxxx-xxxx-xxxx
```

### Issue: Want to change to a different organization

**Update the filter:**
1. Edit `src/services/xero-oauth.ts`
2. Change `'Gershon Consulting LLC'` to your desired organization name
3. Rebuild: `npm run build`
4. Restart: `pm2 restart xero-reports-webapp`

---

## 📖 Related Documentation

- [EXPECTED_REAL_DATA.md](./EXPECTED_REAL_DATA.md) - Expected data from Gershon Consulting LLC
- [READY_TO_USE.md](./READY_TO_USE.md) - How to authenticate and use
- [SECURITY_CREDENTIALS.md](./SECURITY_CREDENTIALS.md) - Security information

---

## 🎯 Summary

**Configuration**: Extracts data from **Gershon Consulting LLC ONLY**

**What You'll See**:
- Invoices: Draft, Awaiting Payment, Overdue (from Gershon Consulting LLC)
- Clients: Milvue, Duorooq Engineering, HSSDR, etc. (clients of Gershon Consulting LLC)
- Reports: P&L, Balance Sheet (for Gershon Consulting LLC)
- Transactions: Bank transactions (for Gershon Consulting LLC)

**Other Organizations**: Completely ignored, even if authorized

**Ready to Connect**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

---

**Last Updated**: 2026-01-05  
**Organization**: Gershon Consulting LLC  
**Status**: Configured and ready to use

**Connect now to see your Gershon Consulting LLC data!** 🚀
