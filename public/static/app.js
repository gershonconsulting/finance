// Frontend application logic

let invoiceChart = null;

// Configure axios to include session token
axios.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem('xero_session');
  if (sessionToken) {
    config.headers['X-Session-Token'] = sessionToken;
  }
  return config;
});

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App initialized');
  
  // Check if user is authenticated
  const isAuthenticated = await checkAuthStatus();
  
  if (isAuthenticated) {
    // Show dashboard, hide login
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('logoutBtn')?.classList.remove('hidden');
    await loadDashboardData();
    updateSheetsAuthStatus();
  } else {
    // Show login, hide dashboard - BUT still load demo data for preview
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('logoutBtn')?.classList.add('hidden');
    
    // Load demo data anyway so user can see the dashboard preview
    console.log('Not authenticated - loading demo data for preview');
    await loadDashboardData(); // This will fall back to demo data
  }
});

// Login with Xero
function loginWithXero() {
  window.location.href = '/auth/login';
}

// Logout
function logout() {
  localStorage.removeItem('xero_session');
  window.location.reload();
}

// Make functions globally available
window.loginWithXero = loginWithXero;
window.logout = logout;

// Check authentication status
async function checkAuthStatus() {
  console.log('=== CHECKING AUTH STATUS ===');
  const sessionToken = localStorage.getItem('xero_session');
  console.log('Session token in localStorage:', sessionToken ? 'EXISTS (length: ' + sessionToken.length + ')' : 'NOT FOUND');
  
  if (!sessionToken) {
    console.log('❌ No session token found');
    return false;
  }
  
  try {
    console.log('Calling /api/auth/status with session token...');
    const response = await axios.get('/api/auth/status');
    console.log('Auth status response:', response.data);
    
    if (response.data.authenticated) {
      console.log('✅ User is authenticated, tenantId:', response.data.tenantId);
    } else {
      console.log('❌ User not authenticated (server returned false)');
    }
    
    return response.data.authenticated;
  } catch (error) {
    console.error('❌ Error checking auth status:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Try to load real data, fall back to demo
    let data;
    try {
      console.log('Attempting to load real data from /api/invoices/summary...');
      const response = await axios.get('/api/invoices/summary');
      data = response.data;
      console.log('✅ Loaded real data from Xero');
    } catch (error) {
      // Fall back to demo data
      console.log('Real data failed, loading demo data from /api/demo/summary...');
      const response = await axios.get('/api/demo/summary');
      data = response.data;
      console.log('✅ Loaded demo data');
    }
    
    updateDashboard(data);
    console.log('✅ Dashboard updated');
    
    // Also load aging data
    await loadAgingData();
    
    // Load revenue metrics (ARR/MRR)
    await loadRevenueMetrics();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Don't show alert - just log and continue
    console.warn('Dashboard will show with default empty state');
  }
}

// Load invoice aging data
async function loadAgingData() {
  try {
    const response = await axios.get('/api/invoices/by-aging');
    const aging = response.data;
    
    // Update CURRENT group
    document.getElementById('currentCount').textContent = aging.current.count;
    document.getElementById('currentAmount').textContent = formatCurrency(aging.current.total);
    
    // Update AGED group
    document.getElementById('agedCount').textContent = aging.aged.count;
    document.getElementById('agedAmount').textContent = formatCurrency(aging.aged.total);
    
    // Update CRITICAL group
    document.getElementById('criticalCount').textContent = aging.critical.count;
    document.getElementById('criticalAmount').textContent = formatCurrency(aging.critical.total);
  } catch (error) {
    console.error('Error loading aging data:', error);
    // Use realistic demo data when not authenticated
    const demoAging = {
      current: { count: 15, total: 25000.00 },
      aged: { count: 12, total: 28000.00 },
      critical: { count: 13, total: 20485.00 }
    };
    
    document.getElementById('currentCount').textContent = demoAging.current.count;
    document.getElementById('currentAmount').textContent = formatCurrency(demoAging.current.total);
    document.getElementById('agedCount').textContent = demoAging.aged.count;
    document.getElementById('agedAmount').textContent = formatCurrency(demoAging.aged.total);
    document.getElementById('criticalCount').textContent = demoAging.critical.count;
    document.getElementById('criticalAmount').textContent = formatCurrency(demoAging.critical.total);
  }
}

// Load revenue metrics (ARR/MRR)
async function loadRevenueMetrics() {
  try {
    let data;
    let isLive = false;

    try {
      console.log('Loading revenue metrics from /api/revenue/metrics...');
      const response = await axios.get('/api/revenue/metrics');
      data = response.data;
      isLive = true;
      console.log('✅ Loaded real revenue metrics');
    } catch (error) {
      // Fall back to demo data
      console.log('Loading demo revenue metrics...');
      const response = await axios.get('/api/demo/revenue/metrics');
      data = response.data;
      console.log('✅ Loaded demo revenue metrics');
    }

    updateLiveIndicator(isLive, new Date().toISOString());

    // Update primary metrics
    document.getElementById('currentMRR').textContent = formatCurrency(data.mrr);
    document.getElementById('currentARR').textContent = formatCurrency(data.arr);
    document.getElementById('ytdRevenue').textContent = formatCurrency(data.ytdRevenue);
    document.getElementById('projectedEOY').textContent = formatCurrency(data.projectedEOY);

    // Update MoM growth
    const momSign = (data.momGrowth || 0) >= 0 ? '+' : '';
    document.getElementById('mrrChange').textContent = `${momSign}${(data.momGrowth || 0).toFixed(1)}% vs last month`;
    document.getElementById('arrGrowth').textContent = `${momSign}${(data.momGrowth || 0).toFixed(1)}% MoM`;

    // Update secondary metrics
    document.getElementById('activeClients').textContent = data.activeClients;
    document.getElementById('avgRevenuePerClient').textContent = formatCurrency(data.calculations.avgRevenuePerClient);
    document.getElementById('monthsRemaining').textContent = data.monthsRemaining;

    // Update month label
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = monthNames.slice(0, data.currentMonth).join('-');
    document.getElementById('ytdMonths').textContent = `${monthLabel} (${data.currentMonth} months)`;

    // Update projection basis
    const paceVsProjection = data.calculations.paceVsProjection;
    const paceText = paceVsProjection >= 0
      ? `Running ${paceVsProjection.toFixed(1)}% ahead of projection`
      : `Running ${Math.abs(paceVsProjection).toFixed(1)}% behind projection`;
    document.getElementById('projectionBasis').textContent = paceText;

    // Update new this-month dashboard cards
    const thisMonthEl = document.getElementById('thisMonthInvoiced');
    if (thisMonthEl) thisMonthEl.textContent = formatCurrency(data.thisMonthInvoiced || data.mrr);

    const momLabel = document.getElementById('momGrowthLabel');
    if (momLabel) {
      const sign = (data.momGrowth || 0) >= 0 ? '+' : '';
      const prevFmt = formatCurrency(data.prevMonthInvoiced || 0);
      momLabel.textContent = `${sign}${(data.momGrowth || 0).toFixed(1)}% vs ${prevFmt} last month`;
    }

    const activeMonthEl = document.getElementById('activeClientsThisMonth');
    if (activeMonthEl) activeMonthEl.textContent = data.activeClients;

    const paidEl = document.getElementById('paidThisMonth');
    if (paidEl) paidEl.textContent = data.paidThisMonth || 0;

    const unpaidEl = document.getElementById('unpaidThisMonth');
    if (unpaidEl) unpaidEl.textContent = data.unpaidThisMonth || 0;

    const lateEl = document.getElementById('lateThisMonth');
    if (lateEl) lateEl.textContent = data.lateThisMonth || 0;

    const crLabel = document.getElementById('collectionRateLabel');
    if (crLabel) crLabel.textContent = `collection rate: ${(data.collectionRate || 0).toFixed(1)}%`;

    // Sync analytics tab cards if visible
    const analyticsArEl = document.getElementById('analyticsMRR');
    if (analyticsArEl) analyticsArEl.textContent = formatCurrency(data.mrr);
    const analyticsArrEl = document.getElementById('analyticsARR');
    if (analyticsArrEl) analyticsArrEl.textContent = formatCurrency(data.arr);
    const analyticsCrEl = document.getElementById('analyticsCollectionRate');
    if (analyticsCrEl) analyticsCrEl.textContent = `${(data.collectionRate || 0).toFixed(1)}%`;
    const analyticsLateEl = document.getElementById('analyticsLate');
    if (analyticsLateEl) analyticsLateEl.textContent = data.lateThisMonth || 0;

    console.log('✅ Revenue metrics updated:', {
      MRR: data.mrr,
      thisMonthInvoiced: data.thisMonthInvoiced,
      prevMonthInvoiced: data.prevMonthInvoiced,
      ARR: data.arr,
    });
  } catch (error) {
    console.error('Error loading revenue metrics:', error);
  }
}

// Live / Not Live indicator
function updateLiveIndicator(isLive, lastRefreshISO) {
  const indicator = document.getElementById('liveIndicator');
  const text = document.getElementById('liveIndicatorText');
  const syncTime = document.getElementById('lastSyncTime');

  if (!indicator || !text) return;

  if (isLive) {
    indicator.className = 'flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white';
    indicator.querySelector('span').className = 'w-2 h-2 rounded-full bg-green-200 mr-2 animate-pulse';
    text.textContent = 'Live Data';
  } else {
    indicator.className = 'flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500 text-white';
    indicator.querySelector('span').className = 'w-2 h-2 rounded-full bg-yellow-200 mr-2';
    text.textContent = 'Not Live';
  }

  if (syncTime && lastRefreshISO) {
    const dt = new Date(lastRefreshISO);
    syncTime.textContent = `Last synced: ${dt.toLocaleTimeString()}`;
    syncTime.classList.remove('hidden');
  }
}

// Make it globally available
window.loadRevenueMetrics = loadRevenueMetrics;

// Update dashboard with data
function updateDashboard(data) {
  // Update the three main metrics that actually exist in the HTML
  document.getElementById('totalOutstanding').textContent = formatCurrency(data.awaitingAmount || 0);
  document.getElementById('totalOverdue').textContent = formatCurrency(data.overdueAmount || 0);
  document.getElementById('invoiceCount').textContent = data.totalInvoices || 0;
  
  // Update status cards (Draft, Awaiting, Overdue)
  if (document.getElementById('draftCount')) {
    document.getElementById('draftCount').textContent = data.draftCount || 0;
  }
  if (document.getElementById('draftAmount')) {
    document.getElementById('draftAmount').textContent = formatCurrency(data.draftAmount || 0);
  }
  if (document.getElementById('awaitingCount')) {
    document.getElementById('awaitingCount').textContent = data.awaitingCount || 0;
  }
  if (document.getElementById('awaitingAmount')) {
    document.getElementById('awaitingAmount').textContent = formatCurrency(data.awaitingAmount || 0);
  }
  if (document.getElementById('overdueCount')) {
    document.getElementById('overdueCount').textContent = data.overdueCount || 0;
  }
  if (document.getElementById('overdueAmount')) {
    document.getElementById('overdueAmount').textContent = formatCurrency(data.overdueAmount || 0);
  }
  
  // Try to update chart if it exists
  try {
    createInvoiceChart(data);
  } catch (error) {
    console.warn('Could not create chart:', error);
  }
}

// Create invoice chart
function createInvoiceChart(data) {
  const ctx = document.getElementById('invoiceChart');
  
  if (invoiceChart) {
    invoiceChart.destroy();
  }
  
  invoiceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Draft', 'Awaiting Payment', 'Overdue'],
      datasets: [
        {
          label: 'Number of Invoices',
          data: [data.draftCount, data.awaitingCount, data.overdueCount],
          backgroundColor: [
            'rgba(156, 163, 175, 0.7)',
            'rgba(251, 146, 60, 0.7)',
            'rgba(239, 68, 68, 0.7)'
          ],
          borderColor: [
            'rgba(156, 163, 175, 1)',
            'rgba(251, 146, 60, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'Amount ($)',
          data: [data.draftAmount, data.awaitingAmount, data.overdueAmount],
          backgroundColor: [
            'rgba(107, 114, 128, 0.5)',
            'rgba(249, 115, 22, 0.5)',
            'rgba(220, 38, 38, 0.5)'
          ],
          borderColor: [
            'rgba(107, 114, 128, 1)',
            'rgba(249, 115, 22, 1)',
            'rgba(220, 38, 38, 1)'
          ],
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Number of Invoices'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Amount ($)'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.datasetIndex === 1) {
                label += formatCurrency(context.parsed.y);
              } else {
                label += context.parsed.y;
              }
              return label;
            }
          }
        }
      }
    }
  });
}

// Tab navigation
// Load invoices
async function loadInvoices(status = null) {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    
    const response = await axios.get(`/api/invoices?${params.toString()}`);
    const invoices = response.data;
    
    displayInvoices(invoices);
  } catch (error) {
    console.error('Error loading invoices:', error);
    showError('Failed to load invoices. Using demo mode data.');
    displayDemoInvoices();
  }
}

// Returns a risk badge for an invoice based on days overdue
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

// Display invoices in table
// Store current invoice data for sorting
let currentInvoiceData = [];
let invoiceSortConfig = { column: null, direction: 'asc' };

