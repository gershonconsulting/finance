# 🚀 Quick Deploy Guide - GenSpark Hosted Deploy

## Deploy to finance.gershoncrm.com in 3 Steps

### Step 1: Configure in GenSpark Deploy Tab

**Environment Variables:**
```
XERO_CLIENT_ID=<your_client_id>
XERO_CLIENT_SECRET=<your_client_secret>
XERO_REDIRECT_URI=https://finance.gershoncrm.com/auth/callback
```

**Custom Domain:**
```
finance.gershoncrm.com
```

### Step 2: Update Xero OAuth App

**Add Redirect URI:**
```
https://finance.gershoncrm.com/auth/callback
```

**Where:** https://developer.xero.com/app/manage

### Step 3: Click Deploy

**In GenSpark:**
1. Go to **Deploy** tab
2. Click **Deploy** button
3. Wait for build to complete
4. Done! ✅

## Test Deployment

```bash
# Test health
curl https://finance.gershoncrm.com/api/health

# Or open in browser
https://finance.gershoncrm.com
```

## That's It!

GenSpark handles:
- ✅ Building the project
- ✅ Deploying to hosting
- ✅ SSL certificate setup
- ✅ Domain configuration
- ✅ Environment variables

No Cloudflare needed!

---

**Full Guide**: [GENSPARK_DEPLOY.md](GENSPARK_DEPLOY.md)
