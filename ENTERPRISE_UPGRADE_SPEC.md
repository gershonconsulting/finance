# Gershon Finance Dashboard — Enterprise CFO Analytics Platform Upgrade Spec
## Target Version: v2.7.0 | Phase 1 Implementation

---

## SECTION 0 — MANDATORY PRE-FLIGHT (Read Before Any Code Change)

These are hard blockers, not suggestions. Stop and resolve each before writing code.

### 0.1 Verify Production State First
```bash
curl https://finance.gershoncrm.com/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['version'])"
```
Confirm the version matches `package.json`. If they diverge, diagnose before proceeding.

### 0.2 Non-Negotiable Guardrails (from CRITICAL_MISTAKES_REVIEW.md)

1. **Edit `public/` files for anything users see.** The `src/index.tsx` HTML fallback is NOT what Cloudflare Pages serves. All HTML/JS changes go in `public/index.html` and `public/static/app.js`.
2. **Every HTML element ID must have a matching JS reference.** Before claiming any feature done, `grep -n 'id="element-id"' public/index.html` and verify `getElementById('element-id')` exists in `public/static/app.js`.
3. **Every new tab needs ALL THREE parts simultaneously:** tab button in nav + `div#tab-name` content block + `load*()` function registered in the tab-switch handler.
4. **Every new API endpoint needs a demo data fallback.** Unauthenticated users must see realistic demo data, not errors.
5. **Never claim "done" without verifying the endpoint with curl.** After `npm run build`, start the server locally and curl each new endpoint.
6. **Version bumped exactly once per phase** — update `package.json` and the version badge in `public/index.html` (line 73) and the `/api/health` handler in `src/index.tsx`.
7. **Go slow. One feature completely before starting the next.**

---

## SECTION 1 — Architecture Reference Card

### File Roles (never confuse these)

| File | Purpose |
|---|---|
| `public/index.html` | Production HTML — tab buttons, content divs, element IDs |
| `public/static/app.js` | Production JS — load functions, display functions, tab-switch handler |
| `src/index.tsx` | Hono API server — all `app.get('/api/...')` routes |
| `src/services/xero-api.ts` | Xero data layer — `getInvoices()`, `getBankTransactions()`, `getProfitAndLossReport()`, etc. |
| `src/services/payment-trends.ts` | Existing analytics pattern to follow |
| `server.js` | Node.js mirror of `src/index.tsx` routes (must stay in sync) |
| `package.json` | Version source of truth |

### Code Patterns (copy-paste exact style)

**Tab button in `public/index.html`:**
```html
<button data-tab="tab-name" class="tab-button px-6 py-3 font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300">
    <i class="fas fa-icon-name mr-2"></i>Tab Label
</button>
```

**Tab content div:**
```html
<div id="tab-tab-name" class="tab-content hidden">
  <!-- content here -->
</div>
```

**Tab switch handler registration (in `public/static/app.js`, within the `DOMContentLoaded` tab-switch block around line 1463):**
```javascript
} else if (tabName === 'tab-name') {
  loadTabName();
}
```

**API route pattern in `src/index.tsx`:**
```typescript
app.get('/api/new/endpoint', async (c) => {
  try {
    const { session } = await getSessionWithRefresh(c);
    if (!session?.accessToken || !session?.tenantId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    const xero = new XeroApiService(session.accessToken, session.tenantId);
    // ... logic
    return c.json(result);
  } catch (error: any) {
    console.error('Error:', error);
    return c.json({ error: error.message || 'Failed' }, 500);
  }
});
```

**Demo endpoint pattern:**
```typescript
app.get('/api/demo/new-endpoint', (c) => {
  return c.json({ /* realistic hardcoded data */ });
});
```

**Frontend load function pattern in `public/static/app.js`:**
```javascript
async function loadNewTab() {
  try {
    let data;
    try {
      const response = await axios.get('/api/new/endpoint');
      data = response.data;
    } catch (error) {
      const response = await axios.get('/api/demo/new-endpoint');
      data = response.data;
    }
    // update DOM elements
  } catch (error) {
    console.error('Error loading new tab:', error);
  }
}
window.loadNewTab = loadNewTab;
```

---

## SECTION 2 — New Service File: `src/services/cfo-analytics.ts`

Create this file. Follow the same TypeScript class pattern as `src/services/payment-trends.ts`.

