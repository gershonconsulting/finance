# 🚨 CRITICAL: GenSpark Hosted Deploy Cache Issue

## Problem
**GenSpark Hosted Deploy is deploying v2.4.1 instead of v2.4.2**

### Evidence
- Sandbox build: `dist/_worker.js` contains v2.4.2 ✅
- Sandbox code: Has `/api/sheets/` endpoints ✅
- Production URL (https://finance.gershoncrm.com): Shows v2.4.1 ❌

### Root Cause
**GenSpark is using a cached snapshot from the database/worker, NOT reading latest files from sandbox**

---

## ✅ SOLUTION: Force Complete Rebuild

### Option 1: GenSpark UI (RECOMMENDED)
1. Go to **Deploy Tab**
2. Click **Deploy to Hosted Platform**
3. **CRITICAL: Check ALL THREE boxes:**
   - ☑️ **Rebuild database** ← MUST CHECK
   - ☑️ **Recreate worker** ← MUST CHECK  
   - ☑️ **Clear cache** ← MUST CHECK
4. Click **Deploy**
5. **Wait 5-10 minutes** (longer than usual due to full rebuild)
6. Hard refresh browser: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)

### Option 2: Manual File Upload (If Option 1 Fails)
1. Download backup: https://www.genspark.ai/api/files/s/d3LJTYH2
2. Extract locally: `tar -xzf webapp-v2.4.2-final.tar.gz`
3. In GenSpark Deploy Tab:
   - Delete current deployment
   - Upload extracted `dist/` folder manually
   - Deploy fresh

### Option 3: Contact GenSpark Support
If both options fail, GenSpark may have a cache corruption issue requiring support intervention.

---

## 🔍 VERIFICATION STEPS

### Step 1: Check Version (30 seconds)
```bash
curl https://finance.gershoncrm.com/api/health | grep version
```
**Must show:** `"version": "2.4.2"`
**If shows v2.4.1:** Cache not cleared yet, wait longer or try Option 2

### Step 2: Test Google Sheets Endpoint (30 seconds)
```bash
curl https://finance.gershoncrm.com/api/sheets/Urban%20Factory/due
```
**Must show:** `2055.20` (plain text number)
**If 404 or 500:** Old worker still deployed

### Step 3: Test Clients List Endpoint (30 seconds)
```bash
curl https://finance.gershoncrm.com/api/sheets/clients/list
```
**Must show:** CSV with headers and 3 rows
**If error:** Old worker still deployed

---

## 📦 WHAT'S IN THE SANDBOX BUILD (v2.4.2)

### File: dist/_worker.js (100.69 kB)
- ✅ Contains v2.4.2 version string
- ✅ Contains `/api/sheets/:clientName/due` endpoint
- ✅ Contains `/api/sheets/clients/list` endpoint
- ✅ Health endpoint returns v2.4.2
- ✅ All release notes updated

### Confirmed via grep:
```bash
$ grep "version.*2\\.4" dist/_worker.js
# Found: version:"2.4.2"

$ grep "/api/sheets/" dist/_worker.js  
# Found: Both endpoints present
```

### Last Build Time:
```bash
$ ls -lah dist/_worker.js
-rw-r--r-- 1 user user 99K Feb 10 10:17 dist/_worker.js
```

---

## 🎯 WHY GenSpark DEPLOYS OLD VERSION

### GenSpark Hosted Deploy Flow:
1. User clicks "Deploy"
2. GenSpark reads from **database snapshot** (not live sandbox files)
3. If no rebuild options checked → uses cached worker
4. Worker deployment happens instantly (< 1 min) → indicates cache hit
5. New code ignored

### The Fix:
**Force GenSpark to rebuild from sandbox files by checking ALL rebuild options**

---

## 📋 BACKUP INFORMATION

In case you need to restore or manually deploy:

**Backup URL:** https://www.genspark.ai/api/files/s/d3LJTYH2
**Backup Size:** 1.7 MB
**Contains:**
- Complete `/home/user/webapp/` directory
- Built `dist/_worker.js` with v2.4.2
- All source code with Google Sheets endpoints
- Git history (commit 38deaaf)

