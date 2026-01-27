# Xero OAuth Configuration

## Production Credentials

**IMPORTANT: These credentials are for production use only. Keep them secure!**

```
XERO_CLIENT_ID=0CA378B164364DB0821A6014520913E6
XERO_CLIENT_SECRET=-OvY_3_op75SDteQt6tOqvZVyZ3Ihq07aE32QYGOCWiqHhvh
```

## Required Redirect URIs in Xero

**You MUST add these to your Xero OAuth app:**

### For Production (finance.gershoncrm.com)
```
https://finance.gershoncrm.com/auth/callback
```

### For Sandbox Testing
```
https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

## How to Update Xero OAuth App

1. **Go to:** https://developer.xero.com/app/manage
2. **Find app with Client ID:** `0CA378B164364DB0821A6014520913E6`
3. **Click Edit**
4. **Redirect URIs section:**
   - Click "Add URI"
   - Add: `https://finance.gershoncrm.com/auth/callback`
   - Click "Add URI" again
   - Add: `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback`
5. **Save changes**

## Environment Variables for Deployment

### For Production (finance.gershoncrm.com)
```bash
XERO_CLIENT_ID=0CA378B164364DB0821A6014520913E6
XERO_CLIENT_SECRET=-OvY_3_op75SDteQt6tOqvZVyZ3Ihq07aE32QYGOCWiqHhvh
XERO_REDIRECT_URI=https://finance.gershoncrm.com/auth/callback
```

### For Sandbox Testing
```bash
XERO_CLIENT_ID=0CA378B164364DB0821A6014520913E6
XERO_CLIENT_SECRET=-OvY_3_op75SDteQt6tOqvZVyZ3Ihq07aE32QYGOCWiqHhvh
XERO_REDIRECT_URI=https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/callback
```

## Required OAuth Scopes

Make sure these scopes are enabled in your Xero app:
- `accounting.reports.read`
- `accounting.transactions.read`
- `accounting.contacts.read`
- `accounting.settings.read`
- `offline_access`

## Testing URLs

### Sandbox (Current Environment)
- **Login**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai/auth/login
- **Dashboard**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai

### Production (After Deployment)
- **Login**: https://finance.gershoncrm.com/auth/login
- **Dashboard**: https://finance.gershoncrm.com

## Security Notes

- ⚠️ **NEVER commit these credentials to git**
- ⚠️ **Store in environment variables only**
- ⚠️ **Use GenSpark Deploy tab to configure**
- ⚠️ **Client Secret is sensitive - treat like a password**

## Status

- ✅ Client ID: Confirmed
- ✅ Client Secret: Updated
- ⏳ Redirect URIs: Need to be added to Xero
- ⏳ Environment variables: Need to be set in deployment

## Next Steps

1. Add redirect URIs to Xero OAuth app
2. Set environment variables in GenSpark Deploy tab
3. Deploy to production
4. Test authentication

---

**Last Updated**: January 27, 2026
