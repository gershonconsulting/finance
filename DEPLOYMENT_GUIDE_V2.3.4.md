# Deployment Guide - v2.3.4 🎯

## Critical Fix: Session Storage Architecture

### Root Cause Analysis

**What Broke:**
- Authentication was working before Feb 5, 2026
- After v2.3.0-v2.3.3 changes, users could authenticate with Xero but immediately got logged out
- The OAuth callback would redirect to the dashboard, but the session was lost

**Why It Broke:**
The application uses **Cloudflare Workers** (via `wrangler.jsonc`) for deployment, NOT Node.js:
- Cloudflare Workers are **stateless** - they restart frequently
- Sessions were stored in an **in-memory `Map()`** - cleared on every restart
- After OAuth callback, the session token was saved in localStorage, but when the frontend checked `/api/auth/status`, the server had already forgotten the session

**Evidence:**
```bash
curl https://finance.gershoncrm.com/api/health
# Returns: "server": "cloudflare-workers"
```

### The Fix (v2.3.4)

**Changed:**
- ❌ **Before:** Server-side `Map<string, SessionData>()` (lost on restart)
- ✅ **After:** Client-side Base64-encoded tokens (stored in browser, decoded on server)

**How It Works:**
1. **OAuth callback:** Server creates a Base64-encoded token containing `{accessToken, refreshToken, tenantId, expiresAt}`
2. **Frontend:** Stores the token in `localStorage` as `xero_session`
3. **API requests:** Frontend sends token via `X-Session-Token` header
4. **Server:** Decodes the token to get session data (no server-side storage needed)
5. **Token refresh:** When expired, server refreshes the token and returns updated Base64 string

**Code Changes:**
```typescript
// OLD (v2.3.3 and earlier)
const sessions = new Map<string, SessionData>();
function createSession(data: SessionData): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, data);  // ❌ Lost on restart
  return sessionId;
}

// NEW (v2.3.4)
function encodeSession(session: SessionData): string {
  return btoa(JSON.stringify(session));  // ✅ Client stores full session
}

function decodeSession(encoded: string): SessionData | null {
  return JSON.parse(atob(encoded));  // ✅ Server decodes on demand
}
```

---

## Deployment Steps

### 1. Pre-Deployment Checklist

✅ **Code Ready:**
- Git commit: `df3c3bd`
- Version: `2.3.4`
- Release: `Feb 5, 2026 7:30 PM UTC`

✅ **Files Updated:**
- `src/index.tsx` - Session storage rewritten
- `public/index.html` - Version updated to 2.3.4
- `package.json` - Version bumped to 2.3.4
- `dist/` - Rebuilt with new code

✅ **Local Tests Passed:**
```bash
# Health endpoint
curl http://localhost:3000/api/health
# Expected: {"version": "2.3.4"}

# Auth status (without token)
curl http://localhost:3000/api/auth/status
# Expected: {"authenticated": false}

# OAuth redirect
curl -I http://localhost:3000/auth/login
# Expected: 302 redirect to login.xero.com
```

---

### 2. Deploy to Production

**A. In GenSpark Dashboard:**

1. **Open Deploy Tab**
   - Project: `Gershon Finance Dashboard`
   - Current version on production: `2.3.3` (broken auth)
   - Target version: `2.3.4` (fixed auth)

2. **Deploy Configuration:**
   - Platform: `Hosted Platform`
   - ✅ Check: `Rebuild database`
   - ✅ Check: `Recreate worker`

3. **Click Deploy**

4. **Wait 2-3 minutes**
   - GenSpark will:
     - Pull latest commit (`df3c3bd`)
     - Run `npm install`
     - Run `npm run build` (creates `dist/`)
     - Deploy `dist/` to Cloudflare Workers
     - Start the worker

---

### 3. Verify Deployment

**A. Check Health Endpoint**