function displayInvoices(invoices) {
  currentInvoiceData = invoices; // Store for sorting
  const listEl = document.getElementById('invoiceList');
  
  if (invoices.length === 0) {
    listEl.innerHTML = '<p class="text-gray-500 text-center py-8">No invoices found</p>';
    return;
  }
  
  const html = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th onclick="sortInvoices('InvoiceNumber')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Invoice # <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortInvoices('Contact')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Contact <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortInvoices('Date')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Date <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortInvoices('DueDate')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Due Date <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortInvoices('Total')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Total <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortInvoices('AmountDue')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Amount Due <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortInvoices('Status')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Status <i class="fas fa-sort ml-1"></i>
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Risk
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${invoices.map(inv => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${inv.InvoiceNumber || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${inv.Contact?.Name || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(inv.Date)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(inv.DueDate)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatCurrency(inv.Total)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatCurrency(inv.AmountDue)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(inv.Status)}">
                ${inv.Status}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${getInvoiceRiskBadge(inv)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  listEl.innerHTML = html;
}

// Sort invoices by column
function sortInvoices(column) {
  // Toggle direction if same column, otherwise default to ascending
  if (invoiceSortConfig.column === column) {
    invoiceSortConfig.direction = invoiceSortConfig.direction === 'asc' ? 'desc' : 'asc';
  } else {
    invoiceSortConfig.column = column;
    invoiceSortConfig.direction = 'asc';
  }
  
  const sorted = [...currentInvoiceData].sort((a, b) => {
    let aVal, bVal;
    
    switch(column) {
      case 'InvoiceNumber':
        aVal = a.InvoiceNumber || '';
        bVal = b.InvoiceNumber || '';
        break;
      case 'Contact':
        aVal = a.Contact?.Name || '';
        bVal = b.Contact?.Name || '';
        break;
      case 'Date':
        aVal = new Date(a.Date || 0);
        bVal = new Date(b.Date || 0);
        break;
      case 'DueDate':
        aVal = new Date(a.DueDate || 0);
        bVal = new Date(b.DueDate || 0);
        break;
      case 'Total':
        aVal = a.Total || 0;
        bVal = b.Total || 0;
        break;
      case 'AmountDue':
        aVal = a.AmountDue || 0;
        bVal = b.AmountDue || 0;
        break;
      case 'Status':
        aVal = a.Status || '';
        bVal = b.Status || '';
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return invoiceSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return invoiceSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  displayInvoices(sorted);
}

// Make sortInvoices globally available
window.sortInvoices = sortInvoices;

// Display demo invoices
function displayDemoInvoices() {
  const demoInvoices = [
    {
      InvoiceNumber: 'INV-2024-001',
      Contact: { Name: 'ABC Company' },
      Date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      DueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      Total: 15000.00,
      AmountDue: 15000.00,
      Status: 'AUTHORISED'
    },
    {
      InvoiceNumber: 'INV-2024-002',
      Contact: { Name: 'XYZ Corporation' },
      Date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      DueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      Total: 8500.00,
      AmountDue: 0.00,
      Status: 'PAID'
    },
    {
      InvoiceNumber: 'INV-2024-003',
      Contact: { Name: 'Tech Solutions Ltd' },
      Date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      DueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      Total: 12000.00,
      AmountDue: 12000.00,
      Status: 'DRAFT'
    }
  ];
  
  displayInvoices(demoInvoices);
}

// Load Profit & Loss report
async function loadProfitLoss() {
  try {
    const response = await axios.get('/api/reports/profit-loss');
    displayReport(response.data, 'Profit & Loss Report');
  } catch (error) {
    console.error('Error loading P&L report:', error);
    showError('Failed to load Profit & Loss report');
  }
}

// Load Balance Sheet report
async function loadBalanceSheet() {
  try {
    const response = await axios.get('/api/reports/balance-sheet');
    displayReport(response.data, 'Balance Sheet Report');
  } catch (error) {
    console.error('Error loading balance sheet:', error);
    showError('Failed to load Balance Sheet report');
  }
}

// Display report data
function displayReport(report, title) {
  const reportEl = document.getElementById('reportData');
  
  // Store report type for export
  window.currentReportType = title.toLowerCase().includes('profit') ? 'profit-loss' : 'balance-sheet';
  
  let html = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-800">${title}</h2>
        <div class="space-x-2">
          <button onclick="exportToGoogleSheets(window.currentReportType)" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">
            <i class="fas fa-table mr-2"></i>Export to Google Sheets
          </button>
          <button onclick="exportReport('pdf')" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            <i class="fas fa-file-pdf mr-2"></i>Export PDF
          </button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <pre class="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96">${JSON.stringify(report, null, 2)}</pre>
      </div>
    </div>
  `;
  
  reportEl.innerHTML = html;
}

// Load transactions
async function loadTransactions() {
  try {
    const response = await axios.get('/api/transactions');
    const transactions = response.data;
    
    displayTransactions(transactions);
  } catch (error) {
    console.error('Error loading transactions:', error);
    showError('Failed to load transactions');
  }
}

// Display transactions
function displayTransactions(transactions) {
  const listEl = document.getElementById('transactionList');
  
  if (transactions.length === 0) {
    listEl.innerHTML = '<p class="text-gray-500 text-center py-8">No transactions found</p>';
    return;
  }
  
  const html = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${transactions.map(tx => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDate(tx.Date)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${tx.Contact?.Name || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tx.Type === 'RECEIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                ${tx.Type}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${tx.Type === 'RECEIVE' ? 'text-green-600' : 'text-red-600'} font-medium">
              ${formatCurrency(Math.abs(tx.Total))}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">${tx.Reference || 'N/A'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  listEl.innerHTML = html;
}

// Helper functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  // Xero returns dates in format: "/Date(1234567890000+0000)/"
  // or ISO format: "2024-01-15T00:00:00"
  let date;
  
  if (typeof dateStr === 'string' && dateStr.includes('/Date(')) {
    // Xero format: "/Date(1234567890000)/"
    const timestamp = dateStr.match(/\/Date\((\d+)([+-]\d+)?\)\//);
    if (timestamp) {
      date = new Date(parseInt(timestamp[1]));
    } else {
      return 'Invalid Date';
    }
  } else {
    date = new Date(dateStr);
  }
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}


function getStatusColor(status) {
  const colors = {
    'DRAFT': 'bg-gray-100 text-gray-800',
    'SUBMITTED': 'bg-blue-100 text-blue-800',
    'AUTHORISED': 'bg-orange-100 text-orange-800',
    'PAID': 'bg-green-100 text-green-800',
    'VOIDED': 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function showError(message) {
  // Just log to console - don't show alert popups
  console.error('Error:', message);
}

// Load clients awaiting payment
async function loadClientsAwaitingPayment() {
  try {
    let response;
    let isDemo = false;
    
    try {
      response = await axios.get('/api/clients/awaiting-payment');
    } catch (error) {
      // Fall back to demo data
      console.log('Using demo data - not authenticated');
      response = await axios.get('/api/demo/clients-awaiting-payment');
      isDemo = true;
    }
    
    const clients = response.data;
    displayClientsAwaitingPayment(clients, isDemo);
  } catch (error) {
    console.error('Error loading clients awaiting payment:', error);
    showError('Failed to load clients awaiting payment');
  }
}

// Returns a Diamond/Gold/Silver segment badge based on client payment profile
function getClientSegmentBadge(client) {
  const outstanding = client.totalOutstanding || 0;
  const delay = client.averagePaymentDelay || 0;
  if (outstanding > 10000 && delay < 30) {
    return '<span class="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full font-semibold">💎 Diamond</span>';
  } else if (outstanding > 5000 || delay < 60) {
    return '<span class="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full font-semibold">🥇 Gold</span>';
  }
  return '<span class="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full font-semibold">🥈 Silver</span>';
}

// Store current client data for sorting
let currentClientData = [];
let clientSortConfig = { column: null, direction: 'asc' };

// Sort clients by column
function sortClients(column) {
  // Toggle direction if same column, otherwise default to ascending
  if (clientSortConfig.column === column) {
    clientSortConfig.direction = clientSortConfig.direction === 'asc' ? 'desc' : 'asc';
  } else {
    clientSortConfig.column = column;
    clientSortConfig.direction = 'asc';
  }
  
  const sorted = [...currentClientData].sort((a, b) => {
    let aVal, bVal;
    
    switch(column) {
      case 'contactName':
        aVal = a.contactName || '';
        bVal = b.contactName || '';
        break;
      case 'invoiceCount':
        aVal = a.invoiceCount || 0;
        bVal = b.invoiceCount || 0;
        break;
      case 'totalOutstanding':
        aVal = a.totalOutstanding || 0;
        bVal = b.totalOutstanding || 0;
        break;
      case 'averagePaymentDelay':
        aVal = a.averagePaymentDelay || 0;
        bVal = b.averagePaymentDelay || 0;
        break;
      case 'totalPaid':
        aVal = a.totalPaid || 0;
        bVal = b.totalPaid || 0;
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return clientSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return clientSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  displayClientsAwaitingPayment(sorted, false);
}

// Make sortClients globally available
window.sortClients = sortClients;

// Display clients awaiting payment
function displayClientsAwaitingPayment(clients, isDemo = false) {
  currentClientData = clients; // Store for sorting
  const listEl = document.getElementById('clientsList');
  const infoEl = document.getElementById('clientsListInfo');
  
  // Show/hide demo mode indicator
  if (isDemo) {
    infoEl.classList.remove('hidden');
  } else {
    infoEl.classList.add('hidden');
  }
  
  if (clients.length === 0) {
    listEl.innerHTML = '<p class="text-gray-500 text-center py-8">No clients with outstanding payments</p>';
    return;
  }
  
  // Calculate totals
  const totalInvoices = clients.reduce((sum, client) => sum + client.invoiceCount, 0);
  const totalOutstanding = clients.reduce((sum, client) => sum + client.totalOutstanding, 0);
  const totalPaid = clients.reduce((sum, client) => sum + (client.totalPaid || 0), 0);
  const avgDelay = clients.length > 0 
    ? Math.round(clients.reduce((sum, client) => sum + (client.averagePaymentDelay || 0), 0) / clients.length)
    : 0;
  
  const html = `
    <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p class="text-sm text-blue-600 font-medium">Total Companies</p>
          <p class="text-2xl font-bold text-blue-900">${clients.length}</p>
        </div>
        <div>
          <p class="text-sm text-blue-600 font-medium">Total Invoices</p>
          <p class="text-2xl font-bold text-blue-900">${totalInvoices}</p>
        </div>
        <div>
          <p class="text-sm text-blue-600 font-medium">Total Outstanding</p>
          <p class="text-2xl font-bold text-blue-900">${formatCurrency(totalOutstanding)}</p>
        </div>
      </div>
    </div>
    
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th onclick="sortClients('contactName')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Company Name <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortClients('invoiceCount')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Invoices <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortClients('totalOutstanding')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            Outstanding <i class="fas fa-sort ml-1"></i>
          </th>
          <th onclick="sortClients('averagePaymentDelay')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            <span class="flex items-center">
              Avg Delay <i class="fas fa-sort ml-1"></i>
              <i class="fas fa-clock ml-1 text-orange-500" title="Average payment delay in days"></i>
            </span>
          </th>
          <th onclick="sortClients('totalPaid')" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
            <span class="flex items-center">
              Total Paid <i class="fas fa-sort ml-1"></i>
              <i class="fas fa-check-circle ml-1 text-green-500" title="Total paid historically"></i>
            </span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${clients.map(client => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <i class="fas fa-building text-blue-600"></i>
                </div>
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">${client.contactName}${getClientSegmentBadge(client)}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                ${client.invoiceCount}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              ${formatCurrency(client.totalOutstanding)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                client.averagePaymentDelay <= 30 ? 'bg-green-100 text-green-800' :
                client.averagePaymentDelay <= 60 ? 'bg-yellow-100 text-yellow-800' :
                client.averagePaymentDelay <= 90 ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }">
                ${client.averagePaymentDelay || 0} days
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
              ${formatCurrency(client.totalPaid || 0)}
            </td>
          </tr>
        `).join('')}
        <tr class="bg-gray-100 font-bold">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-800">
              ${totalInvoices}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
            ${formatCurrency(totalOutstanding)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-800">
              ${avgDelay} days
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
            ${formatCurrency(totalPaid)}
          </td>
        </tr>
      </tbody>
    </table>
  `;
  
  listEl.innerHTML = html;
}

// Export functions for Google Sheets
async function exportToGoogleSheets(type, params = {}) {
  try {
    let url = '';
    let filename = '';
    
    switch(type) {
      case 'summary':
        url = '/api/export/summary';
        filename = 'invoice-summary.csv';
        break;
      case 'invoices':
        url = '/api/export/invoices';
        filename = 'invoices.csv';
        if (params.status) url += `?status=${params.status}`;
        break;
      case 'transactions':
        url = '/api/export/transactions';
        filename = 'transactions.csv';
        break;
      case 'clients-awaiting-payment':
        url = '/api/export/clients-awaiting-payment';
        filename = 'clients-awaiting-payment.csv';
        break;
      case 'profit-loss':
        url = '/api/export/profit-loss';
        filename = 'profit-loss.csv';
        break;
      case 'balance-sheet':
        url = '/api/export/balance-sheet';
        filename = 'balance-sheet.csv';
        break;
      case 'payment-trends':
        const viewType = document.getElementById('trendsViewType')?.value || 'monthly';
        const periods = viewType === 'weekly' ? 8 : (viewType === 'monthly' ? 6 : 4);
        url = `/api/export/payment-trends?view=${viewType}&periods=${periods}`;
        filename = `payment-trends-${viewType}.csv`;
        break;
      default:
        throw new Error('Unknown export type');
    }
    
    // Download CSV file
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    
    // Show success message with instructions
    showGoogleSheetsInstructions(filename);
    
  } catch (error) {
    console.error('Error exporting:', error);
    showError('Failed to export data. Please try again.');
  }
}

function showGoogleSheetsInstructions(filename) {
  const message = `
    ✅ CSV file downloaded: ${filename}
    
    To import to Google Sheets:
    1. Open Google Sheets (sheets.google.com)
    2. Click File → Import
    3. Select "Upload" tab
    4. Drag and drop the downloaded CSV file
    5. Click "Import data"
    
    Or simply drag the CSV file into Google Drive and open with Google Sheets!
  `;
  
  alert(message);
}

function exportReport(format) {
  if (format === 'csv') {
    // Trigger the appropriate export based on current context
    const activeTab = document.querySelector('.tab-content:not(.hidden)');
    if (activeTab.id === 'tab-dashboard') {
      exportToGoogleSheets('summary');
    } else if (activeTab.id === 'tab-invoices') {
      exportToGoogleSheets('invoices');
    } else if (activeTab.id === 'tab-transactions') {
      exportToGoogleSheets('transactions');
    }
  } else {
    alert(`Export to ${format.toUpperCase()} - Feature coming soon!`);
  }
}

// Copy URL to clipboard
async function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;
  
  try {
    await navigator.clipboard.writeText(text);
    
    // Show success feedback
    const button = event.target.closest('button');
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check mr-2"></i>Copied!';
    button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    button.classList.add('bg-green-600');
    
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove('bg-green-600');
      button.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }, 2000);
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('URL copied to clipboard!');
    } catch (err) {
      alert('Failed to copy URL. Please copy manually: ' + text);
    }
    document.body.removeChild(textArea);
  }
}

// ============================================
// Settings Functions
// ============================================

// Load current settings on page load when settings tab is shown
function initializeSettings() {
  const redirectUri = `${window.location.origin}/auth/callback`;
  document.getElementById('redirectUri').value = redirectUri;
  
  loadCurrentSettings();
  updateSettingsStatus();
}

// Load current credentials from localStorage
function loadCurrentSettings() {
  const clientId = localStorage.getItem('xero_client_id') || '';
  const clientSecret = localStorage.getItem('xero_client_secret') || '';
  
  document.getElementById('clientId').value = clientId;
  document.getElementById('clientSecret').value = clientSecret ? '••••••••••••••••' : '';
  
  updateSettingsStatus();
}

// Load default (pre-configured) credentials
function loadDefaultSettings() {
  // Default credentials from .dev.vars
  const defaultClientId = '0CA378B164364DB0821A6014520913E6';
  const defaultClientSecret = '1V72d0a3rmemuOng7bW5MikXQTlR60hIiQCpLh0w7ON7E15U';
  
  document.getElementById('clientId').value = defaultClientId;
  document.getElementById('clientSecret').value = defaultClientSecret;
  
  alert('✅ Default configuration loaded! Click "Save Configuration" to use these credentials.');
}

// Save settings to localStorage
function saveSettings() {
  const clientId = document.getElementById('clientId').value.trim();
  const clientSecret = document.getElementById('clientSecret').value.trim();
  
  if (!clientId) {
    alert('❌ Please enter a Client ID');
    return;
  }
  
  if (!clientSecret || clientSecret === '••••••••••••••••') {
    alert('❌ Please enter a Client Secret');
    return;
  }
  
  // Save to localStorage
  localStorage.setItem('xero_client_id', clientId);
  localStorage.setItem('xero_client_secret', clientSecret);
  
  updateSettingsStatus();
  alert('✅ Settings saved successfully! You can now click "Connect to Xero" in the header.');
}

// Clear all settings and disconnect
function clearSettings() {
  if (!confirm('⚠️ This will clear all saved credentials and disconnect your Xero account. Continue?')) {
    return;
  }
  
  // Clear all Xero-related localStorage
  localStorage.removeItem('xero_client_id');
  localStorage.removeItem('xero_client_secret');
  localStorage.removeItem('xero_session');
  
  // Clear form
  document.getElementById('clientId').value = '';
  document.getElementById('clientSecret').value = '';
  
  updateSettingsStatus();
  
  alert('✅ All credentials cleared. The page will reload.');
  window.location.reload();
}

// Test connection (redirect to OAuth)
function testConnection() {
  const clientId = localStorage.getItem('xero_client_id');
  
  if (!clientId) {
    alert('❌ Please save your credentials first before testing the connection.');
    return;
  }
  
  if (confirm('✅ Settings look good! Click OK to test the connection by redirecting to Xero login.')) {
    window.location.href = '/auth/login';
  }
}

// Toggle secret visibility
function toggleSecretVisibility() {
  const input = document.getElementById('clientSecret');
  const icon = document.getElementById('secretIcon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// Copy redirect URI
function copyRedirectUri() {
  const redirectUri = document.getElementById('redirectUri').value;
  const textArea = document.createElement('textarea');
  textArea.value = redirectUri;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();
  
  try {
    document.execCommand('copy');
    alert('✅ Redirect URI copied! Add this to your Xero app configuration.');
  } catch (err) {
    alert('❌ Failed to copy. Please copy manually: ' + redirectUri);
  }
  
  document.body.removeChild(textArea);
}

// Update settings status display
function updateSettingsStatus() {
  const statusEl = document.getElementById('settingsStatus');
  const clientId = localStorage.getItem('xero_client_id');
  const clientSecret = localStorage.getItem('xero_client_secret');
  const sessionToken = localStorage.getItem('xero_session');
  
  if (sessionToken) {
    statusEl.className = 'p-4 rounded-lg border bg-green-50 border-green-200';
    statusEl.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-check-circle text-green-600 text-xl mr-3"></i>
        <div>
          <p class="font-medium text-green-900">Connected to Xero</p>
          <p class="text-sm text-green-700">You are currently authenticated and using real Xero data.</p>
        </div>
      </div>
    `;
  } else if (clientId && clientSecret) {
    statusEl.className = 'p-4 rounded-lg border bg-yellow-50 border-yellow-200';
    statusEl.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-exclamation-circle text-yellow-600 text-xl mr-3"></i>
        <div>
          <p class="font-medium text-yellow-900">Credentials Configured</p>
          <p class="text-sm text-yellow-700">Click "Test Connection" or "Connect to Xero" in the header to authenticate.</p>
        </div>
      </div>
    `;
  } else {
    statusEl.className = 'p-4 rounded-lg border bg-blue-50 border-blue-200';
    statusEl.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-info-circle text-blue-600 text-xl mr-3"></i>
        <div>
          <p class="font-medium text-blue-900">No Credentials Configured</p>
          <p class="text-sm text-blue-700">Load default configuration or enter your own Xero API credentials below.</p>
        </div>
      </div>
    `;
  }
}

// Update Sheets Links tab authentication status
async function updateSheetsAuthStatus() {
  try {
    const statusEl = document.getElementById('sheetsAuthStatus');
    if (!statusEl) return;
    
    const response = await axios.get('/api/auth/status');
    
    if (response.data.authenticated) {
      statusEl.innerHTML = `
        <div class="flex items-center space-x-2">
          <i class="fas fa-check-circle text-green-600"></i>
          <span class="text-sm font-semibold text-green-700">Ready to Use</span>
        </div>
        <p class="text-xs text-green-600 mt-1">Returning real Xero data</p>
      `;
    } else {
      statusEl.innerHTML = `
        <button onclick="window.location.href='/auth/login'" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-md">
          <i class="fas fa-plug mr-2"></i>Connect to Xero
        </button>
        <p class="text-xs text-gray-600 mt-1">One-time setup required</p>
      `;
    }
  } catch (error) {
    console.error('Error updating sheets auth status:', error);
  }
}

// Make it globally available
window.updateSheetsAuthStatus = updateSheetsAuthStatus;

// Load payment trends
async function loadPaymentTrends() {
  try {
    const viewType = document.getElementById('trendsViewType').value;
    const periods = viewType === 'weekly' ? 8 : (viewType === 'monthly' ? 6 : 4);
    
    const response = await axios.get(`/api/payment-trends?view=${viewType}&periods=${periods}`);
    const trends = response.data;
    
    // Update summary metrics
    document.getElementById('totalImprovement').textContent = formatCurrency(trends.totalImprovement);
    document.getElementById('avgPaymentVelocity').textContent = `${trends.averagePaymentVelocity} days`;
    document.getElementById('bestPeriodLabel').textContent = trends.bestPeriod.periodLabel;
    
    // Calculate trend direction
    const recentPeriods = trends.periods.slice(-3);
    const avgReduction = recentPeriods.reduce((sum, p) => sum + p.overdueReduction, 0) / recentPeriods.length;
    const trendIcon = avgReduction > 0 ? '📈 Improving' : avgReduction < 0 ? '📉 Declining' : '➡️ Stable';
    document.getElementById('trendsDirection').textContent = trendIcon;
    
    // Display trends table
    displayPaymentTrends(trends);
  } catch (error) {
    console.error('Error loading payment trends:', error);
    showError('Failed to load payment trends. Please try again.');
  }
}

// Display payment trends table with sorting
let trendsSortState = { column: null, direction: 'asc' };
let currentTrendsData = null;

function displayPaymentTrends(trends) {
  currentTrendsData = trends;
  renderTrendsTable();
}

function renderTrendsTable() {
  if (!currentTrendsData) return;
  
  const dataEl = document.getElementById('trendsData');
  const periods = [...currentTrendsData.periods]; // Create a copy
  // Default: most recent first
  if (!trendsSortState.column) periods.reverse();
  
  // Apply sorting if active
  if (trendsSortState.column) {
    periods.sort((a, b) => {
      let aVal, bVal;
      
      switch(trendsSortState.column) {
        case 'period':
          // Sort chronologically using periodStart (ISO date) if available,
          // otherwise parse the month name from the label (e.g. "Jan 2026")
          if (a.periodStart && b.periodStart) {
            aVal = new Date(a.periodStart).getTime();
            bVal = new Date(b.periodStart).getTime();
          } else {
            const monthOrder = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
            const parseLabel = (label) => {
              const m = label.match(/([A-Za-z]+)\s+(\d{4})/);
              if (m) return parseInt(m[2]) * 100 + (monthOrder[m[1]] || 0);
              // Quarterly: "Q1 2026" -> 202601
              const q = label.match(/Q(\d)\s+(\d{4})/);
              if (q) return parseInt(q[2]) * 100 + (parseInt(q[1]) - 1) * 3 + 1;
              return 0;
            };
            aVal = parseLabel(a.periodLabel);
            bVal = parseLabel(b.periodLabel);
          }
          break;
        case 'outstanding':
          aVal = a.totalOutstanding;
          bVal = b.totalOutstanding;
          break;
        case 'overdue':
          aVal = a.overdueAmount;
          bVal = b.overdueAmount;
          break;
        case 'payments':
          aVal = a.paymentsReceived;
          bVal = b.paymentsReceived;
          break;
        case 'improvement':
          aVal = a.overdueReduction;
          bVal = b.overdueReduction;
          break;
        case 'collection':
          aVal = a.collectionRate;
          bVal = b.collectionRate;
          break;
        case 'paydays':
          aVal = a.paymentVelocity;
          bVal = b.paymentVelocity;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string') {
        const compare = aVal.localeCompare(bVal);
        return trendsSortState.direction === 'asc' ? compare : -compare;
      } else {
        return trendsSortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }
  
  const getSortIcon = (column) => {
    if (trendsSortState.column !== column) return '<i class="fas fa-sort ml-1 text-gray-400"></i>';
    return trendsSortState.direction === 'asc' 
      ? '<i class="fas fa-sort-up ml-1 text-blue-600"></i>'
      : '<i class="fas fa-sort-down ml-1 text-blue-600"></i>';
  };
  
  let html = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortTrends('period')">
            Period ${getSortIcon('period')}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortTrends('outstanding')">
            Outstanding ${getSortIcon('outstanding')}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortTrends('overdue')">
            Overdue ${getSortIcon('overdue')}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortTrends('payments')">
            Payments ${getSortIcon('payments')}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortTrends('improvement')">
            Improvement ${getSortIcon('improvement')}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortTrends('collection')">
            Collection% ${getSortIcon('collection')}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortTrends('paydays')">
            Pay Days ${getSortIcon('paydays')}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
  `;
  
  periods.forEach(period => {
    const improvementColor = period.overdueReduction > 0 ? 'text-green-600' : period.overdueReduction < 0 ? 'text-red-600' : 'text-gray-600';
    const improvementIcon = period.overdueReduction > 0 ? '↓' : period.overdueReduction < 0 ? '↑' : '→';
    
    html += `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${period.periodLabel}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${formatCurrency(period.totalOutstanding)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${period.overdueAmount > 0 ? 'text-red-600' : 'text-gray-500'}">
          ${formatCurrency(period.overdueAmount)}
          <span class="text-xs text-gray-500">(${period.overdueCount})</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
          ${formatCurrency(period.paymentsReceived)}
          <span class="text-xs text-gray-500">(${period.paymentsCount})</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${improvementColor} font-semibold">
          ${improvementIcon} ${formatCurrency(Math.abs(period.overdueReduction))}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
          ${period.collectionRate.toFixed(1)}%
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
          ${period.paymentVelocity} days
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  dataEl.innerHTML = html;
}

function sortTrends(column) {
  if (trendsSortState.column === column) {
    // Toggle direction
    trendsSortState.direction = trendsSortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    // New column, default to ascending
    trendsSortState.column = column;
    trendsSortState.direction = 'asc';
  }
  renderTrendsTable();
}

// Make sorting function globally available
window.sortTrends = sortTrends;

// Export to Google Sheets - payment trends
function exportPaymentTrendsToGoogleSheets() {
  const viewType = document.getElementById('trendsViewType').value;
  const periods = viewType === 'weekly' ? 8 : (viewType === 'monthly' ? 6 : 4);
  window.open(`/api/export/payment-trends?view=${viewType}&periods=${periods}`, '_blank');
}

// Make functions globally available
window.loadPaymentTrends = loadPaymentTrends;
window.exportPaymentTrendsToGoogleSheets = exportPaymentTrendsToGoogleSheets;

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Load Clients button
  const loadClientsBtn = document.getElementById('loadClientsBtn');
  if (loadClientsBtn) {
    loadClientsBtn.addEventListener('click', loadClientsAwaitingPayment);
  }
  
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const tabName = e.currentTarget.getAttribute('data-tab');
      
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
      });
      
      // Remove active class from all buttons
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'border-blue-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
      });
      
      // Show selected tab
      const selectedTab = document.getElementById('tab-' + tabName);
      if (selectedTab) {
        selectedTab.classList.remove('hidden');
      }
      
      // Add active class to clicked button
      e.currentTarget.classList.add('active', 'border-blue-600', 'text-blue-600');
      e.currentTarget.classList.remove('border-transparent', 'text-gray-500');
      
      // Load data for the selected tab
      if (tabName === 'clients') {
        loadClientsAwaitingPayment();
        loadClientLifetime();
      } else if (tabName === 'invoices') {
        loadInvoices();
      } else if (tabName === 'trends') {
        loadPaymentTrends();
        loadMonthlyTrends();
      } else if (tabName === 'analytics') {
        loadAnalyticsGoals();
      } else if (tabName === 'goals') {
        loadGoalProgress();
      } else if (tabName === 'valuation') {
        loadValuation();
      }
    });
  });
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});

// Load per-client IMPORTDATA formulas for the Google Sheets Links tab
async function loadClientSheetFormulas() {
  const container = document.getElementById('clientSheetFormulas');
  if (!container) return;

  container.innerHTML = '<p class="text-sm text-gray-400 italic">Loading clients...</p>';

  try {
    let clients = [];

    try {
      // Fetch client lifetime data — gives us billedMonths + latestInvoiceDate
      const response = await axios.get('/api/clients/lifetime');
      const allClients = (response.data && response.data.clients) || response.data || [];

      // "Active" = recurring (2+ billed months) AND invoiced in the last month
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      clients = allClients.filter(c => {
        const recurring = (c.billedMonths || 0) >= 2;
        const latest = c.latestInvoiceDate ? new Date(c.latestInvoiceDate) : null;
        const recentlyInvoiced = latest && latest >= lastMonth && latest <= thisMonthEnd;
        return recurring && recentlyInvoiced;
      });
    } catch (err) {
      // Fallback to awaiting-payment
      try {
        const response = await axios.get('/api/clients/awaiting-payment');
        clients = response.data || [];
      } catch (e2) {
        const response = await axios.get('/api/demo/clients-awaiting-payment');
        clients = response.data || [];
      }
    }

    if (!clients || clients.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No active recurring clients found (clients with 2+ billed months and an invoice in the last month).</p>';
      return;
    }

    // Sort alphabetically by client name
    clients.sort((a, b) => (a.contactName || '').localeCompare(b.contactName || ''));

    const baseUrl = `${window.location.origin}/api/sheets`;

    const escapeHtml = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const rows = clients.map(client => {
      const encoded = encodeURIComponent(client.contactName);
      const formula = `=IMPORTDATA("${baseUrl}/${encoded}/due")`;
      const formulaAttr = escapeHtml(formula);
      const nameAttr = escapeHtml(client.contactName);
      return `
        <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2 gap-3">
          <span class="text-sm font-medium text-gray-800 w-48 shrink-0 truncate" title="${nameAttr}">${nameAttr}</span>
          <code class="text-xs text-gray-700 flex-1 select-all break-all">${formulaAttr}</code>
          <button type="button" data-formula="${formulaAttr}" onclick="copyText(this)"
                  class="shrink-0 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition">
            <i class="fas fa-copy"></i>
          </button>
        </div>`;
    }).join('');

    container.innerHTML = rows;
  } catch (error) {
    console.error('Error loading client sheet formulas:', error);
    container.innerHTML = '<p class="text-sm text-red-500">Failed to load clients. Make sure you are connected to Xero.</p>';
  }
}

// Copy text helper used by per-client copy buttons.
// Accepts either (btn) — reads from btn.dataset.formula or the sibling <code>
// — or (btn, text) for backward compatibility with any older call sites.
function copyText(btn, text) {
  // Resolve the text to copy
  let payload = text;
  if (payload == null || payload === '') {
    if (btn && btn.dataset && btn.dataset.formula) {
      payload = btn.dataset.formula;
    } else if (btn && btn.parentElement) {
      const codeEl = btn.parentElement.querySelector('code');
      if (codeEl) payload = codeEl.textContent;
    }
  }
  payload = String(payload || '');

  const flashSuccess = () => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.classList.replace('bg-blue-600', 'bg-green-600');
    btn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.replace('bg-green-600', 'bg-blue-600');
      btn.classList.replace('hover:bg-green-700', 'hover:bg-blue-700');
    }, 1500);
  };

  const fallbackCopy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = payload;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) flashSuccess();
      else window.prompt('Copy the formula below:', payload);
    } catch (e) {
      window.prompt('Copy the formula below:', payload);
    }
  };

  // navigator.clipboard requires a secure context (https or localhost).
  // Fall back to execCommand when unavailable.
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(payload).then(flashSuccess).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

window.loadClientSheetFormulas = loadClientSheetFormulas;
window.copyText = copyText;

// Make functions globally available
window.loadClientsAwaitingPayment = loadClientsAwaitingPayment;

// ---- Executive Dashboard ----
let executiveRevenueChartInstance = null;

async function loadExecutiveDashboard() {
  try {
    let summary, chartData;
    try {
      const [s, c] = await Promise.all([
        axios.get('/api/executive/summary'),
        axios.get('/api/executive/revenue-chart'),
      ]);
      summary = s.data;
      chartData = c.data;
    } catch (e) {
      const [s, c] = await Promise.all([
        axios.get('/api/demo/executive-summary'),
        axios.get('/api/demo/executive-revenue-chart'),
      ]);
      summary = s.data;
      chartData = c.data;
    }

    // DSO card with traffic-light colour
    const dsoEl = document.getElementById('execDso');
    const dsoCard = document.getElementById('dsoCard');
    const dsoStatus = document.getElementById('dsoStatus');
    if (dsoEl) dsoEl.textContent = `${summary.dso} days`;
    if (dsoCard && dsoStatus) {
      dsoCard.classList.remove('border-gray-300', 'border-green-500', 'border-yellow-500', 'border-red-500');
      if (summary.dso < 30) {
        dsoCard.classList.add('border-green-500');
        dsoStatus.textContent = 'Excellent';
        dsoStatus.className = 'text-xs text-green-600 mt-1';
      } else if (summary.dso < 60) {
        dsoCard.classList.add('border-yellow-500');
        dsoStatus.textContent = 'Acceptable';
        dsoStatus.className = 'text-xs text-yellow-600 mt-1';
      } else {
        dsoCard.classList.add('border-red-500');
        dsoStatus.textContent = 'Needs Attention';
        dsoStatus.className = 'text-xs text-red-600 mt-1';
      }
    }

    const gmEl = document.getElementById('execGrossMargin');
    if (gmEl) gmEl.textContent = `${summary.grossMarginPct.toFixed(1)}%`;

    const cpEl = document.getElementById('execCashPosition');
    if (cpEl) cpEl.textContent = formatCurrency(summary.cashPosition);

    const mom = summary.revenueGrowth ? summary.revenueGrowth.momGrowth : 0;
    const rgEl = document.getElementById('execRevenueGrowth');
    if (rgEl) {
      rgEl.textContent = `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`;
      rgEl.className = `text-3xl font-bold mt-2 ${mom >= 0 ? 'text-green-700' : 'text-red-700'}`;
    }
    const rdEl = document.getElementById('execRevenueDetail');
    if (rdEl && summary.revenueGrowth) {
      rdEl.textContent = `${formatCurrency(summary.revenueGrowth.currentMonthRevenue)} vs ${formatCurrency(summary.revenueGrowth.priorMonthRevenue)}`;
    }

    // Revenue chart
    const canvas = document.getElementById('executiveRevenueChart');
    if (canvas && chartData) {
      const ctx = canvas.getContext('2d');
      if (executiveRevenueChartInstance) executiveRevenueChartInstance.destroy();
      executiveRevenueChartInstance = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: v => '$' + Number(v).toLocaleString() },
            },
          },
        },
      });
    }
  } catch (error) {
    console.error('Error loading executive dashboard:', error);
  }
}
window.loadExecutiveDashboard = loadExecutiveDashboard;

// ---- Cash Flow ----
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
    if (!tableEl) return;

    const rows = forecast.map((week, i) => {
      const isNegative = week.projectedBalance < 0;
      const rowClass = isNegative ? 'bg-red-50' : i % 2 === 0 ? '' : 'bg-gray-50';
      const alertCell = isNegative
        ? '<td class="px-4 py-3"><span class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full font-semibold">⚠ Cash Warning</span></td>'
        : '<td class="px-4 py-3"></td>';
      return `<tr class="${rowClass}">
        <td class="px-4 py-3 text-sm font-medium ${isNegative ? 'text-red-700' : 'text-gray-900'}">${week.weekLabel}</td>
        <td class="px-4 py-3 text-sm text-green-700">${formatCurrency(week.expectedInflows)}</td>
        <td class="px-4 py-3 text-sm text-red-700">(${formatCurrency(week.expectedOutflows)})</td>
        <td class="px-4 py-3 text-sm font-bold ${isNegative ? 'text-red-700' : 'text-blue-700'}">${formatCurrency(week.projectedBalance)}</td>
        ${alertCell}
      </tr>`;
    }).join('');

    tableEl.innerHTML = `<table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Inflows</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Outflows</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projected Balance</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alert</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">${rows}</tbody>
    </table>`;
  } catch (error) {
    console.error('Error loading cash flow:', error);
  }
}
window.loadCashFlow = loadCashFlow;

// ---- Monthly Trends Table ----
async function loadMonthlyTrends() {
  const el = document.getElementById('monthlyTrendsTable');
  if (!el) return;
  el.innerHTML = '<p class="text-gray-400 text-center py-6">Loading...</p>';

  try {
    const res = await axios.get('/api/monthly/trends');
    const { months, lastRefresh } = res.data;
    updateLiveIndicator(true, lastRefresh);
    renderMonthlyTrendsTable(months);
  } catch (e) {
    el.innerHTML = '<p class="text-red-500 text-center py-6">Unable to load — sign in with Xero to see live data</p>';
  }
}

function renderMonthlyTrendsTable(months) {
  const el = document.getElementById('monthlyTrendsTable');
  if (!el) return;

  const rows = months.map(m => {
    const crColor = m.collectionRate >= 80 ? 'text-green-600' : m.collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600';
    return `<tr class="hover:bg-gray-50 border-b border-gray-100">
      <td class="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">${m.month}</td>
      <td class="px-4 py-3 text-sm text-right font-semibold text-blue-700">${formatCurrency(m.totalInvoiced)}</td>
      <td class="px-4 py-3 text-sm text-right text-gray-700">${m.activeClients}</td>
      <td class="px-4 py-3 text-sm text-right text-gray-600">${formatCurrency(m.avgPerClient)}</td>
      <td class="px-4 py-3 text-sm text-right text-gray-600">${m.invoiceCount}</td>
      <td class="px-4 py-3 text-sm text-right text-green-600">${m.paidCount}</td>
      <td class="px-4 py-3 text-sm text-right text-orange-500">${m.unpaidCount}</td>
      <td class="px-4 py-3 text-sm text-right text-red-500">${m.lateCount}</td>
      <td class="px-4 py-3 text-sm text-right font-semibold ${crColor}">${m.collectionRate.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<table class="min-w-full text-left">
    <thead>
      <tr class="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
        <th class="px-4 py-3">Month</th>
        <th class="px-4 py-3 text-right">Total Invoiced</th>
        <th class="px-4 py-3 text-right">Active Clients</th>
        <th class="px-4 py-3 text-right">Avg / Client</th>
        <th class="px-4 py-3 text-right">Invoices</th>
        <th class="px-4 py-3 text-right">Paid</th>
        <th class="px-4 py-3 text-right">Unpaid</th>
        <th class="px-4 py-3 text-right">Late</th>
        <th class="px-4 py-3 text-right">Collection Rate</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

window.loadMonthlyTrends = loadMonthlyTrends;

// ---- Client Lifetime / Retention ----
async function loadClientLifetime() {
  const el = document.getElementById('clientLifetimeTable');
  if (!el) return;
  el.innerHTML = '<p class="text-gray-400 text-center py-6">Loading...</p>';

  try {
    const res = await axios.get('/api/clients/lifetime');
    const { clients, lastRefresh } = res.data;
    updateLiveIndicator(true, lastRefresh);

    if (!clients.length) {
      el.innerHTML = '<p class="text-gray-500 text-center py-6">No client data found</p>';
      return;
    }

    const rows = clients.map(c => `
      <tr class="hover:bg-gray-50 border-b border-gray-100">
        <td class="px-4 py-3 text-sm font-medium text-gray-900">${c.contactName}</td>
        <td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">${c.firstInvoiceDate}</td>
        <td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">${c.latestInvoiceDate}</td>
        <td class="px-4 py-3 text-sm text-center font-semibold text-blue-700">${c.elapsedMonths}</td>
        <td class="px-4 py-3 text-sm text-center font-semibold text-purple-700">${c.billedMonths}</td>
        <td class="px-4 py-3 text-sm text-right text-gray-800 font-semibold">${formatCurrency(c.totalInvoiced)}</td>
        <td class="px-4 py-3 text-sm text-right text-gray-600">${formatCurrency(c.latestInvoiceAmount)}</td>
      </tr>`).join('');

    el.innerHTML = `<table class="min-w-full text-left">
      <thead>
        <tr class="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
          <th class="px-4 py-3">Client</th>
          <th class="px-4 py-3">First Invoice</th>
          <th class="px-4 py-3">Latest Invoice</th>
          <th class="px-4 py-3 text-center">Elapsed Months</th>
          <th class="px-4 py-3 text-center">Billed Months</th>
          <th class="px-4 py-3 text-right">Total Invoiced</th>
          <th class="px-4 py-3 text-right">Latest Invoice</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="text-xs text-gray-400 mt-3">
      <strong>Elapsed months:</strong> first invoice month to latest invoice month, inclusive. &nbsp;
      <strong>Billed months:</strong> distinct months with at least one invoice.
    </p>`;
  } catch (e) {
    el.innerHTML = '<p class="text-red-500 text-center py-6">Unable to load — sign in with Xero to see live data</p>';
  }
}

window.loadClientLifetime = loadClientLifetime;

// ---- Analytics & Goals ----
async function loadAnalyticsGoals() {
  // Populate KPI cards from already-loaded revenue metrics
  await loadRevenueMetrics();

  // Load monthly table for analytics tab
  const el = document.getElementById('analyticsMonthlyTable');
  if (!el) return;
  el.innerHTML = '<p class="text-gray-400 text-center py-6">Loading...</p>';

  try {
    const res = await axios.get('/api/monthly/trends');
    const { months } = res.data;

    const rows = months.map(m => {
      const crColor = m.collectionRate >= 80 ? 'text-green-600' : m.collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600';
      return `<tr class="hover:bg-gray-50 border-b border-gray-100">
        <td class="px-4 py-3 text-sm font-medium text-gray-800">${m.month}</td>
        <td class="px-4 py-3 text-sm text-right text-blue-700 font-semibold">${formatCurrency(m.totalInvoiced)}</td>
        <td class="px-4 py-3 text-sm text-right text-green-600">${formatCurrency(m.paidAmount)}</td>
        <td class="px-4 py-3 text-sm text-right text-orange-500">${formatCurrency(m.unpaidAmount)}</td>
        <td class="px-4 py-3 text-sm text-right text-red-500">${formatCurrency(m.lateAmount)}</td>
        <td class="px-4 py-3 text-sm text-right font-semibold ${crColor}">${m.collectionRate.toFixed(1)}%</td>
        <td class="px-4 py-3 text-sm text-right text-gray-600">${m.activeClients}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `<table class="min-w-full text-left">
      <thead>
        <tr class="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
          <th class="px-4 py-3">Month</th>
          <th class="px-4 py-3 text-right">Total Invoiced</th>
          <th class="px-4 py-3 text-right">Paid</th>
          <th class="px-4 py-3 text-right">Unpaid</th>
          <th class="px-4 py-3 text-right">Late / Overdue</th>
          <th class="px-4 py-3 text-right">Collection Rate</th>
          <th class="px-4 py-3 text-right">Active Clients</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch (e) {
    el.innerHTML = '<p class="text-red-500 text-center py-6">Unable to load — sign in with Xero to see live data</p>';
  }
}

window.loadAnalyticsGoals = loadAnalyticsGoals;

// ============================================================
// v2.10.0+ ENHANCEMENTS: sortable tables, analytics charts,
// client LTV analysis, AI-style insights per tab.
// All additive — no existing logic replaced in-place.
// ============================================================

// ---------- 1. Generic axios response capture for AI context ----------
window.__aiContext = window.__aiContext || {};
(function installAxiosCapture() {
  try {
    axios.interceptors.response.use((response) => {
      try {
        const url = (response.config && response.config.url ? response.config.url : '').split('?')[0];
        const key = url
          .replace(/^\/api\//, '')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '') || 'root';
        window.__aiContext[key] = response.data;
      } catch (e) { /* non-fatal */ }
      return response;
    });
  } catch (e) { console.warn('axios capture install failed', e); }
})();

// ---------- 2. Generic sortable-table helper ----------
// Attaches to any newly-rendered <table> inside the given container.
// Skips tables where any <th> already has an onclick attribute (to avoid
// conflicting with existing sortInvoices / sortClients / sortTrends logic).
function __getCellSortValue(cell) {
  if (!cell) return '';
  if (cell.dataset && cell.dataset.sortValue != null && cell.dataset.sortValue !== '') {
    const n = Number(cell.dataset.sortValue);
    return isNaN(n) ? cell.dataset.sortValue : n;
  }
  const txt = (cell.textContent || '').trim();
  if (!txt) return '';
  // Currency: $1,234.56 or -$1,234.56
  if (/^-?\$[\d,]+(\.\d+)?/.test(txt)) return parseFloat(txt.replace(/[$,]/g, ''));
  // Percentage: 85.4% or -10.0%
  if (/^-?\d+(\.\d+)?\s*%$/.test(txt)) return parseFloat(txt);
  // Numeric with optional suffix (days, months, mo)
  const num = txt.match(/^-?[\d,]+(\.\d+)?(\s*(days?|months?|mo))?$/i);
  if (num) return parseFloat(txt.replace(/,/g, ''));
  // ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) return new Date(txt).getTime();
  // Short month label "Apr 26" or "Jan 2026" or "Q1 2026"
  const mo = txt.match(/^([A-Za-z]{3})\s+(\d{2,4})$/);
  if (mo) {
    const monthOrder = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    const year = mo[2].length === 2 ? 2000 + parseInt(mo[2], 10) : parseInt(mo[2], 10);
    return year * 12 + (monthOrder[mo[1]] || 0);
  }
  const qtr = txt.match(/^Q([1-4])\s+(\d{4})$/);
  if (qtr) return parseInt(qtr[2], 10) * 10 + parseInt(qtr[1], 10);
  return txt.toLowerCase();
}

function __sortTableByColumn(table, colIdx, th) {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  // Preserve a "TOTAL" row at bottom
  const totalRow = rows.find(r =>
    r.classList.contains('font-bold') ||
    /^(total|grand\s*total)/i.test((r.textContent || '').trim().slice(0, 40))
  );
  const sortable = rows.filter(r => r !== totalRow);

  const newDir = th.dataset._sortDir === 'asc' ? 'desc' : 'asc';
  // Reset all header indicators in this table
  table.querySelectorAll('thead th').forEach(h => {
    h.dataset._sortDir = '';
    const ic = h.querySelector('i.__auto-sort-icon');
    if (ic) ic.className = 'fas fa-sort ml-1 text-gray-400 __auto-sort-icon';
  });
  th.dataset._sortDir = newDir;
  const icon = th.querySelector('i.__auto-sort-icon');
  if (icon) icon.className = (newDir === 'asc'
    ? 'fas fa-sort-up ml-1 text-blue-600 __auto-sort-icon'
    : 'fas fa-sort-down ml-1 text-blue-600 __auto-sort-icon');

  sortable.sort((a, b) => {
    const av = __getCellSortValue(a.cells[colIdx]);
    const bv = __getCellSortValue(b.cells[colIdx]);
    if (typeof av === 'number' && typeof bv === 'number') {
      return newDir === 'asc' ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    return newDir === 'asc' ? cmp : -cmp;
  });

  sortable.forEach(r => tbody.appendChild(r));
  if (totalRow) tbody.appendChild(totalRow);
}

function __applySortableToTables(container) {
  if (!container) return;
  const tables = container.querySelectorAll('table');
  tables.forEach(table => {
    if (table.dataset._autoSortable === '1') return;
    const ths = table.querySelectorAll('thead th');
    if (!ths.length) return;
    // Skip if any th already has an onclick (existing custom sort)
    let hasOwnSort = false;
    ths.forEach(th => { if (th.getAttribute('onclick')) hasOwnSort = true; });
    if (hasOwnSort) return;
    table.dataset._autoSortable = '1';
    ths.forEach((th, idx) => {
      // Skip columns explicitly marked non-sortable
      if (th.dataset && th.dataset.nosort === '1') return;
      th.style.cursor = 'pointer';
      th.classList.add('hover:bg-gray-100', 'select-none');
      // Append sort icon if not present
      if (!th.querySelector('i.__auto-sort-icon')) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-sort ml-1 text-gray-400 __auto-sort-icon';
        th.appendChild(document.createTextNode(' '));
        th.appendChild(icon);
      }
      th.addEventListener('click', () => __sortTableByColumn(table, idx, th));
    });
  });
}

function autoSortableContainer(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  __applySortableToTables(el);
  const observer = new MutationObserver(() => __applySortableToTables(el));
  observer.observe(el, { childList: true, subtree: true });
}

// Activate on all tab panels
document.addEventListener('DOMContentLoaded', () => {
  [
    'tab-dashboard', 'tab-invoices', 'tab-clients',
    'tab-trends', 'tab-analytics', 'tab-goals', 'tab-valuation', 'tab-sheets-links'
  ].forEach(id => autoSortableContainer(id));
});

// ---------- 3. Analytics charts (Invoiced, Stacked, Collection, Clients) ----------
window.__analyticsCharts = window.__analyticsCharts || {};
function __mkChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.__analyticsCharts[id]) {
    try { window.__analyticsCharts[id].destroy(); } catch (e) {}
  }
  window.__analyticsCharts[id] = new Chart(el, config);
}

function renderAnalyticsCharts(months) {
  if (!Array.isArray(months) || !months.length) return;
  const labels = months.map(m => m.month);
  const invoiced = months.map(m => Number(m.totalInvoiced) || 0);
  const paid = months.map(m => Number(m.paidAmount) || 0);
  const late = months.map(m => Number(m.lateAmount) || 0);
  const unpaidNotLate = months.map((m, i) => Math.max(0, (Number(m.unpaidAmount) || 0) - (Number(m.lateAmount) || 0)));
  const collRate = months.map(m => Number(m.collectionRate) || 0);
  const activeClients = months.map(m => Number(m.activeClients) || 0);

  __mkChart('analyticsInvoicedChart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Invoiced',  data: invoiced, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.15)', fill: true,  tension: 0.3 },
        { label: 'Paid',      data: paid,     borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.05)', fill: false, tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } }
    }
  });

  __mkChart('analyticsPaidStackedChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Paid',   data: paid,          backgroundColor: '#16a34a' },
        { label: 'Unpaid', data: unpaidNotLate, backgroundColor: '#f97316' },
        { label: 'Late',   data: late,          backgroundColor: '#dc2626' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } }
      }
    }
  });

  __mkChart('analyticsCollectionChart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Collection Rate %', data: collRate, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.12)', fill: true, tension: 0.3 },
        { label: 'Target 90%',        data: Array(labels.length).fill(90), borderColor: '#a16207', borderDash: [5,5], fill: false, pointRadius: 0, tension: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, max: 110, ticks: { callback: v => v + '%' } } }
    }
  });

  __mkChart('analyticsActiveClientsChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Active Clients', data: activeClients, backgroundColor: '#8b5cf6' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// ---------- 3b. Revenue Performance Summary — bar chart + avg line + best month ----------
function renderRevPerfSummary(months) {
  if (!Array.isArray(months) || !months.length) return;
  const labels = months.map(m => m.month);
  const invoiced = months.map(m => Number(m.totalInvoiced) || 0);
  const activeClients = months.map(m => Number(m.activeClients) || 0);
  const collRates = months.map(m => Number(m.collectionRate) || 0);

  // Compute averages
  const avgRev = invoiced.reduce((a, b) => a + b, 0) / invoiced.length;
  const avgClients = activeClients.reduce((a, b) => a + b, 0) / activeClients.length;
  const avgColl = collRates.reduce((a, b) => a + b, 0) / collRates.length;

  // Best month
  const bestIdx = invoiced.indexOf(Math.max(...invoiced));
  const bestMonth = labels[bestIdx];
  const bestAmount = invoiced[bestIdx];

  // Update KPI cards
  const el = id => document.getElementById(id);
  if (el('revPerfAvgRev')) el('revPerfAvgRev').textContent = '$' + Math.round(avgRev).toLocaleString();
  if (el('revPerfBestMonth')) el('revPerfBestMonth').textContent = bestMonth;
  if (el('revPerfBestAmount')) el('revPerfBestAmount').textContent = '$' + bestAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (el('revPerfAvgClients')) el('revPerfAvgClients').textContent = avgClients.toFixed(1);
  if (el('revPerfAvgColl')) el('revPerfAvgColl').textContent = avgColl.toFixed(1) + '%';

  // Bar colours — best month is gold, others are blue
  const barColors = invoiced.map((v, i) => i === bestIdx ? '#f59e0b' : '#3b82f6');
  const borderColors = invoiced.map((v, i) => i === bestIdx ? '#d97706' : '#2563eb');

  __mkChart('revPerfBarChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Revenue',
          data: invoiced,
          backgroundColor: barColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Average ($' + Math.round(avgRev).toLocaleString() + ')',
          data: Array(labels.length).fill(avgRev),
          type: 'line',
          borderColor: '#ef4444',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (ctx.dataset.type === 'line') return ctx.dataset.label;
              const val = '$' + ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 });
              const diff = ctx.parsed.y - avgRev;
              const pct = ((diff / avgRev) * 100).toFixed(1);
              const sign = diff >= 0 ? '+' : '';
              return val + ' (' + sign + pct + '% vs avg)';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => '$' + v.toLocaleString() }
        }
      }
    }
  });
}

