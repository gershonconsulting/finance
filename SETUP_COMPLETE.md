# 🚀 Complete Setup Checklist for finance.gershoncrm.com

## Your Xero OAuth Credentials

```
Client ID: 0CA378B164364DB0821A6014520913E6
Client Secret: -OvY_3_op75SDteQt6tOqvZVyZ3Ihq07aE32QYGOCWiqHhvh
```

---

## ✅ Step-by-Step Deployment

### Step 1: Update Xero OAuth App ⚠️ CRITICAL

**Go to:** https://developer.xero.com/app/manage

1. Find your app with Client ID: `0CA378B164364DB0821A6014520913E6`
2. Click **Edit**
3. Go to **OAuth 2.0 redirect URIs** section
4. Click **"Add URI"** and add:
   ```
   https://finance.gershoncrm.com/auth/callback
   ```
5. Click **"Add URI"** again and add:
   ```
   https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
   ```
6. Click **Save**

**Why both URLs?**
- First one: For production (finance.gershoncrm.com)
- Second one: For sandbox testing (current environment)

---

### Step 2: Test in Sandbox First

**Test URL:** https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login

1. Click the link above
2. Click "Sign in with Xero"
3. Login with your Xero account
4. Select your organization (e.g., Gershon Consulting LLC)
5. Grant permissions
6. You should be redirected back to the dashboard ✅

**If this works, you're ready for production!**

---

### Step 3: Configure GenSpark Deploy

**In GenSpark Deploy Tab:**

#### Environment Variables
Add these three variables:

```
Variable Name: XERO_CLIENT_ID
Value: 0CA378B164364DB0821A6014520913E6

Variable Name: XERO_CLIENT_SECRET
Value: -OvY_3_op75SDteQt6tOqvZVyZ3Ihq07aE32QYGOCWiqHhvh

Variable Name: XERO_REDIRECT_URI
Value: https://finance.gershoncrm.com/auth/callback
```

#### Custom Domain
```
Domain: finance.gershoncrm.com
```

---

### Step 4: Deploy

**In GenSpark Deploy Tab:**
1. Click **"Deploy"** button
2. Wait for build to complete (~1-2 minutes)
3. Check deployment logs for errors

---

### Step 5: Test Production

**After deployment:**

1. **Open:** https://finance.gershoncrm.com
2. **Should see:** Login page with "Sign in with Xero"
3. **Click:** "Sign in with Xero"
4. **Login:** With your Xero account
5. **Select:** Your organization
6. **Result:** Dashboard loads with real data ✅

---

## 🔍 Troubleshooting

### Issue: "unauthorized_client" Error

**Cause:** Redirect URI not added to Xero app

**Solution:**
1. Double-check Step 1 above
2. Make sure both URLs are added to Xero
3. No typos or extra spaces
4. Save changes in Xero

### Issue: "Origin DNS error" on finance.gershoncrm.com

**Cause:** Domain not configured correctly

**Solution:**
1. Check DNS settings in GenSpark Deploy tab
2. Follow DNS configuration instructions
3. Wait for DNS propagation (5-30 minutes)

### Issue: Works in Sandbox but Not Production

**Cause:** Environment variables not set in production

**Solution:**
1. Check GenSpark Deploy tab
2. Verify all three environment variables are set
3. Redeploy after adding variables

---

## 📋 Verification Checklist

### Before Deployment
- [ ] Xero OAuth app updated with redirect URIs
- [ ] Tested authentication in sandbox
- [ ] Environment variables ready
- [ ] Custom domain configured in GenSpark

### After Deployment
- [ ] Production URL loads (finance.gershoncrm.com)
- [ ] Login page displays
- [ ] Xero OAuth flow works
- [ ] Dashboard loads after authentication
- [ ] All tabs show data (Invoices, Clients, Trends)
- [ ] Export to CSV works
- [ ] Logout and re-login works
- [ ] Session persists after refresh

---

## 🌐 URLs Summary

### Sandbox (For Testing)
- **Login**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai

### Production (After Deployment)
- **Login**: https://finance.gershoncrm.com/auth/login
- **Dashboard**: https://finance.gershoncrm.com
- **Health**: https://finance.gershoncrm.com/api/health

---

## 🔐 Security Reminders

- ✅ Credentials documented in XERO_CREDENTIALS.md
- ✅ .dev.vars file added to .gitignore (NOT committed)
- ⚠️ Never share Client Secret publicly
- ⚠️ Store in GenSpark environment variables only
- ⚠️ Treat like a password

---

## 📞 Next Actions

**RIGHT NOW:**

1. **Update Xero OAuth app** (Step 1)
   - Add both redirect URIs
   - Save changes

2. **Test in sandbox** (Step 2)
   - https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
   - Verify authentication works

3. **Deploy to production** (Steps 3-4)
   - Configure GenSpark Deploy tab
   - Click Deploy button

4. **Test production** (Step 5)
   - https://finance.gershoncrm.com
   - Complete full testing checklist

---

## ✨ What You'll Get

**After successful deployment:**

- ✅ Professional login page
- ✅ Secure Xero OAuth authentication
- ✅ Real-time invoice dashboard
- ✅ Payment trends analysis
- ✅ Client reports with sortable columns
- ✅ Google Sheets export
- ✅ Session persistence
- ✅ Mobile-responsive design

---

**Status**: ✅ Credentials configured, sandbox ready, production pending deployment

**Next**: Update Xero OAuth app with redirect URIs, then deploy! 🚀
