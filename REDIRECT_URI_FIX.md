# Fix: Xero OAuth Redirect URI Error

## 🔴 Error Encountered

```
Error: unauthorized_client
Invalid redirect_uri
Error code: 500
```

This error occurs when the Redirect URI in your Xero app doesn't match what the application is sending during OAuth.

---

## ✅ Solution

### **Required Redirect URI**

Your application is using:
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

### **Step-by-Step Fix**

#### **1. Go to Xero Developer Portal**
Visit: https://developer.xero.com/myapps

#### **2. Select Your App**
- Look for your app with Client ID ending in `E6`
- Click on it to open settings

#### **3. Find OAuth 2.0 Redirect URIs Section**
- Scroll down to **"OAuth 2.0 redirect URIs"**
- This section lists all allowed callback URLs

#### **4. Add the Redirect URI**
- Click **"Add URI"** button
- Paste this exact URL:
  ```
  https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
  ```
- Make sure there are NO extra spaces or characters
- Click **"Save"**

#### **5. Verify Settings**
Your Xero app should now have:
- **Client ID**: `0C••••••••••••••••••••••••••E6`
- **Client Secret**: (your generated secret)
- **Redirect URI**: `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback`

#### **6. Try Connecting Again**
1. Go back to your dashboard: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
2. Click **"Connect to Xero"** button
3. You should now see the Xero authorization page
4. Sign in and authorize
5. You'll be redirected back successfully!

---

## 📸 Screenshots to Help

### **What to Look For in Xero App Settings:**

**OAuth 2.0 redirect URIs section should look like:**
```
┌─────────────────────────────────────────────────────────────────┐
│ OAuth 2.0 redirect URIs                                         │
├─────────────────────────────────────────────────────────────────┤
│ https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback │
│ [Delete]                                                        │
├─────────────────────────────────────────────────────────────────┤
│ [Add URI]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Common Mistakes to Avoid

❌ **Wrong:**
- `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/callback` (missing `/auth`)
- `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback/` (trailing slash)
- `http://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback` (http instead of https)

✅ **Correct:**
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

---

## 🎯 Using Settings Page

You can also verify the correct Redirect URI in the dashboard:

1. Go to **Settings** tab
2. Look at the **Redirect URI** field (read-only)
3. Click **"Copy"** button to copy the exact URI
4. Paste it into your Xero app settings

---

## 🧪 Test After Fix

After adding the Redirect URI to your Xero app:

1. **Clear browser cache** (or use incognito mode)
2. **Go to dashboard**
3. **Click "Connect to Xero"**
4. **You should see Xero login page** (not an error)
5. **Sign in and authorize**
6. **Redirect back to dashboard successfully**
7. **See "Connected to Xero"** status

---

## 🆘 Still Having Issues?

### **Check These:**

1. **Exact Match**: URI must match EXACTLY (case-sensitive)
2. **HTTPS**: Must use `https://` not `http://`
3. **No Trailing Slash**: Don't add `/` at the end
4. **Save Changes**: Click Save in Xero app settings
5. **Wait a Moment**: Sometimes takes 10-30 seconds to propagate

### **Alternative: Use Settings Page**

If you continue having issues:

1. Go to **Settings** tab in dashboard
2. Click **"Load Default Configuration"**
3. This uses pre-configured credentials that are known to work
4. Click **"Save Configuration"**
5. Try connecting again

---

## 📞 Xero Support

If the issue persists after following these steps:

- **Xero Developer Forum**: https://central.xero.com/s/topic/0TO1N000000MbqnWAC/xero-api
- **Xero API Support**: https://developer.xero.com/contact-us
- **Check Xero Status**: https://status.xero.com

---

## ✅ Expected Result

After fixing the Redirect URI, you should see:

**Before Fix:**
```
❌ Error: unauthorized_client
❌ Invalid redirect_uri
```

**After Fix:**
```
✅ Xero login page appears
✅ Authorize your app
✅ Redirect back to dashboard
✅ "Connected to Xero" status shows
✅ Real data loads
```

---

## 🔗 Quick Reference

- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **Settings Tab**: Click gear icon in navigation
- **Xero Apps**: https://developer.xero.com/myapps
- **Required URI**: `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback`

---

**Fix this error in 2 minutes by adding the Redirect URI to your Xero app!** 🚀