// Wrap loadAnalyticsGoals to also draw charts and load LTV
(function wrapLoadAnalytics() {
  const original = window.loadAnalyticsGoals;
  if (typeof original !== 'function') return;
  window.loadAnalyticsGoals = async function () {
    try { await original.apply(this, arguments); } catch (e) { console.warn(e); }
    try {
      const res = await axios.get('/api/monthly/trends');
      const months = (res && res.data && res.data.months) || [];
      window.__aiContext.monthlyTrends = months;
      renderAnalyticsCharts(months);
      renderRevPerfSummary(months);
    } catch (e) { console.warn('Could not render analytics charts:', e); }
    try { await loadClientLTVAnalytics(); } catch (e) { console.warn('LTV analytics failed:', e); }
  };
})();

// ---------- 4. Client LTV analytics (active pending-payment clients only) ----------
window.__ltvCharts = window.__ltvCharts || {};
function __mkLtvChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.__ltvCharts[id]) {
    try { window.__ltvCharts[id].destroy(); } catch (e) {}
  }
  window.__ltvCharts[id] = new Chart(el, config);
}

async function loadClientLTVAnalytics() {
  const tableEl = document.getElementById('ltvSummaryTable');
  if (!tableEl) return;
  tableEl.innerHTML = '<p class="text-gray-400 text-center py-6">Loading...</p>';

  const setKPI = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  ['ltvAvgLifetime','ltvAvgInvoices','ltvAvgInvoiceValue','ltvAvgLTV'].forEach(id => setKPI(id, '--'));

  try {
    const [lifetimeRes, pendingRes] = await Promise.all([
      axios.get('/api/clients/lifetime').catch(() => null),
      axios.get('/api/clients/awaiting-payment').catch(() => null)
    ]);

    const allClients = (lifetimeRes && lifetimeRes.data && lifetimeRes.data.clients) || [];
    const pendingRaw = pendingRes && pendingRes.data
      ? (pendingRes.data.clients || pendingRes.data)
      : [];
    const pendingArr = Array.isArray(pendingRaw) ? pendingRaw : [];

    if (!allClients.length) {
      tableEl.innerHTML = '<p class="text-gray-500 text-center py-6">No client lifetime data available</p>';
      return;
    }
    if (!pendingArr.length) {
      tableEl.innerHTML = '<p class="text-gray-500 text-center py-6">No active pending-payment clients right now</p>';
      return;
    }

    const norm = (s) => (s || '').toString().toLowerCase().trim();
    const pendingNames = new Set(pendingArr.map(c => norm(c.contactName || c.name)));
    const pendingLookup = {};
    pendingArr.forEach(c => { pendingLookup[norm(c.contactName || c.name)] = c; });

    const filtered = allClients.filter(c => pendingNames.has(norm(c.contactName))).map(c => ({
      ...c,
      pendingOutstanding: (pendingLookup[norm(c.contactName)] || {}).totalOutstanding || 0,
      pendingInvoices:    (pendingLookup[norm(c.contactName)] || {}).invoiceCount || 0
    }));

    if (!filtered.length) {
      tableEl.innerHTML = '<p class="text-gray-500 text-center py-6">No overlap between lifetime history and active pending-payment clients</p>';
      return;
    }

    const totalClients = filtered.length;
    const invoicesOf = (c) => Number(c.invoiceCount) || Number(c.billedMonths) || 0;
    const totalInvoices = filtered.reduce((s, c) => s + invoicesOf(c), 0);
    const totalInvoiced = filtered.reduce((s, c) => s + (Number(c.totalInvoiced) || 0), 0);
    const avgLifetime = filtered.reduce((s, c) => s + (Number(c.elapsedMonths) || 0), 0) / totalClients;
    const avgInvoices = totalInvoices / totalClients;
    const avgInvoiceValue = totalInvoices > 0 ? totalInvoiced / totalInvoices : 0;
    const avgLTV = totalInvoiced / totalClients;

    setKPI('ltvAvgLifetime', avgLifetime.toFixed(1) + ' mo');
    setKPI('ltvAvgInvoices', avgInvoices.toFixed(1));
    setKPI('ltvAvgInvoiceValue', formatCurrency(avgInvoiceValue));
    setKPI('ltvAvgLTV', formatCurrency(avgLTV));

    // Retention histogram
    const buckets = [
      { label: '< 3 mo',   min: 0,  max: 2.99 },
      { label: '3–6 mo',   min: 3,  max: 5.99 },
      { label: '6–12 mo',  min: 6,  max: 11.99 },
      { label: '12–24 mo', min: 12, max: 23.99 },
      { label: '24+ mo',   min: 24, max: Infinity }
    ];
    const bucketCounts = buckets.map(b =>
      filtered.filter(c => {
        const m = Number(c.elapsedMonths) || 0;
        return m >= b.min && m <= b.max;
      }).length
    );

    __mkLtvChart('ltvRetentionChart', {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [{ label: 'Pending-payment clients', data: bucketCounts, backgroundColor: '#8b5cf6' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    __mkLtvChart('ltvScatterChart', {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Clients',
          data: filtered.map(c => ({
            x: invoicesOf(c),
            y: Number(c.totalInvoiced) || 0,
            name: c.contactName
          })),
          backgroundColor: 'rgba(37,99,235,0.75)',
          pointRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.raw.name}: ${ctx.raw.x} invoices, ${formatCurrency(ctx.raw.y)}`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Invoices (all-time)' }, beginAtZero: true, ticks: { precision: 0 } },
          y: { title: { display: true, text: 'Total Invoiced' },      beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } }
        }
      }
    });

    // Summary table (sortable via auto-sort helper)
    const sorted = [...filtered].sort((a, b) => (Number(b.totalInvoiced) || 0) - (Number(a.totalInvoiced) || 0));
    const rows = sorted.map(c => {
      const invCount = invoicesOf(c);
      const avgPerInv = invCount > 0 ? (Number(c.totalInvoiced) || 0) / invCount : 0;
      return `<tr class="hover:bg-gray-50 border-b border-gray-100">
        <td class="px-4 py-3 text-sm font-medium text-gray-800">${c.contactName || ''}</td>
        <td class="px-4 py-3 text-sm text-right text-blue-700">${c.elapsedMonths || 0} mo</td>
        <td class="px-4 py-3 text-sm text-right text-purple-700">${c.billedMonths || 0}</td>
        <td class="px-4 py-3 text-sm text-right text-gray-700">${invCount}</td>
        <td class="px-4 py-3 text-sm text-right font-semibold text-green-700">${formatCurrency(c.totalInvoiced || 0)}</td>
        <td class="px-4 py-3 text-sm text-right text-gray-600">${formatCurrency(avgPerInv)}</td>
        <td class="px-4 py-3 text-sm text-right text-red-600">${formatCurrency(c.pendingOutstanding || 0)}</td>
      </tr>`;
    }).join('');

    tableEl.innerHTML = `<table class="min-w-full text-left">
      <thead>
        <tr class="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
          <th class="px-4 py-3">Client</th>
          <th class="px-4 py-3 text-right">Lifetime</th>
          <th class="px-4 py-3 text-right">Billed Months</th>
          <th class="px-4 py-3 text-right">Invoices</th>
          <th class="px-4 py-3 text-right">Total Invoiced</th>
          <th class="px-4 py-3 text-right">Avg / Invoice</th>
          <th class="px-4 py-3 text-right">Outstanding</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="text-xs text-gray-400 mt-3">
      Scope: ${totalClients} active pending-payment client${totalClients === 1 ? '' : 's'}.
      Lifetime = months from first to latest invoice (inclusive). Avg / Invoice = Total Invoiced ÷ Invoices.
    </p>`;

    window.__aiContext.ltv = {
      totalClients, avgLifetime, avgInvoices, avgInvoiceValue, avgLTV,
      totalInvoices, totalInvoiced,
      clients: filtered,
      bucketLabels: buckets.map(b => b.label),
      bucketCounts
    };
  } catch (e) {
    console.error('LTV analytics error:', e);
    tableEl.innerHTML = '<p class="text-red-500 text-center py-6">Unable to load — sign in with Xero to see live data</p>';
  }
}
window.loadClientLTVAnalytics = loadClientLTVAnalytics;

// ---------- 5. AI Insights (rule-based, per tab) ----------
function __fmt$(n) { return formatCurrency(Number(n) || 0); }
function __pct(n)  { return (Number(n) || 0).toFixed(1) + '%'; }

function __trendDirection(arr) {
  if (!Array.isArray(arr) || arr.length < 3) return 'flat';
  const n = arr.length;
  const first3 = arr.slice(0, 3).reduce((s, v) => s + (Number(v) || 0), 0) / 3;
  const last3  = arr.slice(n - 3).reduce((s, v) => s + (Number(v) || 0), 0) / 3;
  if (last3 > first3 * 1.05) return 'rising';
  if (last3 < first3 * 0.95) return 'falling';
  return 'flat';
}

function __insightHTML(title, sections) {
  // sections: [{ heading, bullets: [string, ...], tone: 'good'|'warn'|'bad'|'neutral' }]
  const toneColor = {
    good:   'border-green-300 bg-green-50',
    warn:   'border-yellow-300 bg-yellow-50',
    bad:    'border-red-300 bg-red-50',
    neutral:'border-gray-200 bg-white'
  };
  const toneIcon = {
    good: 'fa-circle-check text-green-600',
    warn: 'fa-triangle-exclamation text-yellow-600',
    bad:  'fa-circle-xmark text-red-600',
    neutral: 'fa-circle-info text-gray-500'
  };
  let html = `<div class="space-y-3">`;
  html += `<p class="text-xs text-gray-500">Generated ${new Date().toLocaleString()} — heuristic analysis from data currently on this page.</p>`;
  for (const s of sections) {
    const tone = s.tone || 'neutral';
    html += `<div class="border ${toneColor[tone]} rounded-lg p-3">
      <p class="text-sm font-semibold text-gray-800 mb-1"><i class="fas ${toneIcon[tone]} mr-2"></i>${s.heading}</p>
      <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
        ${s.bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function __insightsForDashboard() {
  const sections = [];
  const rev = window.__aiContext.revenue_metrics || window.__aiContext.demo_revenue_metrics;
  const aging = window.__aiContext.invoices_by_aging;
  const summary = window.__aiContext.invoices_summary || window.__aiContext.demo_summary;

  if (rev) {
    const momSign = (rev.momGrowth || 0) >= 0 ? '+' : '';
    sections.push({
      heading: 'Revenue snapshot',
      tone: (rev.momGrowth || 0) >= 0 ? 'good' : 'warn',
      bullets: [
        `MRR is <strong>${__fmt$(rev.mrr)}</strong> (ARR run-rate <strong>${__fmt$(rev.arr)}</strong>).`,
        `Month-over-month change: <strong>${momSign}${(rev.momGrowth || 0).toFixed(1)}%</strong> vs last month (${__fmt$(rev.prevMonthInvoiced || 0)}).`,
        `YTD revenue is <strong>${__fmt$(rev.ytdRevenue)}</strong>; projected EOY <strong>${__fmt$(rev.projectedEOY)}</strong>.`,
        `Active clients this month: <strong>${rev.activeClients}</strong>, avg revenue / client <strong>${__fmt$((rev.calculations || {}).avgRevenuePerClient || 0)}</strong>.`
      ]
    });

    const crNum = Number(rev.collectionRate) || 0;
    sections.push({
      heading: 'Collection health',
      tone: crNum >= 85 ? 'good' : crNum >= 60 ? 'warn' : 'bad',
      bullets: [
        `Collection rate this month is <strong>${__pct(crNum)}</strong>.`,
        `Late invoices this month: <strong>${rev.lateThisMonth || 0}</strong>, paid <strong>${rev.paidThisMonth || 0}</strong>, unpaid <strong>${rev.unpaidThisMonth || 0}</strong>.`,
        crNum < 60 ? 'A collection rate under 60% usually signals invoices went out very recently — expect it to rise as due dates hit.' : 'Collection pace looks healthy for the period.'
      ]
    });
  }

  if (aging) {
    const tot = (aging.current && aging.current.total || 0) + (aging.aged && aging.aged.total || 0) + (aging.critical && aging.critical.total || 0);
    const critPct = tot > 0 ? (aging.critical.total / tot) * 100 : 0;
    sections.push({
      heading: 'Invoice aging',
      tone: critPct > 20 ? 'bad' : critPct > 10 ? 'warn' : 'good',
      bullets: [
        `Current (0–99d): <strong>${aging.current.count}</strong> inv / <strong>${__fmt$(aging.current.total)}</strong>.`,
        `Aged (100–199d): <strong>${aging.aged.count}</strong> inv / <strong>${__fmt$(aging.aged.total)}</strong>.`,
        `Critical (200+ d): <strong>${aging.critical.count}</strong> inv / <strong>${__fmt$(aging.critical.total)}</strong> — <strong>${critPct.toFixed(1)}%</strong> of outstanding.`,
        critPct > 20 ? '🚨 More than a fifth of outstanding AR is deeply overdue — consider legal escalation or write-offs.' : 'Aging distribution is within a manageable range.'
      ]
    });
  }

  if (summary) {
    sections.push({
      heading: 'Invoice pipeline',
      tone: 'neutral',
      bullets: [
        `Draft: <strong>${summary.draftCount || 0}</strong> (${__fmt$(summary.draftAmount || 0)}).`,
        `Awaiting payment: <strong>${summary.awaitingCount || 0}</strong> (${__fmt$(summary.awaitingAmount || 0)}).`,
        `Overdue: <strong>${summary.overdueCount || 0}</strong> (${__fmt$(summary.overdueAmount || 0)}).`
      ]
    });
  }

  if (!sections.length) {
    sections.push({
      heading: 'No data yet',
      tone: 'neutral',
      bullets: ['Interact with the dashboard (or sign in with Xero) to load data, then try again.']
    });
  }
  return sections;
}

function __insightsForInvoices() {
  const invs = (typeof currentInvoiceData !== 'undefined' ? currentInvoiceData : []) || [];
  if (!invs.length) {
    return [{ heading: 'No invoices loaded', tone: 'neutral', bullets: ['Click one of the status buttons above to load invoices, then regenerate.'] }];
  }
  const byStatus = {};
  let totalDue = 0, totalAmt = 0;
  let oldestOverdue = null;
  const now = Date.now();
  invs.forEach(inv => {
    const st = inv.Status || 'UNKNOWN';
    byStatus[st] = (byStatus[st] || 0) + 1;
    totalAmt += Number(inv.Total) || 0;
    totalDue += Number(inv.AmountDue) || 0;
    if ((Number(inv.AmountDue) || 0) > 0 && inv.DueDate) {
      const d = new Date(inv.DueDate).getTime();
      if (d < now) {
        if (!oldestOverdue || d < new Date(oldestOverdue.DueDate).getTime()) oldestOverdue = inv;
      }
    }
  });
  const sections = [{
    heading: `Invoice list — ${invs.length} invoice${invs.length === 1 ? '' : 's'}`,
    tone: totalDue > 0 ? 'warn' : 'good',
    bullets: [
      `Total billed: <strong>${__fmt$(totalAmt)}</strong>, outstanding: <strong>${__fmt$(totalDue)}</strong>.`,
      'Status breakdown: ' + Object.entries(byStatus).map(([k, v]) => `<strong>${v}</strong> ${k}`).join(', ') + '.'
    ]
  }];
  if (oldestOverdue) {
    const daysLate = Math.floor((now - new Date(oldestOverdue.DueDate).getTime()) / 86400000);
    sections.push({
      heading: 'Oldest outstanding invoice',
      tone: daysLate > 90 ? 'bad' : 'warn',
      bullets: [
        `<strong>${oldestOverdue.InvoiceNumber || 'N/A'}</strong> — ${(oldestOverdue.Contact && oldestOverdue.Contact.Name) || 'Unknown'}: ${__fmt$(oldestOverdue.AmountDue)} is <strong>${daysLate} day${daysLate === 1 ? '' : 's'}</strong> past due.`
      ]
    });
  }
  return sections;
}

function __insightsForClients() {
  const sections = [];
  const pending = (typeof currentClientData !== 'undefined' ? currentClientData : []) || [];
  const lifetime = (window.__aiContext.clients_lifetime && window.__aiContext.clients_lifetime.clients) || [];

  if (pending.length) {
    const totOut = pending.reduce((s, c) => s + (c.totalOutstanding || 0), 0);
    const sorted = [...pending].sort((a, b) => (b.totalOutstanding || 0) - (a.totalOutstanding || 0));
    const top3 = sorted.slice(0, 3);
    const worstDelay = [...pending].sort((a, b) => (b.averagePaymentDelay || 0) - (a.averagePaymentDelay || 0))[0];
    const concentration = top3.reduce((s, c) => s + (c.totalOutstanding || 0), 0) / Math.max(1, totOut) * 100;
    sections.push({
      heading: `Pending-payment clients (${pending.length})`,
      tone: concentration > 60 ? 'warn' : 'neutral',
      bullets: [
        `Total outstanding: <strong>${__fmt$(totOut)}</strong>.`,
        `Top 3 by outstanding concentrate <strong>${concentration.toFixed(1)}%</strong> of AR: ${top3.map(c => `${c.contactName} (${__fmt$(c.totalOutstanding)})`).join(', ')}.`,
        worstDelay ? `Worst avg delay: <strong>${worstDelay.contactName}</strong> at <strong>${worstDelay.averagePaymentDelay} days</strong>.` : ''
      ].filter(Boolean)
    });
  }

  if (lifetime.length) {
    const avgLT = lifetime.reduce((s, c) => s + (c.elapsedMonths || 0), 0) / lifetime.length;
    const longTerm = lifetime.filter(c => (c.elapsedMonths || 0) >= 12).length;
    sections.push({
      heading: 'Retention',
      tone: avgLT >= 12 ? 'good' : avgLT >= 6 ? 'warn' : 'bad',
      bullets: [
        `Avg elapsed lifetime across <strong>${lifetime.length}</strong> clients: <strong>${avgLT.toFixed(1)} months</strong>.`,
        `${longTerm} client${longTerm === 1 ? '' : 's'} retained ≥ 12 months (${((longTerm / lifetime.length) * 100).toFixed(0)}%).`
      ]
    });
  }

  if (!sections.length) {
    sections.push({ heading: 'No client data yet', tone: 'neutral', bullets: ['Click Load on the Retention or Awaiting-Payment cards, then regenerate.'] });
  }
  return sections;
}

function __insightsForTrends() {
  const sections = [];
  const trends = currentTrendsData;
  const monthly = window.__aiContext.monthlyTrends || [];
  if (trends && trends.periods && trends.periods.length) {
    const last = trends.periods[trends.periods.length - 1];
    const first = trends.periods[0];
    const collTrend = __trendDirection(trends.periods.map(p => p.collectionRate));
    sections.push({
      heading: `Payment trends — ${trends.periods.length} periods`,
      tone: collTrend === 'rising' ? 'good' : collTrend === 'falling' ? 'bad' : 'neutral',
      bullets: [
        `Average payment velocity: <strong>${trends.averagePaymentVelocity} days</strong>.`,
        `Total improvement over period: <strong>${__fmt$(trends.totalImprovement)}</strong>.`,
        `Best period: <strong>${trends.bestPeriod.periodLabel}</strong>.`,
        `Collection rate trend: <strong>${collTrend}</strong> (${first.collectionRate.toFixed(1)}% → ${last.collectionRate.toFixed(1)}%).`
      ]
    });
  }
  if (monthly.length) {
    const invTrend = __trendDirection(monthly.map(m => m.totalInvoiced));
    const clientTrend = __trendDirection(monthly.map(m => m.activeClients));
    sections.push({
      heading: 'Monthly breakdown (12 mo)',
      tone: invTrend === 'rising' ? 'good' : invTrend === 'falling' ? 'warn' : 'neutral',
      bullets: [
        `Invoiced trend: <strong>${invTrend}</strong>.`,
        `Active-client trend: <strong>${clientTrend}</strong>.`
      ]
    });
  }
  if (!sections.length) sections.push({ heading: 'No trends loaded', tone: 'neutral', bullets: ['Click "Load Trends" or "Load" in the Monthly Breakdown card, then regenerate.'] });
  return sections;
}

function __insightsForAnalytics() {
  const sections = [];
  const months = window.__aiContext.monthlyTrends || [];
  const rev    = window.__aiContext.revenue_metrics || window.__aiContext.demo_revenue_metrics;
  const ltv    = window.__aiContext.ltv;

  if (months.length) {
    const invAvg    = months.reduce((s, m) => s + (m.totalInvoiced || 0), 0) / months.length;
    const crAvg     = months.reduce((s, m) => s + (m.collectionRate || 0), 0) / months.length;
    const clientAvg = months.reduce((s, m) => s + (m.activeClients || 0), 0) / months.length;
    const invTrend  = __trendDirection(months.map(m => m.totalInvoiced));
    const crTrend   = __trendDirection(months.map(m => m.collectionRate));
    const best      = [...months].sort((a, b) => (b.totalInvoiced || 0) - (a.totalInvoiced || 0))[0];
    sections.push({
      heading: '12-month overview',
      tone: invTrend === 'rising' ? 'good' : invTrend === 'falling' ? 'warn' : 'neutral',
      bullets: [
        `Average monthly invoiced: <strong>${__fmt$(invAvg)}</strong> (trend: <strong>${invTrend}</strong>).`,
        `Average collection rate: <strong>${crAvg.toFixed(1)}%</strong> (trend: <strong>${crTrend}</strong>).`,
        `Average active clients per month: <strong>${clientAvg.toFixed(1)}</strong>.`,
        best ? `Best invoiced month: <strong>${best.month}</strong> (${__fmt$(best.totalInvoiced)}).` : ''
      ].filter(Boolean)
    });
  }

  if (rev) {
    sections.push({
      heading: 'Run-rate & projection',
      tone: (rev.momGrowth || 0) >= 0 ? 'good' : 'warn',
      bullets: [
        `Current MRR / ARR: <strong>${__fmt$(rev.mrr)}</strong> / <strong>${__fmt$(rev.arr)}</strong>.`,
        `Projected EOY: <strong>${__fmt$(rev.projectedEOY)}</strong> — pace vs projection <strong>${((rev.calculations && rev.calculations.paceVsProjection) || 0).toFixed(1)}%</strong>.`
      ]
    });
  }

  if (ltv) {
    const topClient = [...(ltv.clients || [])].sort((a, b) => (b.totalInvoiced || 0) - (a.totalInvoiced || 0))[0];
    const longRetained = (ltv.clients || []).filter(c => (c.elapsedMonths || 0) >= 12).length;
    const retentionPct = ltv.totalClients > 0 ? (longRetained / ltv.totalClients) * 100 : 0;
    sections.push({
      heading: `LTV — active pending-payment clients (${ltv.totalClients})`,
      tone: ltv.avgLifetime >= 12 ? 'good' : ltv.avgLifetime >= 6 ? 'warn' : 'bad',
      bullets: [
        `On average we keep a pending-payment client <strong>${ltv.avgLifetime.toFixed(1)} months</strong> and send <strong>${ltv.avgInvoices.toFixed(1)} invoices</strong>.`,
        `Average charge per invoice is <strong>${__fmt$(ltv.avgInvoiceValue)}</strong>; average LTV is <strong>${__fmt$(ltv.avgLTV)}</strong>.`,
        `${longRetained} of ${ltv.totalClients} pending clients have been retained ≥ 12 months (<strong>${retentionPct.toFixed(0)}%</strong>).`,
        topClient ? `Highest-value pending client: <strong>${topClient.contactName}</strong> (${__fmt$(topClient.totalInvoiced)} across ${topClient.invoiceCount || topClient.billedMonths || 0} invoices).` : ''
      ].filter(Boolean)
    });
  }

  if (!sections.length) sections.push({ heading: 'No analytics loaded', tone: 'neutral', bullets: ['Click "Load" on this page to compute analytics, then regenerate.'] });
  return sections;
}

function __insightsForSheetsLinks() {
  return [{
    heading: 'How to get the most out of these links',
    tone: 'neutral',
    bullets: [
      'Paste <code>=IMPORTDATA("…")</code> into Google Sheets — it auto-refreshes when you open the sheet.',
      'Combine <strong>Clients Awaiting Payment</strong> + <strong>Payment Trends</strong> on one tab for a quick weekly AR review.',
      'Use <strong>Invoices by Aging</strong> as the source for conditional-formatting-driven collection priorities.',
      'Per-client <code>/api/sheets/{ClientName}/due</code> URLs are ideal as cells in a client-by-client tracker.'
    ]
  }];
}

function generateAIInsights(tab) {
  const target = document.getElementById('aiInsights-' + tab);
  if (!target) return;
  target.classList.remove('hidden');
  target.innerHTML = '<p class="text-sm text-gray-500 py-2"><i class="fas fa-spinner fa-spin mr-2"></i>Analyzing data on this page…</p>';
  let sections;
  try {
    switch (tab) {
      case 'dashboard':     sections = __insightsForDashboard(); break;
      case 'invoices':      sections = __insightsForInvoices();  break;
      case 'clients':       sections = __insightsForClients();   break;
      case 'trends':        sections = __insightsForTrends();    break;
      case 'analytics':     sections = __insightsForAnalytics(); break;
      case 'goals':         sections = __insightsForGoals(); break;
      case 'sheets-links':  sections = __insightsForSheetsLinks(); break;
      default: sections = [{ heading: 'No analyzer for this tab', tone: 'neutral', bullets: ['—'] }];
    }
  } catch (e) {
    console.error('AI insights error:', e);
    sections = [{ heading: 'Could not analyze', tone: 'bad', bullets: ['An error occurred while analyzing this page: ' + (e.message || e)] }];
  }
  // tiny delay so the spinner is visible
  setTimeout(() => {
    target.innerHTML = __insightHTML('AI Insights', sections);
  }, 150);
}
window.generateAIInsights = generateAIInsights;

// ============================================================
// v2.11.0 GOALS TAB — editable targets stored in localStorage,
// progress bars, projections, monthly tracking table.
// ============================================================

// Goals are stored server-side so all team members see the same targets
async function __loadGoalsFromStorage() {
  try {
    const res = await axios.get('/api/goals');
    return res.data || { revenue: null, clients: null, collection: null };
  } catch (e) {
    return { revenue: null, clients: null, collection: null };
  }
}

async function __saveGoalsToStorage(goals) {
  const res = await axios.post('/api/goals', goals);
  if (!res?.data?.ok) {
    const err = res?.data?.error || 'Save failed';
    throw new Error(err);
  }
  return res.data;
}

// Populate inputs from server on page load
document.addEventListener('DOMContentLoaded', async () => {
  const goals = await __loadGoalsFromStorage();
  const rEl = document.getElementById('goalRevenue');
  const cEl = document.getElementById('goalClients');
  const colEl = document.getElementById('goalCollection');
  if (rEl && goals.revenue != null) rEl.value = goals.revenue;
  if (cEl && goals.clients != null) cEl.value = goals.clients;
  if (colEl && goals.collection != null) colEl.value = goals.collection;
});

async function saveGoals() {
  const revenue = parseFloat(document.getElementById('goalRevenue')?.value) || null;
  const clients = parseInt(document.getElementById('goalClients')?.value, 10) || null;
  const collection = parseFloat(document.getElementById('goalCollection')?.value) || null;
  const btn = event.target.closest('button');
  try {
    await __saveGoalsToStorage({ revenue, clients, collection });
  } catch (e) {
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-times mr-2"></i>Save failed';
      btn.classList.replace('bg-blue-600', 'bg-red-600');
      btn.classList.replace('hover:bg-blue-700', 'hover:bg-red-700');
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.replace('bg-red-600', 'bg-blue-600');
        btn.classList.replace('hover:bg-red-700', 'hover:bg-blue-700');
      }, 3000);
    }
    console.error('saveGoals error:', e);
    return;
  }

  // visual feedback
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check mr-2"></i>Saved!';
    btn.classList.replace('bg-blue-600', 'bg-green-600');
    btn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.replace('bg-green-600', 'bg-blue-600');
      btn.classList.replace('hover:bg-green-700', 'hover:bg-blue-700');
    }, 1500);
  }
  // auto-refresh progress
  loadGoalProgress();
}
window.saveGoals = saveGoals;

// ---- Progress rendering ----

function __pctColor(pct) {
  if (pct >= 90) return { bar: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' };
  if (pct >= 60) return { bar: 'bg-yellow-400', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' };
  return { bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800' };
}

function __onTrackLabel(pct, dayOfMonth, daysInMonth) {
  // Expected pct at this point in the month
  const expectedPct = (dayOfMonth / daysInMonth) * 100;
  const diff = pct - expectedPct;
  if (diff >= 5) return { label: 'Ahead of pace', icon: 'fa-rocket', cls: 'text-green-600' };
  if (diff >= -5) return { label: 'On track', icon: 'fa-check-circle', cls: 'text-blue-600' };
  if (diff >= -20) return { label: 'Slightly behind', icon: 'fa-exclamation-triangle', cls: 'text-yellow-600' };
  return { label: 'Off pace', icon: 'fa-times-circle', cls: 'text-red-600' };
}

function __buildProgressCard(label, icon, iconColor, actual, target, unit, dayOfMonth, daysInMonth) {
  const isPercent = unit === '%';
  const pct = target > 0 ? Math.min((actual / target) * 100, 120) : 0;
  const pctClamped = Math.min(pct, 100);
  const colors = __pctColor(pctClamped);
  const pace = __onTrackLabel(pctClamped, dayOfMonth, daysInMonth);
  const fmtActual = isPercent ? actual.toFixed(1) + '%' : (typeof formatCurrency === 'function' ? formatCurrency(actual) : '$' + actual.toLocaleString());
  const fmtTarget = isPercent ? target + '%' : (typeof formatCurrency === 'function' ? formatCurrency(target) : '$' + target.toLocaleString());

  return `
    <div class="border border-gray-200 rounded-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center">
          <i class="fas ${icon} ${iconColor} mr-2"></i>
          <span class="font-semibold text-gray-800">${label}</span>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full ${colors.badge} font-medium">${pctClamped.toFixed(0)}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
        <div class="${colors.bar} h-4 rounded-full transition-all duration-500" style="width:${Math.min(pctClamped, 100)}%"></div>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="${colors.text} font-medium">${fmtActual}</span>
        <span class="text-gray-400">of ${fmtTarget}</span>
      </div>
      <div class="flex items-center mt-2 text-xs ${pace.cls}">
        <i class="fas ${pace.icon} mr-1"></i>${pace.label}
        <span class="text-gray-400 ml-2">(day ${dayOfMonth} of ${daysInMonth})</span>
      </div>
    </div>`;
}

async function loadGoalProgress() {
  const goals = await __loadGoalsFromStorage();
  const container = document.getElementById('goalsProgressContainer');
  const tableContainer = document.getElementById('goalsMonthlyTable');
  const monthLabel = document.getElementById('goalsCurrentMonthLabel');
  if (!container) return;

  // Need at least one goal set
  if (!goals.revenue && !goals.clients && !goals.collection) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Set at least one goal above, then click "Refresh"</p>';
    return;
  }

  container.innerHTML = '<p class="text-sm text-gray-500 py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading actuals from Xero…</p>';

  try {
    // Fetch monthly trends data (same endpoint that powers the Analytics tab)
    const response = await axios.get('/api/monthly/trends');
    const months = (response.data && response.data.months) || response.data;
    if (!months || !months.length) {
      container.innerHTML = '<p class="text-gray-500 text-center py-8">No data returned from analytics endpoint</p>';
      return;
    }

    // Cache for AI insights
    window.__goalsData = { goals, months };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (monthLabel) monthLabel.textContent = `Actuals vs targets for ${monthName} — day ${dayOfMonth} of ${daysInMonth}`;

    // Find current month data — use monthNum/year fields if available, else parse label
    const currentData = months.find(m => {
      if (m.monthNum && m.year) return m.monthNum === (currentMonth + 1) && m.year === currentYear;
      const d = m.month ? new Date(m.month + ' 1, ' + currentYear) : null;
      return d && !isNaN(d) && d.getMonth() === currentMonth;
    }) || months[months.length - 1]; // fallback to most recent

    const actualRevenue = currentData.totalInvoiced || 0;
    const actualClients = currentData.activeClients || 0;
    const actualCollection = currentData.totalInvoiced > 0
      ? ((currentData.paidAmount || 0) / currentData.totalInvoiced) * 100
      : 0;

    // Build progress cards
    let cards = '';
    if (goals.revenue) {
      cards += __buildProgressCard('Monthly Revenue', 'fa-dollar-sign', 'text-green-600',
        actualRevenue, goals.revenue, '$', dayOfMonth, daysInMonth);
    }
    if (goals.clients) {
      cards += __buildProgressCard('Active Clients', 'fa-users', 'text-purple-600',
        actualClients, goals.clients, '#', dayOfMonth, daysInMonth);
    }
    if (goals.collection) {
      cards += __buildProgressCard('Collection Rate', 'fa-percentage', 'text-orange-600',
        actualCollection, goals.collection, '%', dayOfMonth, daysInMonth);
    }

    container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-${Math.min(3, [goals.revenue, goals.clients, goals.collection].filter(Boolean).length)} gap-6">${cards}</div>`;

    // ---- Monthly tracking table ----
    if (tableContainer && months.length) {
      const sorted = [...months].sort((a, b) => (b.month || '').localeCompare(a.month || ''));
      let rows = sorted.map(m => {
        const inv = m.totalInvoiced || 0;
        const paid = m.paidAmount || 0;
        const colRate = inv > 0 ? (paid / inv * 100) : 0;
        const clients = m.activeClients || 0;
        const revPct = goals.revenue ? ((inv / goals.revenue) * 100).toFixed(0) : '—';
        const cliPct = goals.clients ? ((clients / goals.clients) * 100).toFixed(0) : '—';
        const colPct = goals.collection ? ((colRate / goals.collection) * 100).toFixed(0) : '—';
        const revClass = goals.revenue ? (inv >= goals.revenue ? 'text-green-600 font-semibold' : 'text-red-600') : '';
        const cliClass = goals.clients ? (clients >= goals.clients ? 'text-green-600 font-semibold' : 'text-red-600') : '';
        const colClass = goals.collection ? (colRate >= goals.collection ? 'text-green-600 font-semibold' : 'text-red-600') : '';
        const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => '$' + Number(v).toLocaleString();
        return `<tr class="border-b border-gray-100 hover:bg-gray-50">
          <td class="px-4 py-2 text-sm font-medium text-gray-800">${m.month || '—'}</td>
          <td class="px-4 py-2 text-sm text-right ${revClass}">${fmt(inv)}</td>
          <td class="px-4 py-2 text-sm text-right text-gray-500">${goals.revenue ? revPct + '%' : '—'}</td>
          <td class="px-4 py-2 text-sm text-right ${cliClass}">${clients}</td>
          <td class="px-4 py-2 text-sm text-right text-gray-500">${goals.clients ? cliPct + '%' : '—'}</td>
          <td class="px-4 py-2 text-sm text-right ${colClass}">${colRate.toFixed(1)}%</td>
          <td class="px-4 py-2 text-sm text-right text-gray-500">${goals.collection ? colPct + '%' : '—'}</td>
        </tr>`;
      }).join('');

      tableContainer.innerHTML = `
        <table class="w-full text-left">
          <thead><tr class="bg-gray-50 text-xs uppercase text-gray-500">
            <th class="px-4 py-2">Month</th>
            <th class="px-4 py-2 text-right">Revenue</th>
            <th class="px-4 py-2 text-right">% of Goal</th>
            <th class="px-4 py-2 text-right">Clients</th>
            <th class="px-4 py-2 text-right">% of Goal</th>
            <th class="px-4 py-2 text-right">Collection</th>
            <th class="px-4 py-2 text-right">% of Goal</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    // ---- Projection chart ----
    __renderGoalsProjectionChart(months, goals);

  } catch (err) {
    console.error('Goals: failed to load actuals', err);
    container.innerHTML = '<p class="text-red-500 text-center py-8"><i class="fas fa-exclamation-triangle mr-2"></i>Failed to load data — make sure you are connected to Xero.</p>';
  }
}
window.loadGoalProgress = loadGoalProgress;

// ---- Projection chart ----
window.__goalsCharts = window.__goalsCharts || {};

function __renderGoalsProjectionChart(months, goals) {
  const canvasId = 'goalsProjectionChart';
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (window.__goalsCharts[canvasId]) { window.__goalsCharts[canvasId].destroy(); }

  // Sort ascending
  const sorted = [...months].sort((a, b) => (a.month || '').localeCompare(b.month || ''));
  const labels = sorted.map(m => {
    const d = m.month ? new Date(m.month + '-01') : null;
    return d ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : (m.month || '');
  });
  const revenues = sorted.map(m => m.totalInvoiced || 0);

  // Rolling 3-month avg for projection
  const last3 = revenues.slice(-3);
  const rolling = last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 0;

  // Add 3 projected months
  const now = new Date();
  const projLabels = [];
  const projValues = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    projLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    projValues.push(Math.round(rolling));
  }

  const allLabels = [...labels, ...projLabels];
  const actualData = [...revenues, ...Array(3).fill(null)];
  const projData = [...Array(revenues.length - 1).fill(null), revenues[revenues.length - 1], ...projValues];

  const datasets = [
    {
      label: 'Actual Revenue',
      data: actualData,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 3
    },
    {
      label: 'Projected (3-mo avg)',
      data: projData,
      borderColor: 'rgb(99, 102, 241)',
      borderDash: [6, 3],
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointStyle: 'triangle'
    }
  ];

  if (goals.revenue) {
    datasets.push({
      label: 'Revenue Target',
      data: Array(allLabels.length).fill(goals.revenue),
      borderColor: 'rgba(239, 68, 68, 0.6)',
      borderDash: [4, 4],
      borderWidth: 1.5,
      fill: false,
      pointRadius: 0
    });
  }

  window.__goalsCharts[canvasId] = new Chart(el, {
    type: 'line',
    data: { labels: allLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              if (v == null) return '';
              const fmt = typeof formatCurrency === 'function' ? formatCurrency : val => '$' + Number(val).toLocaleString();
              return ctx.dataset.label + ': ' + fmt(v);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => {
              const fmt = typeof formatCurrency === 'function' ? formatCurrency : val => '$' + Number(val).toLocaleString();
              return fmt(v);
            }
          }
        }
      }
    }
  });
}

// ---- AI Insights for Goals tab ----
function __insightsForGoals() {
  const data = window.__goalsData;
  if (!data || !data.months || !data.months.length) {
    return [{ heading: 'No goals data loaded', tone: 'neutral', bullets: ['Click "Refresh" on the Goals tab first, then try again.'] }];
  }
  const { goals, months } = data;
  const sections = [];
  const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => '$' + Number(v).toLocaleString();

  // Sort descending
  const sorted = [...months].sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const current = sorted[0] || {};
  const currRev = current.totalInvoiced || 0;
  const currClients = current.activeClients || 0;
  const currCol = current.totalInvoiced > 0 ? ((current.paidAmount || 0) / current.totalInvoiced) * 100 : 0;

  // Revenue insights
  if (goals.revenue) {
    const pct = ((currRev / goals.revenue) * 100).toFixed(0);
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const runRate = dayOfMonth > 0 ? (currRev / dayOfMonth) * daysInMonth : 0;
    const metMonths = sorted.filter(m => (m.totalInvoiced || 0) >= goals.revenue).length;
    const tone = parseInt(pct) >= 90 ? 'good' : parseInt(pct) >= 60 ? 'warn' : 'bad';

    sections.push({
      heading: `Revenue Goal: ${fmt(goals.revenue)}/mo`,
      tone,
      bullets: [
        `Current month: <strong>${fmt(currRev)}</strong> invoiced so far — <strong>${pct}%</strong> of your target.`,
        `At current pace, month-end run-rate projection: <strong>${fmt(Math.round(runRate))}</strong>.`,
        runRate >= goals.revenue
          ? `You're on track to <strong>meet or exceed</strong> your revenue target this month.`
          : `You need <strong>${fmt(Math.round(goals.revenue - currRev))}</strong> more in the remaining ${daysInMonth - dayOfMonth} days to hit target.`,
        `Over the last 12 months, you hit the revenue target in <strong>${metMonths}</strong> of ${sorted.length} months.`
      ]
    });
  }

  // Client count insights
  if (goals.clients) {
    const pct = ((currClients / goals.clients) * 100).toFixed(0);
    const tone = parseInt(pct) >= 90 ? 'good' : parseInt(pct) >= 60 ? 'warn' : 'bad';
    const avgClients = sorted.reduce((s, m) => s + (m.activeClients || 0), 0) / sorted.length;

    sections.push({
      heading: `Client Count Goal: ${goals.clients} active`,
      tone,
      bullets: [
        `Current month: <strong>${currClients}</strong> active clients — <strong>${pct}%</strong> of target.`,
        `12-month average: <strong>${avgClients.toFixed(1)}</strong> active clients per month.`,
        currClients >= goals.clients
          ? 'You\'ve already hit your client count target this month.'
          : `You need <strong>${goals.clients - currClients}</strong> more active client${goals.clients - currClients > 1 ? 's' : ''} to reach your goal.`
      ]
    });
  }

  // Collection rate insights
  if (goals.collection) {
    const pct = goals.collection > 0 ? ((currCol / goals.collection) * 100).toFixed(0) : 0;
    const tone = parseInt(pct) >= 90 ? 'good' : parseInt(pct) >= 60 ? 'warn' : 'bad';
    const avgCol = sorted.reduce((s, m) => {
      const inv = m.totalInvoiced || 0;
      return s + (inv > 0 ? ((m.paidAmount || 0) / inv) * 100 : 0);
    }, 0) / sorted.length;

    sections.push({
      heading: `Collection Rate Goal: ${goals.collection}%`,
      tone,
      bullets: [
        `Current month: <strong>${currCol.toFixed(1)}%</strong> collected — <strong>${pct}%</strong> of target.`,
        `12-month average collection rate: <strong>${avgCol.toFixed(1)}%</strong>.`,
        currCol >= goals.collection
          ? 'Collection rate is meeting or exceeding your target.'
          : `Gap to target: <strong>${(goals.collection - currCol).toFixed(1)} percentage points</strong>. Focus on outstanding invoices to close the gap.`
      ]
    });
  }

  if (!sections.length) {
    sections.push({ heading: 'No goals set', tone: 'neutral', bullets: ['Set at least one goal above, then analyze.'] });
  }
  return sections;
}

// ============================================================
// v2.13.0 ENHANCEMENTS
// ============================================================

// ---------- 1. Client Filters (status + date range) ----------
let allClientData = [];

async function applyClientFilters() {
  const statusFilter = document.getElementById('clientStatusFilter')?.value || 'all';
  const dateFilter = document.getElementById('clientDateFilter')?.value || 'all';

  const listEl = document.getElementById('clientsList');
  if (!listEl) return;
  listEl.innerHTML = '<p class="text-gray-400 text-center py-6"><i class="fas fa-spinner fa-spin mr-2"></i>Loading clients...</p>';

  try {
    // Decide which endpoint based on status filter
    let endpoint = '/api/clients/awaiting-payment';
    if (statusFilter === 'all' || statusFilter === 'paid') {
      // For 'all' and 'paid' we need the full invoices list
      endpoint = '/api/invoices';
    }

    let clients = [];
    
    if (statusFilter === 'all' || statusFilter === 'paid') {
      // Fetch all invoices and group by client
      const res = await axios.get(endpoint);
      const invoices = res.data.invoices || res.data || [];
      
      // Date filter
      const now = new Date();
      const cutoff = dateFilter !== 'all' ? new Date(now.getFullYear(), now.getMonth() - parseInt(dateFilter), 1) : null;
      
      // Status mapping
      const statusMap = {
        'overdue': inv => ['AUTHORISED', 'SUBMITTED'].includes(inv.Status) && new Date(inv.DueDateString || inv.DueDate) < now,
        'awaiting': inv => ['AUTHORISED', 'SUBMITTED'].includes(inv.Status),
        'paid': inv => inv.Status === 'PAID',
        'draft': inv => inv.Status === 'DRAFT',
        'all': () => true
      };
      const matchStatus = statusMap[statusFilter] || statusMap['all'];

      const filtered = invoices.filter(inv => {
        if (!matchStatus(inv)) return false;
        if (cutoff) {
          const d = inv.DueDateString ? new Date(inv.DueDateString) : (inv.DueDate ? new Date(inv.DueDate) : null);
          if (d && d < cutoff) return false;
        }
        return true;
      });

      // Group by contact
      const byClient = {};
      filtered.forEach(inv => {
        const name = inv.Contact?.Name || 'Unknown';
        if (!byClient[name]) byClient[name] = { contactName: name, invoiceCount: 0, totalOutstanding: 0, totalPaid: 0, averagePaymentDelay: 0, delays: [] };
        byClient[name].invoiceCount++;
        if (inv.Status === 'PAID') {
          byClient[name].totalPaid += inv.Total || 0;
        } else {
          byClient[name].totalOutstanding += inv.AmountDue || inv.Total || 0;
        }
      });
      clients = Object.values(byClient);
    } else {
      // Use the awaiting-payment endpoint for overdue/awaiting
      const res = await axios.get('/api/clients/awaiting-payment');
      clients = res.data || [];
      
      // Date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth() - parseInt(dateFilter), 1);
        // awaiting-payment clients don't have date fields to filter on, so we keep all
      }
      
      // If overdue only, filter out non-overdue
      if (statusFilter === 'overdue') {
        clients = clients.filter(c => (c.averagePaymentDelay || 0) > 0 || (c.totalOutstanding || 0) > 0);
      }
    }

    allClientData = clients;
    displayClientsAwaitingPayment(clients, false);
  } catch (err) {
    console.error('Client filter error:', err);
    // Fallback to awaiting-payment
    try {
      const res = await axios.get('/api/clients/awaiting-payment');
      displayClientsAwaitingPayment(res.data || [], false);
    } catch (e2) {
      listEl.innerHTML = '<p class="text-red-500 text-center py-6">Failed to load clients</p>';
    }
  }
}
window.applyClientFilters = applyClientFilters;

// ---------- 2. Monthly Breakdown chart (multi-line) ----------
function renderMonthlyBreakdownChart(months) {
  const el = document.getElementById('monthlyBreakdownChart');
  if (!el || !months || !months.length) return;

  // Sort ascending by date
  const sorted = [...months].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNum - b.monthNum;
  });

  const labels = sorted.map(m => m.month);
  const revenue = sorted.map(m => m.totalInvoiced || 0);
  const clients = sorted.map(m => m.activeClients || 0);
  const collRate = sorted.map(m => m.collectionRate || 0);

  if (window.__analyticsCharts && window.__analyticsCharts['monthlyBreakdownChart']) {
    try { window.__analyticsCharts['monthlyBreakdownChart'].destroy(); } catch (e) {}
  }

  const chart = new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue ($)',
          data: revenue,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'yRevenue',
          borderWidth: 2
        },
        {
          label: 'Active Clients',
          data: clients,
          borderColor: '#8b5cf6',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          yAxisID: 'yClients',
          borderWidth: 2,
          borderDash: [5, 3]
        },
        {
          label: 'Collection Rate (%)',
          data: collRate,
          borderColor: '#16a34a',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          yAxisID: 'yRate',
          borderWidth: 2,
          borderDash: [2, 2]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        yRevenue: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          ticks: { callback: v => '$' + v.toLocaleString() },
          title: { display: true, text: 'Revenue', color: '#3b82f6' }
        },
        yClients: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Clients', color: '#8b5cf6' }
        },
        yRate: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          max: 110,
          ticks: { callback: v => v + '%' },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Collection %', color: '#16a34a' }
        }
      }
    }
  });

  window.__analyticsCharts = window.__analyticsCharts || {};
  window.__analyticsCharts['monthlyBreakdownChart'] = chart;
}

