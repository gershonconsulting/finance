# Settings Guide - Configure Your Xero API Credentials

## 🎯 Overview

The **Settings** tab allows you to configure your own Xero API credentials instead of using the pre-configured defaults. This is useful when:

1. You want to use your own Xero Developer app
2. You need to connect to a different Xero organization
3. You want to customize the OAuth configuration
4. You have specific security requirements

---

## 📍 How to Access Settings

1. Open the dashboard: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
2. Click the **"Settings"** tab in the navigation menu (gear icon)
3. You'll see the Xero API Configuration page

---

## 🔧 Configuration Options

### **Option 1: Use Pre-configured Credentials (Easiest)**

**Click "Load Default Configuration"** to use the app's built-in credentials:

```
Client ID: 0CA378B164364DB0821A6014520913E6
Client Secret: 1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U
```

Then click **"Save Configuration"** and you're ready to connect!

---

### **Option 2: Use Your Own Credentials**

#### **Step 1: Get Your Xero API Credentials**

1. Go to **Xero Developer Portal**: https://developer.xero.com/myapps
2. Click **"New app"** or select an existing app
3. Fill in the app details:
   - **App name**: Your Dashboard Name
   - **Company/Integration**: Your company name
   - **Integration type**: Web app
4. Copy your **Client ID** (shown immediately)
5. Click **"Generate a secret"** and copy the **Client Secret** (shown once only - save it!)

#### **Step 2: Configure Redirect URI in Xero**

1. In the Xero app settings, find **OAuth 2.0 redirect URIs**
2. Copy the Redirect URI from the Settings page in the dashboard
3. Add it to your Xero app:
   ```
   https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
   ```
4. Click **"Save"**

#### **Step 3: Enter Credentials in Dashboard**

1. Go to the **Settings** tab
2. Enter your **Client ID**
3. Enter your **Client Secret**
4. The **Redirect URI** is automatically filled
5. Click **"Save Configuration"**

#### **Step 4: Test Connection**

1. Click **"Test Connection"** button
2. You'll be redirected to Xero login
3. Sign in and authorize the app
4. You'll be redirected back to the dashboard

---

## 🔒 Security & Storage

### **Where are credentials stored?**
- Stored in your **browser's localStorage** (client-side only)
- Never sent to any external servers except Xero during OAuth
- Credentials are only transmitted over HTTPS

### **What's stored?**
```javascript
localStorage.setItem('xero_client_id', 'your-client-id');
localStorage.setItem('xero_client_secret', 'your-client-secret');
localStorage.setItem('xero_session', 'session-token-after-auth');
```

### **Security Best Practices**
- ✅ Use unique credentials per environment (dev/staging/production)
- ✅ Rotate client secrets periodically
- ✅ Clear credentials when done testing
- ✅ Never share your Client Secret
- ❌ Don't use the same credentials across multiple apps
- ❌ Don't commit credentials to version control

---

## 🎨 Settings Page Features

### **Status Indicator**
Shows current configuration state:
- 🔵 **Blue**: No credentials configured
- 🟡 **Yellow**: Credentials saved but not connected
- 🟢 **Green**: Connected to Xero with real data

### **Action Buttons**

| Button | Description |
|--------|-------------|
| **Save Configuration** | Saves your credentials to localStorage |
| **Test Connection** | Redirects to Xero OAuth to test credentials |
| **Load Current** | Reloads credentials from localStorage |
| **Clear & Disconnect** | Removes all credentials and disconnects |
| **Load Default Configuration** | Loads pre-configured credentials |
| **Copy** (Redirect URI) | Copies redirect URI to clipboard |
| **👁️ Toggle** | Show/hide Client Secret |

---

## 🔄 How Authentication Works

### **With Custom Credentials**

```
1. You enter Client ID + Secret in Settings
   ↓
2. Credentials saved to localStorage
   ↓
3. Click "Connect to Xero"
   ↓
4. Frontend calls POST /auth/login with credentials
   ↓
5. Backend generates OAuth URL
   ↓
6. Redirect to Xero login
   ↓
7. User authorizes app
   ↓
8. Xero redirects to /auth/callback
   ↓
9. Backend exchanges code for access token
   ↓
10. Session created and stored
    ↓
11. Redirect to dashboard
    ↓
12. Real Xero data loaded!
```

### **With Default Credentials**

```
1. Click "Connect to Xero" (no setup needed)
   ↓
2. Backend uses .dev.vars credentials
   ↓
3. Rest of flow is the same...
```

---

## 🐛 Troubleshooting

### **Problem: "Missing credentials" error**

