# Quick Deployment Commands

## 🚀 Deploy to finance.gershoncrm.com

### Prerequisites
```bash
# 1. Setup Cloudflare API token in Deploy tab
# 2. Update Xero OAuth redirect URI to: https://finance.gershoncrm.com/auth/callback
```

### One-Time Setup
```bash
# Create Cloudflare Pages project
npx wrangler pages project create gershon-finance \
  --production-branch main \
  --compatibility-date 2024-01-01
```

### Deploy
```bash
# Build and deploy
npm run deploy

# Or manually:
npm run build
npx wrangler pages deploy dist --project-name gershon-finance
```

### Set Environment Variables
```bash
npx wrangler pages secret put XERO_CLIENT_ID --project-name gershon-finance
npx wrangler pages secret put XERO_CLIENT_SECRET --project-name gershon-finance
npx wrangler pages secret put XERO_REDIRECT_URI --project-name gershon-finance
# Enter: https://finance.gershoncrm.com/auth/callback
```

### Add Custom Domain
```bash
npx wrangler pages domain add finance.gershoncrm.com --project-name gershon-finance
```

### Test
```bash
curl https://finance.gershoncrm.com
```

## URLs
- **Production:** https://finance.gershoncrm.com
- **Pages URL:** https://gershon-finance.pages.dev
- **Login:** https://finance.gershoncrm.com/auth/login