// Patch loadMonthlyTrends to also render the chart and reverse sort
(function patchMonthlyTrends() {
  const origRender = window.renderMonthlyTrendsTable || renderMonthlyTrendsTable;
  if (typeof origRender !== 'function') return;

  window.renderMonthlyTrendsTable = function(months) {
    // Reverse so most recent month is first (for table)
    const reversed = [...months].reverse();
    origRender(reversed);
    // Render chart (ascending order handled inside)
    renderMonthlyBreakdownChart(months);
  };
})();

// ---- Valuation ----
async function loadValuation() {
  const loading = document.getElementById('valuationLoading');
  if (loading) loading.classList.remove('hidden');

  let data;
  try {
    const res = await axios.get('/api/valuation');
    data = res.data;
  } catch (e) {
    try {
      const res = await axios.get('/api/demo/valuation');
      data = res.data;
    } catch (e2) {
      if (loading) loading.classList.add('hidden');
      return;
    }
  }
  if (loading) loading.classList.add('hidden');

  const fmt = v => '$' + Math.round(v).toLocaleString();
  const fmtM = v => {
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K';
    return '$' + Math.round(v).toLocaleString();
  };

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('valARR', fmtM(data.arr));
  set('valLow', fmtM(data.valuationLow));
  set('valMid', fmtM(data.valuationMid));
  set('valHigh', fmtM(data.valuationHigh));
  set('valLowMultiple', (data.multiple - 1).toFixed(1) + '× ARR');
  set('valMidMultiple', data.multiple.toFixed(1) + '× ARR');
  set('valHighMultiple', (data.multiple + 2).toFixed(1) + '× ARR');

  const growthEl = document.getElementById('valGrowth');
  if (growthEl) {
    growthEl.textContent = (data.momGrowth >= 0 ? '+' : '') + data.momGrowth.toFixed(1) + '%';
    growthEl.className = 'text-xl font-bold ' + (data.momGrowth >= 0 ? 'text-green-600' : 'text-red-500');
  }

  set('valChurn', data.monthlyChurnRate.toFixed(1) + '%');
  const churnEl = document.getElementById('valChurn');
  if (churnEl) churnEl.className = 'text-xl font-bold ' + (data.monthlyChurnRate < 3 ? 'text-green-600' : data.monthlyChurnRate < 7 ? 'text-yellow-600' : 'text-red-600');

  const nrrEl = document.getElementById('valNRR');
  if (nrrEl) {
    nrrEl.textContent = data.nrr.toFixed(1) + '%';
    nrrEl.className = 'text-xl font-bold ' + (data.nrr >= 100 ? 'text-purple-700' : 'text-red-500');
  }

  set('valLTV', fmtM(data.ltv));
  set('valMultiple', data.multiple.toFixed(1) + '×');

  const r40El = document.getElementById('valRule40');
  if (r40El) {
    r40El.textContent = data.rule40;
    r40El.className = 'text-2xl font-bold ' + (data.rule40 >= 40 ? 'text-green-600' : 'text-yellow-600');
  }
  const r40Label = document.getElementById('valRule40Label');
  if (r40Label) r40Label.textContent = data.rule40 >= 40 ? '✓ Healthy (≥40)' : 'Below 40 threshold';
}
window.loadValuation = loadValuation;

