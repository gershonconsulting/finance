# Deployment Guide - finance.gershoncrm.com

## Overview
This guide covers deploying the Gershon Finance Dashboard to Cloudflare Pages with custom domain **finance.gershoncrm.com**.

## Prerequisites

### 1. Cloudflare Account Setup
- ✅ Cloudflare account created
- ✅ Domain added to Cloudflare (gershoncrm.com)
- ✅ DNS managed by Cloudflare

### 2. API Token Configuration
**Required before deployment:**
1. Go to **Deploy** tab in the sidebar
2. Create Cloudflare API token with permissions:
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Zone** → **DNS** → **Edit**
3. Save the API token

### 3. Xero OAuth Configuration
**Update your Xero OAuth app redirect URIs to include:**
```
https://finance.gershoncrm.com/auth/callback
```

**Steps:**
1. Go to: https://developer.xero.com/app/manage
2. Select your OAuth app
3. Add redirect URI: `https://finance.gershoncrm.com/auth/callback`
4. Save changes

## Deployment Steps

### Step 1: Configure Cloudflare API Key

**In GenSpark:**
1. Navigate to **Deploy** tab
2. Click **Setup Cloudflare**
3. Enter your API token
4. Save configuration

**Or manually set environment variable:**
```bash
export CLOUDFLARE_API_TOKEN="your_token_here"
```

### Step 2: Build the Project

```bash
cd /home/user/webapp
npm run build
```

**Expected output:**
```
✓ 42 modules transformed
dist/_worker.js  100.40 kB
✓ built in 691ms
```

### Step 3: Create Cloudflare Pages Project

```bash
# Create the project (first time only)
npx wrangler pages project create gershon-finance \
  --production-branch main \
  --compatibility-date 2024-01-01
```

**Expected output:**
```
✨ Successfully created the 'gershon-finance' project.
```

### Step 4: Deploy to Cloudflare Pages

```bash
# Deploy the built files
npm run deploy
```

**Or manually:**
```bash
npx wrangler pages deploy dist --project-name gershon-finance
```

**Expected output:**
```
✨ Uploading...
✨ Deployment complete!
🌎 Production: https://gershon-finance.pages.dev
🌍 Branch: https://main.gershon-finance.pages.dev
```

### Step 5: Configure Environment Variables

**Set Xero OAuth credentials:**
```bash
# Set XERO_CLIENT_ID
npx wrangler pages secret put XERO_CLIENT_ID --project-name gershon-finance
# Enter your Xero Client ID when prompted

# Set XERO_CLIENT_SECRET
npx wrangler pages secret put XERO_CLIENT_SECRET --project-name gershon-finance
# Enter your Xero Client Secret when prompted

# Set XERO_REDIRECT_URI
npx wrangler pages secret put XERO_REDIRECT_URI --project-name gershon-finance
# Enter: https://finance.gershoncrm.com/auth/callback
```

**List secrets to verify:**
```bash
npx wrangler pages secret list --project-name gershon-finance
```

### Step 6: Add Custom Domain

**Option A: Via Cloudflare Dashboard**
1. Go to: https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **gershon-finance**
3. Click **Custom domains** tab
4. Click **Set up a custom domain**
5. Enter: `finance.gershoncrm.com`
6. Click **Activate domain**

**Option B: Via CLI**
```bash
npx wrangler pages domain add finance.gershoncrm.com --project-name gershon-finance
```

**DNS Configuration (automatically created):**
```
Type: CNAME
Name: finance
Target: gershon-finance.pages.dev
Proxy: ✅ Proxied (orange cloud)
```

### Step 7: Verify Deployment

**Check deployment:**
```bash
curl -I https://finance.gershoncrm.com
```

**Expected response:**
```
HTTP/2 200
content-type: text/html
```

**Test authentication:**
1. Open: https://finance.gershoncrm.com
2. Should see login page
3. Click "Sign in with Xero"
4. Complete OAuth flow
5. Dashboard should load

## Post-Deployment Configuration

### 1. SSL/TLS Settings
**In Cloudflare Dashboard:**
- **SSL/TLS mode:** Full (strict)
- **Always Use HTTPS:** Enabled
- **Minimum TLS Version:** 1.2

### 2. Security Headers
**Automatically handled by Cloudflare Workers:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block

### 3. Caching
**Cloudflare Pages automatic caching:**
- Static assets: cached at edge
- API routes: not cached
- Authentication: not cached

## Updating the Deployment

### Deploy New Version
```bash
# 1. Make changes to code
# 2. Build
npm run build

# 3. Deploy
npm run deploy
```

### Rollback to Previous Version
**Via Cloudflare Dashboard:**
1. Go to **Workers & Pages** → **gershon-finance**
2. Click **Deployments** tab
3. Find previous deployment
4. Click **Rollback to this deployment**

## Environment Variables Management

### View Current Variables
```bash
npx wrangler pages secret list --project-name gershon-finance
```

### Update a Variable
```bash
npx wrangler pages secret put VARIABLE_NAME --project-name gershon-finance
```

### Delete a Variable
```bash
npx wrangler pages secret delete VARIABLE_NAME --project-name gershon-finance
```

## Monitoring and Logs

### View Real-Time Logs
```bash
npx wrangler pages deployment tail --project-name gershon-finance
```

