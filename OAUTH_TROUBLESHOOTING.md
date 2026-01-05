# OAuth Troubleshooting Guide - "invalid_client" Error Fix

## Quick Fix (2 Minutes)

**You're seeing "invalid_client" errors. Here's the fastest solution:**

### Option 1: Reset & Connect Page (RECOMMENDED)
1. Open: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/reset-connect
2. Click the blue button: **"Clear Settings & Connect to Xero"**
3. Authorize on Xero's page
4. Done! ✅

### Option 2: Direct Login Link
Simply click this link:
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

This bypasses any saved settings and uses the correct credentials.

---

## Understanding the Problem

### What's Happening?
When you see this error:
```
Error exchanging code for token: 
{"error":"invalid_client"}
```

**Root Cause**: The Client Secret stored in your browser's Settings doesn't match the actual secret in your Xero app.

### Why It Happens
1. You entered credentials in the **Settings** tab
2. Those credentials were saved to browser localStorage
3. When you click "Connect to Xero", the app uses those **saved** credentials
4. During token exchange, Xero rejects them because the Client Secret is wrong
5. Result: `{"error":"invalid_client"}`

### The Client Secret Issue
In your Xero app configuration, you see:
```
Client secret 1
Created at 2026-01-05T02:06:48.1371101Z UTC
```

**Important**: This date is NOT the secret! The actual secret looks like:
```
1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
```

The secret is only shown ONCE when you click "Generate a secret" in Xero. If you didn't save it, you cannot retrieve it.

---

## Solutions

### Solution 1: Use Reset & Connect Page (Fastest)

**This is the easiest and fastest solution:**

1. **Open the Reset Page**:
   ```
   https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/reset-connect
   ```

2. **Click "Clear Settings & Connect to Xero"**
   - This clears any incorrect credentials from your browser
   - Redirects to `/auth/login` which uses environment variables
   - Those environment variables contain the CORRECT credentials

3. **Authorize**
   - Xero's login page appears
   - Choose your organization (e.g., "Gershon Consulting")
   - Click "Continue with 3 organisations"

4. **Success!**
   - Redirected back to dashboard
   - See "Connected to Xero" ✅
   - Real data loads automatically

**Why This Works**: 
- Clears bad credentials from browser
- Uses pre-configured working credentials from `.dev.vars`
- Bypasses the Settings page entirely

---

### Solution 2: Use Direct Login Link

**Even simpler - just click this link:**

https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

This link goes directly to the `GET /auth/login` endpoint which:
- Ignores any saved Settings
- Uses environment variables (correct credentials)
- Redirects to Xero OAuth immediately

**Steps:**
1. Click the link above
2. Authorize on Xero
3. Done!

---

### Solution 3: Generate New Xero Secret

**If you want to use your own credentials properly:**

1. **Generate New Secret in Xero**:
   - Go to: https://developer.xero.com/myapps
   - Open your app (Client ID ending in `E6`)
   - Scroll to "Client secret 1"
   - Click **"Generate another secret"**
   - **IMMEDIATELY COPY** the secret (shown only once!)
   - Store it securely (password manager recommended)

2. **Enter in Dashboard Settings**:
   - Go to: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
   - Click **Settings** tab
   - Enter:
     - Client ID: `0CA378B164364DB0821A6014520913E6`
     - Client Secret: (paste your NEW secret)
     - Redirect URI: (already filled, read-only)
   - Click **"Save Configuration"**
   - Click **"Connect to Xero"**

3. **Authorize**:
   - Xero page appears
   - Authorize
   - Connected! ✅

---

## Technical Details

### OAuth Flow

**Normal Flow (with Settings):**
```
User clicks "Connect to Xero"
  ↓
Frontend reads clientId/clientSecret from localStorage
  ↓
POST /auth/login with custom credentials
  ↓
Credentials stored in temp session
  ↓
Redirect to Xero OAuth
  ↓
User authorizes
  ↓
Callback to /auth/callback?code=...
  ↓
Backend reads temp session credentials
  ↓
Exchange code for tokens using those credentials
  ↓
If credentials wrong → {"error":"invalid_client"}
```

**Reset & Connect Flow (WORKS):**
```
User clicks "Clear Settings & Connect"
  ↓
localStorage cleared
  ↓
Redirect to GET /auth/login (no POST)
  ↓
Backend uses env vars (correct credentials)
  ↓
Redirect to Xero OAuth
  ↓
User authorizes
  ↓
Callback to /auth/callback?code=...
  ↓
Backend uses env vars (correct credentials)
  ↓
Exchange code for tokens ✅
  ↓
Success! Connected!
```

### Environment Variables