// =============================================================
// Bank / Line of Credit section (v2.16.0)
// =============================================================

const __bankState = {
  ttmRev: 0,
  ytdRev: 0,
  priorYtdRev: 0,
  arBuckets: { lt30: 0, b30_60: 0, b60_90: 0, gt90: 0 },
  arTotal: 0,
  topCustPct: 0,
  inputs: { opex: null, existingDebt: null, yearsInBusiness: null },
};

function __bankFmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return '$' + Math.round(n / 1000).toLocaleString() + 'k';
  return '$' + Math.round(n).toLocaleString();
}
function __bankFmtMoneyExact(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString();
}
function __bankPmt(P, ratePct, n) {
  const i = ratePct / 12 / 100;
  if (i === 0) return P / n;
  return P * i / (1 - Math.pow(1 + i, -n));
}

async function loadBankSection() {
  document.getElementById('bankLoading')?.classList.remove('hidden');
  try {
    await Promise.all([__bankLoadInputs(), __bankLoadXeroData()]);
    updateBankSim();
  } catch (e) {
    console.error('loadBankSection error:', e);
  } finally {
    document.getElementById('bankLoading')?.classList.add('hidden');
  }
}

async function __bankLoadInputs() {
  try {
    const r = await axios.get('/api/bank-inputs');
    const d = r.data || {};
    __bankState.inputs = {
      opex: d.opex,
      existingDebt: d.existingDebt,
      yearsInBusiness: d.yearsInBusiness,
    };
    if (d.opex != null) document.getElementById('bankOpex').value = d.opex;
    if (d.existingDebt != null) document.getElementById('bankDebt').value = d.existingDebt;
    if (d.yearsInBusiness != null) document.getElementById('bankYears').value = d.yearsInBusiness;
  } catch {}
}