Import: `import type { XeroInvoice } from '../types/xero';`

Also import XeroBankTransaction if defined in types, otherwise use `any` for bank transaction types.

### Methods to implement:

#### `calculateDSO(invoices: XeroInvoice[]): number`
Days Sales Outstanding = (Total AR Outstanding / Total Revenue over last 90 days) × 90
- Numerator: sum of `AmountDue` for all AUTHORISED invoices
- Denominator: sum of `Total` for all invoices (PAID + AUTHORISED) with `Date` within last 90 days
- Return 0 if denominator is 0

#### `calculateGrossMargin(plReport: any): { grossMarginPct: number, revenue: number, cogs: number }`
Parse the Xero P&L report's nested `Rows` array:
- Revenue rows: find Section with Title containing "Revenue" or "Income", sum the values from `SummaryRow`
- COGS rows: find Section with Title containing "Cost" or "Less Cost", sum the values
- Gross Margin % = (revenue - cogs) / revenue × 100
- Return `{ grossMarginPct: 0, revenue: 0, cogs: 0 }` if parsing fails

#### `calculateCashPosition(bankTransactions: any[]): number`
Sum all `Total` values where `Type === 'RECEIVE'` minus all `Total` values where `Type === 'SPEND'` for the last 90 days.

#### `calculateRevenueGrowth(invoices: XeroInvoice[]): { momGrowth: number, yoyGrowth: number, currentMonthRevenue: number, priorMonthRevenue: number }`
- Group paid invoices by calendar month using `inv.Date`
- currentMonth = invoices paid in current calendar month, sum their `Total`
- priorMonth = invoices paid in previous calendar month, sum their `Total`  
- MoM growth = (current - prior) / prior × 100, return 0 if prior is 0
- YoY: same month last year vs this year
- Return the object with all four fields

#### `build13WeekForecast(invoices: XeroInvoice[], bankTransactions: any[]): Array<{ weekLabel: string, weekStart: string, expectedInflows: number, expectedOutflows: number, projectedBalance: number }>`
- Calculate historical collection rate: count of PAID invoices / (count of PAID + AUTHORISED invoices) over last 90 days
- Calculate average weekly SPEND from bank transactions over last 8 weeks
- For each of 13 forward weeks (week 1 = next 7 days, week 2 = days 8-14, etc.):
  - `expectedInflows` = sum of `AmountDue` on AUTHORISED invoices whose `DueDate` falls in that week × collection rate
  - `expectedOutflows` = average weekly spend
  - `projectedBalance` = prior week's projectedBalance + expectedInflows - expectedOutflows (seed week 0 balance = current cash position)
- Return array of 13 objects

#### `buildOperatingCashFlow(bankTransactions: any[], weeks: number = 12): Array<{ weekLabel: string, inflows: number, outflows: number, netCashFlow: number }>`
- For each of the last `weeks` weeks (chronological order):
  - Sum RECEIVE transactions that fall in that week = inflows
  - Sum SPEND transactions = outflows
  - netCashFlow = inflows - outflows
- Return array

---

## SECTION 3 — New API Endpoints in `src/index.tsx`

Add these 6 routes as a block AFTER the existing `/api/revenue/metrics` route (around line 656).

Also add the `CfoAnalyticsService` import at the top of the file:
```typescript
import { CfoAnalyticsService } from './services/cfo-analytics';
```

### Route 1: GET /api/executive/summary
Returns: `{ dso, grossMarginPct, revenue, cogs, cashPosition, revenueGrowth: { momGrowth, yoyGrowth, currentMonthRevenue, priorMonthRevenue }, activeInvoices, overdueAmount }`

Calls: `xero.getInvoices()`, `xero.getProfitAndLossReport()`, `xero.getBankTransactions()`

### Route 2: GET /api/executive/revenue-chart
Returns: `{ labels: string[], datasets: [{ label: string, data: number[] }] }`
- Group PAID invoices by month for the last 12 months
- Each month = sum of `Total` for paid invoices in that month
- Return Chart.js-compatible format

### Route 3: GET /api/cashflow/forecast
Returns: array of 13 week objects from `CfoAnalyticsService.build13WeekForecast()`

Calls: `xero.getInvoices()`, `xero.getBankTransactions()`

