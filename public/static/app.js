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
    document.getElementById('logoutBtn').classList.remove('hidden');
    await loadDashboardData();
    updateSheetsAuthStatus();
  } else {
    // Show login, hide dashboard - BUT still load demo data for preview
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
    
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
    
    try {
      console.log('Loading revenue metrics from /api/revenue/metrics...');
      const response = await axios.get('/api/revenue/metrics');
      data = response.data;
      console.log('✅ Loaded real revenue metrics');
    } catch (error) {
      // Fall back to demo data
      console.log('Loading demo revenue metrics...');
      const response = await axios.get('/api/demo/revenue/metrics');
      data = response.data;
      console.log('✅ Loaded demo revenue metrics');
    }
    
    // Update primary metrics
    document.getElementById('currentMRR').textContent = formatCurrency(data.mrr);
    document.getElementById('currentARR').textContent = formatCurrency(data.arr);
    document.getElementById('ytdRevenue').textContent = formatCurrency(data.ytdRevenue);
    document.getElementById('projectedEOY').textContent = formatCurrency(data.projectedEOY);
    
    // Update growth indicators
    const growthSign = data.growthRate >= 0 ? '+' : '';
    document.getElementById('mrrChange').textContent = `${growthSign}${data.growthRate.toFixed(1)}% vs expected`;
    document.getElementById('arrGrowth').textContent = `${growthSign}${data.growthRate.toFixed(1)}% growth`;
    
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
    
    console.log('✅ Revenue metrics updated:', {
      MRR: data.mrr,
      ARR: data.arr,
      YTD: data.ytdRevenue,
      Projected: data.projectedEOY
    });
  } catch (error) {
    console.error('Error loading revenue metrics:', error);
    console.warn('Revenue metrics will show default values');
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
                  <div class="text-sm font-medium text-gray-900">${client.contactName}</div>
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
      } else if (tabName === 'invoices') {
        loadInvoices();
      } else if (tabName === 'trends') {
        loadPaymentTrends();
      } else if (tabName === 'sheets-links') {
        loadClientSheetFormulas();
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
      const response = await axios.get('/api/clients/awaiting-payment');
      clients = response.data;
    } catch (err) {
      const response = await axios.get('/api/demo/clients-awaiting-payment');
      clients = response.data;
    }

    if (!clients || clients.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No clients with outstanding balances.</p>';
      return;
    }

    // Sort alphabetically by client name
    clients.sort((a, b) => (a.contactName || '').localeCompare(b.contactName || ''));

    const baseUrl = 'https://finance.gershoncrm.com/api/sheets';

    const rows = clients.map(client => {
      const encoded = encodeURIComponent(client.contactName);
      const formula = `=IMPORTDATA("${baseUrl}/${encoded}/due")`;
      return `
        <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2 gap-3">
          <span class="text-sm font-medium text-gray-800 w-48 shrink-0 truncate" title="${client.contactName}">${client.contactName}</span>
          <code class="text-xs text-gray-700 flex-1 select-all break-all">${formula}</code>
          <button onclick="copyText(this, '${formula.replace(/'/g, "\\'")}')"
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

// Copy text helper used by per-client copy buttons
function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.classList.replace('bg-blue-600', 'bg-green-600');
    btn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.replace('bg-green-600', 'bg-blue-600');
      btn.classList.replace('hover:bg-green-700', 'hover:bg-blue-700');
    }, 1500);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

window.loadClientSheetFormulas = loadClientSheetFormulas;
window.copyText = copyText;

// Make functions globally available
window.loadClientsAwaitingPayment = loadClientsAwaitingPayment;
