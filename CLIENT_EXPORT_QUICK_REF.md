# 📊 Google Sheets Client Balance - Quick Reference

## ✨ Feature: Export Individual Client Balances

---

## 🎯 The Formula You Requested

### Urban Factory Example
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")
```

**Expected Result:** `2055.20`

---

## 📋 Quick Reference

### Syntax
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/CLIENT_NAME/due")
```

### Examples
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Milvue/due")
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Acme Corp/due")
```

### Get All Clients at Once
```
=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/clients/list")
```

---

## 🚀 Next Steps

1. **Redeploy to GenSpark** (to activate this feature)
2. **Sign in to Xero** at `https://finance.gershoncrm.com`
3. **Open Google Sheets** and use the formula
4. **See your live balance!** 🎉

---

## 📊 Ready-to-Use Google Sheets Template

Copy this into Google Sheets:

| A | B |
|---|---|
| **Client Name** | **Balance Due** |
| Urban Factory | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Urban Factory/due")` |
| Milvue | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Milvue/due")` |
| Acme Corp | `=IMPORTDATA("https://finance.gershoncrm.com/api/sheets/Acme Corp/due")` |
| **TOTAL** | `=SUM(B2:B4)` |

---

## ✅ Status

- ✅ **Code:** Ready
- ✅ **Tested:** Local sandbox
- 🟡 **Production:** Awaiting redeploy
- 📚 **Docs:** [GOOGLE_SHEETS_CLIENT_EXPORT.md](./GOOGLE_SHEETS_CLIENT_EXPORT.md)

---

**Deploy now and start using!** 🚀