async function __bankLoadXeroData() {
  try {
    const trendsRes = await axios.get('/api/monthly/trends');
    const trends = Array.isArray(trendsRes.data) ? trendsRes.data : (trendsRes.data?.months || trendsRes.data?.data || []);
    const recent = trends.slice(-12);
    __bankState.ttmRev = recent.reduce((s, m) => s + (Number(m.revenue) || Number(m.invoiced) || 0), 0);
    const now = new Date();
    const ytdMonths = trends.filter(m => {
      const dt = new Date(m.month || m.period || m.date || '');
      return dt.getFullYear() === now.getFullYear();
    });
    const priorYtdMonths = trends.filter(m => {
      const dt = new Date(m.month || m.period || m.date || '');
      return dt.getFullYear() === now.getFullYear() - 1 && dt.getMonth() <= now.getMonth();
    });
    __bankState.ytdRev = ytdMonths.reduce((s, m) => s + (Number(m.revenue) || Number(m.invoiced) || 0), 0);
    __bankState.priorYtdRev = priorYtdMonths.reduce((s, m) => s + (Number(m.revenue) || Number(m.invoiced) || 0), 0);
  } catch (e) { console.error('bank trends:', e); }

  try {
    const agingRes = await axios.get('/api/invoices/by-aging');
    const a = agingRes.data || {};
    const buckets = a.buckets || a.aging || a;
    __bankState.arBuckets.lt30 = Number(buckets.current ?? buckets['0-30'] ?? buckets.lt30 ?? 0);
    __bankState.arBuckets.b30_60 = Number(buckets['30-60'] ?? buckets.b30_60 ?? buckets.thirty ?? 0);
    __bankState.arBuckets.b60_90 = Number(buckets['60-90'] ?? buckets.b60_90 ?? buckets.sixty ?? 0);
    __bankState.arBuckets.gt90 = Number(buckets['90+'] ?? buckets.over90 ?? buckets.gt90 ?? buckets.ninety ?? 0);
    __bankState.arTotal = __bankState.arBuckets.lt30 + __bankState.arBuckets.b30_60 + __bankState.arBuckets.b60_90 + __bankState.arBuckets.gt90;
  } catch (e) { console.error('bank aging:', e); }

  try {
    const ltRes = await axios.get('/api/clients/lifetime');
    const clients = Array.isArray(ltRes.data) ? ltRes.data : (ltRes.data?.clients || []);
    if (clients.length && __bankState.ttmRev > 0) {
      const sorted = [...clients].sort((a, b) => (Number(b.totalRevenue || b.lifetime || 0)) - (Number(a.totalRevenue || a.lifetime || 0)));
      const top = Number(sorted[0]?.totalRevenue || sorted[0]?.lifetime || 0);
      __bankState.topCustPct = __bankState.ttmRev > 0 ? Math.round((top / __bankState.ttmRev) * 100) : 0;
    }
  } catch (e) { console.error('bank clients:', e); }
}

function updateBankSim() {
  const amt = +document.getElementById('bankAmount').value;
  const rate = +document.getElementById('bankRate').value;
  const term = +document.getElementById('bankTerm').value;
  const opex = parseFloat(document.getElementById('bankOpex').value) || 0;
  const existingDebtMonthly = parseFloat(document.getElementById('bankDebt').value) || 0;
  const years = parseInt(document.getElementById('bankYears').value, 10) || 0;

  document.getElementById('bankAmtOut').textContent = __bankFmtMoneyExact(amt);
  document.getElementById('bankRateOut').textContent = rate.toFixed(2) + '%';
  document.getElementById('bankTermOut').textContent = term + ' mo';

  document.getElementById('bankTtmRev').textContent = __bankFmtMoney(__bankState.ttmRev);
  const yoy = __bankState.priorYtdRev > 0 ? Math.round(((__bankState.ytdRev - __bankState.priorYtdRev) / __bankState.priorYtdRev) * 1000) / 10 : null;
  document.getElementById('bankYoy').textContent = yoy != null ? (yoy >= 0 ? '+' : '') + yoy + '%' : '—';
  document.getElementById('bankArTotal').textContent = __bankFmtMoney(__bankState.arTotal);
  document.getElementById('bankTopCust').textContent = (__bankState.topCustPct || 0) + '%';

  const eligibleAR = __bankState.arBuckets.lt30 + __bankState.arBuckets.b30_60 + __bankState.arBuckets.b60_90;
  const concentrationExcess = Math.max(0, ((__bankState.topCustPct || 0) - 25) / 100 * __bankState.ttmRev);
  const adjustedAR = Math.max(0, eligibleAR - concentrationExcess);
  const borrowingBase = adjustedAR * 0.80;

  const monthlyPmt = __bankPmt(amt, rate, term);
  const annualDebtSvc = (monthlyPmt + existingDebtMonthly) * 12;
  const cashFlow = __bankState.ttmRev - opex;
  const dscr = annualDebtSvc > 0 ? cashFlow / annualDebtSvc : Infinity;

  const arQualityPct = __bankState.arTotal > 0 ? Math.round((__bankState.arBuckets.lt30 / __bankState.arTotal) * 100) : 0;

  document.getElementById('bankBorrow').textContent = __bankFmtMoney(borrowingBase);
  document.getElementById('bankDscr').textContent = (dscr === Infinity ? '∞' : dscr.toFixed(1) + 'x');
  document.getElementById('bankPayment').textContent = __bankFmtMoneyExact(monthlyPmt);
  document.getElementById('bankArQuality').textContent = arQualityPct + '%';

  const ctx = { amt, dscr, borrowingBase, topCustPct: __bankState.topCustPct, years, ttmRev: __bankState.ttmRev, opex, yoy };
  __bankRenderCard('Cb', __bankScoreCommunityBank(ctx));
  __bankRenderCard('Sba', __bankScoreSBA(ctx));
  __bankRenderCard('Ft', __bankScoreFintech(ctx));
}

function __bankRenderCard(suffix, result) {
  const dot = document.getElementById('bankDot' + suffix);
  const score = document.getElementById('bankScore' + suffix);
  const reasons = document.getElementById('bankReasons' + suffix);
  const colors = { green: '#16a34a', amber: '#d97706', red: '#dc2626' };
  const labels = { green: 'Strong', amber: 'Mixed', red: 'Weak' };
  if (dot) dot.style.background = colors[result.level] || '#9ca3af';
  if (score) { score.textContent = labels[result.level] || '—'; score.style.color = colors[result.level] || '#374151'; }
  if (reasons) reasons.innerHTML = result.reasons.map(r => '<li>' + r + '</li>').join('');
}

function __bankScoreCommunityBank(c) {
  const reasons = []; let flags = 0;
  if (c.dscr >= 1.5) reasons.push('DSCR ' + c.dscr.toFixed(1) + 'x — very strong');
  else if (c.dscr >= 1.25) { reasons.push('DSCR ' + c.dscr.toFixed(1) + 'x — meets minimum'); flags++; }
  else { reasons.push('DSCR ' + c.dscr.toFixed(1) + 'x — below 1.25x threshold'); flags += 2; }
  if (c.amt <= c.borrowingBase) reasons.push('Amount within borrowing base (' + __bankFmtMoney(c.borrowingBase) + ')');
  else { reasons.push('Amount exceeds borrowing base by ' + __bankFmtMoney(c.amt - c.borrowingBase)); flags += 2; }
  if (c.topCustPct > 25) { reasons.push('Top customer ' + c.topCustPct + '% — concentration flag'); flags++; }
  else reasons.push('Concentration within limits');
  if (c.years >= 2) reasons.push(c.years + ' years operating — qualifies');
  else if (c.years > 0) { reasons.push('Less than 2 years — bank may decline'); flags++; }
  return { level: flags === 0 ? 'green' : flags <= 1 ? 'amber' : 'red', reasons };
}
function __bankScoreSBA(c) {
  const reasons = []; let flags = 0;
  if (c.dscr >= 1.15) reasons.push('DSCR ' + c.dscr.toFixed(1) + 'x — passes SBA threshold');
  else { reasons.push('DSCR ' + c.dscr.toFixed(1) + 'x — below 1.15x'); flags += 2; }
  if (c.years >= 2) reasons.push(c.years + ' years operating — eligible');
  else if (c.years > 0) { reasons.push('Less than 2 years — SBA harder'); flags++; }
  reasons.push('Personal guarantee will be required');
  reasons.push('60–90 day timeline; lowest rates');
  if (c.amt > 350000) { reasons.push('Above SBA Express $350k cap'); flags++; }
  return { level: flags === 0 ? 'green' : flags <= 1 ? 'amber' : 'red', reasons };
}
function __bankScoreFintech(c) {
  const reasons = []; let flags = 0;
  if (c.dscr >= 1.0) reasons.push('Cash flow positive — qualifies');
  else { reasons.push('Cash flow tight — DSCR ' + c.dscr.toFixed(1) + 'x'); flags += 2; }
  reasons.push('Approval typically 24–72 hours');
  reasons.push('Expect rate 12–22% APR');
  if (c.yoy != null && c.yoy > 0) reasons.push('Revenue growth +' + c.yoy + '% — favorable');
  else if (c.yoy != null && c.yoy <= 0) { reasons.push('Flat/declining revenue — may price up'); flags++; }
  return { level: flags === 0 ? 'green' : flags <= 1 ? 'amber' : 'red', reasons };
}

async function saveBankInputs() {
  const opex = parseFloat(document.getElementById('bankOpex').value);
  const existingDebt = parseFloat(document.getElementById('bankDebt').value);
  const yearsInBusiness = parseInt(document.getElementById('bankYears').value, 10);
  const btn = event?.target?.closest('button');
  const orig = btn?.innerHTML;
  try {
    const res = await axios.post('/api/bank-inputs', {
      opex: isNaN(opex) ? null : opex,
      existingDebt: isNaN(existingDebt) ? null : existingDebt,
      yearsInBusiness: isNaN(yearsInBusiness) ? null : yearsInBusiness,
    });
    if (!res?.data?.ok) throw new Error(res?.data?.error || 'Save failed');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check mr-1"></i>Saved';
      btn.classList.replace('bg-blue-600', 'bg-green-600');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.replace('bg-green-600', 'bg-blue-600'); }, 1500);
    }
    updateBankSim();
  } catch (e) {
    console.error('saveBankInputs:', e);
    if (btn) {
      btn.innerHTML = '<i class="fas fa-times mr-1"></i>Failed';
      btn.classList.replace('bg-blue-600', 'bg-red-600');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.replace('bg-red-600', 'bg-blue-600'); }, 2500);
    }
  }
}

window.loadBankSection = loadBankSection;
window.saveBankInputs = saveBankInputs;
window.updateBankSim = updateBankSim;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-button[data-tab="bank"]').forEach(btn => {
    btn.addEventListener('click', () => loadBankSection());
  });
});

/* ===========================================================================
 * v2.17.0 — MoM, SWOT, Reports modules.
 * Self-contained. Activated on tab click via DOMContentLoaded handlers below.
 * ===========================================================================
 */