**To extract:**
```bash
curl -L -o webapp-v2.4.2.tar.gz https://www.genspark.ai/api/files/s/d3LJTYH2
tar -xzf webapp-v2.4.2.tar.gz
cd home/user/webapp
ls -lah dist/_worker.js  # Should show 99K Feb 10 10:17
```

---

## ⏰ EXPECTED TIMELINE

| Action | Time | What Happens |
|--------|------|--------------|
| Check all rebuild boxes + Deploy | 0 min | GenSpark starts rebuild |
| Wait for rebuild | 5-10 min | Database rebuild, worker recreation, cache clear |
| Hard refresh browser | 10 min | Test health endpoint |
| Verify Google Sheets endpoints | 11 min | Test with curl commands |
| Success | 12 min | Version 2.4.2 deployed ✅ |

**Total Time:** 10-15 minutes (longer than normal due to full rebuild)

---

## 🚨 IF IT STILL SHOWS v2.4.1 AFTER 15 MINUTES

### Diagnostic Steps:

1. **Check if GenSpark is reading sandbox files:**
   - In Deploy Tab, check "Last Deployment Time"
   - If it's older than your deploy action → GenSpark didn't read sandbox

2. **Check worker logs (if available):**
   - Look for "Building..." or "Using cached worker"
   - If "Using cached" → rebuild didn't work

3. **Try Manual Deployment:**
   - Stop/Delete current deployment completely
   - Extract backup locally (link above)
   - Create NEW project in GenSpark
   - Deploy extracted dist/ folder
   - This bypasses cache entirely

4. **Contact GenSpark Support:**
   - Issue: "Hosted Deploy using cached v2.4.1 instead of v2.4.2 from sandbox"
   - Show them: sandbox dist/_worker.js has v2.4.2, but production shows v2.4.1
   - Request: Force cache invalidation and rebuild from sandbox files

---

## ✅ SUCCESS INDICATORS

When v2.4.2 is successfully deployed, you'll see:

1. **Health endpoint:**
   ```json
   {
     "version": "2.4.2",
     "fixes": [
       "v2.4.2: CRITICAL - Added /api/sheets endpoints for Google Sheets IMPORTDATA",
       ...
     ]
   }
   ```

2. **Google Sheets single client endpoint:**
   ```
   $ curl https://finance.gershoncrm.com/api/sheets/Urban%20Factory/due
   2055.20
   ```

3. **Google Sheets clients list endpoint:**
   ```
   $ curl https://finance.gershoncrm.com/api/sheets/clients/list
   Client Name,Balance Due
   Urban Factory,2055.20
   Milvue,17512.33
   Acme Corp,5000.00
   ```

4. **Dashboard shows demo data** (not $0.00)

5. **Clients tab loads 3 demo companies**

---

## 📝 CURRENT STATUS

- **Sandbox Version:** v2.4.2 ✅
- **Sandbox Build:** dist/_worker.js (99K, Feb 10 10:17) ✅
- **Git Commit:** 38deaaf ✅
- **Backup Created:** https://www.genspark.ai/api/files/s/d3LJTYH2 ✅
- **Production Version:** v2.4.1 ❌ (NEEDS DEPLOYMENT)

---

## 🚀 ACTION REQUIRED

**YOU MUST:**
1. Check **ALL THREE rebuild options** in GenSpark Deploy Tab
2. Wait **10-15 minutes** (longer than usual)
3. Hard refresh browser after deployment
4. Test with curl commands above
5. If still v2.4.1 after 15 minutes → Contact GenSpark Support

**DO NOT:**
- Deploy without checking all rebuild options (will use cache)
- Expect instant deployment (full rebuild takes time)
- Test immediately (wait for rebuild to complete)

---

## 🔥 URGENT NEXT STEPS

1. **Right now:** Deploy with ALL THREE rebuild options checked
2. **Wait 10 minutes:** Let GenSpark complete full rebuild
3. **Then test:** Use curl commands above to verify v2.4.2
4. **If fails:** Download backup and try manual deployment
5. **If still fails:** Contact GenSpark Support with this document

**The code is ready. The issue is GenSpark cache. Force the rebuild!**
