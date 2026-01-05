# Fix Your Xero App Configuration

Based on your screenshot, here's what needs to be fixed:

---

## 🔴 Current Issues

### **1. Wrong Redirect URI**
**Current:** `https://www.gershonconsulting.com`  
**Problem:** This is your company website, not the OAuth callback URL

**Needed:** `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback`

---

## ✅ Step-by-Step Fix

### **Step 1: Open Your Xero App**

You're already here! This is the configuration page.

### **Step 2: Fix Redirect URIs**

**Option A: Replace existing URI**
1. Click on the existing URI: `https://www.gershonconsulting.com`
2. Delete it or edit it
3. Replace with: `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback`
4. Click "Save"

**Option B: Add new URI (keep existing)**
1. Click **"Add another URI"**
2. Paste: `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback`
3. Click "Save"
4. (Optional) You can keep `https://www.gershonconsulting.com` for production use later

### **Step 3: Verify Configuration**

After saving, your config should show:

```
Redirect URIs:
• https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
• https://www.gershonconsulting.com (optional - for future use)

Client id:
0C••••••••••••••••••••••••••E6

Client secret 1:
Created at 2026-01-05T02:06:48.1371101Z UTC
```

### **Step 4: Test Connection**

1. Go to your dashboard: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
2. Go to **Settings** tab
3. Enter your credentials:
   - Client ID: `0C••••••••••••••••••••••••••E6` (your full ID)
   - Client Secret: (your generated secret from Jan 5, 2026)
4. Click "Save Configuration"
5. Click "Test Connection"
6. Should work now! ✅

---

## 🎯 What Each URI Does

### **OAuth Callback URI (Required for OAuth)**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```
- **Purpose**: Where Xero redirects after user authorizes
- **Used by**: The dashboard OAuth flow
- **Must match exactly**: Character-for-character

### **Your Company Website (Optional)**
```
https://www.gershonconsulting.com
```
- **Purpose**: Your main website
- **Used by**: Future production deployments (if you deploy to your domain)
- **Can keep**: Won't interfere with sandbox testing

---

## 📸 What Your Screen Should Look Like After Fix

```
┌────────────────────────────────────────────────────────────────┐
│ Redirect URIs                                                  │
├────────────────────────────────────────────────────────────────┤
│ https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback │
│ [Delete]                                                       │
├────────────────────────────────────────────────────────────────┤
│ https://www.gershonconsulting.com                              │
│ [Delete]                                                       │
├────────────────────────────────────────────────────────────────┤
│ [Add another URI]                                              │
└────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Common Mistakes to Avoid

❌ **Wrong:**
```
https://www.gershonconsulting.com
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/callback
```

✅ **Correct:**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

**Key Points:**
- Must include `/auth/callback` at the end
- Must use `https://` (not http://)
- No trailing slash after `callback`
- Must match EXACTLY

---

## 🧪 Testing After Fix

### **Test 1: From Dashboard**
1. Go to https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
2. Click "Connect to Xero" button
3. **Expected**: Xero login page appears
4. **Not expected**: Error page

### **Test 2: Complete OAuth Flow**
1. Sign in to Xero
2. Select your organization
3. Click "Allow access"
4. **Expected**: Redirect back to dashboard
5. **Expected**: See "Connected to Xero" status
6. **Expected**: Real data loads

### **Test 3: Verify Real Data**
1. Go to "Clients" tab
2. Click "Load Clients"
3. **Expected**: Real clients from your Xero account
4. **Expected**: Actual amounts owed
5. **Not expected**: Demo data

---

## 🔧 Using Settings Page

After fixing Redirect URI in Xero:

1. **Open Settings** tab in dashboard
2. **Enter your credentials:**
   ```
   Client ID: 0C••••••••••••••••••••••••••E6
   Client Secret: [your secret from Jan 5, 2026]
   ```
3. **Redirect URI** will auto-populate:
   ```
   https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
   ```
4. **Click "Save Configuration"**
5. **Click "Test Connection"**
6. Should redirect to Xero and work! ✅

---

## 🆘 Still Having Issues?

### **If you see "unauthorized_client" error:**
- ✅ Double-check Redirect URI is EXACT match
- ✅ Make sure you clicked "Save" in Xero app
- ✅ Wait 30 seconds for changes to propagate
- ✅ Try in incognito mode
- ✅ Clear browser cache

### **If you see "invalid_client" error:**
- ✅ Check Client Secret is correct
- ✅ Generate new secret if needed
- ✅ Update secret in Settings page

### **If redirect loop:**
- ✅ Clear localStorage: `localStorage.clear()`
- ✅ Close all dashboard tabs
- ✅ Open fresh dashboard tab
- ✅ Try connecting again

---

## 📞 Need Help?

### **Quick Links**
- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **Settings**: Click "Settings" tab
- **Xero Apps**: https://developer.xero.com/myapps
- **Xero Support**: https://developer.xero.com/contact-us

### **Documentation**
- **REDIRECT_URI_FIX.md**: Complete redirect URI troubleshooting
- **SETTINGS_GUIDE.md**: Full settings configuration guide
- **XERO_AUTHENTICATION_GUIDE.md**: OAuth flow explanation

---

## ✅ Success Checklist

After fixing, you should have:

- [x] Redirect URI added to Xero app
- [x] Redirect URI matches dashboard callback URL exactly
- [x] "Save" clicked in Xero app settings
- [x] Client ID and Secret entered in dashboard Settings
- [x] "Save Configuration" clicked in dashboard
- [x] "Connect to Xero" shows Xero login (not error)
- [x] OAuth authorization completes successfully
- [x] Dashboard shows "Connected to Xero" status
- [x] Real data loads in Clients tab
- [x] Google Sheets URLs return real data

---

**Fix: Replace `https://www.gershonconsulting.com` with the callback URL in your Xero app!** 🚀