(function () {
  function authHeaders() {
    const t = localStorage.getItem('xero_session') || '';
    return t ? { 'X-Session-Token': t } : {};
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
  function fmt(v, metric) {
    if (v == null || isNaN(v)) return '—';
    return /pct|_pct|days/.test(metric) ? Number(v).toFixed(1) : fmtCurrencyV17(v);
  }
  function fmtCurrencyV17(v) {
    if (v == null || isNaN(v)) return '—';
    return '$' + Math.round(Number(v)).toLocaleString('en-US');
  }
  function pctV17(v) {
    if (v == null || isNaN(v)) return '—';
    return (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%';
  }
  function trendClass(v) { return v == null ? '' : v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-500'; }
  function currentQuarter() { const d = new Date(); return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1); }

  // ---- MoM ----------------------------------------------------------------
  let momChart = null;
  async function initMomTab() {
    const root = document.getElementById('tab-mom');
    if (!root || root.dataset.wired) { renderMom(); return; }
    root.dataset.wired = '1';
    document.getElementById('mom-metric').addEventListener('change', renderMom);
    document.getElementById('mom-months').addEventListener('change', renderMom);
    document.getElementById('mom-snapshot-now').addEventListener('click', captureNow);
    await renderMom();
  }

  async function renderMom() {
    const metric = document.getElementById('mom-metric').value;
    const months = document.getElementById('mom-months').value;
    let data;
    try {
      const r = await fetch(`/api/mom?metric=${encodeURIComponent(metric)}&months=${encodeURIComponent(months)}`,
        { headers: authHeaders() });
      data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    } catch (e) {
      document.getElementById('mom-summary').innerHTML =
        `<div class="col-span-full text-red-600 text-sm">Could not load MoM data: ${escapeHtml(e.message || e)}</div>`;
      return;
    }
    const cur = data.series.length ? data.series[data.series.length - 1].value : null;
    const d = data.delta || {};
    document.getElementById('mom-summary').innerHTML = `
      <div class="bg-gray-50 rounded p-3"><div class="text-xs uppercase text-gray-500">Latest</div><div class="text-2xl font-bold">${fmt(cur, metric)}</div></div>
      <div class="bg-gray-50 rounded p-3"><div class="text-xs uppercase text-gray-500">MoM Δ</div><div class="text-2xl font-bold ${trendClass(d.mom_pct)}">${pctV17(d.mom_pct)}</div></div>
      <div class="bg-gray-50 rounded p-3"><div class="text-xs uppercase text-gray-500">YoY Δ</div><div class="text-2xl font-bold ${trendClass(d.yoy_pct)}">${pctV17(d.yoy_pct)}</div></div>
    `;

    const ctx = document.getElementById('mom-chart').getContext('2d');
    if (momChart) momChart.destroy();
    momChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.series.map(s => s.period),
        datasets: [{ label: metric, data: data.series.map(s => Number(s.value || 0)),
                     backgroundColor: 'rgba(59, 130, 246, 0.6)' }],
      },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } },
    });

    const t = document.getElementById('mom-table');
    t.innerHTML =
      '<thead class="bg-gray-100"><tr><th class="px-3 py-2 text-left">Period</th><th class="px-3 py-2 text-right">Value</th><th class="px-3 py-2 text-right">MoM Δ</th></tr></thead><tbody>'
      + data.series.map((s, i) => {
          const prev = data.series[i - 1] && data.series[i - 1].value;
          const delta = (prev != null && prev !== 0) ? ((s.value - prev) / prev * 100).toFixed(1) + '%' : '—';
          return `<tr class="border-b"><td class="px-3 py-1">${s.period}</td><td class="px-3 py-1 text-right">${fmt(s.value, metric)}</td><td class="px-3 py-1 text-right">${delta}</td></tr>`;
        }).join('')
      + '</tbody>';
  }

  async function captureNow() {
    const period = prompt('Period to snapshot (YYYY-MM):', new Date().toISOString().slice(0, 7));
    if (!period) return;
    try {
      const cap = await fetch(`/api/snapshot/capture?period=${period}`, { headers: authHeaders() });
      if (!cap.ok) throw new Error('capture HTTP ' + cap.status);
      const bundle = await cap.json();
      bundle.source = 'manual';
      const save = await fetch('/api/snapshots', {
        method: 'POST',
        headers: Object.assign({}, authHeaders(), { 'Content-Type': 'application/json' }),
        body: JSON.stringify(bundle),
      });
      if (!save.ok) throw new Error('save HTTP ' + save.status);
      await renderMom();
      alert('Snapshot saved for ' + period);
    } catch (e) {
      alert('Snapshot failed: ' + e.message);
    }
  }

  // ---- SWOT ---------------------------------------------------------------
  async function initSwotTab() {
    const root = document.getElementById('tab-swot');
    if (!root) return;
    if (!root.dataset.wired) {
      root.dataset.wired = '1';
      const periodSel = document.getElementById('swot-period');
      const periods = ['ongoing'];
      const now = new Date();
      for (let i = 0; i < 4; i++) {
        const q = Math.floor(now.getMonth() / 3) + 1 - i;
        const y = now.getFullYear() + (q < 1 ? -1 : 0);
        const qq = ((q - 1 + 4) % 4) + 1;
        periods.push(`${y}-Q${qq}`);
      }
      periodSel.innerHTML = periods.map(p =>
        `<option ${p === currentQuarter() ? 'selected' : ''}>${p}</option>`).join('');
      periodSel.addEventListener('change', renderSwot);
      document.getElementById('swot-tag').addEventListener('change', renderSwot);
      document.getElementById('swot-add').addEventListener('click', addSwot);
    }
    await renderSwot();
  }

  async function renderSwot() {
    const period = document.getElementById('swot-period').value;
    const tag    = document.getElementById('swot-tag').value;
    const qs = new URLSearchParams({ period, ...(tag ? { tag } : {}) });
    let data;
    try {
      const r = await fetch(`/api/swot?${qs}`, { headers: authHeaders() });
      data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    } catch (e) {
      document.querySelectorAll('.swot-cell ul').forEach(ul => {
        ul.innerHTML = `<li class="text-red-600 text-sm">Could not load: ${escapeHtml(e.message || e)}</li>`;
      });
      return;
    }
    document.querySelectorAll('.swot-cell').forEach(cell => {
      const cat = cell.dataset.cat;
      const items = (data.entries || []).filter(e => e.category === cat);
      cell.querySelector('ul').innerHTML = items.length ? items.map(e => `
        <li class="py-2 border-b border-white last:border-0">
          <p class="text-sm">${escapeHtml(e.body)}</p>
          <small class="text-xs text-gray-600">${escapeHtml(e.tag)} · ${escapeHtml(e.author)} · ${(e.created_at || '').slice(0, 10)}</small>
          <button data-id="${e.id}" class="swot-archive float-right text-xs text-red-600 hover:underline">Archive</button>
        </li>
      `).join('') : '<li class="text-sm text-gray-500 italic">No entries.</li>';
    });
    document.querySelectorAll('.swot-archive').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Archive this entry?')) return;
        await fetch(`/api/swot/${b.dataset.id}`, { method: 'DELETE', headers: authHeaders() });
        await renderSwot();
      });
    });
  }

  async function addSwot() {
    const cat = (prompt('Category — S, W, O, or T:') || '').trim().toUpperCase();
    if (!['S','W','O','T'].includes(cat)) return alert('Bad category');
    const tag = prompt('Tag (Strategic / Sales / Finance):', 'Strategic') || 'Strategic';
    const body = prompt('Body (one line):');
    if (!body) return;
    const period = document.getElementById('swot-period').value;
    const author = prompt('Author:', 'Olivier') || 'system';
    try {
      const r = await fetch('/api/swot', {
        method: 'POST',
        headers: Object.assign({}, authHeaders(), { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ period, category: cat, tag, body, author }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      await renderSwot();
    } catch (e) { alert('Could not add: ' + e.message); }
  }

  // ---- Reports ------------------------------------------------------------
  async function initReportsTab() {
    const root = document.getElementById('tab-reports');
    if (!root) return;
    if (!root.dataset.wired) {
      root.dataset.wired = '1';
      document.getElementById('reports-role').addEventListener('change', renderReport);
    }
    await renderReport();
  }

  async function renderReport() {
    const role = document.getElementById('reports-role').value;
    const host = document.getElementById('reports-widgets');
    document.getElementById('reports-narrative').textContent = '';
    host.innerHTML = '<div class="text-gray-500">Loading…</div>';
    let bundle;
    try {
      const r = await fetch(`/api/reports/role/${role}`, { headers: authHeaders() });
      bundle = await r.json();
      if (!r.ok) throw new Error(bundle.error || `HTTP ${r.status}`);
    } catch (e) {
      host.innerHTML = `<div class="text-red-600 col-span-full">Could not load report: ${escapeHtml(e.message || e)}</div>`;
      return;
    }
    document.getElementById('reports-narrative').textContent = bundle.narrative || '';
    host.innerHTML = '';
    for (const w of (bundle.config?.widgets || [])) host.appendChild(renderWidget(w, bundle));
    if (!bundle.history?.length) {
      const note = document.createElement('div');
      note.className = 'col-span-full text-amber-700 bg-amber-50 border border-amber-200 rounded p-4';
      note.innerHTML = '<b>No snapshots yet.</b> Go to the MoM tab and click "Save snapshot now" for at least one period to populate this report.';
      host.appendChild(note);
    }
  }

  function widgetBox(title, inner) {
    const box = document.createElement('section');
    box.className = 'bg-white border border-gray-200 rounded p-4';
    box.innerHTML = `<h3 class="font-semibold text-gray-800 mb-2">${escapeHtml(title)}</h3>`;
    box.appendChild(inner);
    return box;
  }

  function renderWidget(w, b) {
    const wrap = document.createElement('div');
    wrap.className = 'bg-white border border-gray-200 rounded p-4';
    wrap.innerHTML = `<h3 class="font-semibold text-gray-800 mb-2">${escapeHtml(w.title)}</h3>`;
    const inner = document.createElement('div');
    switch (w.id) {
      case 'headline_kpis': renderHeadlineKpis(inner, b); break;
      case 'goals_progress': renderGoalsProgress(inner, b); break;
      case 'cash_position_today': renderCashPosition(inner, b); break;
      case 'dso_trend_12m': renderSeriesChart(inner, b, 'dso_days'); break;
      case 'gross_margin_mom_yoy': renderSeriesChart(inner, b, 'gross_margin_pct'); break;
      case 'ar_aging_buckets': renderArAging(inner, b); break;
      case 'overdue_concentration':
      case 'top10_active_revenue':
      case 'renewals_60d':
      case 'client_type_mix':
      case 'avg_deal_size':
      case 'new_business_mom':
        inner.className = 'text-sm text-gray-500 italic';
        inner.textContent = 'Pulls from existing /api/clients endpoints — wiring follows in v2.17.1.';
        break;
      case 'bank_tab_full': renderBankSnapshot(inner, b); break;
      case 'bank_approval_signal': renderBankApprovalSignal(inner, b); break;
      case 'swot_panel':
      case 'swot_strategic': renderSwotPanel(inner, b); break;
      case 'what_changed': inner.textContent = b.narrative || 'Not enough history yet.'; break;
      default:
        inner.className = 'text-sm text-gray-500 italic';
        inner.textContent = 'Widget renderer not implemented yet.';
    }
    wrap.appendChild(inner);
    return wrap;
  }

  function renderHeadlineKpis(host, b) {
    host.className = 'grid grid-cols-2 sm:grid-cols-4 gap-3';
    const items = [
      ['Revenue (paid)', b.deltas.revenue_paid],
      ['Active clients', b.deltas.active_clients],
      ['Cash position', b.deltas.cash_position],
      ['Gross margin %', b.deltas.gross_margin_pct],
    ];
    host.innerHTML = items.map(([label, x]) => `
      <div class="bg-gray-50 rounded p-2">
        <div class="text-xs uppercase text-gray-500">${label}</div>
        <div class="text-lg font-bold">${x?.cur != null ? (Math.abs(x.cur) > 1000 ? fmtCurrencyV17(x.cur) : Number(x.cur).toFixed(1)) : '—'}</div>
        <div class="text-xs ${trendClass(x?.mom_pct)}">${pctV17(x?.mom_pct)} MoM</div>
      </div>
    `).join('');
  }
  function renderGoalsProgress(host, b) {
    const cur = b.current || {};
    const target = Number(cur.goal_revenue_target) || 0;
    const pct = target ? Math.min(100, (cur.revenue_paid / target) * 100) : 0;
    host.innerHTML = `
      <p class="text-sm">Revenue: <b>${fmtCurrencyV17(cur.revenue_paid)}</b> of <b>${fmtCurrencyV17(target)}</b> target</p>
      <div class="bg-gray-200 rounded h-2 mt-2 overflow-hidden"><div class="bg-blue-600 h-full" style="width:${pct.toFixed(1)}%"></div></div>`;
  }
  function renderCashPosition(host, b) {
    const cur = b.current || {};
    host.innerHTML = `<p class="text-lg">Today: <b>${fmtCurrencyV17(cur.cash_position)}</b></p>
      <p class="text-xs text-gray-500 mt-1">7-day & 13-week forecast: existing /api/cashflow/forecast endpoint.</p>`;
  }
  function renderSeriesChart(host, b, metric) {
    const c = document.createElement('canvas');
    c.height = 100;
    host.appendChild(c);
    setTimeout(() => {
      new Chart(c.getContext('2d'), {
        type: 'line',
        data: {
          labels: b.history.map(s => s.period),
          datasets: [{ data: b.history.map(s => Number(s[metric] || 0)), borderColor: '#2563eb', tension: 0.25 }],
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } },
      });
    }, 0);
  }
  function renderArAging(host, b) {
    const c = b.current || {};
    host.innerHTML = `
      <table class="w-full text-sm">
        <tr><td class="py-1">Current</td><td class="text-right">${fmtCurrencyV17(c.ar_aging_current)}</td></tr>
        <tr><td class="py-1">30-60 days</td><td class="text-right">${fmtCurrencyV17(c.ar_aging_30_60)}</td></tr>
        <tr><td class="py-1">60-90 days</td><td class="text-right">${fmtCurrencyV17(c.ar_aging_60_90)}</td></tr>
        <tr><td class="py-1">90+ days</td><td class="text-right">${fmtCurrencyV17(c.ar_aging_90plus)}</td></tr>
      </table>`;
  }
  function renderBankSnapshot(host, b) {
    const c = b.current || {};
    host.innerHTML = `<ul class="text-sm space-y-1">
      <li>Recommended LoC: <b>${fmtCurrencyV17(c.loc_recommended)}</b></li>
      <li>DSCR: <b>${c.loc_dscr ?? '—'}</b></li>
      <li>Borrowing base: <b>${fmtCurrencyV17(c.borrowing_base)}</b></li>
      <li>Bank approval (community / SBA / fintech): <b>${c.bank_score_community ?? '—'} / ${c.bank_score_sba ?? '—'} / ${c.bank_score_fintech ?? '—'}</b></li>
    </ul>`;
  }
  function renderBankApprovalSignal(host, b) {
    const c = b.current || {};
    const max = Math.max(c.bank_score_community || 0, c.bank_score_sba || 0, c.bank_score_fintech || 0);
    const cls = max >= 70 ? 'text-green-600' : max >= 40 ? 'text-amber-600' : 'text-red-600';
    host.innerHTML = `<p class="text-lg">Best approval score: <b class="${cls}">${max}</b> / 100</p>`;
  }
  function renderSwotPanel(host, b) {
    host.innerHTML = '<ul class="text-sm space-y-1">' +
      ((b.swot || []).map(e =>
        `<li><span class="inline-block w-5 h-5 mr-2 text-xs font-bold rounded bg-blue-100 text-blue-800 text-center">${e.category}</span>${escapeHtml(e.body)} <small class="text-gray-500">${escapeHtml(e.tag)}</small></li>`
      ).join('') || '<li class="italic text-gray-500">No SWOT entries.</li>') +
      '</ul>';
  }

  // ---- wire to tab clicks -------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-button[data-tab="mom"]').forEach(btn =>
      btn.addEventListener('click', () => initMomTab()));
    document.querySelectorAll('.tab-button[data-tab="swot"]').forEach(btn =>
      btn.addEventListener('click', () => initSwotTab()));
    document.querySelectorAll('.tab-button[data-tab="reports"]').forEach(btn =>
      btn.addEventListener('click', () => initReportsTab()));
  });

  window.initMomTab = initMomTab;
  window.initSwotTab = initSwotTab;
  window.initReportsTab = initReportsTab;
})();

/* v2.17.0 — sidebar layout: keep topbar h1 in sync with active tab. */
(function () {
  const titles = {
    dashboard: 'Dashboard', invoices: 'Invoices', clients: 'Clients', trends: 'Trends',
    analytics: 'Analytics', goals: 'Goals', valuation: 'Valuation', bank: 'Bank',
    mom: 'MoM Evolution', swot: 'SWOT', reports: 'Executive Reports', 'sheets-links': 'Google Sheets',
  };
  function setTitle(tab) {
    const h1 = document.getElementById('pageTitle');
    if (h1 && titles[tab]) h1.textContent = titles[tab];
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      setTitle(t.getAttribute('data-tab'));
      // Close sidebar drawer on mobile after click
      document.querySelector('.sidebar')?.classList.remove('open');
    }
  });
  // Initialize from active item on load
  const init = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
  if (init) setTitle(init);
})();

/* =============================================================================
 * v2.17.0+ — Auto-generated reports (CFO/CEO/VP Sales) and SWOT.
 *
 * Replaces the empty-shell SWOT and Reports tabs with substantive analysis
 * drawn from the live data already on /api/* endpoints. No user data entry
 * required; the page renders the moment it's opened (provided the Xero
 * session is fresh).
 *
 * Also: globally redirect to login on any 401 from /api/* so the user never
 * gets stuck staring at a "dashboard renders but everything is zero" state.
 * =============================================================================
 */
