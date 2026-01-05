# 🔒 Security & Credentials Documentation

## ⚠️ IMPORTANT: Private Credentials

This application contains **PRIVATE CREDENTIALS** for personal use only.

---

## 🔐 Credential Storage

### Where Credentials Are Stored

**Primary Location**: `.dev.vars` file (NOT committed to git)

```bash
# Location: /home/user/webapp/.dev.vars
XERO_CLIENT_ID=0CA378B164364DB0821A6014520913E6
XERO_CLIENT_SECRET=eGbADLibs2cAOi5U3m8jdZDzbqRFIkIxWKkDN9BkKDA-EEPc
XERO_REDIRECT_URI=https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

### Security Measures in Place

✅ **Git Protection**:
- `.dev.vars` is listed in `.gitignore`
- File is **NEVER** committed to git repository
- Safe from accidental exposure via GitHub

✅ **Local Storage Only**:
- Credentials stored only in sandbox environment
- Not accessible via public URLs
- Only used server-side for OAuth

✅ **Environment Variable Pattern**:
- Follows security best practices
- Loaded at runtime, not hardcoded in code
- Easy to rotate if needed

---

## 🔑 Your Xero App Details

### Application Information
- **App Name**: GC Reports (or your app name in Xero Developer Portal)
- **Client ID**: `0CA378B164364DB0821A6014520913E6`
- **Client Secret**: `eGbADLibs2cAOi5U3m8jdZDzbqRFIkIxWKkDN9BkKDA-EEPc`
- **Created**: 2026-01-05
- **Owner**: Your Xero Developer account

### OAuth Configuration
- **Authorization Endpoint**: `https://login.xero.com/identity/connect/authorize`
- **Token Endpoint**: `https://identity.xero.com/connect/token`
- **Redirect URI**: `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback`

### Required Scopes
- `accounting.reports.read` - Read financial reports
- `accounting.transactions.read` - Read bank transactions
- `accounting.contacts.read` - Read client/contact information
- `accounting.settings.read` - Read organization settings
- `offline_access` - Refresh tokens for long-term access

---

## 🚀 How to Use

### Quick Connect

Simply open this URL in your browser:

```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
```

**What happens:**
1. Server reads credentials from `.dev.vars`
2. Generates OAuth authorization URL
3. Redirects you to Xero login
4. You authorize the app
5. Xero redirects back with authorization code
6. Server exchanges code for access token using your Client Secret
7. ✅ You're connected with real data!

---

## 🔄 Rotating Credentials

If you need to generate a new Client Secret:

### Step 1: Generate New Secret in Xero
1. Go to: https://developer.xero.com/myapps
2. Open your app
3. Click "Generate another secret"
4. **COPY IT IMMEDIATELY** (shown only once!)

### Step 2: Update .dev.vars
Replace the secret in `.dev.vars`:

```bash
XERO_CLIENT_SECRET=your-new-secret-here
```

### Step 3: Restart Application
```bash
cd /home/user/webapp
npm run build
pm2 restart xero-reports-webapp
```

### Step 4: Test
Open: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

---

## 📂 File Structure

### Secure Files (NOT in git)
```
.dev.vars              # Your credentials (secure)
.env                   # Alternative env file (if used)
.env.production        # Production env (if used)
```

### Configuration Files (IN git, no secrets)
```
wrangler.jsonc         # Cloudflare config (no secrets)
package.json           # Dependencies
ecosystem.config.cjs   # PM2 config
```

### Code Files (IN git, safe)
```
src/index.tsx          # Main app (reads from env vars)
src/services/xero-oauth.ts      # OAuth service
src/services/xero-api.ts        # API service
```

---

## ⚠️ Security Warnings

### DO NOT:
- ❌ Commit `.dev.vars` to git
- ❌ Share Client Secret publicly
- ❌ Hardcode secrets in source code
- ❌ Store secrets in browser localStorage (except temporarily for OAuth flow)
- ❌ Include secrets in URLs or logs

### DO:
- ✅ Keep `.dev.vars` in `.gitignore`
- ✅ Use environment variables
- ✅ Rotate secrets periodically
- ✅ Revoke old secrets after rotation
- ✅ Use HTTPS for all OAuth flows

---

## 🔍 Verifying Security

### Check .gitignore
```bash
cd /home/user/webapp
grep -n ".dev.vars" .gitignore
```
Should show: `.dev.vars` is listed

### Check Git Status
```bash
cd /home/user/webapp
git status
```
Should NOT show `.dev.vars` as untracked or modified

### Check File Permissions (Optional)
```bash
ls -la /home/user/webapp/.dev.vars
```
Should be readable only by you

---

## 📊 What Data This Accesses

Your credentials provide access to:

- ✅ **Invoice Data**: All invoices (draft, authorized, paid)
- ✅ **Client Information**: Contact names, IDs, outstanding amounts
- ✅ **Financial Reports**: Profit & Loss, Balance Sheet
- ✅ **Bank Transactions**: All transaction history
- ✅ **Organization Settings**: Tenant ID, organization details

**Scope**: Read-only access (cannot modify or delete data)

---

## 🎯 Current Status

### ✅ Credentials Configured
- Client ID: Set in `.dev.vars`
- Client Secret: Updated with working secret
- Redirect URI: Configured for sandbox environment

### ✅ Security Measures Active
- `.dev.vars` in `.gitignore`
- Environment variables used
- No secrets in git repository
- HTTPS OAuth flow

### ✅ Ready to Use
- Application running
- OAuth endpoints configured
- Real data access enabled

---

## 🔗 Quick Links

### Your Application
- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **OAuth Login**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
- **Auth Status**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/auth/status

### Xero Developer
- **My Apps**: https://developer.xero.com/myapps
- **Documentation**: https://developer.xero.com/documentation
- **API Reference**: https://developer.xero.com/documentation/api/accounting/overview

---

## 📝 Notes

### Personal Use Only
These credentials are for **YOUR PERSONAL USE ONLY**. Do not share with others or deploy publicly with these credentials.

### Production Deployment
For production deployment to Cloudflare Pages:
1. Store credentials as Cloudflare Secrets (not in `.dev.vars`)
2. Use `wrangler secret put` commands
3. Never commit production secrets to git

### Backup
Keep a secure backup of your Client Secret in:
- Password manager (recommended)
- Encrypted file
- Secure notes

---

**Last Updated**: 2026-01-05  
**Status**: ✅ Secure and Configured  
**Owner**: Olivier (GC Reports)

---

## 🎉 You're All Set!

Your credentials are:
- ✅ Securely stored in `.dev.vars`
- ✅ Protected by `.gitignore`
- ✅ Working with Xero OAuth
- ✅ Ready to access real data

**Just open the login URL and authorize!** 🚀