### View Analytics
**Cloudflare Dashboard:**
1. **Workers & Pages** → **gershon-finance**
2. Click **Analytics** tab
3. View:
   - Request volume
   - Error rates
   - Response times
   - Geographic distribution

## Troubleshooting

### Issue: OAuth Error After Deployment
**Cause:** Redirect URI not configured in Xero

**Solution:**
1. Go to https://developer.xero.com/app/manage
2. Add: `https://finance.gershoncrm.com/auth/callback`
3. Save and test again

### Issue: Environment Variables Not Working
**Cause:** Secrets not set or deployment not updated

**Solution:**
```bash
# Check if secrets are set
npx wrangler pages secret list --project-name gershon-finance

# If missing, set them
npx wrangler pages secret put XERO_CLIENT_ID --project-name gershon-finance

# Redeploy
npm run deploy
```

### Issue: Custom Domain Not Working
**Cause:** DNS not propagated or CNAME incorrect

**Solution:**
```bash
# Check DNS
dig finance.gershoncrm.com

# Expected output:
# finance.gershoncrm.com. 300 IN CNAME gershon-finance.pages.dev.

# If incorrect, update in Cloudflare DNS dashboard
```

### Issue: Login Page Shows But Dashboard Errors
**Cause:** Session management or API errors

**Solution:**
```bash
# Check logs
npx wrangler pages deployment tail --project-name gershon-finance

# Check browser console for errors
# Verify environment variables are set correctly
```

## Testing Checklist

After deployment, verify:

- [ ] **Homepage loads:** https://finance.gershoncrm.com
- [ ] **Login page shows:** Default view without auth
- [ ] **Xero OAuth works:** Can click "Sign in with Xero"
- [ ] **OAuth redirect:** Returns to https://finance.gershoncrm.com/auth/callback
- [ ] **Dashboard loads:** After successful authentication
- [ ] **Invoices tab:** Loads real data from Xero
- [ ] **Clients tab:** Shows clients awaiting payment
- [ ] **Trends tab:** Displays payment trends with sortable columns
- [ ] **Sheets Links:** CSV export URLs work
- [ ] **Logout:** Returns to login page
- [ ] **Session persists:** Refresh doesn't log out

## Performance Optimization

### Cloudflare Pages Benefits
- **Global CDN:** Deployed to 300+ data centers
- **Zero cold starts:** Instant response times
- **Automatic scaling:** Handle any traffic volume
- **Free tier:** 500 builds/month, unlimited requests

### Expected Performance
- **First Byte:** < 50ms
- **Dashboard Load:** < 500ms
- **API Response:** < 200ms
- **Global Latency:** < 100ms (99th percentile)

## Security Best Practices

### 1. Environment Variables
- ✅ Never commit secrets to git
- ✅ Use Cloudflare Pages secrets
- ✅ Rotate credentials regularly

### 2. OAuth Security
- ✅ Use HTTPS only
- ✅ Validate redirect URIs
- ✅ Implement token refresh
- ✅ Secure session storage

### 3. Access Control
- ✅ Xero OAuth required
- ✅ Session tokens validated
- ✅ API endpoints protected
- ✅ Automatic token refresh

## URLs Summary

### Production URLs
- **Main Domain:** https://finance.gershoncrm.com
- **Pages URL:** https://gershon-finance.pages.dev
- **Branch URL:** https://main.gershon-finance.pages.dev

### OAuth URLs
- **Login:** https://finance.gershoncrm.com/auth/login
- **Callback:** https://finance.gershoncrm.com/auth/callback
- **Status:** https://finance.gershoncrm.com/api/auth/status

### API Endpoints
- **Health:** https://finance.gershoncrm.com/api/health
- **Invoices:** https://finance.gershoncrm.com/api/invoices/summary
- **Clients:** https://finance.gershoncrm.com/api/clients/awaiting-payment
- **Trends:** https://finance.gershoncrm.com/api/payment-trends

## Support Resources

### Cloudflare Documentation
- Pages: https://developers.cloudflare.com/pages
- Workers: https://developers.cloudflare.com/workers
- DNS: https://developers.cloudflare.com/dns

### Xero Documentation
- OAuth 2.0: https://developer.xero.com/documentation/guides/oauth2/overview
- API Reference: https://developer.xero.com/documentation/api/api-overview

## Deployment Checklist

**Pre-Deployment:**
- [ ] Code tested in sandbox environment
- [ ] Xero OAuth app configured with production redirect URI
- [ ] Cloudflare API token created
- [ ] Domain DNS managed by Cloudflare

**Deployment:**
- [ ] Project built successfully (`npm run build`)
- [ ] Cloudflare Pages project created
- [ ] Deployment completed without errors
- [ ] Environment variables set
- [ ] Custom domain added
- [ ] DNS records created

**Post-Deployment:**
- [ ] All URLs accessible
- [ ] OAuth flow works end-to-end
- [ ] Dashboard loads with real data
- [ ] All features tested
- [ ] Performance verified
- [ ] Security headers present

## Summary

**Project Name:** gershon-finance  
**Production URL:** https://finance.gershoncrm.com  
**Platform:** Cloudflare Pages  
**Framework:** Hono + TypeScript  
**Authentication:** Xero OAuth 2.0  

**Status:** Ready for deployment  
**Next Step:** Configure Cloudflare API token in Deploy tab