```bash
curl https://finance.gershoncrm.com/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-05T19:30:00.000Z",
  "version": "2.3.4",
  "releaseDate": "2026-02-05T19:30:00Z",
  "server": "cloudflare-workers",
  "fixes": [
    "v2.3.4: Fixed session storage - switched from in-memory Map to client-side tokens for Cloudflare Workers",
    "v2.3.3: QA tested - removed duplicate auth endpoint, verified all features"
  ]
}
```

**If wrong version:**
- Wait 2 more minutes (deployment might be slow)
- Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Re-check health endpoint
- If still wrong, deployment failed - check GenSpark logs

---

**B. Test Homepage**

```
https://finance.gershoncrm.com/
```

**Expected:**
- Header shows: `Gershon Finance Dashboard v2.3.4`
- Time shows: `• Feb 5, 2026 7:30 PM UTC`
- `Sign in with Xero` button visible
- No console errors (press F12 → Console tab)

**If wrong version:**
- This is a **browser cache issue** (static HTML cached)
- Hard refresh: `Ctrl + Shift + R` or `Cmd + Shift + R`
- If still wrong, try incognito mode
- Health endpoint should still show v2.3.4 (backend is correct)

---

**C. Test Authentication (Critical!)**

1. **Click "Sign in with Xero"**
   - Should redirect to `login.xero.com`
   - Login with your Xero account
   - Click "Allow access"

2. **After Authorization**
   - Should redirect to `https://finance.gershoncrm.com/`
   - Should see message: "Authentication successful! Redirecting..."
   - Should auto-redirect to dashboard

3. **Dashboard Should Load**
   - Header shows: `Xero Reports Dashboard v2.3.4`
   - "Logout" button visible (top right)
   - Dashboard tabs: `Dashboard`, `Invoices`, `Clients`, `Sheets Links`, `Settings`
   - No error: "Not authenticated" or "Failed to load"

4. **Test Clients Tab**
   - Click "Clients" tab
   - Should load a table with company names
   - No error: "Failed to load clients awaiting payment"

**If authentication fails:**
- Check browser console (F12 → Console)
- Look for errors like:
  - `Failed to fetch` → Network issue
  - `401 Unauthorized` → Session token not working
  - `SyntaxError: Unexpected token` → Response parsing issue

---

**D. Test Sheets Links (Optional)**

1. Click "Sheets Links" tab
2. Verify all URLs start with `https://finance.gershoncrm.com/api/`
3. **No sandbox URLs** (e.g., `sandbox.novita.ai`)

**Example URLs:**
```
=IMPORTDATA("https://finance.gershoncrm.com/api/export/summary")
=IMPORTDATA("https://finance.gershoncrm.com/api/export/clients-awaiting-payment")
=IMPORTDATA("https://finance.gershoncrm.com/api/export/invoices")
```

---

## Troubleshooting

### Issue 1: Authentication Still Fails After v2.3.4

**Symptoms:**
- OAuth callback succeeds
- Redirects to dashboard
- Immediately shows "Not authenticated" error

**Diagnosis:**
```bash
# Test with fake session token
curl -s https://finance.gershoncrm.com/api/auth/status \
  -H "X-Session-Token: eyJhY2Nlc3NUb2tlbiI6ImZha2UifQ=="

# Expected: {"authenticated": false, "tenantId": null}
# If returns 500 error: decodeSession() is broken
```

**Fix:**
- Check browser console for JavaScript errors
- Verify localStorage has `xero_session` key after OAuth
- Manually decode the token:
  ```javascript
  atob(localStorage.getItem('xero_session'))
  ```
- Should return JSON with `accessToken`, `refreshToken`, `tenantId`

---

### Issue 2: Health Endpoint Shows Old Version

**Symptoms:**
```bash
curl https://finance.gershoncrm.com/api/health
# Returns: "version": "2.3.3" (or older)
```

**Diagnosis:**
- Deployment didn't pull latest code
- Build failed silently
- Worker not restarted

**Fix:**
1. Check GenSpark deployment logs
2. Look for errors in build step (`npm run build`)
3. Redeploy with:
   - ✅ `Rebuild database`
   - ✅ `Recreate worker`