The app has pre-configured working credentials in `.dev.vars`:
```bash
XERO_CLIENT_ID=0CA378B164364DB0821A6014520913E6
XERO_CLIENT_SECRET=1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
XERO_REDIRECT_URI=https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

These credentials:
- ✅ Are correct
- ✅ Match the Xero app configuration
- ✅ Work for OAuth token exchange
- ✅ Are used by `GET /auth/login` endpoint

### API Endpoints

1. **GET /auth/login** - Uses environment variables
   ```
   Uses: env.XERO_CLIENT_ID, env.XERO_CLIENT_SECRET, env.XERO_REDIRECT_URI
   Returns: 302 Redirect to Xero OAuth
   ```

2. **POST /auth/login** - Uses custom credentials
   ```
   Accepts: { clientId, clientSecret, redirectUri }
   Stores: Credentials in temp session
   Returns: { authUrl, state }
   ```

3. **GET /auth/callback** - Handles OAuth callback
   ```
   Reads: code, state from query params
   Checks: temp session for custom credentials
   Falls back: to environment variables if no custom creds
   Exchanges: code for access tokens
   Returns: Redirect to dashboard with session
   ```

---

## Verification Steps

### After Successful Connection

1. **Check Header Status**:
   - Header shows: "Connected to Xero" with green checkmark
   - Not: "Demo Mode" or "Not Connected"

2. **Check Dashboard**:
   - Real invoice statistics appear
   - Numbers match your actual Xero data
   - Not the demo data (ABC Corporation, XYZ Industries, etc.)

3. **Check Clients Tab**:
   - Real company names from your Xero contacts
   - Actual outstanding amounts
   - Real invoice counts

4. **Check API Endpoint**:
   ```bash
   curl -s 'https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/auth/status' | jq
   ```
   Should return:
   ```json
   {
     "authenticated": true,
     "tenantId": "your-real-tenant-id"
   }
   ```

5. **Check Google Sheets URL**:
   ```
   https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment
   ```
   Should return real CSV data with your actual clients

---

## Common Issues

### Issue 1: "Invalid redirect_uri"
**Error**: `{"error":"invalid_client","error_description":"Invalid redirect_uri"}`

**Fix**: Ensure your Xero app has this EXACT redirect URI:
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

Go to: https://developer.xero.com/myapps → Your app → OAuth 2.0 redirect URIs

### Issue 2: Still seeing "invalid_client" after reset
**Possible Causes**:
1. Browser cache not cleared
2. Old session still active
3. Cookies interfering

**Fix**:
1. Open reset page: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/reset-connect
2. Open browser DevTools (F12)
3. Go to Application → Local Storage
4. Delete all `xero_*` entries
5. Click "Clear Settings & Connect"
6. Try again

### Issue 3: Authorization page shows "Already connected"
**This is NORMAL!** Just click "Continue with 3 organisations" to proceed.

### Issue 4: Callback shows error page
**Symptoms**: After authorization, you see an error page instead of the dashboard.

**Fix**:
1. Check PM2 logs: `pm2 logs xero-reports-webapp --nostream`
2. Look for specific error messages
3. If you see "invalid_client", use Reset & Connect page
4. If you see "Failed to get tenant ID", check Xero API access

---

## Success Checklist

After following the fix, verify all these:

- [ ] Header shows "Connected to Xero" (green)
- [ ] Dashboard shows real invoice numbers
- [ ] Clients tab shows actual company names
- [ ] Outstanding amounts match your Xero data
- [ ] Google Sheets URLs return real CSV data
- [ ] No "Demo Mode" indicator
- [ ] `/api/auth/status` returns `authenticated: true`

If ALL checkboxes are ✅, you're successfully connected!

---

## Quick Links

- **Reset & Connect Page**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/reset-connect
- **Direct Login**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **Settings**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai (click Settings tab)
- **Xero Developer Portal**: https://developer.xero.com/myapps
- **Auth Status API**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/auth/status

---

## Need Help?

### Check Logs
```bash
pm2 logs xero-reports-webapp --nostream
```

### Test OAuth Endpoint
```bash
curl -I 'http://localhost:3000/auth/login'
```
Should return:
```
HTTP/1.1 302 Found
Location: https://login.xero.com/identity/connect/authorize?...
```

### Check Environment Variables
The app should load these from `.dev.vars`:
- XERO_CLIENT_ID
- XERO_CLIENT_SECRET
- XERO_REDIRECT_URI

---

## Final Notes

**Recommended Approach**: Use the **Reset & Connect page** for the fastest and most reliable connection.

**Why it works**: 
- Clears any problematic saved settings
- Uses pre-configured working credentials
- Bypasses Settings page entirely
- Direct path to successful OAuth

**After connecting**: You can use the Settings page to configure custom credentials if needed, but the default credentials work perfectly!

---

**Last Updated**: 2026-01-05
**Status**: ✅ Tested and working
**Time to Fix**: ~2 minutes
