# Xero Authentication Guide

## 🎯 How to Connect Your Real Xero Data

Your web app is now configured to use **real Xero API data** from your account. Follow these steps to authenticate:

---

## ✅ Quick Start (3 Steps)

### **Step 1: Open the Dashboard**
Visit your live dashboard:
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
```

### **Step 2: Click "Connect to Xero"**
You'll see a green button in the top-right corner that says **"Connect to Xero"**. Click it.

### **Step 3: Authorize the App**
- You'll be redirected to Xero's login page
- Sign in with your Xero credentials
- Select your organization
- Click **"Allow access"** to authorize the app
- You'll be redirected back to the dashboard

---

## 🎉 That's It!

Once authenticated, your dashboard will:
- ✅ Show **"Connected to Xero"** status (green checkmark)
- ✅ Load **real invoices, transactions, and reports** from your Xero account
- ✅ Provide **live data** in all export URLs for Google Sheets

---

## 📊 Using Real Data with Google Sheets

After authentication, your IMPORTDATA URLs will return **real Xero data**:

### **Clients Awaiting Payment (Real Data)**
```
=IMPORTDATA("https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment")
```

This will show:
- Real company names from your Xero contacts
- Actual invoice counts per client
- Real outstanding amounts
- Only clients with `AmountDue > 0`

---

## 🔐 OAuth Configuration (Already Set Up)

Your app is pre-configured with these Xero OAuth credentials:

```
Client ID: 0CA378B164364DB0821A6014520913E6
Client Secret: 1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
Redirect URI: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

**Scopes Requested:**
- `accounting.reports.read` - Read financial reports (P&L, Balance Sheet)
- `accounting.transactions.read` - Read invoices and bank transactions
- `accounting.contacts.read` - Read client/customer information
- `accounting.settings.read` - Read organization settings
- `offline_access` - Refresh tokens for long-term access

---

## 🔄 Session Management

- **Session Token**: Stored in browser's `localStorage` as `xero_session`
- **Token Refresh**: Automatically refreshes access tokens when they expire
- **Logout**: Clear browser data to disconnect

---

## 🐛 Troubleshooting

### **"Demo Mode" Still Shows After Authentication**
1. Clear your browser cache and cookies
2. Close all browser tabs with the app
3. Open a new tab and visit the dashboard
4. Click "Connect to Xero" again

### **"Authentication Error" on Callback**
1. Verify your Xero credentials are correct
2. Ensure your organization is active in Xero
3. Check that your Xero subscription includes API access
4. Contact Xero support if the issue persists

### **Data Not Loading**
1. Check that you clicked "Allow access" during OAuth
2. Refresh the page (press F5 or Ctrl+R)
3. Click the "Refresh" button in the top-right corner
4. Check browser console for errors (F12 → Console tab)

---

## 📝 API Endpoints Reference

### **With Authentication (Real Data)**
All these endpoints require a valid Xero session:

- `GET /api/invoices/summary` - Dashboard statistics
- `GET /api/invoices?status=AUTHORISED` - Filtered invoices
- `GET /api/export/clients-awaiting-payment` - Clients with outstanding invoices
- `GET /api/export/invoices` - All invoices CSV
- `GET /api/export/transactions` - Bank transactions CSV
- `GET /api/export/profit-loss` - P&L report CSV
- `GET /api/export/balance-sheet` - Balance Sheet CSV

### **Without Authentication (Demo Data)**
- `GET /api/demo/summary` - Sample invoice statistics
- `GET /api/demo/clients-awaiting-payment` - Sample clients

---

## 🚀 Next Steps

1. **Authenticate** by clicking "Connect to Xero"
2. **Verify** real data loads in the Dashboard tab
3. **Test** the Clients tab to see real clients awaiting payment
4. **Copy** the IMPORTDATA URLs from the "Sheets Links" tab
5. **Import** into Google Sheets to analyze your data

---

## 🔗 Important URLs

- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **OAuth Login**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
- **Auth Status**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/auth/status

---

## ⚠️ Security Notes

- **Never share** your session token or OAuth credentials
- **Do not commit** `.dev.vars` file to version control (already in `.gitignore`)
- **Tokens expire** after 30 minutes (automatically refreshed)
- **Revoke access** anytime at https://app.xero.com/settings/connections

---

**Ready to get started? Click the "Connect to Xero" button now!** 🎉
