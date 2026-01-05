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
  await checkAuthStatus();
  await loadDashboardData();
  updateSheetsAuthStatus(); // Update Sheets Links tab status
});

// Check authentication status
async function checkAuthStatus() {
  try {
    const response = await axios.get('/api/auth/status');
    const authStatusEl = document.getElementById('authStatus');
    const connectBtn = document.getElementById('connectBtn');
    
    if (response.data.authenticated) {
      authStatusEl.innerHTML = `
        <span class="flex items-center">
          <i class="fas fa-check-circle text-green-400 mr-2"></i>
          <span>Connected to Xero</span>
        </span>
      `;
      connectBtn.classList.add('hidden');
    } else {
      authStatusEl.innerHTML = `
        <span class="flex items-center">
          <i class="fas fa-exclamation-circle text-yellow-400 mr-2"></i>
          <span>Demo Mode - Click to connect</span>
        </span>
      `;
      connectBtn.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Try to load real data, fall back to demo
    let data;
    try {
      const response = await axios.get('/api/invoices/summary');
      data = response.data;
    } catch (error) {
      // Fall back to demo data
      const response = await axios.get('/api/demo/summary');
      data = response.data;
    }
    
    updateDashboard(data);
    
    // Also load aging data
    await loadAgingData();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showError('Failed to load dashboard data');
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
    // Set to demo/zero values
    document.getElementById('currentCount').textContent = '--';
    document.getElementById('currentAmount').textContent = '$0.00';
    document.getElementById('agedCount').textContent = '--';
    document.getElementById('agedAmount').textContent = '$0.00';
    document.getElementById('criticalCount').textContent = '--';
    document.getElementById('criticalAmount').textContent = '$0.00';
  }
}

// Update dashboard with data
function updateDashboard(data) {
  document.getElementById('draftCount').textContent = data.draftCount;
  document.getElementById('draftAmount').textContent = formatCurrency(data.draftAmount);
  
  document.getElementById('awaitingCount').textContent = data.awaitingCount;
  document.getElementById('awaitingAmount').textContent = formatCurrency(data.awaitingAmount);
  
  document.getElementById('overdueCount').textContent = data.overdueCount;
  document.getElementById('overdueAmount').textContent = formatCurrency(data.overdueAmount);
  
  createInvoiceChart(data);
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
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active', 'border-blue-600', 'text-blue-600');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  
  // Show selected tab
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');
  
  // Add active class to clicked button
  event.target.closest('.tab-btn').classList.add('active', 'border-blue-600', 'text-blue-600');
  event.target.closest('.tab-btn').classList.remove('border-transparent', 'text-gray-500');
}

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
function displayInvoices(invoices) {
  const listEl = document.getElementById('invoiceList');
  
  if (invoices.length === 0) {
    listEl.innerHTML = '<p class="text-gray-500 text-center py-8">No invoices found</p>';
    return;
  }
  
  const html = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Due</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
  const date = new Date(dateStr);
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
  // You can implement a toast notification here
  console.error(message);
  alert(message);
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

// Display clients awaiting payment
function displayClientsAwaitingPayment(clients, isDemo = false) {
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
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number of Invoices</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Outstanding</th>
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
                ${client.invoiceCount} invoice${client.invoiceCount !== 1 ? 's' : ''}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              ${formatCurrency(client.totalOutstanding)}
            </td>
          </tr>
        `).join('')}
        <tr class="bg-gray-100 font-bold">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-800">
              ${totalInvoices} invoice${totalInvoices !== 1 ? 's' : ''}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
            ${formatCurrency(totalOutstanding)}
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

function refreshData() {
  loadDashboardData();
  showError = () => {}; // Suppress errors during refresh
  setTimeout(() => {
    showError = (msg) => alert(msg); // Restore error handler
  }, 1000);
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

// Initialize settings when tab is shown
const originalShowTab = typeof showTab !== 'undefined' ? showTab : () => {};
window.showTab = function(tabName) {
  originalShowTab(tabName);
  if (tabName === 'settings') {
    initializeSettings();
  }
};

// Connect to Xero with custom or default credentials
async function connectToXero() {
  const clientId = localStorage.getItem('xero_client_id');
  const clientSecret = localStorage.getItem('xero_client_secret');
  const redirectUri = `${window.location.origin}/auth/callback`;
  
  if (!clientId || !clientSecret) {
    // No custom credentials, use default OAuth flow
    window.location.href = '/auth/login';
    return;
  }
  
  try {
    // Use custom credentials via POST
    const response = await axios.post('/auth/login', {
      clientId,
      clientSecret,
      redirectUri
    });
    
    if (response.data.authUrl) {
      window.location.href = response.data.authUrl;
    } else {
      alert('❌ Failed to initiate authentication');
    }
  } catch (error) {
    console.error('Connect error:', error);
    alert('❌ Failed to connect. Please check your credentials in Settings.');
  }
}

// Make connectToXero globally available
window.connectToXero = connectToXero;

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
