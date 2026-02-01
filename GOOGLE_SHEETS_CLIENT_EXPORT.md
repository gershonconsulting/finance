# 📊 Google Sheets Client Balance Export

## ✨ New Feature: Individual Client Balance Export

You can now export the exact balance due for any specific client directly to Google Sheets using the `IMPORTDATA` function.

---

## 🎯 Usage

### Basic Syntax
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/CLIENT_NAME/due")
```

### Example: Urban Factory
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")
```

**Result:** `2055.20` (as a number Google Sheets can use in formulas)

---

## 📋 How It Works

1. **Replace `CLIENT_NAME`** with the exact client name from your Xero account
2. **Spaces are supported** - URL encoding is handled automatically
3. **Case-insensitive** - "Urban Factory", "urban factory", "URBAN FACTORY" all work
4. **Returns a number** - Google Sheets treats it as currency/number for calculations
5. **Updates automatically** - Data refreshes when Google Sheets reloads

---

## 💡 Real-World Examples

### Single Client Balance
```
Cell A1: Urban Factory
Cell B1: =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A1&"/due")
Result: 2055.20
```

### Multiple Clients
```
Row 1: Client Name | Balance Due
Row 2: Urban Factory | =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")
Row 3: Milvue | =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Milvue/due")
Row 4: Acme Corp | =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Acme Corp/due")
```

### Dynamic Client List
```
// Get all clients and their balances
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")
```

Returns CSV:
```
Client Name,Amount Due
Urban Factory,2055.20
Milvue,17512.33
Acme Corp,5000.00
...
```

---

## 🔧 API Endpoints

### 1. Get Client Balance
**Endpoint:** `/api/sheets/:clientName/due`

**Method:** `GET`

**Example:**
```bash
curl https://finance.gershoncrm.com/api/sheets/Urban%20Factory/due
```

**Response:** `2055.20` (plain text number)

**Google Sheets:**
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")
```

---

### 2. List All Clients
**Endpoint:** `/api/sheets/clients/list`

**Method:** `GET`

**Example:**
```bash
curl https://finance.gershoncrm.com/api/sheets/clients/list
```

**Response:** CSV format
```
Client Name,Amount Due
Urban Factory,2055.20
Milvue,17512.33
Acme Corp,5000.00
```

**Google Sheets:**
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")
```

---

## 🎨 Google Sheets Template

### Option 1: Simple List

| A | B |
|---|---|
| **Client Name** | **Balance Due** |
| Urban Factory | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")` |
| Milvue | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Milvue/due")` |
| Acme Corp | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Acme Corp/due")` |

---

### Option 2: Dynamic with Reference

| A | B |
|---|---|
| **Client Name** | **Balance Due** |
| Urban Factory | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A2&"/due")` |
| Milvue | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A3&"/due")` |
| Acme Corp | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A4&"/due")` |

**Benefits:**
- Change client name in column A, formula updates automatically
- Easy to drag down for multiple clients
- Can sort/filter without breaking formulas

---

### Option 3: Complete Auto-Import

Use the list endpoint to get ALL clients at once:

```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")
```

**Result:** Automatically populates with all clients and their balances!

```
Client Name         | Amount Due
Urban Factory       | 2055.20
Milvue             | 17512.33
Acme Corp          | 5000.00
Demo Client A      | 3000.00
Demo Client B      | 7500.00
```

---

## 🔐 Authentication

**Important:** You must be authenticated with Xero for these endpoints to work.

### How to Authenticate:
1. Visit: `https://finance.gershoncrm.com`
2. Click "Sign in with Xero"
3. Authorize your organization
4. Your session is stored and persists across requests

### Session Handling:
- Session token stored in browser localStorage
- Token included automatically in API requests
- Lasts until you logout or clear cookies
- Google Sheets uses server-side authentication

**Note:** For Google Sheets to work, you need to ensure your session is valid. The dashboard maintains your session automatically.

---

## 🧪 Testing

### Test Individual Client
```bash
# Test with session token
curl -H "X-Session-Token: YOUR_SESSION_TOKEN" \
  https://finance.gershoncrm.com/api/sheets/Urban%20Factory/due
```

Expected: `2055.20`

### Test Client List
```bash
curl -H "X-Session-Token: YOUR_SESSION_TOKEN" \
  https://finance.gershoncrm.com/api/sheets/clients/list
```

Expected: CSV with all clients and balances

---

## 📊 Advanced Use Cases

### 1. Total Outstanding Across Multiple Clients
```
Cell A1: Urban Factory
Cell A2: Milvue  
Cell A3: Acme Corp

Cell B1: =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A1&"/due")
Cell B2: =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A2&"/due")
Cell B3: =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A3&"/due")

Cell B4: =SUM(B1:B3)  // Total outstanding
```

### 2. Conditional Formatting
```
// Highlight clients with balance > $10,000
Format > Conditional formatting
Apply to range: B2:B100
Format cells if: Greater than 10000
Formatting style: Red background
```

### 3. Dashboard with SPARKLINE
```
Cell A1: Client Name
Cell B1: Current Balance
Cell C1: Trend

Cell B2: =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/"&A2&"/due")
Cell C2: =SPARKLINE(B2:B2, {"charttype","bar"})
```

### 4. Export to Chart
1. Import all clients: `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")`
2. Select data range
3. Insert > Chart
4. Choose Pie Chart or Bar Chart
5. Visualize balances by client

---

## ❗ Error Handling

### Client Not Found
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/NonExistent Client/due")
```
**Returns:** `0`

### Not Authenticated
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")
```
**Returns:** `Error: Not authenticated`

**Solution:** Sign in at `https://finance.gershoncrm.com`

### Special Characters in Client Names
If client name has special characters, URL encoding is handled automatically:
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Smith & Sons/due")
```
Works without manual encoding!

---

## 🚀 Deployment

### Current Status
- ✅ **Sandbox:** Working at `https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai`
- 🟡 **Production:** Ready to deploy to `https://finance.gershoncrm.com`

### To Deploy
1. Redeploy on GenSpark (Deploy tab)
2. Wait 1-2 minutes
3. Test with your Xero data

---

## 📝 Complete Example Sheet

Here's a complete Google Sheets template you can use:

```
     A                    B                                                           C
1    Client Name          Balance Due                                                 Formula
2    Urban Factory        =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")
3    Milvue              =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Milvue/due")
4    Acme Corp           =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Acme Corp/due")
5    
6    TOTAL               =SUM(B2:B4)
7
8    All Clients (Auto)
9    =IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")
```

---

## ✅ Summary

| Feature | Endpoint | Google Sheets Formula |
|---------|----------|----------------------|
| **Single Client Balance** | `/api/sheets/:clientName/due` | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")` |
| **All Clients List** | `/api/sheets/clients/list` | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")` |

**Expected Result for Urban Factory:** `2055.20`

**Ready to use after redeployment!** 🎉

---

## 🆘 Support

If you encounter issues:
1. Ensure you're signed in at `https://finance.gershoncrm.com`
2. Check client name spelling (case-insensitive)
3. Test the endpoint directly with `curl` first
4. Verify Google Sheets can access external URLs (check permissions)

---

**Let me know when you've redeployed and I'll help you test it with your real Xero data!**