### Route 4: GET /api/cashflow/operating
Returns: array of 12 week objects from `CfoAnalyticsService.buildOperatingCashFlow()`

Calls: `xero.getBankTransactions()`

### Route 5: GET /api/demo/executive-summary
Returns hardcoded realistic demo data:
```json
{
  "dso": 47,
  "grossMarginPct": 68.5,
  "revenue": 124500,
  "cogs": 39217,
  "cashPosition": 45200,
  "revenueGrowth": { "momGrowth": 12.3, "yoyGrowth": 28.7, "currentMonthRevenue": 24500, "priorMonthRevenue": 21815 },
  "activeInvoices": 38,
  "overdueAmount": 63313
}
```

### Route 6: GET /api/demo/cashflow-forecast
Returns hardcoded array of 13 weeks with realistic values (varying inflows, steady outflows around $8k/week, starting balance $45k).

---

## SECTION 4 — New Tabs in `public/index.html` + `public/static/app.js`

### Tab 1: Executive Dashboard

**In `public/index.html`** — Add tab button after the existing sheets-links button (line ~101):
```html
<button data-tab="executive" class="tab-button px-6 py-3 font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300">
    <i class="fas fa-briefcase mr-2"></i>Executive
</button>
```

Add content div before the closing `</div>` of the content container (before `</div></div>` at line 640):
```html
<!-- Executive Dashboard Tab -->
<div id="tab-executive" class="tab-content hidden">
  <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
    <!-- DSO Card -->
    <div class="bg-white rounded-lg shadow-md p-6 border-l-4" id="dsoCard">
      <p class="text-sm text-gray-500 uppercase tracking-wide">Days Sales Outstanding</p>
      <p id="execDso" class="text-3xl font-bold mt-2">--</p>
      <p id="dsoStatus" class="text-xs mt-1">Loading...</p>
    </div>
    <!-- Gross Margin Card -->
    <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
      <p class="text-sm text-gray-500 uppercase tracking-wide">Gross Margin</p>
      <p id="execGrossMargin" class="text-3xl font-bold text-purple-700 mt-2">--</p>
      <p class="text-xs text-purple-500 mt-1">Revenue minus COGS</p>
    </div>
    <!-- Cash Position Card -->
    <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
      <p class="text-sm text-gray-500 uppercase tracking-wide">Cash Position</p>
      <p id="execCashPosition" class="text-3xl font-bold text-green-700 mt-2">--</p>
      <p class="text-xs text-green-500 mt-1">Net bank balance</p>
    </div>
    <!-- Revenue Growth Card -->
    <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
      <p class="text-sm text-gray-500 uppercase tracking-wide">MoM Revenue Growth</p>
      <p id="execRevenueGrowth" class="text-3xl font-bold text-blue-700 mt-2">--</p>
      <p id="execRevenueDetail" class="text-xs text-blue-500 mt-1">vs prior month</p>
    </div>
  </div>
  <!-- Revenue Chart -->
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <h3 class="text-lg font-bold text-gray-800 mb-4">Monthly Revenue (12 Months)</h3>
    <canvas id="executiveRevenueChart" height="100"></canvas>
  </div>
  <!-- Refresh Button -->
  <div class="text-right">
    <button onclick="loadExecutiveDashboard()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
      <i class="fas fa-sync-alt mr-2"></i>Refresh
    </button>
  </div>
</div>
```

**In `public/static/app.js`** — Add tab switch case (inside the tab-switch block, after the `trends` case around line 1468):
```javascript
} else if (tabName === 'executive') {
  loadExecutiveDashboard();
} else if (tabName === 'cashflow') {
  loadCashFlow();
}
```