4. Wait 3-5 minutes (sometimes slow)
5. Re-check health endpoint

---

### Issue 3: Frontend Shows Old Version, Backend Correct

**Symptoms:**
```bash
# Backend correct:
curl https://finance.gershoncrm.com/api/health
# Returns: "version": "2.3.4" ✅

# Frontend wrong:
https://finance.gershoncrm.com/
# Shows: "v2.3.3" ❌
```

**Diagnosis:**
- Browser cached `public/index.html`
- Cloudflare edge cache hasn't updated

**Fix:**
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. If still wrong, try incognito mode
3. If still wrong, wait 5-10 minutes for Cloudflare edge cache to expire
4. Worst case: clear Cloudflare cache via Cloudflare dashboard

---

### Issue 4: Session Token Too Large

**Symptoms:**
- Authentication works
- Random 400/413 errors on API requests
- Error: "Request header too large"

**Diagnosis:**
- Base64 session token is 1-2 KB (should fit in header)
- If token > 8 KB, something is wrong

**Fix:**
- Check what's in the token:
  ```javascript
  JSON.parse(atob(localStorage.getItem('xero_session')))
  ```
- Should only contain: `accessToken`, `refreshToken`, `tenantId`, `expiresAt`
- If contains extra data, fix `createSessionToken()` in `src/index.tsx`

---

## Rollback Plan

**If v2.3.4 doesn't work:**

### Option A: Rollback to Last Known Good Version

**When did authentication last work?**
- User said: "It was working properly before now it does not"
- Last known good: **Before Feb 5, 2026**

**Find last good commit:**
```bash
cd /home/user/webapp
git log --oneline --before=2026-02-05 | head -10
```

**Rollback steps:**
1. Identify commit hash (e.g., `6b212b6`)
2. In GenSpark Deploy tab:
   - Manually trigger deploy from specific commit
   - Or: `git checkout 6b212b6 && git push -f origin main`
3. Wait 3 minutes
4. Test authentication

---

### Option B: Switch to Node.js Server (Drastic!)

**Why this would work:**
- Node.js server uses persistent processes
- In-memory `Map()` sessions would work
- But: requires different hosting setup

**How:**
1. Delete `wrangler.jsonc`
2. Update `package.json`:
   ```json
   "scripts": {
     "start": "node server.js"
   }
   ```
3. Ensure GenSpark uses `npm start` (not `wrangler`)
4. Redeploy

**Downside:**
- Loses Cloudflare Workers edge benefits
- Slower performance
- Different deployment process

---

## Success Criteria

✅ **Deployment Successful:**
- [ ] Health endpoint returns version `2.3.4`
- [ ] Frontend shows `v2.3.4 • Feb 5, 2026 7:30 PM UTC`
- [ ] OAuth flow works (redirects to Xero)
- [ ] After authorization, dashboard loads (no "Not authenticated" error)
- [ ] Clients tab loads company data
- [ ] Sheets Links tab shows production URLs only
- [ ] No console errors in browser (F12 → Console)

---

## What Changed Since v2.3.3

| Feature | v2.3.3 (Broken) | v2.3.4 (Fixed) |
|---------|-----------------|----------------|
| **Session Storage** | In-memory `Map()` (cleared on restart) | Base64 tokens (client-side) |
| **Session Lifecycle** | Lost when worker restarts | Persists across restarts |
| **Authentication** | ❌ Breaks after OAuth callback | ✅ Works permanently |
| **Code Location** | `sessions.set()` / `sessions.get()` | `encodeSession()` / `decodeSession()` |

---

## Contact & Support

**If issues persist:**
1. Take screenshots of:
   - Health endpoint response
   - Browser console errors (F12 → Console)
   - Clients tab error (if any)
2. Note exact symptoms:
   - When does it fail? (after OAuth? on page load?)
   - Error messages?
3. Share with development team

---

**Version:** 2.3.4  
**Date:** Feb 5, 2026 7:30 PM UTC  
**Commit:** df3c3bd  
**Status:** ✅ Ready for Deployment
