# Xero Reports Dashboard - Usage Guide

## 🎯 Quick Start

Your Xero Reports Dashboard is now running and accessible at:

**Public URL**: https://3000-ipvcm98kowbtq5i0syvrt-de59bda9.sandbox.novita.ai

## 📱 Current Features

### 1. Dashboard Overview
The main dashboard displays real-time invoice statistics:
- **Draft Invoices**: Number and total amount of draft invoices
- **Awaiting Payment**: Invoices authorized but not yet paid
- **Overdue**: Invoices past due date with outstanding balances
- **Visual Chart**: Interactive bar chart showing invoice metrics

### 2. Invoices Tab
View and filter your invoices:
- Click **Draft** button to see draft invoices
- Click **Awaiting** button to see invoices awaiting payment
- Click **Paid** button to see completed invoices
- Click **All** button to see all invoices
- Table shows: Invoice #, Contact, Date, Due Date, Total, Amount Due, Status

### 3. Reports Tab
Generate financial reports:
- **Profit & Loss Report**: Click "Generate Report" to view income and expenses
- **Balance Sheet Report**: Click "Generate Report" to view assets, liabilities, and equity
- Export options (CSV, PDF) - coming soon

### 4. Transactions Tab
View bank transaction history:
- Click "Load Transactions" to fetch data
- See transaction date, contact, type (RECEIVE/SPEND), amount, and reference
- Color-coded: Green for income, Red for expenses

## 🔄 Demo Mode

The application currently runs in **Demo Mode** with sample data. This allows you to:
- Test all features without Xero authentication
- See the interface and user experience
- Understand the data structure and reporting capabilities

**Demo Data Includes:**
- 92 total invoices
- 16 draft invoices ($30,017.87)
- 38 awaiting payment ($63,313.81)
- 38 overdue invoices ($63,313.81)

## 🔐 Connecting to Your Xero Account

To connect your real Xero data, you'll need to:

1. **Set up Xero Developer Account**:
   - Go to https://developer.xero.com/myapps
   - Create a new app
   - Get your Client ID and Client Secret

2. **Configure Authentication**:
   - Add OAuth2 implementation (development in progress)
   - Set up redirect URI
   - Store credentials securely

3. **Grant Permissions**:
   - Authorize the app to access your Xero data
   - Select appropriate scopes (accounting.reports.read, accounting.transactions, etc.)

## 📊 Understanding Your Data

### Invoice Statuses
- **DRAFT**: Invoice created but not sent
- **SUBMITTED**: Invoice submitted for approval
- **AUTHORISED**: Invoice approved and sent to customer
- **PAID**: Invoice fully paid
- **VOIDED**: Invoice cancelled

### Transaction Types
- **RECEIVE**: Money coming in (sales, payments received)
- **SPEND**: Money going out (purchases, payments made)

### Report Types
- **Profit & Loss**: Shows revenue and expenses over a period
- **Balance Sheet**: Shows financial position at a specific date
- **Trial Balance**: Lists all accounts with debits and credits (coming soon)

## 🛠️ Technical Details

### API Endpoints Available
```
GET /api/health              - Health check
GET /api/auth/status         - Check authentication status
GET /api/invoices/summary    - Get invoice statistics
GET /api/invoices            - List invoices (with filters)
GET /api/reports/profit-loss - Generate P&L report
GET /api/reports/balance-sheet - Generate Balance Sheet
GET /api/transactions        - List bank transactions
GET /api/demo/summary        - Demo data endpoint
```

### Query Parameters
```
# Invoices
?status=DRAFT|AUTHORISED|PAID
?fromDate=2024-01-01
?toDate=2024-12-31

# Reports
?fromDate=2024-01-01
?toDate=2024-12-31
?date=2024-12-31
```

## 🚀 Next Steps

### Immediate (Week 1-2)
1. Implement Xero OAuth2 authentication
2. Add session management with Cloudflare KV
3. Test with real Xero data

### Short-term (Week 3-4)
1. Add CSV export functionality
2. Implement PDF report generation
3. Add date range filters to UI

### Medium-term (Month 2)
1. Add Excel export support
2. Implement scheduled auto-refresh
3. Add email report delivery
4. Create custom report builder

## 📞 Support & Resources

### Documentation
- Xero API Docs: https://developer.xero.com/documentation
- Hono Framework: https://hono.dev
- Cloudflare Pages: https://pages.cloudflare.com

### Troubleshooting

**App not loading?**
- Check if service is running: `pm2 list`
- View logs: `pm2 logs xero-reports-webapp --nostream`
- Restart: `pm2 restart xero-reports-webapp`

**Demo data not showing?**
- Clear browser cache
- Try endpoint directly: `curl http://localhost:3000/api/demo/summary`
- Check browser console for errors (F12)

**Port 3000 in use?**
- Kill process: `fuser -k 3000/tcp`
- Or use: `npm run clean-port`

## 💡 Tips & Best Practices

1. **Data Refresh**: Click the "Refresh" button in the navigation bar to reload dashboard data

2. **Browser Compatibility**: Best viewed in modern browsers (Chrome, Firefox, Safari, Edge)

3. **Mobile Access**: The interface is responsive and works on tablets and phones

4. **Keyboard Shortcuts**:
   - Ctrl+R or F5: Refresh page
   - Ctrl+Shift+I or F12: Open developer tools

5. **Performance**: First load may take a few seconds. Subsequent loads are cached.

## 🔒 Security Notes

- Always use HTTPS in production
- Never share your Xero API credentials
- Keep your access tokens secure
- Log out when using shared computers

## 📈 Monitoring

Check application health:
```bash
# API health check
curl http://localhost:3000/api/health

# View application logs
pm2 logs xero-reports-webapp

# Monitor resource usage
pm2 monit
```

## 🎨 Customization

The application uses Tailwind CSS for styling. To customize:
- Edit `/public/static/styles.css` for custom styles
- Modify colors in the HTML templates
- Adjust chart colors in `/public/static/app.js`

## 📝 Feedback

For feature requests, bug reports, or questions, please contact the development team.

---

**Remember**: This is currently in Demo Mode. Real Xero data integration requires OAuth2 setup and authentication.