Add the load function (after the existing `loadPaymentTrends` function):
```javascript
let executiveRevenueChartInstance = null;

async function loadExecutiveDashboard() {
  try {
    let summary, chartData;
    try {
      const [s, c] = await Promise.all([
        axios.get('/api/executive/summary'),
        axios.get('/api/executive/revenue-chart')
      ]);
      summary = s.data;
      chartData = c.data;
    } catch (e) {
      const [s, c] = await Promise.all([
        axios.get('/api/demo/executive-summary'),
        axios.get('/api/demo/executive-revenue-chart')
      ]);
      summary = s.data;
      chartData = c.data;
    }

    // Update KPI cards
    document.getElementById('execDso').textContent = `${summary.dso} days`;
    const dsoCard = document.getElementById('dsoCard');
    const dsoStatus = document.getElementById('dsoStatus');
    if (summary.dso < 30) {
      dsoCard.classList.add('border-green-500'); dsoStatus.textContent = 'Excellent'; dsoStatus.className = 'text-xs text-green-600 mt-1';
    } else if (summary.dso < 60) {
      dsoCard.classList.add('border-yellow-500'); dsoStatus.textContent = 'Acceptable'; dsoStatus.className = 'text-xs text-yellow-600 mt-1';
    } else {
      dsoCard.classList.add('border-red-500'); dsoStatus.textContent = 'Needs Attention'; dsoStatus.className = 'text-xs text-red-600 mt-1';
    }

    document.getElementById('execGrossMargin').textContent = `${summary.grossMarginPct.toFixed(1)}%`;
    document.getElementById('execCashPosition').textContent = formatCurrency(summary.cashPosition);

    const mom = summary.revenueGrowth.momGrowth;
    document.getElementById('execRevenueGrowth').textContent = `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`;
    document.getElementById('execRevenueDetail').textContent = `${formatCurrency(summary.revenueGrowth.currentMonthRevenue)} vs ${formatCurrency(summary.revenueGrowth.priorMonthRevenue)}`;

    // Render revenue chart
    const ctx = document.getElementById('executiveRevenueChart').getContext('2d');
    if (executiveRevenueChartInstance) executiveRevenueChartInstance.destroy();
    executiveRevenueChartInstance = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } }
      }
    });
  } catch (error) {
    console.error('Error loading executive dashboard:', error);
  }
}
window.loadExecutiveDashboard = loadExecutiveDashboard;
```

---

### Tab 2: Cash Flow

**In `public/index.html`** — Add tab button after the Executive button:
```html
<button data-tab="cashflow" class="tab-button px-6 py-3 font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300">
    <i class="fas fa-water mr-2"></i>Cash Flow
</button>
```

Add content div:
```html
<!-- Cash Flow Tab -->
<div id="tab-cashflow" class="tab-content hidden">
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-800">13-Week Cash Flow Forecast</h2>
      <button onclick="loadCashFlow()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        <i class="fas fa-sync-alt mr-2"></i>Refresh
      </button>
    </div>
    <div id="cashflowForecastTable" class="overflow-x-auto">
      <p class="text-gray-500 text-center py-8">Loading cash flow forecast...</p>
    </div>
  </div>
</div>
```

**In `public/static/app.js`** — Add the load function:
```javascript
async function loadCashFlow() {
  try {
    let forecast;
    try {
      const response = await axios.get('/api/cashflow/forecast');
      forecast = response.data;
    } catch (e) {
      const response = await axios.get('/api/demo/cashflow-forecast');
      forecast = response.data;
    }

    const tableEl = document.getElementById('cashflowForecastTable');
    const rows = forecast.map((week, i) => {
      const isNegative = week.projectedBalance < 0;
      const rowClass = isNegative ? 'bg-red-50' : i % 2 === 0 ? '' : 'bg-gray-50';
      return `<tr class="${rowClass}">
        <td class="px-4 py-3 text-sm font-medium ${isNegative ? 'text-red-700' : 'text-gray-900'}">${week.weekLabel}</td>
        <td class="px-4 py-3 text-sm text-green-700">${formatCurrency(week.expectedInflows)}</td>
        <td class="px-4 py-3 text-sm text-red-700">(${formatCurrency(week.expectedOutflows)})</td>
        <td class="px-4 py-3 text-sm font-bold ${isNegative ? 'text-red-700' : 'text-blue-700'}">${formatCurrency(week.projectedBalance)}</td>
        ${isNegative ? '<td class="px-4 py-3"><span class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Cash Warning</span></td>' : '<td></td>'}
      </tr>`;
    }).join('');

    tableEl.innerHTML = `<table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Inflows</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Outflows</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projected Balance</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">${rows}</tbody>
    </table>`;
  } catch (error) {
    console.error('Error loading cash flow:', error);
  }
}
window.loadCashFlow = loadCashFlow;
```

---

## SECTION 5 — Enhancements to Existing Tabs

### 5.1 Invoices Tab — Add Risk Column

**In `public/static/app.js`**, modify the `displayInvoices()` function:

