# Fix: Invalid Client Secret Error

## 🔴 Error Encountered

```
OAuth callback error: Token exchange failed: {"error":"invalid_client"}
```

This means the **Client Secret** being used is incorrect or doesn't match what Xero expects.

---

## ✅ Solution: Get the Correct Client Secret

### **Important: Client Secret vs Creation Date**

**What you see in Xero app:**
```
Client secret 1
Created at 2026-01-05T02:06:48.1371101Z UTC
```

**⚠️ This is NOT the secret!** This is just when it was created.

**The actual secret** was shown only once when you clicked "Generate a secret". It looks like:
```
1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
```

---

## 🔧 Fix Options

### **Option 1: Generate a New Secret (Recommended)**

**If you don't have the original secret saved:**

1. **Go to Xero Developer Portal**
   ```
   https://developer.xero.com/myapps
   ```

2. **Open your app** (Client ID: `0C••••••••••••••••••••••••••E6`)

3. **Scroll to "Client secret 1" section**

4. **Click "Generate another secret"** button

5. **Copy the secret immediately** (it's only shown once!)
   - It will look like: `ABC123xyz789...` (about 50 characters)
   - Save it in a password manager or secure note

6. **Click "Save"** in Xero app

7. **Go to Settings tab** in dashboard

8. **Paste the new secret** into "Client Secret" field

9. **Click "Save Configuration"**

10. **Click "Test Connection"**

11. **Authorize on Xero page**

12. **Should work now!** ✅

---

### **Option 2: Use Existing Secret (If You Have It)**

**If you saved the secret when you generated it:**

1. **Find your saved secret**
   - Check password manager
   - Check secure notes
   - Check email (if you emailed it to yourself)
   - Check `.env` files or config files

2. **Go to Settings tab** in dashboard

3. **Enter the Client Secret** (the long alphanumeric string)

4. **Click "Save Configuration"**

5. **Click "Test Connection"**

6. **Should work!** ✅

---

### **Option 3: Use Default Configuration (Fastest)**

**If you don't want to deal with your own credentials right now:**

1. **Go to Settings tab** in dashboard

2. **Click "Load Default Configuration"** button
   - This loads pre-configured, working credentials
   - Client ID: `0CA378B164364DB0821A6014520913E6`
   - Client Secret: `1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U`

3. **Click "Save Configuration"**

4. **Click "Test Connection"**

5. **Authorize on Xero page**

6. **Works immediately!** ✅

---

## 🎯 What a Client Secret Looks Like

**Example Client Secrets (not real):**
```
1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
xKz3P9qW7mN2vC5bR8tY6hJ4gF1dS0aL3xK9wQ7eR2tY5uI
ABCdef123456GHIjkl789012MNOpqr345678STUvwx901234
```

**What it's NOT:**
- ❌ `Created at 2026-01-05T02:06:48.1371101Z UTC` (this is the creation date)
- ❌ `0C••••••••••••••••••••••••••E6` (this is the Client ID)
- ❌ `Client secret 1` (this is just the label)

---

## 🔐 Security Best Practices

### **When Generating a New Secret:**

1. **Copy immediately** - It's only shown once
2. **Save in password manager** - Use 1Password, LastPass, etc.
3. **Don't commit to git** - Never put in code repositories
4. **Don't share** - Keep it confidential
5. **Use environment variables** - For server deployments

### **If You Lost the Secret:**

- ✅ Generate a new one (it's free and takes 10 seconds)
- ❌ You cannot retrieve the old secret (Xero doesn't store it)
- ✅ Old secret stops working when you generate new one
- ✅ Update all apps using the old secret

---

## 🧪 Testing After Fix

### **Test 1: Save Configuration**

In Settings tab, after entering the correct secret:

**Status should show:**
```
✅ Credentials Configured
   Click "Test Connection" or "Connect to Xero" in the header to authenticate.
```

### **Test 2: Test Connection**

Click "Test Connection" button:

**Expected:** Redirect to Xero login page  
**Not Expected:** Error page or "invalid_client"

### **Test 3: Complete OAuth**

After authorizing on Xero:

**Expected:** Redirect back to dashboard  
**Expected:** "Connected to Xero" status  
**Expected:** Real data loads

### **Test 4: Load Real Data**

Go to Clients tab and click "Load Clients":

**Expected:** Real companies from your Xero account  
**Expected:** Actual outstanding amounts  
**Not Expected:** Demo data or error

---

## 🆘 Troubleshooting

### **Still getting "invalid_client" error?**

**Check:**
1. ✅ Client Secret is the actual secret (not the date)
2. ✅ No extra spaces before/after the secret
3. ✅ Copied the complete secret (all characters)
4. ✅ Using the most recent secret generated
5. ✅ Clicked "Save" in both Xero app and Settings

**Try:**
1. Generate a brand new secret in Xero
2. Copy it immediately
3. Paste into Settings (don't type it)
4. Save and test again

### **Error: "Token exchange failed"?**

This means either:
- Client Secret is wrong
- Client ID doesn't match
- Xero API is having issues

**Solution:**
1. Use "Load Default Configuration" to verify app works
2. If default works, your credentials are the issue
3. Generate new secret and try again

### **Browser shows "Something went wrong"?**

**Check backend logs:**
```bash
pm2 logs xero-reports-webapp --nostream
```

Look for:
- `invalid_client` - Wrong secret
- `unauthorized_client` - Wrong redirect URI
- `invalid_grant` - Authorization code expired

---

## 📋 Quick Fix Checklist

- [ ] Go to https://developer.xero.com/myapps
- [ ] Open your app
- [ ] Click "Generate another secret"
- [ ] Copy the secret immediately (only shown once!)
- [ ] Save secret in password manager
- [ ] Go to Settings tab in dashboard
- [ ] Paste Client ID: `0C••••••••••••••••••••••••••E6`
- [ ] Paste Client Secret: (your copied secret)
- [ ] Click "Save Configuration"
- [ ] See yellow "Credentials Configured" status
- [ ] Click "Test Connection"
- [ ] Authorize on Xero page
- [ ] Redirect back to dashboard
- [ ] See green "Connected to Xero" status
- [ ] Test loading real data

---

## 🔗 Quick Links

- **Dashboard Settings**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai (click Settings tab)
- **Xero Apps**: https://developer.xero.com/myapps
- **Xero API Status**: https://status.xero.com

---

## ✅ Success Indicators

**After fixing:**

**In Settings:**
```
✅ Credentials Configured
   Click "Test Connection" or "Connect to Xero" in the header to authenticate.
```

**After connecting:**
```
✅ Connected to Xero
   You are currently authenticated and using real Xero data.
```

**In Dashboard header:**
```
✅ Connected to Xero (green checkmark)
```

**In Clients tab:**
```
Real company names
Real amounts owed
Real invoice counts
```

---

**Generate a new Client Secret in Xero and update it in Settings!** 🔑