**Solution:**
1. Go to Settings tab
2. Enter Client ID and Client Secret
3. Click "Save Configuration"
4. Try connecting again

---

### **Problem: "Redirect URI mismatch" error**

**Solution:**
1. Copy the Redirect URI from Settings page
2. Go to https://developer.xero.com/myapps
3. Edit your Xero app
4. Add the redirect URI exactly as shown
5. Save and try again

---

### **Problem: "Invalid client_secret" error**

**Solution:**
1. Go to https://developer.xero.com/myapps
2. Edit your Xero app
3. Click "Generate a secret" to create a new one
4. Copy the new secret immediately (it's only shown once)
5. Update in Settings page
6. Save and try again

---

### **Problem: Credentials not saving**

**Solution:**
1. Check browser console for errors (F12 → Console)
2. Ensure localStorage is enabled in your browser
3. Try clearing browser cache
4. Use incognito mode to test

---

### **Problem: Already authenticated but want to change credentials**

**Solution:**
1. Go to Settings tab
2. Click "Clear & Disconnect"
3. Enter new credentials
4. Save and reconnect

---

## 📊 Use Cases

### **1. Development & Testing**
- Use separate credentials for dev environment
- Test OAuth flow with your own app
- Debug authentication issues

### **2. Multiple Organizations**
- Connect to different Xero organizations
- Switch between test and production accounts
- Use different credentials per client

### **3. Custom Branding**
- Use your own Xero app with custom name
- Show your company name in OAuth consent screen
- Maintain brand consistency

### **4. Security Compliance**
- Use organization-specific credentials
- Implement credential rotation
- Meet audit requirements

---

## 🎯 Quick Start Examples

### **Example 1: First-Time Setup with Default Credentials**

```
1. Open dashboard
2. Click "Settings" tab
3. Click "Load Default Configuration"
4. Click "Save Configuration"
5. Click "Test Connection"
6. Authorize on Xero page
7. Done! Start using real data
```

### **Example 2: Setup with Your Own Credentials**

```
1. Get credentials from https://developer.xero.com/myapps
   - Client ID: 1234ABCD...
   - Client Secret: xyz789...
   
2. Add Redirect URI to Xero app:
   https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback

3. Go to Settings in dashboard
4. Enter Client ID and Secret
5. Click "Save Configuration"
6. Click "Connect to Xero" in header
7. Authorize
8. Done!
```

### **Example 3: Switch to Different Organization**

```
1. Go to Settings
2. Click "Clear & Disconnect"
3. Get credentials for new organization
4. Enter new Client ID and Secret
5. Save and reconnect
6. Now using different organization's data
```

---

## 📋 Checklist: Setting Up Your Own Credentials

- [ ] Create Xero Developer account
- [ ] Create new app or select existing
- [ ] Copy Client ID
- [ ] Generate and copy Client Secret (save it securely!)
- [ ] Copy Redirect URI from Settings page
- [ ] Add Redirect URI to Xero app OAuth 2.0 settings
- [ ] Save Xero app configuration
- [ ] Enter Client ID in Settings
- [ ] Enter Client Secret in Settings
- [ ] Click "Save Configuration"
- [ ] Click "Test Connection" or "Connect to Xero"
- [ ] Authorize on Xero login page
- [ ] Verify green "Connected to Xero" status
- [ ] Test loading real data in Dashboard

---

## 🔗 Useful Links

- **Xero Developer Portal**: https://developer.xero.com/myapps
- **Xero API Documentation**: https://developer.xero.com/documentation
- **OAuth 2.0 Guide**: https://developer.xero.com/documentation/oauth2/overview
- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai
- **Settings Page**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai (click Settings tab)

---

## 💡 Pro Tips

1. **Save your Client Secret securely** - It's only shown once during generation
2. **Use password manager** - Store credentials in a password manager
3. **Test in incognito** - Test authentication in incognito window to avoid cache issues
4. **Check browser console** - F12 → Console shows detailed error messages
5. **One org at a time** - Each browser can only be authenticated to one org at a time
6. **Logout before switching** - Clear & Disconnect before changing credentials

---

## ⚠️ Important Notes

- **Client Secret is sensitive** - Never share it or commit to version control
- **One-time display** - Client Secret is only shown once when generated
- **Browser-specific** - Credentials are stored per browser/device
- **No server storage** - Credentials are NOT stored on the server
- **HTTPS required** - OAuth requires HTTPS for security
- **Xero limits** - Check Xero's API rate limits for your app tier

---

**Ready to configure your credentials? Go to the Settings tab now!** ⚙️