(function () {
  // ---------- 401 -> logout auto-redirect ------------------------------------
  if (window.axios) {
    window.axios.interceptors.response.use(
      r => r,
      err => {
        const status = err?.response?.status;
        if (status === 401 && location.pathname === '/' && !sessionStorage.getItem('_did_redirect_login')) {
          sessionStorage.setItem('_did_redirect_login', '1');
          console.warn('[v17] 401 detected — Xero session expired. Logging out.');
          localStorage.removeItem('xero_session');
          location.reload();
        }
        return Promise.reject(err);
      }
    );
  }
  // Also intercept raw fetch() for endpoints we call directly.
  const __origFetch = window.fetch.bind(window);
  window.fetch = async function (...a) {
    const res = await __origFetch(...a);
    if (res.status === 401 && (a[0] + '').includes('/api/') && !sessionStorage.getItem('_did_redirect_login')) {
      sessionStorage.setItem('_did_redirect_login', '1');
      localStorage.removeItem('xero_session');
      setTimeout(() => location.reload(), 100);
    }
    return res;
  };

  // ---------- helpers --------------------------------------------------------
  function authHdr() {
    const t = localStorage.getItem('xero_session') || '';
    return t ? { 'X-Session-Token': t } : {};
  }
  async function getJSON(url) {
    const r = await fetch(url, { headers: authHdr() });
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return r.json();
  }
  function $usd(v) { if (v == null || isNaN(v)) return '—'; return '$' + Math.round(Number(v)).toLocaleString('en-US'); }
  function $pct(v, digits = 1) { if (v == null || isNaN(v)) return '—'; return Number(v).toFixed(digits) + '%'; }
  function $num(v) { if (v == null || isNaN(v)) return '—'; return Number(v).toLocaleString('en-US'); }
  function trend(v) {
    if (v == null) return 'flat';
    return v > 0.5 ? 'up' : v < -0.5 ? 'down' : 'flat';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
  function nowLong() {
    return new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  }
  const trendClassMap = { up: 'text-emerald-600', down: 'text-rose-600', flat: 'text-slate-500' };
  const trendArrow    = { up: '▲', down: '▼', flat: '▬' };

  // ---------- data gather ----------------------------------------------------
  async function gather() {
    // Pull every endpoint we need in parallel; tolerate individual failures
    // so the report renders gracefully if one source is unavailable.
    const fetchSafe = (url) => getJSON(url).catch(e => { console.warn('[gather]', url, e.message); return null; });
    const [exec, summary, aging, awaiting, trends, rev, cash, bank, goals, monthly] = await Promise.all([
      fetchSafe('/api/executive/summary'),
      fetchSafe('/api/invoices/summary'),
      fetchSafe('/api/invoices/by-aging'),
      fetchSafe('/api/clients/awaiting-payment'),
      fetchSafe('/api/payment-trends?view=monthly&periods=6'),
      fetchSafe('/api/revenue/metrics'),
      fetchSafe('/api/cashflow/forecast'),
      fetchSafe('/api/bank-inputs'),
      fetchSafe('/api/goals'),
      fetchSafe('/api/monthly/trends'),
    ]);
    return { exec, summary, aging, awaiting, trends, rev, cash, bank, goals, monthly };
  }

  // ---------- analyzer: CFO-perspective SWOT ---------------------------------
  function buildSwot(d) {
    const items = { S: [], W: [], O: [], T: [] };

    const exec = d.exec || {};
    const aging = d.aging || {};
    const awaiting = d.awaiting || [];
    const trends = d.trends?.periods || [];
    const rev = d.rev || {};
    const cash = d.cash || [];

    // ---- pull out metrics safely
    const gm   = Number(exec.grossMarginPct);
    const dso  = Number(exec.dso);
    const cashPos = Number(exec.cashPosition);
    const overdue = Number(exec.overdueAmount);
    const revGrowthMoM = Number(exec.revenueGrowth?.momGrowth);
    const revGrowthYoY = Number(exec.revenueGrowth?.yoyGrowth);

    const arTotal =
      (Number(aging.current?.total)||0) +
      (Number(aging.aged?.total)||0) +
      (Number(aging.critical?.total)||0);
    const arCritical = Number(aging.critical?.total) || 0;
    const arCriticalPct = arTotal > 0 ? (arCritical / arTotal) * 100 : 0;
    const arOverduePct  = arTotal > 0 ? (overdue / arTotal) * 100 : 0;

    const collectionPct = Number(trends[0]?.collectionRate);
    const paymentVelocity = Number(trends[0]?.paymentVelocity);
    const arr = Number(rev.arr);
    const mrr = Number(rev.mrr);

    // Customer concentration — top client's share of outstanding AR
    const topClient = awaiting?.[0];
    const concentrationPct = (topClient && arTotal > 0)
      ? (Number(topClient.totalOutstanding) / arTotal) * 100
      : 0;

    // Cash runway — cashPos / avg-monthly-opex (use bank-inputs.opex; otherwise estimate)
    const opex = Number(d.bank?.opex);
    const cashRunwayMonths = (cashPos > 0 && opex > 0) ? cashPos / opex : null;

    // ---- STRENGTHS
    if (gm >= 30) items.S.push({
      title: `Gross margin ${gm.toFixed(1)}%`,
      detail: 'Above 30% — healthy unit economics give pricing flexibility and absorb shocks.',
    });
    if (dso > 0 && dso <= 45) items.S.push({
      title: `DSO ${dso} days`,
      detail: 'Clients pay quickly. Working capital is not stuck in receivables.',
    });
    if (cashRunwayMonths && cashRunwayMonths >= 6) items.S.push({
      title: `Cash runway ${cashRunwayMonths.toFixed(1)} months`,
      detail: 'Provides strategic optionality — can absorb a slow quarter without distress.',
    });
    if (revGrowthMoM > 5) items.S.push({
      title: `Revenue +${revGrowthMoM.toFixed(1)}% MoM`,
      detail: 'Momentum is positive; build on what is working.',
    });
    if (collectionPct >= 90) items.S.push({
      title: `Collection rate ${collectionPct.toFixed(0)}%`,
      detail: 'Strong cash conversion from billed revenue. Process discipline is paying off.',
    });
    if (arr > 0) items.S.push({
      title: `ARR ${$usd(arr)} (MRR ${$usd(mrr)})`,
      detail: 'Recurring base is a stable platform to plan against.',
    });

    // ---- WEAKNESSES
    if (arOverduePct > 20) items.W.push({
      title: `${arOverduePct.toFixed(0)}% of AR is overdue`,
      detail: `$${Math.round(overdue).toLocaleString()} past due. Collections process is lagging.`,
    });
    if (dso > 60) items.W.push({
      title: `DSO ${dso} days`,
      detail: 'Cash is tied up significantly longer than ideal. Each extra day = working capital cost.',
    });
    if (gm > 0 && gm < 20) items.W.push({
      title: `Gross margin ${gm.toFixed(1)}%`,
      detail: 'Below 20% — pricing or COGS pressure. Investigate per-client unit economics.',
    });
    if (concentrationPct > 30) items.W.push({
      title: `${concentrationPct.toFixed(0)}% of outstanding AR from one client`,
      detail: `${esc(topClient.contactName)} alone represents major exposure. Diversify or de-risk.`,
    });
    if (revGrowthMoM < -5) items.W.push({
      title: `Revenue ${revGrowthMoM.toFixed(1)}% MoM`,
      detail: 'Decline is meaningful. Dig into churn vs. new business vs. invoice timing.',
    });
    if (paymentVelocity > 30) items.W.push({
      title: `Payment velocity ${paymentVelocity} days late on avg`,
      detail: 'Clients are systematically late. Consider tightening terms, late fees, or net-7 for new clients.',
    });

    // ---- OPPORTUNITIES
    const agedTotal = Number(aging.aged?.total) || 0;
    if (agedTotal > 0) items.O.push({
      title: `${$usd(agedTotal)} in 100-200 day AR could be accelerated`,
      detail: 'Offer a 1-2% early-pay discount on aged balances. Math: even a 2% discount on $10k beats writing it off.',
    });
    if (d.bank?.opex && cashPos > 0 && cashRunwayMonths > 3) items.O.push({
      title: 'Line of credit headroom looks viable',
      detail: 'Healthy cash + margin should support a $50-100k LoC at community-bank pricing. Use the Bank tab simulator to size.',
    });
    if (d.goals?.revenue && rev.ytdRevenue) {
      const gap = Number(d.goals.revenue) - Number(rev.ytdRevenue);
      if (gap > 0) items.O.push({
        title: `${$usd(gap)} away from revenue goal`,
        detail: 'Targeted push on top-10 active accounts likely closes the gap faster than net-new prospecting.',
      });
    }
    if (revGrowthYoY > 10) items.O.push({
      title: `YoY revenue +${revGrowthYoY.toFixed(1)}%`,
      detail: 'Strong YoY signal — repeatable demand. Consider expanding capacity rather than discounting.',
    });

    // ---- THREATS
    if (arCriticalPct > 5) items.T.push({
      title: `${arCriticalPct.toFixed(0)}% of AR is 200+ days old`,
      detail: `${$usd(arCritical)} at material risk of write-off. Establish a 14-day collection-or-discount-or-escalate policy.`,
    });
    if (cashRunwayMonths && cashRunwayMonths < 3) items.T.push({
      title: `Cash runway only ${cashRunwayMonths.toFixed(1)} months`,
      detail: 'Below 3 months is the danger zone. Establish a 13-week rolling cash forecast and weekly cash standup.',
    });
    if (concentrationPct > 50) items.T.push({
      title: `${concentrationPct.toFixed(0)}% single-client concentration`,
      detail: 'Existential risk if this client churns or delays. Diversification should be a 2026 strategic priority.',
    });
    if (paymentVelocity > 45) items.T.push({
      title: 'Systemic late-payment behavior',
      detail: 'Average 45+ day delay suggests broader market stress. Watch for an uptick in writes-offs over the next 90 days.',
    });

    // Always have at least placeholder if any quadrant is empty
    for (const k of ['S','W','O','T']) {
      if (!items[k].length) items[k].push({ title: '—', detail: 'Not enough signal in the current data to flag anything here.' });
    }
    return items;
  }

  // ---------- SWOT tab (auto-rendered) --------------------------------------
  let swotInited = false;
  async function initSwotTab() {
    const root = document.getElementById('tab-swot');
    if (!root) return;
    root.innerHTML = `
      <div class="report-hero report-hero--cfo">
        <div>
          <div class="report-hero__eyebrow">CFO Analysis</div>
          <h2 class="report-hero__title">SWOT — Strategic Health Check</h2>
          <p class="report-hero__sub">${nowLong()} — auto-generated from live financial data.</p>
        </div>
        <button id="swotRefresh" class="btn-refresh"><i class="fas fa-arrows-rotate"></i>Refresh</button>
      </div>
      <div id="swot-loader" class="report-loader"><i class="fas fa-spinner fa-spin"></i> Reading the books…</div>
      <div id="swot-grid" class="swot-grid-pro" hidden></div>
    `;
    document.getElementById('swotRefresh').addEventListener('click', loadSwot);
    swotInited = true;
    await loadSwot();
  }
  async function loadSwot() {
    const loader = document.getElementById('swot-loader');
    const grid = document.getElementById('swot-grid');
    loader.hidden = false; grid.hidden = true;
    try {
      const d = await gather();
      const swot = buildSwot(d);
      grid.innerHTML = `
        ${renderSwotCell('S', 'Strengths',     'fa-shield-halved', 'emerald', swot.S)}
        ${renderSwotCell('W', 'Weaknesses',    'fa-triangle-exclamation', 'rose', swot.W)}
        ${renderSwotCell('O', 'Opportunities', 'fa-bullseye', 'sky', swot.O)}
        ${renderSwotCell('T', 'Threats',       'fa-skull-crossbones', 'amber', swot.T)}
      `;
      loader.hidden = true; grid.hidden = false;
    } catch (e) {
      loader.innerHTML = `<span class="text-rose-600">Could not load data: ${esc(e.message)}</span>`;
    }
  }
  function renderSwotCell(letter, name, icon, color, items) {
    return `
      <article class="swot-card swot-card--${color}">
        <header><span class="swot-card__letter">${letter}</span><i class="fas ${icon}"></i><h3>${name}</h3></header>
        <ul>${items.map(i => `<li><strong>${esc(i.title)}</strong><span>${esc(i.detail)}</span></li>`).join('')}</ul>
      </article>
    `;
  }

  // ---------- Exec Reports (3 polished role views) ---------------------------
  const ROLE_META = {
    'cfo':      { label: 'CFO — Treasury & Risk',      gradient: 'cfo',  icon: 'fa-coins',     accent: 'sky'     },
    'ceo':      { label: 'CEO — Strategic Overview',   gradient: 'ceo',  icon: 'fa-crown',     accent: 'violet'  },
    'vp-sales': { label: 'VP Sales / CRO — Accounts',  gradient: 'sales',icon: 'fa-rocket',    accent: 'emerald' },
  };
  let reportsInited = false;
  async function initReportsTab(forceRole) {
    const root = document.getElementById('tab-reports');
    if (!root) return;
    if (!reportsInited) {
      root.innerHTML = `
        <div class="report-roleswitch">
          ${Object.entries(ROLE_META).map(([k,v]) =>
            `<button data-role="${k}" class="role-tab ${k === 'cfo' ? 'active' : ''}"><i class="fas ${v.icon}"></i>${esc(v.label)}</button>`
          ).join('')}
        </div>
        <div id="report-body"></div>
      `;
      root.querySelectorAll('.role-tab').forEach(b => {
        b.addEventListener('click', () => {
          root.querySelectorAll('.role-tab').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          loadReport(b.getAttribute('data-role'));
        });
      });
      reportsInited = true;
    }
    const role = forceRole || root.querySelector('.role-tab.active')?.getAttribute('data-role') || 'cfo';
    await loadReport(role);
  }
  async function loadReport(role) {
    const body = document.getElementById('report-body');
    const meta = ROLE_META[role] || ROLE_META['cfo'];
    body.innerHTML = `<div class="report-loader"><i class="fas fa-spinner fa-spin"></i> Building the ${meta.label.split(' — ')[0]} briefing…</div>`;
    try {
      const d = await gather();
      if      (role === 'cfo')      body.innerHTML = renderCFOReport(d);
      else if (role === 'ceo')      body.innerHTML = renderCEOReport(d);
      else if (role === 'vp-sales') body.innerHTML = renderSalesReport(d);
      // Render any charts (deferred so their canvases exist)
      setTimeout(() => activateReportCharts(role, d), 0);
    } catch (e) {
      body.innerHTML = `<div class="text-rose-600 p-4">Could not load report: ${esc(e.message)}</div>`;
    }
  }

  // ---------- CFO REPORT -----------------------------------------------------
  function renderCFOReport(d) {
    const exec = d.exec || {};
    const aging = d.aging || {};
    const awaiting = d.awaiting || [];
    const cashFc = Array.isArray(d.cash) ? d.cash : [];
    const trends = d.trends?.periods || [];
    const rev = d.rev || {};

    const cash = Number(exec.cashPosition) || 0;
    const dso = Number(exec.dso) || 0;
    const gm = Number(exec.grossMarginPct) || 0;
    const revMoM = Number(exec.revenueGrowth?.momGrowth);
    const overdue = Number(exec.overdueAmount) || 0;

    const kpi = (label, val, sub, color) => `
      <div class="kpi-pro kpi-pro--${color || 'slate'}">
        <div class="kpi-pro__label">${label}</div>
        <div class="kpi-pro__value">${val}</div>
        ${sub ? `<div class="kpi-pro__sub ${color ? 'text-' + color + '-700' : ''}">${sub}</div>` : ''}
      </div>
    `;

    const arTotal =
      (Number(aging.current?.total)||0) + (Number(aging.aged?.total)||0) + (Number(aging.critical?.total)||0);
    const aBucket = (label, n, total, color) => {
      const pct = arTotal > 0 ? (total / arTotal) * 100 : 0;
      return `
        <div class="ar-bucket">
          <div class="ar-bucket__head">
            <span>${label}</span><strong>${$usd(total)}</strong>
          </div>
          <div class="ar-bucket__bar"><span class="bg-${color}-500" style="width:${pct.toFixed(1)}%"></span></div>
          <div class="ar-bucket__sub">${n} invoices · ${pct.toFixed(1)}% of AR</div>
        </div>
      `;
    };

    const topOverdue = awaiting.slice(0, 5);

    // Forecast min/end
    const fcEnd = cashFc.length ? Number(cashFc[cashFc.length - 1].projectedBalance) : null;
    const fcMin = cashFc.length ? Math.min(...cashFc.map(p => Number(p.projectedBalance))) : null;

    const actions = buildCFOActions(d);

    return `
      <div class="report-hero report-hero--cfo">
        <div>
          <div class="report-hero__eyebrow"><i class="fas fa-coins"></i> CFO Briefing</div>
          <h2 class="report-hero__title">Treasury & Risk Snapshot</h2>
          <p class="report-hero__sub">${nowLong()} — every number sourced from Xero, refreshed at load.</p>
        </div>
        <div class="report-hero__quick">
          <div><span>Cash today</span><b>${$usd(cash)}</b></div>
          <div><span>DSO</span><b>${$num(dso)} days</b></div>
        </div>
      </div>

      <section class="report-section">
        <h3>Headline</h3>
        <div class="kpi-pro-grid">
          ${kpi('Cash position',  $usd(cash),   `${trendArrow[trend(revMoM)]} ${$pct(revMoM)} rev MoM`,   trend(revMoM) === 'up' ? 'emerald' : trend(revMoM) === 'down' ? 'rose' : null)}
          ${kpi('DSO',            $num(dso) + ' days', dso <= 45 ? '✓ healthy' : dso <= 60 ? 'monitoring' : '↑ collection pressure',   dso <= 45 ? 'emerald' : dso <= 60 ? 'amber' : 'rose')}
          ${kpi('Gross margin',   $pct(gm),     gm >= 30 ? '✓ healthy unit economics' : gm >= 20 ? 'tightening' : 'pricing pressure',  gm >= 30 ? 'emerald' : gm >= 20 ? 'amber' : 'rose')}
          ${kpi('Overdue AR',     $usd(overdue), arTotal > 0 ? `${((overdue / arTotal) * 100).toFixed(0)}% of total AR` : null,        overdue > 0 ? 'rose' : 'emerald')}
        </div>
      </section>

      <section class="report-section">
        <h3>13-Week Cash Forecast</h3>
        <div class="report-card">
          <div class="report-card__row" style="justify-content:space-between">
            <div><span class="muted">Today</span><strong>${$usd(cash)}</strong></div>
            <div><span class="muted">Trough (next 13w)</span><strong class="${fcMin && fcMin < 0 ? 'text-rose-600' : ''}">${fcMin == null ? '—' : $usd(fcMin)}</strong></div>
            <div><span class="muted">Projected EoF</span><strong>${fcEnd == null ? '—' : $usd(fcEnd)}</strong></div>
          </div>
          <canvas id="cfo-cash-chart" height="120"></canvas>
        </div>
      </section>

      <section class="report-section">
        <h3>AR Aging — Where the cash is stuck</h3>
        <div class="ar-grid">
          ${aBucket('Current (0-100 days)',       aging.current?.count  || 0, aging.current?.total  || 0, 'emerald')}
          ${aBucket('Aged (100-200 days)',        aging.aged?.count     || 0, aging.aged?.total     || 0, 'amber')}
          ${aBucket('Critical (200+ days)',       aging.critical?.count || 0, aging.critical?.total || 0, 'rose')}
        </div>
      </section>

      <section class="report-section">
        <h3>Concentration — Top 5 by outstanding AR</h3>
        <table class="report-table">
          <thead><tr><th>Client</th><th class="num">Invoices</th><th class="num">Outstanding</th><th class="num">Avg delay</th></tr></thead>
          <tbody>
          ${topOverdue.length ? topOverdue.map(c => `
            <tr>
              <td>${esc(c.contactName)}</td>
              <td class="num">${$num(c.invoiceCount)}</td>
              <td class="num">${$usd(c.totalOutstanding)}</td>
              <td class="num">${$num(c.averagePaymentDelay)} d</td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="muted">No overdue clients.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="report-section">
        <h3><i class="fas fa-list-check"></i> Recommended Actions</h3>
        <ol class="action-list">${actions.map(a => `<li><strong>${esc(a.title)}</strong><span>${esc(a.detail)}</span></li>`).join('')}</ol>
      </section>
    `;
  }

  function buildCFOActions(d) {
    const actions = [];
    const exec = d.exec || {};
    const aging = d.aging || {};
    const awaiting = d.awaiting || [];
    if (Number(exec.dso) > 60) actions.push({ title: 'Tighten collections cadence on >60d invoices', detail: 'Set up weekly statement reminders at d+7, d+14, d+30. Aim to bring DSO under 55 days within a quarter.' });
    if (Number(aging.critical?.total) > 0) actions.push({ title: `Escalate ${$usd(aging.critical.total)} in 200+ day AR`, detail: 'Offer 2% discount for payment within 14 days, otherwise route to formal collections / write-off review.' });
    if (Number(exec.grossMarginPct) > 0 && Number(exec.grossMarginPct) < 20) actions.push({ title: 'Audit per-client gross margin', detail: 'A few low-margin engagements may be dragging blended margin. Renegotiate or sunset.' });
    if (awaiting?.[0]) {
      const top = awaiting[0];
      const total = (Number(aging.current?.total)||0) + (Number(aging.aged?.total)||0) + (Number(aging.critical?.total)||0);
      const pct = total > 0 ? (top.totalOutstanding / total) * 100 : 0;
      if (pct > 30) actions.push({ title: `Phone call this week to ${esc(top.contactName)}`, detail: `Single-client concentration at ${pct.toFixed(0)}% of AR — direct conversation typically unlocks payment faster than any other lever.` });
    }
    if (Array.isArray(d.cash) && d.cash.some(p => Number(p.projectedBalance) < 0)) {
      actions.push({ title: 'Pull forward inflows for forecast trough', detail: 'Cash forecast dips below zero in the 13-week window. Either accelerate billing or arrange short-term LoC.' });
    }
    if (!actions.length) actions.push({ title: 'No urgent finance actions', detail: 'Indicators are within healthy ranges. Use the cycle to strengthen reporting cadence and forecasting accuracy.' });
    return actions;
  }

  // ---------- CEO REPORT -----------------------------------------------------
  function renderCEOReport(d) {
    const exec = d.exec || {};
    const rev = d.rev || {};
    const goals = d.goals || {};
    const aging = d.aging || {};
    const monthly = Array.isArray(d.monthly) ? d.monthly : (d.monthly?.periods || []);

    const cash = Number(exec.cashPosition) || 0;
    const gm = Number(exec.grossMarginPct) || 0;
    const revYoY = Number(exec.revenueGrowth?.yoyGrowth);
    const revMoM = Number(exec.revenueGrowth?.momGrowth);
    const arr = Number(rev.arr) || 0;

    const goalRev = Number(goals.revenue) || null;
    const ytdRev = Number(rev.ytdRevenue) || 0;
    const goalProgress = (goalRev && goalRev > 0) ? Math.min(100, (ytdRev / goalRev) * 100) : null;

    const narrative = buildCEONarrative(d);

    return `
      <div class="report-hero report-hero--ceo">
        <div>
          <div class="report-hero__eyebrow"><i class="fas fa-crown"></i> CEO Briefing</div>
          <h2 class="report-hero__title">Where the business stands</h2>
          <p class="report-hero__sub">${nowLong()}</p>
        </div>
        <div class="report-hero__quick">
          <div><span>Revenue MoM</span><b class="${trendClassMap[trend(revMoM)]}">${trendArrow[trend(revMoM)]} ${$pct(revMoM)}</b></div>
          <div><span>ARR</span><b>${$usd(arr)}</b></div>
        </div>
      </div>

      <section class="report-section">
        <div class="ceo-narrative">${narrative}</div>
      </section>

      <section class="report-section">
        <h3>Headline KPIs</h3>
        <div class="kpi-pro-grid">
          <div class="kpi-pro kpi-pro--violet"><div class="kpi-pro__label">Revenue (YTD)</div><div class="kpi-pro__value">${$usd(ytdRev)}</div><div class="kpi-pro__sub">${$pct(revYoY)} YoY</div></div>
          <div class="kpi-pro kpi-pro--violet"><div class="kpi-pro__label">ARR</div><div class="kpi-pro__value">${$usd(arr)}</div><div class="kpi-pro__sub">Annualized run rate</div></div>
          <div class="kpi-pro kpi-pro--violet"><div class="kpi-pro__label">Cash</div><div class="kpi-pro__value">${$usd(cash)}</div><div class="kpi-pro__sub">Position today</div></div>
          <div class="kpi-pro kpi-pro--violet"><div class="kpi-pro__label">Gross margin</div><div class="kpi-pro__value">${$pct(gm)}</div><div class="kpi-pro__sub">${gm >= 30 ? 'Healthy' : gm >= 20 ? 'Tightening' : 'Under pressure'}</div></div>
        </div>
      </section>

      ${goalProgress != null ? `
      <section class="report-section">
        <h3>Goals Progress</h3>
        <div class="report-card">
          <div class="report-card__row" style="justify-content:space-between;margin-bottom:.5rem">
            <strong>Revenue: ${$usd(ytdRev)} of ${$usd(goalRev)} target</strong>
            <span class="muted">${goalProgress.toFixed(0)}% of target</span>
          </div>
          <div class="progress-bar"><span style="width:${goalProgress.toFixed(1)}%"></span></div>
        </div>
      </section>` : ''}

      <section class="report-section">
        <h3>Revenue Trajectory</h3>
        <div class="report-card"><canvas id="ceo-rev-chart" height="160"></canvas></div>
      </section>

      <section class="report-section">
        <h3>Strategic Signals</h3>
        <div class="report-card">
          <ul class="signal-list">
            ${buildCEOSignals(d).map(s => `<li><i class="fas ${s.icon} text-${s.color}-600"></i><span>${esc(s.text)}</span></li>`).join('')}
          </ul>
        </div>
      </section>
    `;
  }
  function buildCEONarrative(d) {
    const exec = d.exec || {};
    const rev = d.rev || {};
    const bits = [];
    const revMoM = Number(exec.revenueGrowth?.momGrowth);
    const revYoY = Number(exec.revenueGrowth?.yoyGrowth);
    const cash = Number(exec.cashPosition) || 0;
    const gm = Number(exec.grossMarginPct) || 0;
    if (!isNaN(revMoM)) bits.push(`Revenue is ${revMoM >= 0 ? 'up' : 'down'} <b>${Math.abs(revMoM).toFixed(1)}%</b> MoM and ${revYoY >= 0 ? 'up' : 'down'} <b>${Math.abs(revYoY).toFixed(1)}%</b> YoY.`);
    bits.push(`Cash position is <b>${$usd(cash)}</b>${gm > 0 ? `, with gross margin holding at <b>${gm.toFixed(1)}%</b>` : ''}.`);
    const overdue = Number(exec.overdueAmount) || 0;
    if (overdue > 0) bits.push(`<b>${$usd(overdue)}</b> in AR is past due — material to liquidity if not collected this quarter.`);
    return bits.join(' ');
  }
  function buildCEOSignals(d) {
    const out = [];
    const exec = d.exec || {};
    const rev = d.rev || {};
    if (Number(exec.revenueGrowth?.momGrowth) > 5) out.push({ icon:'fa-arrow-trend-up', color:'emerald', text:'Revenue momentum is positive — invest in what is working.' });
    if (Number(exec.grossMarginPct) >= 30) out.push({ icon:'fa-shield-halved', color:'emerald', text:'Healthy gross margin — pricing power is intact.' });
    if (Number(rev.arr) > 0) out.push({ icon:'fa-rotate', color:'violet', text:`Recurring base of ${$usd(rev.arr)} ARR is a stable platform.` });
    if (Number(exec.dso) > 60) out.push({ icon:'fa-clock', color:'rose', text:'DSO is elevated — clients are slow to pay, watch cash conversion.' });
    if (out.length === 0) out.push({ icon:'fa-circle-info', color:'slate', text:'Indicators are within normal ranges this period.' });
    return out;
  }

  // ---------- VP SALES / CRO REPORT -----------------------------------------
  function renderSalesReport(d) {
    const awaiting = d.awaiting || [];
    const rev = d.rev || {};
    const monthly = Array.isArray(d.monthly) ? d.monthly : [];
    const summary = d.summary || {};

    const top10 = awaiting.slice(0, 10);

    return `
      <div class="report-hero report-hero--sales">
        <div>
          <div class="report-hero__eyebrow"><i class="fas fa-rocket"></i> VP Sales / CRO Briefing</div>
          <h2 class="report-hero__title">Accounts, velocity, and risk</h2>
          <p class="report-hero__sub">${nowLong()}</p>
        </div>
        <div class="report-hero__quick">
          <div><span>Active clients</span><b>${$num(rev.activeClients)}</b></div>
          <div><span>MRR</span><b>${$usd(rev.mrr)}</b></div>
        </div>
      </div>

      <section class="report-section">
        <h3>New & Recurring Revenue</h3>
        <div class="kpi-pro-grid">
          <div class="kpi-pro kpi-pro--emerald"><div class="kpi-pro__label">YTD Revenue</div><div class="kpi-pro__value">${$usd(rev.ytdRevenue)}</div></div>
          <div class="kpi-pro kpi-pro--emerald"><div class="kpi-pro__label">MRR</div><div class="kpi-pro__value">${$usd(rev.mrr)}</div><div class="kpi-pro__sub">Current month run-rate</div></div>
          <div class="kpi-pro kpi-pro--emerald"><div class="kpi-pro__label">ARR</div><div class="kpi-pro__value">${$usd(rev.arr)}</div></div>
          <div class="kpi-pro kpi-pro--emerald"><div class="kpi-pro__label">Avg Revenue / Client</div><div class="kpi-pro__value">${$usd(rev.avgRevenuePerClient)}</div></div>
        </div>
      </section>

      <section class="report-section">
        <h3>Top 10 Accounts — Outstanding</h3>
        <table class="report-table">
          <thead><tr><th>Client</th><th class="num">Invoices</th><th class="num">Outstanding</th><th class="num">Total paid</th><th class="num">Avg delay</th></tr></thead>
          <tbody>
          ${top10.length ? top10.map(c => `
            <tr>
              <td>${esc(c.contactName)}</td>
              <td class="num">${$num(c.invoiceCount)}</td>
              <td class="num">${$usd(c.totalOutstanding)}</td>
              <td class="num">${$usd(c.totalPaid)}</td>
              <td class="num ${c.averagePaymentDelay > 30 ? 'text-rose-600 font-semibold' : ''}">${$num(c.averagePaymentDelay)} d</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="muted">No active accounts with outstanding balances.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="report-section">
        <h3>Pipeline Signal</h3>
        <div class="report-card">
          <p class="muted" style="margin-bottom:.75rem">Pipeline data isn't in Xero — these are the closest proxies we can give you today:</p>
          <ul class="signal-list">
            <li><i class="fas fa-file-invoice text-blue-600"></i><span><b>${$num(summary.draftCount)}</b> draft invoices totaling <b>${$usd(summary.draftAmount)}</b> — work-in-flight</span></li>
            <li><i class="fas fa-hourglass text-amber-600"></i><span><b>${$num(summary.awaitingCount)}</b> awaiting payment (<b>${$usd(summary.awaitingAmount)}</b>) — booked but not banked</span></li>
            <li><i class="fas fa-triangle-exclamation text-rose-600"></i><span><b>${$num(summary.overdueCount)}</b> overdue (<b>${$usd(summary.overdueAmount)}</b>) — review for retention risk</span></li>
          </ul>
        </div>
      </section>

      <section class="report-section">
        <h3>At-Risk Accounts</h3>
        <table class="report-table">
          <thead><tr><th>Client</th><th class="num">Outstanding</th><th class="num">Avg delay</th><th>Why at risk</th></tr></thead>
          <tbody>
          ${buildAtRisk(d).map(r => `
            <tr>
              <td>${esc(r.contactName)}</td>
              <td class="num">${$usd(r.totalOutstanding)}</td>
              <td class="num text-rose-600 font-semibold">${$num(r.averagePaymentDelay)} d</td>
              <td>${esc(r.reason)}</td>
            </tr>
          `).join('') || '<tr><td colspan="4" class="muted">No accounts crossing risk thresholds.</td></tr>'}
          </tbody>
        </table>
      </section>
    `;
  }
  function buildAtRisk(d) {
    const list = (d.awaiting || []).filter(c => (c.averagePaymentDelay || 0) > 30 || (c.totalOutstanding || 0) > 0 && (c.invoiceCount || 0) >= 3);
    return list.slice(0, 6).map(c => ({
      ...c,
      reason: c.averagePaymentDelay > 60 ? 'Chronic slow-pay (>60d avg)' :
              c.averagePaymentDelay > 30 ? 'Slow-pay trend (>30d avg)'  :
              c.invoiceCount >= 3        ? 'Multiple open invoices'     : 'Outstanding balance',
    }));
  }

  // ---------- charts ---------------------------------------------------------
  function activateReportCharts(role, d) {
    if (role === 'cfo') {
      const el = document.getElementById('cfo-cash-chart');
      const cash = Array.isArray(d.cash) ? d.cash : [];
      if (el && cash.length) {
        new Chart(el.getContext('2d'), {
          type: 'line',
          data: {
            labels: cash.map(p => p.weekLabel),
            datasets: [{
              label: 'Projected balance',
              data: cash.map(p => Number(p.projectedBalance)),
              borderColor: '#0284c7', backgroundColor: 'rgba(56,189,248,0.12)',
              fill: true, tension: 0.3,
            }],
          },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } },
        });
      }
    }
    if (role === 'ceo') {
      const el = document.getElementById('ceo-rev-chart');
      const m = Array.isArray(d.monthly) ? d.monthly : (d.monthly?.periods || []);
      if (el && m.length) {
        new Chart(el.getContext('2d'), {
          type: 'bar',
          data: {
            labels: m.map(p => p.month || p.periodLabel || p.period),
            datasets: [{
              label: 'Revenue',
              data: m.map(p => Number(p.revenue || p.totalOutstanding || 0)),
              backgroundColor: 'rgba(139,92,246,0.65)',
            }],
          },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } },
        });
      }
    }
  }

  // ---------- override the v17 init points (the previous versions are dead) -
  window.initSwotTab = initSwotTab;
  window.initReportsTab = initReportsTab;
})();