Add a helper function (place near other helper functions):
```javascript
function getInvoiceRiskBadge(inv) {
  if (inv.Status === 'PAID' || inv.Status === 'DRAFT') return '';
  const dueDate = inv.DueDate ? new Date(inv.DueDate) : null;
  if (!dueDate) return '';
  const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysOverdue <= 0) return '<span class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Low</span>';
  if (daysOverdue <= 30) return '<span class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Low</span>';
  if (daysOverdue <= 60) return '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Medium</span>';
  return '<span class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">High</span>';
}
```

In the `displayInvoices()` function table header, add after the Status `<th>`:
```html
<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
```

In each `<tr>` row, add after the Status `<td>`:
```javascript
<td class="px-6 py-4 whitespace-nowrap">${getInvoiceRiskBadge(inv)}</td>
```

### 5.2 Clients Tab — Diamond/Gold/Silver Badges

**In `public/static/app.js`**, add a helper function:
```javascript
function getClientSegmentBadge(client) {
  const outstanding = client.totalOutstanding || 0;
  const delay = client.averagePaymentDelay || 0;
  if (outstanding > 10000 && delay < 30) {
    return '<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-semibold">💎 Diamond</span>';
  } else if (outstanding > 5000 || delay < 60) {
    return '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full font-semibold">🥇 Gold</span>';
  }
  return '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full font-semibold">🥈 Silver</span>';
}
```

In `displayClientsAwaitingPayment()`, modify the Company Name column cell to include the badge:
```javascript
<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
  ${client.contactName} ${getClientSegmentBadge(client)}
</td>
```

### 5.3 Trends Tab — 3-Period Forecast Overlay

**In `public/static/app.js`**, after rendering the trends table in `renderTrendsTable()`, also update the chart.

In `loadPaymentTrends()`, after calling `displayPaymentTrends(trends)`, add a forecast overlay that extrapolates the last 3 outstanding amounts linearly. Find the chart update code and add a dashed forecast dataset.

Since the trends tab uses a table (not a chart canvas), skip the chart overlay for now. Instead, add a simple forecast row at the bottom of the trends table showing projected next-period outstanding based on linear extrapolation of the last 3 periods.

In `renderTrendsTable()`, after building the `html`, append:
```javascript
// Add forecast row
if (currentTrendsData && currentTrendsData.periods.length >= 3) {
  const lastThree = currentTrendsData.periods.slice(-3);
  const trend = (lastThree[2].totalOutstanding - lastThree[0].totalOutstanding) / 2;
  const forecast = Math.max(0, lastThree[2].totalOutstanding + trend);
  // Append a forecast row to the table before closing </tbody>
}
```

---

## SECTION 6 — Version & Commit Strategy

### Step 1: Bump version
In `package.json`: change `"version": "2.6.1"` to `"version": "2.7.0"`

In `public/index.html` line 73: change `v2.6.1` to `v2.7.0`

In `src/index.tsx` `/api/health` handler: change version string to `'2.7.0'`

### Step 2: Build
```bash
npm run build
```

Verify build output:
```bash
grep -c 'tab-executive\|tab-cashflow' dist/index.html
# Should return > 0
```

### Step 3: Commit
```bash
git add src/services/cfo-analytics.ts src/index.tsx public/index.html public/static/app.js package.json ENTERPRISE_UPGRADE_SPEC.md
git commit -m "v2.7.0: Executive Dashboard + Cash Flow tabs, invoice risk badges, client segmentation"
git push -u origin claude/check-build-version-01lOf
```

---

## SECTION 7 — Verification Checklist

After implementation, verify each item before declaring done:

- [ ] `curl http://localhost:3000/api/demo/executive-summary` returns JSON with `dso`, `grossMarginPct`, `cashPosition`
- [ ] `curl http://localhost:3000/api/demo/cashflow-forecast` returns array of 13 objects
- [ ] `dist/index.html` contains `id="tab-executive"` and `id="tab-cashflow"`
- [ ] `dist/index.html` contains `data-tab="executive"` and `data-tab="cashflow"`
- [ ] Invoice table in `public/static/app.js` has "Risk" column rendering
- [ ] Client display in `public/static/app.js` has `getClientSegmentBadge()` call
- [ ] `package.json` version is `2.7.0`
- [ ] `/api/health` returns `version: "2.7.0"`
