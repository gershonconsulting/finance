# 🔴 URGENT: Fix OAuth "invalid_client" Error

## 🚨 THE PROBLEM

The Client Secret in your `.dev.vars` file **IS NOT VALID** for your Xero app.

**Error**: `{"error":"invalid_client"}`

**Root Cause**: The Client Secret `1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U` does not match your Xero app's actual secret.

---

## ✅ THE SOLUTION (5 Minutes)

### Option 1: Generate NEW Client Secret (Recommended)

Follow these exact steps:

#### Step 1: Generate New Secret in Xero

1. **Go to Xero Developer Portal**:
   ```
   https://developer.xero.com/myapps
   ```

2. **Open your app**:
   - Look for the app with Client ID ending in `E6`
   - Click on it to open

3. **Generate a new secret**:
   - Scroll down to "Client secret 1"
   - Click **"Generate another secret"** button
   - A new secret will appear (looks like: `AbC123...`)

4. **COPY IT IMMEDIATELY**:
   - ⚠️ **CRITICAL**: The secret is shown **ONLY ONCE**
   - Click the copy button or select and copy the entire secret
   - Paste it into Notepad or a secure place temporarily

#### Step 2: Test the New Secret

1. **Open the Test Credentials page**:
   ```
   https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/test-credentials
   ```

2. **Paste your NEW Client Secret**:
   - The page will have a form
   - Client ID is already filled: `0CA378B164364DB0821A6014520913E6`
   - **Paste your NEW secret** into the "Client Secret" field

3. **Click "Test Connection with These Credentials"**:
   - If the secret is correct, you'll be redirected to Xero
   - Authorize the app
   - You'll be connected! ✅

4. **If it works**:
   - You're now connected with real data
   - Dashboard will show real invoice numbers
   - Clients tab will show actual companies

#### Step 3: Update .dev.vars (For Future Use)

After confirming the new secret works, update the file so it persists:

1. The new secret is saved in your browser automatically
2. To update the server file for future deployments, I can help you update `.dev.vars`
3. But for now, your connection is working via browser storage

---

### Option 2: Use Manual Access Token (Alternative)

If you have a Xero access token already, you can use it directly:

1. Get your access token from Xero OAuth Playground:
   ```
   https://developer.xero.com/documentation/tools/oauth-playground
   ```

2. Go to Settings in the dashboard
3. Enter the access token in the manual token field
4. Save and connect

---

## 🧪 TEST PAGE

**Use this page to test your credentials**:

### 👉 https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/test-credentials

This page will:
- ✅ Let you enter your NEW Client Secret from Xero
- ✅ Test if it works with OAuth
- ✅ Show you the exact error if it doesn't work
- ✅ Connect you immediately if it works

---

## 📋 Quick Checklist

Follow this checklist in order:

- [ ] Open https://developer.xero.com/myapps
- [ ] Find your app (Client ID ending in `E6`)
- [ ] Click "Generate another secret"
- [ ] **COPY THE SECRET IMMEDIATELY** (shown only once!)
- [ ] Open https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/test-credentials
- [ ] Paste the NEW secret into the form
- [ ] Click "Test Connection"
- [ ] Authorize on Xero
- [ ] ✅ Connected!

---

## 🔍 Why This Is Happening

### The Previous Secret Is Invalid

The secret in `.dev.vars` is:
```
1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
```

This secret is **NOT WORKING** because:

1. **It was revoked** - Someone clicked "Revoke" in Xero
2. **It expired** - Xero secrets can expire
3. **It's from a different app** - This might be from a test app
4. **It was never valid** - It might have been copied incorrectly

**Solution**: Generate a **NEW** secret and it will work!

---

## 💡 Understanding Xero Secrets

### What You See in Xero Dashboard:
```
Client secret 1
Created at 2026-01-05T02:06:48.1371101Z UTC
[Generate another secret] [Revoke]
```

### Important Notes:

1. **The DATE is NOT the secret!**
   - `Created at 2026-01-05...` is just when it was created
   - The actual secret is a long string shown only once

2. **Secrets are shown ONLY ONCE**:
   - When you click "Generate another secret"
   - The secret appears briefly
   - If you don't copy it immediately, it's gone forever
   - You can't retrieve it later

3. **You can have multiple secrets**:
   - "Generate another secret" creates a NEW one
   - Both old and new secrets work
   - Until you revoke the old one

4. **Format of a secret**:
   ```
   1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
   ```
   - 48+ characters long
   - Mix of letters and numbers
   - Case-sensitive

---

## 🎯 After You Connect

Once you've successfully connected with your NEW Client Secret, you'll see:

### Dashboard:
- ✅ Header shows "Connected to Xero" (green)
- ✅ Real invoice statistics
- ✅ Actual draft/awaiting/overdue counts
- ✅ Real amounts from your Xero data

### Clients Tab:
- ✅ Real company names (not "ABC Corporation", "XYZ Industries")
- ✅ Actual outstanding amounts
- ✅ Real invoice counts per client

### Google Sheets URLs:
- ✅ All IMPORTDATA URLs return real CSV data
- ✅ Example:
  ```
  https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/api/export/clients-awaiting-payment
  ```
  Returns your actual clients with real data!

---

## 📞 If You Need Help

### Check the Logs:
```bash
pm2 logs xero-reports-webapp --nostream
```

### Test Your Credentials:
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/test-credentials
```

### Read Full Troubleshooting:
- [OAUTH_TROUBLESHOOTING.md](./OAUTH_TROUBLESHOOTING.md)
- [AUTHENTICATION_COMPLETE.md](./AUTHENTICATION_COMPLETE.md)

---

## 🔗 All Important Links

### Xero:
- **Developer Portal**: https://developer.xero.com/myapps
- **OAuth Playground**: https://developer.xero.com/documentation/tools/oauth-playground

### Your App:
- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **Test Credentials**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/test-credentials
- **Settings**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai (click Settings tab)

---

## ⚡ TL;DR - Do This Now

1. **Generate new secret**: https://developer.xero.com/myapps → Your app → "Generate another secret"
2. **Copy it immediately** (shown only once!)
3. **Test it here**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/static/test-credentials
4. **Paste the secret** and click "Test Connection"
5. **Authorize on Xero**
6. **Done!** ✅

**Time required**: 5 minutes  
**Difficulty**: Easy (just need to copy/paste the new secret)

---

**Last Updated**: 2026-01-05  
**Status**: 🔴 Action Required  
**Priority**: URGENT

---

## 🎉 Success Looks Like This

After following the steps above, you'll see:

```
✅ Connected to Xero
```

In the dashboard header, with real data loading automatically!

**Go generate that new secret now!** 🚀
