# 🚀 Quick Deploy Guide

## ✅ Status: READY FOR GENSPARK HOSTED DEPLOY

---

## 🎯 Deploy Steps

### 1. Open GenSpark Deploy Tab
- Navigate to your GenSpark dashboard
- Click **"Deploy"** or **"Hosted Deploy"**

### 2. Set Custom Domain
```
finance.gershoncrm.com
```

### 3. Click Deploy
- GenSpark will run `npm install` and `npm start`
- Wait 1-2 minutes for deployment
- Server will start automatically on GenSpark's assigned port

### 4. Test Production
```bash
# Health check
curl https://finance.gershoncrm.com/api/health

# Open in browser
https://finance.gershoncrm.com
```

---

## ⚙️ Xero OAuth Setup (Required)

**Add these redirect URIs to your Xero OAuth app:**

1. https://finance.gershoncrm.com/auth/callback (production)
2. https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback (sandbox)

**Client ID:** `0CA378B164364DB0821A6014520913E6`

**Configure at:** https://developer.xero.com/app/manage

---

## 📦 What's Included

✅ Node.js server (`server.js`)
✅ Embedded Xero credentials (no env vars needed)
✅ Auto-detecting redirect URI
✅ Frontend dashboard (`public/index.html`)
✅ All features working

---

## 🧪 Testing URLs

**Sandbox (Working Now):**
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai

**Production (After Deploy):**
https://finance.gershoncrm.com

---

## ✅ Ready!

Your app is ready for GenSpark Hosted Deploy. No environment variables needed - just click Deploy!
