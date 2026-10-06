/**
 * Online Shopping System - Admin Dashboard
 * Vanilla JavaScript Frontend Application
 * Designed for DBMS College Project (Flask + Oracle 23ai API)
 */

// ==========================================
// 1. STATE & GLOBAL CONFIGURATION
// ==========================================
const CONFIG = {
  API_BASE: '/api',
};

const state = {
  currentView: 'dashboard',
  currentUser: {
    name: 'Manepalli Abhishek',
    rollNo: '25B11CS561',
    role: 'System Administrator',
  },
  userLogs: [],
  activeShopperId: 1,
  shopperCart: {},
  shopperOrders: [],
  categories: [],
  products: [],
  customers: [],
  orders: [],
  payments: [],
  charts: {
    revenueCategory: null,
    topProducts: null,
    orderStatus: null,
    customerSpending: null,
  },
  confirmCallback: null,
};

// ==========================================
// 2. REUSABLE API HELPER
// ==========================================
/**
 * Generic API fetch wrapper with centralized error handling.
 * @param {string} endpoint - API route (e.g. '/stats' or '/products/1')
 * @param {object} options - Fetch options (method, headers, body)
 * @returns {Promise<any>} Parsed JSON response
 */
async function api(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    let data = null;

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : {};
    }

    if (!response.ok) {
      const errorMessage = data.error || data.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, err);
    throw err;
  }
}

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================
/**
 * Safely escape HTML to prevent XSS attacks.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format numbers as Indian Rupee (₹) with thousands separators.
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format ISO dates into human-readable strings.
 */
function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return escapeHtml(isoString);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Toast notification dispatcher.
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">${escapeHtml(message)}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==========================================
// CSV EXPORT UTILITIES
// ==========================================
/**
 * Triggers a browser download for CSV data.
 */
function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escapes fields containing commas, quotes, or newlines for CSV format.
 */
function escapeCSVField(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports current products list (respecting search and category filters) as a CSV file.
 */
function exportProductsCSV() {
  if (!state.products || state.products.length === 0) {
    showToast('No products available to export', 'error');
    return;
  }

  const headers = ['Product ID', 'Product Name', 'Category', 'Price (INR)', 'Stock Quantity', 'Inventory Status'];
  const rows = state.products.map(p => [
    p.product_id,
    p.product_name,
    p.category_name || 'General',
    Number(p.price).toFixed(2),
    p.stock_qty,
    p.stock_qty < 50 ? `Low Stock (${p.stock_qty} left)` : 'In Stock'
  ]);

  const csvRows = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `products_report_${dateStr}.csv`;
  downloadCSV(filename, csvRows.join('\r\n'));
  showToast(`Exported ${state.products.length} products to ${filename}`);
}

/**
 * Exports current orders list (respecting status filter) as a CSV file.
 */
function exportOrdersCSV() {
  if (!state.orders || state.orders.length === 0) {
    showToast('No orders available to export', 'error');
    return;
  }

  const headers = ['Order ID', 'Customer', 'Order Date', 'Status', 'Order Total (INR)', 'Payment Status'];
  const rows = state.orders.map(o => [
    o.order_id,
    o.customer,
    formatDate(o.order_date),
    o.status,
    Number(o.order_total).toFixed(2),
    o.payment_status || 'Pending'
  ]);

  const csvRows = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `orders_report_${dateStr}.csv`;
  downloadCSV(filename, csvRows.join('\r\n'));
  showToast(`Exported ${state.orders.length} orders to ${filename}`);
}

// ==========================================
// 3B. USER LOGIN & SESSION MANAGEMENT
// ==========================================
function initUserSession() {
  const savedUser = localStorage.getItem('shop_admin_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
    } catch (e) {
      console.error(e);
    }
  }
  updateUserSessionUI();
  initUserLogs();
}

function updateUserSessionUI() {
  const user = state.currentUser || { name: 'Manepalli Abhishek', role: 'System Administrator', rollNo: '25B11CS561' };
  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'MA';
  
  // Header
  const headerAvatar = document.getElementById('headerUserAvatar');
  const headerName = document.getElementById('headerUserName');
  const headerRole = document.getElementById('headerUserRole');
  if (headerAvatar) headerAvatar.textContent = initials;
  if (headerName) headerName.textContent = user.name.split(' ')[0];
  if (headerRole) headerRole.textContent = user.role.includes('Admin') ? 'Admin' : 'Operator';

  // Dashboard Welcome Bar
  const avatarText = document.getElementById('userAvatarText');
  const nameDisplay = document.getElementById('currentUserNameDisplay');
  const roleDisplay = document.getElementById('currentUserRoleDisplay');
  const sessionLoginTimeText = document.getElementById('sessionLoginTimeText');
  if (avatarText) avatarText.textContent = initials;
  if (nameDisplay) nameDisplay.textContent = user.name;
  if (roleDisplay) roleDisplay.textContent = `${user.role}${user.rollNo ? ` (${user.rollNo})` : ''}`;
  if (sessionLoginTimeText) sessionLoginTimeText.textContent = 'Session active: Authenticated';

  // Modal active highlight
  document.querySelectorAll('.team-user-item').forEach(item => item.classList.remove('active'));
  if (user.name.includes('Abhishek')) document.getElementById('teamUserMA')?.classList.add('active');
  else if (user.name.includes('Guru')) document.getElementById('teamUserGG')?.classList.add('active');
  else if (user.name.includes('Devi')) document.getElementById('teamUserUD')?.classList.add('active');
  else if (user.name.includes('Kandipilli')) document.getElementById('teamUserKH')?.classList.add('active');
}

function openLoginModal() {
  updateUserSessionUI();
  document.getElementById('userLoginModal')?.classList.add('active');
}

function closeLoginModal() {
  document.getElementById('userLoginModal')?.classList.remove('active');
}

function selectTeamLogin(name, rollNo, role) {
  state.currentUser = {
    name,
    rollNo,
    role,
    loginTime: new Date().toISOString()
  };
  localStorage.setItem('shop_admin_user', JSON.stringify(state.currentUser));
  updateUserSessionUI();
  closeLoginModal();
  logUserActivity('LOGIN', `Authenticated session as ${role} (${name} • ${rollNo})`);
  showToast(`Welcome, ${name}! Logged in as ${role}`);
}

function handleCustomLogin(e) {
  e.preventDefault();
  const name = document.getElementById('loginCustomName').value.trim();
  const role = document.getElementById('loginCustomRole').value;
  if (!name) return;

  state.currentUser = {
    name,
    rollNo: 'STAFF',
    role,
    loginTime: new Date().toISOString()
  };
  localStorage.setItem('shop_admin_user', JSON.stringify(state.currentUser));
  updateUserSessionUI();
  closeLoginModal();
  document.getElementById('customLoginForm').reset();
  logUserActivity('LOGIN', `Authenticated custom session as ${role} (${name})`);
  showToast(`Logged in as ${name} (${role})`);
}

// ==========================================
// 3C. USER & SYSTEM ACTIVITY LOG
// ==========================================
function initUserLogs() {
  const saved = localStorage.getItem('shop_admin_user_logs');
  if (saved) {
    try {
      state.userLogs = JSON.parse(saved);
    } catch (e) {
      state.userLogs = [];
    }
  }

  // Prepopulate initial logs if empty
  if (!state.userLogs || state.userLogs.length === 0) {
    const now = new Date();
    state.userLogs = [
      {
        id: 1,
        timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        user: 'Manepalli Abhishek',
        role: 'System Administrator',
        action: 'LOGIN',
        details: 'Admin session authenticated via Oracle 23ai connection pool',
        status: 'Success'
      },
      {
        id: 2,
        timestamp: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
        user: 'Guru kiran Gowda',
        role: 'Inventory Manager',
        action: 'PAYMENT',
        details: 'Settled payment for Order #102 (Amount: ₹34,999) via Credit Card',
        status: 'Success'
      },
      {
        id: 3,
        timestamp: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
        user: 'Upparapalli Devi Sri',
        role: 'Sales Coordinator',
        action: 'STATUS',
        details: 'Updated Order #102 status to "Shipped"',
        status: 'Success'
      },
      {
        id: 4,
        timestamp: new Date(now.getTime() - 85 * 60 * 1000).toISOString(),
        user: 'Kandipilli Hema Sankara VaraPrasad',
        role: 'Database Administrator',
        action: 'ORDER',
        details: 'Placed Order #104 under atomic ACID transaction (Total: ₹4,998)',
        status: 'Success'
      },
      {
        id: 5,
        timestamp: new Date(now.getTime() - 150 * 60 * 1000).toISOString(),
        user: 'Manepalli Abhishek',
        role: 'System Administrator',
        action: 'PRODUCT',
        details: 'Catalog inventory checked: 3 items flagged with Low Stock (< 50)',
        status: 'Success'
      }
    ];
    saveUserLogs();
  }
}

function saveUserLogs() {
  try {
    localStorage.setItem('shop_admin_user_logs', JSON.stringify((state.userLogs || []).slice(0, 100)));
  } catch (e) {
    console.error('Error saving user logs:', e);
  }
}

function logUserActivity(actionType, details, status = 'Success') {
  const newLog = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    user: state.currentUser?.name || 'Administrator',
    role: state.currentUser?.role || 'Admin',
    action: actionType,
    details: details,
    status: status
  };

  if (!state.userLogs) state.userLogs = [];
  state.userLogs.unshift(newLog);
  if (state.userLogs.length > 100) state.userLogs = state.userLogs.slice(0, 100);
  saveUserLogs();

  if (state.currentView === 'dashboard') {
    renderUserActivityLogs();
  }
}

function clearUserLogs() {
  state.userLogs = [{
    id: Date.now(),
    timestamp: new Date().toISOString(),
    user: state.currentUser?.name || 'Administrator',
    role: state.currentUser?.role || 'Admin',
    action: 'LOGIN',
    details: 'User activity audit log cleared by operator',
    status: 'Success'
  }];
  saveUserLogs();
  renderUserActivityLogs();
  showToast('Activity log cleared');
}

function renderUserActivityLogs() {
  const tbody = document.getElementById('userActivityLogTableBody');
  if (!tbody) return;

  const filter = document.getElementById('userLogFilter')?.value || 'ALL';
  let logs = state.userLogs || [];
  if (filter !== 'ALL') {
    logs = logs.filter(l => l.action === filter);
  }

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 24px; color: var(--text-muted);">
          No activity log entries found for this filter.
        </td>
      </tr>
    `;
    return;
  }

  const badgeMap = {
    'LOGIN': { label: 'User Login', class: 'log-badge-login' },
    'ORDER': { label: 'Order Placed', class: 'log-badge-order' },
    'STATUS': { label: 'Status Update', class: 'log-badge-status' },
    'PAYMENT': { label: 'Payment Settled', class: 'log-badge-payment' },
    'PRODUCT': { label: 'Inventory', class: 'log-badge-product' },
    'CUSTOMER': { label: 'Customer', class: 'log-badge-customer' }
  };

  tbody.innerHTML = logs.map(l => {
    const badge = badgeMap[l.action] || { label: l.action, class: 'log-badge-login' };
    const date = new Date(l.timestamp);
    const timeFormatted = isNaN(date.getTime()) ? '-' : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateFormatted = isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const initials = (l.user || 'AD').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${timeFormatted}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${dateFormatted}</div>
        </td>
        <td>
          <div class="log-actor-name">
            <span class="log-actor-avatar">${escapeHtml(initials)}</span>
            <span>${escapeHtml(l.user)}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-left: 26px;">${escapeHtml(l.role || '')}</div>
        </td>
        <td>
          <span class="log-badge ${badge.class}">${badge.label}</span>
        </td>
        <td style="font-size: 13px; color: var(--text-main);">
          ${escapeHtml(l.details)}
        </td>
        <td class="text-center">
          <span style="display: inline-block; font-size: 11px; font-weight: 600; color: #16a34a; background: rgba(22, 163, 74, 0.1); padding: 2px 8px; border-radius: 9999px;">
            ✓ ${escapeHtml(l.status || 'OK')}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// 4. THEME MANAGEMENT (DARK / LIGHT)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('shop_admin_theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('shop_admin_theme', theme);

  const iconEl = document.getElementById('themeIcon');
  const textEl = document.getElementById('themeText');

  if (theme === 'dark') {
    if (iconEl) {
      iconEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    }
    if (textEl) textEl.textContent = 'Light Mode';
  } else {
    if (iconEl) {
      iconEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
    if (textEl) textEl.textContent = 'Dark Mode';
  }

  // Refresh charts to adapt grid and legend colors
  if (state.currentView === 'dashboard') {
    loadCharts();
  }
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

// Mobile sidebar drawer
function toggleMobileSidebar(forceState) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !backdrop) return;

  const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-open');
  sidebar.classList.toggle('mobile-open', isOpen);
  backdrop.classList.toggle('active', isOpen);
}

// ==========================================
// 5. VIEW ROUTING (SINGLE-PAGE APP)
// ==========================================
function switchView(viewName) {
  state.currentView = viewName;

  // Close mobile sidebar if open
  toggleMobileSidebar(false);

  // Update navigation items
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-view') === viewName);
  });

  // Update active view section
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSection = document.getElementById(`view-${viewName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Update page title
  const titles = {
    'dashboard': 'Dashboard Overview',
    'products': 'Product Catalog Management',
    'customers': 'Customer Directory',
    'orders': 'Customer Orders',
    'place-order': 'Create Order (ACID Transaction)',
    'payments': 'Payment Records & Settlement',
    'user-dashboard': 'User Dashboard (Shopper Portal)',
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';

  // Load view data
  switch (viewName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'products':
      loadCategories().then(() => loadProducts());
      break;
    case 'customers':
      loadCustomers();
      break;
    case 'orders':
      loadOrders();
      break;
    case 'place-order':
      initPlaceOrderView();
      break;
    case 'payments':
      loadPayments();
      break;
    case 'user-dashboard':
      loadUserDashboard();
      break;
  }
}

// ==========================================
// 6. DASHBOARD & CHARTS (Chart.js)
// ==========================================
async function loadDashboard() {
  updateUserSessionUI();
  await Promise.all([loadStats(), loadCharts(), loadRecentOrders()]);
  renderUserActivityLogs();
}

async function loadStats() {
  try {
    const stats = await api('/stats');
    document.getElementById('statCustomers').textContent = stats.total_customers ?? 0;
    document.getElementById('statProducts').textContent = stats.total_products ?? 0;
    document.getElementById('statOrders').textContent = stats.total_orders ?? 0;
    document.getElementById('statRevenue').textContent = formatCurrency(stats.total_revenue ?? 0);

    const pendingCount = stats.pending_payments ?? 0;
    const pendingEl = document.getElementById('statPendingPayments');
    if (pendingEl) {
      pendingEl.textContent = `${pendingCount} Pending Payment${pendingCount === 1 ? '' : 's'}`;
    }
  } catch (err) {
    showToast('Failed to load dashboard statistics: ' + err.message, 'error');
  }
}

async function loadCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  // Common chart defaults
  Chart.defaults.color = textColor;
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  try {
    // 1. Revenue by Category (Doughnut)
    const revCategoryData = await api('/charts/revenue-by-category');
    renderRevenueCategoryChart(revCategoryData);

    // 2. Top 5 Products (Horizontal Bar)
    const topProductsData = await api('/charts/top-products');
    renderTopProductsChart(topProductsData, textColor, gridColor);

    // 3. Orders by Status (Pie)
    const orderStatusData = await api('/charts/orders-by-status');
    renderOrderStatusChart(orderStatusData);

    // 4. Customer Spending (Bar)
    const spendingData = await api('/charts/customer-spending');
    renderCustomerSpendingChart(spendingData, textColor, gridColor);
  } catch (err) {
    console.error('Error rendering charts:', err);
  }
}

function renderRevenueCategoryChart(data) {
  const ctx = document.getElementById('chartRevenueCategory');
  if (!ctx) return;

  if (state.charts.revenueCategory) {
    state.charts.revenueCategory.destroy();
  }

  const labels = data.map(d => d.category_name);
  const values = data.map(d => Number(d.revenue) || 0);

  const colors = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'
  ];

  state.charts.revenueCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#151e32' : '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${formatCurrency(item.raw)}`
          }
        }
      },
      cutout: '65%'
    }
  });
}

function renderTopProductsChart(data, textColor, gridColor) {
  const ctx = document.getElementById('chartTopProducts');
  if (!ctx) return;

  if (state.charts.topProducts) {
    state.charts.topProducts.destroy();
  }

  const labels = data.map(d => d.product_name);
  const values = data.map(d => Number(d.total_sold) || 0);

  state.charts.topProducts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Units Sold',
        data: values,
        backgroundColor: '#6366f1',
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, precision: 0 }
        },
        y: {
          grid: { display: false },
          ticks: { color: textColor }
        }
      }
    }
  });
}

function renderOrderStatusChart(data) {
  const ctx = document.getElementById('chartOrderStatus');
  if (!ctx) return;

  if (state.charts.orderStatus) {
    state.charts.orderStatus.destroy();
  }

  const labels = data.map(d => d.status);
  const values = data.map(d => Number(d.count) || 0);

  const statusColors = {
    'Placed': '#3b82f6',
    'Shipped': '#8b5cf6',
    'Delivered': '#10b981',
    'Cancelled': '#ef4444'
  };

  const bgColors = labels.map(status => statusColors[status] || '#64748b');

  state.charts.orderStatus = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#151e32' : '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function renderCustomerSpendingChart(data, textColor, gridColor) {
  const ctx = document.getElementById('chartCustomerSpending');
  if (!ctx) return;

  if (state.charts.customerSpending) {
    state.charts.customerSpending.destroy();
  }

  const labels = data.map(d => d.name);
  const values = data.map(d => Number(d.total_spent) || 0);

  state.charts.customerSpending = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Spent',
        data: values,
        backgroundColor: '#06b6d4',
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` Total Spent: ${formatCurrency(item.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (v) => '₹' + v
          }
        }
      }
    }
  });
}

async function loadRecentOrders() {
  const tbody = document.getElementById('recentOrdersTableBody');
  if (!tbody) return;

  try {
    const orders = await api('/orders');
    const recent = orders.slice(0, 5);

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center empty-state">No orders placed yet</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(o => `
      <tr class="clickable" onclick="viewOrderDetails(${o.order_id})">
        <td class="tabular-nums" style="font-weight: 600;">#${o.order_id}</td>
        <td>${escapeHtml(o.customer)}</td>
        <td>${formatDate(o.order_date)}</td>
        <td><span class="badge badge-${o.status.toLowerCase()}">${escapeHtml(o.status)}</span></td>
        <td class="text-right tabular-nums font-semibold">${formatCurrency(o.order_total)}</td>
        <td><span class="badge badge-${o.payment_status === 'Paid' ? 'paid' : 'pending-pay'}">${escapeHtml(o.payment_status || 'Pending')}</span></td>
        <td class="text-center">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewOrderDetails(${o.order_id})">
            Details
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 20px;">Failed to load recent orders: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ==========================================
// 7. PRODUCTS (CRUD + SEARCH & FILTER)
// ==========================================
async function loadCategories() {
  try {
    const categories = await api('/categories');
    state.categories = categories;

    // Populate category dropdown in product table filter
    const filterSelect = document.getElementById('productCategoryFilter');
    if (filterSelect) {
      const currentVal = filterSelect.value;
      filterSelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join('');
      filterSelect.value = currentVal;
    }

    // Populate modal select
    const modalSelect = document.getElementById('productCategory');
    if (modalSelect) {
      modalSelect.innerHTML = '<option value="">-- Select Category --</option>' +
        categories.map(c => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

let productFilterDebounce = null;
function handleProductFilter() {
  clearTimeout(productFilterDebounce);
  productFilterDebounce = setTimeout(() => {
    loadProducts();
  }, 250);
}

async function loadProducts() {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  const search = document.getElementById('productSearchInput')?.value.trim() || '';
  const categoryId = document.getElementById('productCategoryFilter')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (categoryId) params.append('category_id', categoryId);

  const queryString = params.toString() ? `?${params.toString()}` : '';

  try {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 28px;"><div class="spinner"></div></td></tr>`;
    const products = await api(`/products${queryString}`);
    state.products = products;

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-title">No products found</div>
            <div class="empty-state-desc">Try clearing search filters or add a new product.</div>
            <button class="btn btn-primary btn-sm" onclick="openProductModal()">+ Add Product</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const isLowStock = p.stock_qty < 50;
      return `
        <tr>
          <td class="tabular-nums" style="font-weight: 600;">#${p.product_id}</td>
          <td style="font-weight: 500;">${escapeHtml(p.product_name)}</td>
          <td><span style="color: var(--text-secondary);">${escapeHtml(p.category_name || '-')}</span></td>
          <td class="text-right tabular-nums font-semibold">${formatCurrency(p.price)}</td>
          <td class="text-right tabular-nums">${p.stock_qty}</td>
          <td>
            ${isLowStock
              ? `<span class="badge badge-low-stock">Low Stock (${p.stock_qty} left)</span>`
              : `<span class="badge badge-paid">In Stock</span>`
            }
          </td>
          <td class="text-center">
            <div style="display: flex; gap: 8px; justify-content: center;">
              <button class="btn btn-secondary btn-sm" onclick="editProduct(${p.product_id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="confirmDeleteProduct(${p.product_id}, '${escapeHtml(p.product_name)}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 20px;">Failed to load products: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openProductModal(product = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');
  const idInput = document.getElementById('productId');
  const nameInput = document.getElementById('productName');
  const categorySelect = document.getElementById('productCategory');
  const priceInput = document.getElementById('productPrice');
  const stockInput = document.getElementById('productStock');

  if (product) {
    title.textContent = 'Edit Product';
    idInput.value = product.product_id;
    nameInput.value = product.product_name;
    categorySelect.value = product.category_id;
    priceInput.value = product.price;
    stockInput.value = product.stock_qty;
  } else {
    title.textContent = 'Add Product';
    idInput.value = '';
    nameInput.value = '';
    categorySelect.value = state.categories.length > 0 ? state.categories[0].category_id : '';
    priceInput.value = '';
    stockInput.value = '100';
  }

  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.remove('active');
}

function editProduct(productId) {
  const product = state.products.find(p => p.product_id === productId);
  if (product) openProductModal(product);
}

async function handleProductSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const category_id = parseInt(document.getElementById('productCategory').value, 10);
  const price = parseFloat(document.getElementById('productPrice').value);
  const stock_qty = parseInt(document.getElementById('productStock').value, 10);

  // Client Validation
  if (!name) return showToast('Product name is required', 'error');
  if (isNaN(category_id)) return showToast('Please select a category', 'error');
  if (isNaN(price) || price <= 0) return showToast('Price must be greater than 0', 'error');
  if (isNaN(stock_qty) || stock_qty < 0) return showToast('Stock quantity cannot be negative', 'error');

  const payload = {
    product_name: name,
    category_id,
    price,
    stock_qty
  };

  try {
    if (id) {
      await api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast(`Product #${id} updated successfully!`);
      logUserActivity('PRODUCT', `Updated Product #${id} ("${name}" - Price: ₹${price}, Stock: ${stock_qty})`);
    } else {
      await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Product added successfully!');
      logUserActivity('PRODUCT', `Added new Product "${name}" (Price: ₹${price}, Stock: ${stock_qty})`);
    }

    closeProductModal();
    loadProducts();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmDeleteProduct(id, name) {
  openConfirmModal(
    'Delete Product',
    `Are you sure you want to delete product "${name}" (ID #${id})? This cannot be undone.`,
    async () => {
      try {
        await api(`/products/${id}`, { method: 'DELETE' });
        showToast('Product deleted successfully');
        logUserActivity('PRODUCT', `Deleted Product #${id} ("${name}") from inventory`);
        loadProducts();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// ==========================================
// 8. CUSTOMERS (CRUD + VALIDATION)
// ==========================================
let customerFilterDebounce = null;
function handleCustomerFilter() {
  clearTimeout(customerFilterDebounce);
  customerFilterDebounce = setTimeout(() => {
    loadCustomers();
  }, 250);
}

async function loadCustomers() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  const search = document.getElementById('customerSearchInput')?.value.trim().toLowerCase() || '';

  try {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 28px;"><div class="spinner"></div></td></tr>`;
    const customers = await api('/customers');
    state.customers = customers;

    const filtered = search
      ? customers.filter(c =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.city.toLowerCase().includes(search)
        )
      : customers;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-title">No customers found</div>
            <button class="btn btn-primary btn-sm" onclick="openCustomerModal()">+ Add Customer</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => `
      <tr>
        <td class="tabular-nums" style="font-weight: 600;">#${c.customer_id}</td>
        <td style="font-weight: 500;">${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td class="tabular-nums">${escapeHtml(c.phone || '-')}</td>
        <td>${escapeHtml(c.address || '-')}</td>
        <td>${escapeHtml(c.city || '-')}</td>
        <td class="text-center">
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button class="btn btn-secondary btn-sm" onclick="editCustomer(${c.customer_id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteCustomer(${c.customer_id}, '${escapeHtml(c.name)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 20px;">Failed to load customers: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openCustomerModal(customer = null) {
  const modal = document.getElementById('customerModal');
  const title = document.getElementById('customerModalTitle');
  const idInput = document.getElementById('customerId');
  const nameInput = document.getElementById('customerName');
  const emailInput = document.getElementById('customerEmail');
  const phoneInput = document.getElementById('customerPhone');
  const addrInput = document.getElementById('customerAddress');
  const cityInput = document.getElementById('customerCity');

  if (customer) {
    title.textContent = 'Edit Customer';
    idInput.value = customer.customer_id;
    nameInput.value = customer.name;
    emailInput.value = customer.email;
    phoneInput.value = customer.phone || '';
    addrInput.value = customer.address || '';
    cityInput.value = customer.city || '';
  } else {
    title.textContent = 'Add Customer';
    idInput.value = '';
    nameInput.value = '';
    emailInput.value = '';
    phoneInput.value = '';
    addrInput.value = '';
    cityInput.value = '';
  }

  modal.classList.add('active');
}

function closeCustomerModal() {
  document.getElementById('customerModal')?.classList.remove('active');
}

function editCustomer(customerId) {
  const customer = state.customers.find(c => c.customer_id === customerId);
  if (customer) openCustomerModal(customer);
}

async function handleCustomerSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('customerId').value;
  const name = document.getElementById('customerName').value.trim();
  const email = document.getElementById('customerEmail').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('customerAddress').value.trim();
  const city = document.getElementById('customerCity').value.trim();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name) return showToast('Customer name is required', 'error');
  if (!emailRegex.test(email)) return showToast('Please enter a valid email address', 'error');

  const payload = { name, email, phone, address, city };

  try {
    if (id) {
      await api(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast(`Customer #${id} updated successfully!`);
      logUserActivity('CUSTOMER', `Updated customer profile for "${name}" (${email})`);
    } else {
      await api('/customers', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Customer added successfully!');
      logUserActivity('CUSTOMER', `Registered new customer "${name}" (${email})`);
    }

    closeCustomerModal();
    loadCustomers();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmDeleteCustomer(id, name) {
  openConfirmModal(
    'Delete Customer',
    `Are you sure you want to delete customer "${name}" (ID #${id})? Note: Customers with existing orders cannot be deleted.`,
    async () => {
      try {
        await api(`/customers/${id}`, { method: 'DELETE' });
        showToast('Customer deleted successfully');
        logUserActivity('CUSTOMER', `Deleted customer #${id} ("${name}")`);
        loadCustomers();
        loadStats();
      } catch (err) {
        // Displays friendly error if child record exists (ORA-02292)
        showToast(err.message, 'error');
      }
    }
  );
}

// ==========================================
// 9. ORDERS & DETAILS SIDE PANEL
// ==========================================
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  const statusFilter = document.getElementById('orderStatusFilter')?.value || '';
  const queryString = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';

  try {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 28px;"><div class="spinner"></div></td></tr>`;
    const orders = await api(`/orders${queryString}`);
    state.orders = orders;

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-title">No orders found</div>
            <div class="empty-state-desc">Try clearing status filter or place a new order.</div>
            <button class="btn btn-primary btn-sm" onclick="switchView('place-order')">+ Place New Order</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr class="clickable" onclick="viewOrderDetails(${o.order_id})">
        <td class="tabular-nums" style="font-weight: 600;">#${o.order_id}</td>
        <td style="font-weight: 500;">${escapeHtml(o.customer)}</td>
        <td>${formatDate(o.order_date)}</td>
        <td>
          <span class="badge badge-${o.status.toLowerCase()}">${escapeHtml(o.status)}</span>
        </td>
        <td class="text-right tabular-nums font-semibold">${formatCurrency(o.order_total)}</td>
        <td>
          <span class="badge badge-${o.payment_status === 'Paid' ? 'paid' : 'pending-pay'}">
            ${escapeHtml(o.payment_status || 'Pending')}
          </span>
        </td>
        <td class="text-center" onclick="event.stopPropagation()">
          <select class="select-control" style="padding: 4px 8px; font-size: 12px;" onchange="updateOrderStatus(${o.order_id}, this.value)">
            <option value="Placed" ${o.status === 'Placed' ? 'selected' : ''}>Placed</option>
            <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          </select>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 20px;">Failed to load orders: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    await api(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    showToast(`Order #${orderId} marked as ${newStatus}`);
    logUserActivity('STATUS', `Updated Order #${orderId} fulfillment status to "${newStatus}"`);
    if (state.currentView === 'orders') loadOrders();
    if (state.currentView === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(`Failed to update status: ${err.message}`, 'error');
  }
}

async function viewOrderDetails(orderId) {
  const modal = document.getElementById('orderDetailsModal');
  const body = document.getElementById('orderDetailsBody');
  const title = document.getElementById('orderDetailsTitle');

  title.textContent = `Order Details #${orderId}`;
  body.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <span>Fetching order items and payment...</span>
    </div>
  `;
  modal.classList.add('active');

  try {
    const data = await api(`/orders/${orderId}`);
    const order = data.order || data;
    const items = data.items || [];
    const payment = data.payment || {};

    const itemsRows = items.map(item => `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(item.product_name)}</td>
        <td class="text-right tabular-nums">${item.quantity}</td>
        <td class="text-right tabular-nums">${formatCurrency(item.unit_price)}</td>
        <td class="text-right tabular-nums font-semibold">${formatCurrency(item.quantity * item.unit_price)}</td>
      </tr>
    `).join('');

    body.innerHTML = `
      <div class="order-summary-box">
        <div class="order-summary-item">
          <span class="label">Customer</span>
          <span class="val">${escapeHtml(order.customer_name || order.customer)}</span>
        </div>
        <div class="order-summary-item">
          <span class="label">Customer Email</span>
          <span class="val">${escapeHtml(order.customer_email || '-')}</span>
        </div>
        <div class="order-summary-item">
          <span class="label">Order Date</span>
          <span class="val">${formatDate(order.order_date)}</span>
        </div>
        <div class="order-summary-item">
          <span class="label">Status</span>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span class="badge badge-${(order.status || 'placed').toLowerCase()}">${escapeHtml(order.status)}</span>
            <select class="select-control" style="padding: 2px 6px; font-size: 11px;" onchange="updateOrderStatus(${order.order_id}, this.value).then(() => viewOrderDetails(${order.order_id}))">
              <option value="Placed" ${order.status === 'Placed' ? 'selected' : ''}>Placed</option>
              <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            </select>
          </div>
        </div>
        <div class="order-summary-item">
          <span class="label">Payment Method</span>
          <span class="val">${escapeHtml(payment.payment_method || order.payment_method || 'COD')}</span>
        </div>
        <div class="order-summary-item">
          <span class="label">Payment Status</span>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span class="badge badge-${(payment.payment_status || order.payment_status) === 'Paid' ? 'paid' : 'pending-pay'}">
              ${escapeHtml(payment.payment_status || order.payment_status || 'Pending')}
            </span>
            ${(payment.payment_status || order.payment_status) !== 'Paid' ? `
              <button class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size: 11px;" onclick="markPaymentPaid(${order.order_id}).then(() => viewOrderDetails(${order.order_id}))">
                Mark Paid
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">Purchased Items</h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || '<tr><td colspan="4" class="text-center">No line items</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3" class="text-right">Grand Total:</th>
              <th class="text-right tabular-nums" style="font-size: 15px; color: var(--primary);">
                ${formatCurrency(order.order_total || payment.amount || 0)}
              </th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="text-center text-danger" style="padding: 24px;">Failed to load order: ${escapeHtml(err.message)}</div>`;
  }
}

function closeOrderDetailsModal() {
  document.getElementById('orderDetailsModal')?.classList.remove('active');
}

// ==========================================
// 10. PLACE NEW ORDER (ACID TRANSACTION)
// ==========================================
async function initPlaceOrderView() {
  try {
    // Load fresh customers and products
    const [customers, products] = await Promise.all([
      api('/customers'),
      api('/products')
    ]);

    state.customers = customers;
    state.products = products;

    // Populate customer select
    const customerSelect = document.getElementById('orderCustomerSelect');
    customerSelect.innerHTML = '<option value="">-- Choose Customer --</option>' +
      customers.map(c => `<option value="${c.customer_id}">${escapeHtml(c.name)} (${escapeHtml(c.city || c.email)})</option>`).join('');

    // Clear dynamic rows and add first row
    const container = document.getElementById('orderItemsContainer');
    container.innerHTML = '';
    addOrderItemRow();

    updateOrderSummary();
  } catch (err) {
    showToast('Failed to initialize order form: ' + err.message, 'error');
  }
}

function addOrderItemRow() {
  const container = document.getElementById('orderItemsContainer');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'order-item-row';

  // Build product options
  const productOptions = state.products.map(p => `
    <option value="${p.product_id}" data-price="${p.price}" data-stock="${p.stock_qty}">
      ${escapeHtml(p.product_name)} - ₹${p.price} (${p.stock_qty} in stock)
    </option>
  `).join('');

  row.innerHTML = `
    <div>
      <select class="form-control item-product-select" onchange="handleProductSelectChange(this)" required>
        <option value="">-- Select Product --</option>
        ${productOptions}
      </select>
    </div>
    <div>
      <input type="number" class="form-control item-quantity-input" min="1" value="1" oninput="handleQuantityChange(this)" required />
    </div>
    <div class="text-right">
      <span class="tabular-nums font-semibold item-line-total">₹0.00</span>
    </div>
    <div class="text-center">
      <button type="button" class="btn btn-secondary btn-icon" onclick="removeOrderItemRow(this)" title="Remove item">
        ✕
      </button>
    </div>
  `;

  container.appendChild(row);
  updateOrderSummary();
}

function removeOrderItemRow(button) {
  const container = document.getElementById('orderItemsContainer');
  const rows = container.querySelectorAll('.order-item-row');
  if (rows.length <= 1) {
    showToast('An order must have at least one product row', 'error');
    return;
  }
  button.closest('.order-item-row').remove();
  updateOrderSummary();
}

function handleProductSelectChange(select) {
  const row = select.closest('.order-item-row');
  const selectedOption = select.options[select.selectedIndex];
  const maxStock = parseInt(selectedOption.getAttribute('data-stock') || '0', 10);
  const qtyInput = row.querySelector('.item-quantity-input');

  if (maxStock <= 0) {
    showToast('Warning: This product is currently out of stock!', 'error');
  }

  qtyInput.max = maxStock > 0 ? maxStock : 1;
  handleQuantityChange(qtyInput);
}

function handleQuantityChange(input) {
  const row = input.closest('.order-item-row');
  const select = row.querySelector('.item-product-select');
  const selectedOption = select.options[select.selectedIndex];
  const price = parseFloat(selectedOption.getAttribute('data-price') || '0');
  const qty = parseInt(input.value, 10) || 0;

  const lineTotal = price * qty;
  row.querySelector('.item-line-total').textContent = formatCurrency(lineTotal);
  updateOrderSummary();
}

function updateOrderSummary() {
  const rows = document.querySelectorAll('#orderItemsContainer .order-item-row');
  let totalUnits = 0;
  let subtotal = 0;
  let validItemsCount = 0;

  rows.forEach(row => {
    const select = row.querySelector('.item-product-select');
    const qtyInput = row.querySelector('.item-quantity-input');

    if (select.value) {
      validItemsCount++;
      const option = select.options[select.selectedIndex];
      const price = parseFloat(option.getAttribute('data-price') || '0');
      const qty = parseInt(qtyInput.value, 10) || 0;

      totalUnits += qty;
      subtotal += (price * qty);
    }
  });

  document.getElementById('summaryItemCount').textContent = validItemsCount;
  document.getElementById('summaryUnitCount').textContent = totalUnits;
  document.getElementById('summarySubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('summaryGrandTotal').textContent = formatCurrency(subtotal);
}

async function handlePlaceOrder(event) {
  event.preventDefault();

  const customerId = parseInt(document.getElementById('orderCustomerSelect').value, 10);
  const paymentMethod = document.getElementById('orderPaymentMethod').value;
  const rows = document.querySelectorAll('#orderItemsContainer .order-item-row');

  if (!customerId) {
    return showToast('Please select a customer', 'error');
  }

  const items = [];
  const chosenProducts = new Set();

  for (const row of rows) {
    const select = row.querySelector('.item-product-select');
    const qtyInput = row.querySelector('.item-quantity-input');
    const productId = parseInt(select.value, 10);
    const quantity = parseInt(qtyInput.value, 10);

    if (!productId) {
      return showToast('Please select a product for all rows or remove unused rows', 'error');
    }

    if (chosenProducts.has(productId)) {
      return showToast('Duplicate product selected. Please adjust quantity on the first row instead.', 'error');
    }
    chosenProducts.add(productId);

    if (isNaN(quantity) || quantity <= 0) {
      return showToast('Quantity must be at least 1', 'error');
    }

    items.push({ product_id: productId, quantity });
  }

  if (items.length === 0) {
    return showToast('Please add at least one item to place order', 'error');
  }

  const submitBtn = document.getElementById('submitOrderBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Executing ACID Transaction...';

  try {
    const result = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        payment_method: paymentMethod,
        items,
      }),
    });

    showToast(`Order #${result.order_id} successfully created! Total: ${formatCurrency(result.order_total || result.total)}`);
    const cust = state.customers.find(c => c.customer_id === customerId);
    logUserActivity('ORDER', `Placed Order #${result.order_id} for ${cust ? cust.name : 'Customer #' + customerId} (Total: ${formatCurrency(result.order_total || result.total)}) via ${paymentMethod} under ACID transaction`);
    
    // Switch to orders view and highlight
    switchView('orders');
  } catch (err) {
    // Shows stock error or database constraint rejection
    showToast(`Transaction Failed: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit & Execute Transaction';
  }
}

// ==========================================
// 11. PAYMENTS (VIEW & SETTLEMENT)
// ==========================================
async function loadPayments() {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 28px;"><div class="spinner"></div></td></tr>`;
    const payments = await api('/payments');
    state.payments = payments;

    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No payment records found</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map(p => {
      const isPaid = p.payment_status === 'Paid';
      return `
        <tr>
          <td class="tabular-nums" style="font-weight: 600;">#${p.payment_id}</td>
          <td class="tabular-nums">#${p.order_id}</td>
          <td style="font-weight: 500;">${escapeHtml(p.customer_name || '-')}</td>
          <td>${escapeHtml(p.payment_method)}</td>
          <td>${formatDate(p.payment_date)}</td>
          <td class="text-right tabular-nums font-semibold">${formatCurrency(p.amount)}</td>
          <td>
            <span class="badge badge-${isPaid ? 'paid' : 'pending-pay'}">
              ${escapeHtml(p.payment_status)}
            </span>
          </td>
          <td class="text-center">
            ${!isPaid ? `
              <button class="btn btn-primary btn-sm" onclick="markPaymentPaid(${p.order_id})">
                Mark as Paid
              </button>
            ` : `
              <span style="font-size: 12px; color: var(--success); font-weight: 600;">Settled</span>
            `}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger" style="padding: 20px;">Failed to load payments: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function markPaymentPaid(orderId) {
  try {
    await api(`/payments/${orderId}`, {
      method: 'PUT',
    });
    showToast(`Payment for Order #${orderId} marked as Paid!`);
    logUserActivity('PAYMENT', `Settled payment for Order #${orderId} - marked as Paid`);
    loadPayments();
    if (state.currentView === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(`Payment update failed: ${err.message}`, 'error');
  }
}

// ==========================================
// 11B. USER DASHBOARD (SHOPPER PORTAL)
// ==========================================
async function loadUserDashboard() {
  try {
    if (!state.customers || state.customers.length === 0) {
      state.customers = await api('/customers');
    }
    if (!state.categories || state.categories.length === 0) {
      state.categories = await api('/categories');
    }
    if (!state.products || state.products.length === 0) {
      state.products = await api('/products');
    }

    // Populate Shopper Profile select
    const select = document.getElementById('shopperProfileSelect');
    if (select) {
      select.innerHTML = state.customers.map(c => `
        <option value="${c.customer_id}" ${c.customer_id === state.activeShopperId ? 'selected' : ''}>
          ${escapeHtml(c.name)} (${escapeHtml(c.city)})
        </option>
      `).join('');
    }

    // Update active customer header
    const currentCust = state.customers.find(c => c.customer_id === state.activeShopperId) || state.customers[0];
    if (currentCust) {
      state.activeShopperId = currentCust.customer_id;
      const initials = currentCust.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CU';
      
      const avatarEl = document.getElementById('shopperAvatarBadge');
      const nameEl = document.getElementById('shopperNameText');
      const contactEl = document.getElementById('shopperContactText');
      const addrEl = document.getElementById('shopperDeliveryAddressPreview');

      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl) nameEl.textContent = currentCust.name;
      if (contactEl) {
        contactEl.innerHTML = `
          <span>${escapeHtml(currentCust.email)}</span> • 
          <span>${escapeHtml(currentCust.phone || 'Phone verified')}</span> • 
          <span>${escapeHtml(currentCust.address || '')}, ${escapeHtml(currentCust.city)}</span>
        `;
      }
      if (addrEl) {
        addrEl.textContent = `${currentCust.address || 'Standard Address'}, ${currentCust.city}`;
      }
    }

    // Load orders for this customer and setup storefront catalog
    await Promise.all([
      loadShopperOrders(),
      loadShopperCatalog()
    ]);
  } catch (err) {
    showToast('Failed to load User Dashboard: ' + err.message, 'error');
  }
}

function handleShopperChange(newId) {
  saveShopperCart(state.activeShopperId, state.shopperCart);
  state.activeShopperId = parseInt(newId, 10);
  state.shopperCart = getShopperCart(state.activeShopperId);
  loadUserDashboard();
}

function getShopperCart(userId) {
  try {
    const raw = localStorage.getItem('shopper_cart_' + userId);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveShopperCart(userId, cart) {
  try {
    localStorage.setItem('shopper_cart_' + userId, JSON.stringify(cart || {}));
  } catch (e) {
    console.error(e);
  }
}

// ------------------------------------------
// MULTI-USER MODAL & REGISTRATION
// ------------------------------------------
function openMultiUserSwitchModal() {
  document.getElementById('multiUserSwitchModal')?.classList.add('active');
  renderMultiUserModalList();
}

function closeMultiUserSwitchModal() {
  document.getElementById('multiUserSwitchModal')?.classList.remove('active');
}

function filterMultiUserModalList() {
  renderMultiUserModalList();
}

function renderMultiUserModalList() {
  const container = document.getElementById('multiUserModalList');
  if (!container || !state.customers) return;

  const search = document.getElementById('multiUserModalSearch')?.value.trim().toLowerCase() || '';
  let customers = state.customers;
  if (search) {
    customers = customers.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (c.email && c.email.toLowerCase().includes(search)) ||
      (c.city && c.city.toLowerCase().includes(search))
    );
  }

  if (customers.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">No users found matching "${escapeHtml(search)}"</div>`;
    return;
  }

  container.innerHTML = customers.map(c => {
    const isCurrent = c.customer_id === state.activeShopperId;
    const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CU';
    const orderCount = (state.orders || []).filter(o => o.customer === c.name || o.customer_id === c.customer_id).length;

    return `
      <div class="multi-user-grid-item ${isCurrent ? 'active' : ''}" onclick="selectUserFromModal(${c.customer_id})">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="user-mini-avatar" style="width: 38px; height: 38px; font-size: 13px;">${escapeHtml(initials)}</div>
          <div>
            <div style="font-weight: 700; color: var(--text-main); font-size: 14px; display: flex; align-items: center; gap: 6px;">
              <span>${escapeHtml(c.name)}</span>
              ${isCurrent ? '<span style="font-size: 10px; background: rgba(37, 99, 235, 0.12); color: var(--primary); padding: 2px 6px; border-radius: 9999px;">Active</span>' : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              ${escapeHtml(c.email)} • ${escapeHtml(c.city)}
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--bg-card); padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            ${orderCount} Order${orderCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function selectUserFromModal(customerId) {
  handleShopperChange(customerId);
  closeMultiUserSwitchModal();
  const c = state.customers.find(item => item.customer_id === customerId);
  showToast(`Switched active session to ${c ? c.name : 'Customer #' + customerId}`);
}

function openRegisterShopperModal() {
  document.getElementById('registerShopperForm')?.reset();
  document.getElementById('registerShopperModal')?.classList.add('active');
}

function closeRegisterShopperModal() {
  document.getElementById('registerShopperModal')?.classList.remove('active');
}

async function handleRegisterShopperSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('regShopperName').value.trim();
  const email = document.getElementById('regShopperEmail').value.trim();
  const phone = document.getElementById('regShopperPhone').value.trim();
  const address = document.getElementById('regShopperAddress').value.trim();
  const city = document.getElementById('regShopperCity').value.trim();

  if (!name || !email) {
    showToast('Name and email are required', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitRegisterShopper');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Registering User...';
  }

  try {
    const newCust = await api('/customers', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, address, city })
    });

    state.customers.push(newCust);
    logUserActivity('CUSTOMER', `Registered new shopper account "${name}" (${email}, ${city}) for multi-user dashboard access`);
    showToast(`Welcome, ${name}! Your new shopper account is ready.`);
    
    closeRegisterShopperModal();
    handleShopperChange(newCust.customer_id);
  } catch (err) {
    showToast('Registration failed: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create Account & Log In';
    }
  }
}

function switchUserPortalTab(tab) {
  const btnTrack = document.getElementById('tabBtnTrackOrders');
  const btnShop = document.getElementById('tabBtnPlaceOrder');
  const contentTrack = document.getElementById('userTabContentTrack');
  const contentShop = document.getElementById('userTabContentShop');

  if (tab === 'track') {
    btnTrack?.classList.add('active');
    btnShop?.classList.remove('active');
    contentTrack?.classList.add('active');
    contentShop?.classList.remove('active');
    loadShopperOrders();
  } else {
    btnTrack?.classList.remove('active');
    btnShop?.classList.add('active');
    contentTrack?.classList.remove('active');
    contentShop?.classList.add('active');
    renderShopperCatalog();
    renderShopperCart();
  }
}

async function loadShopperOrders() {
  const container = document.getElementById('userOrdersListContainer');
  if (!container) return;

  try {
    container.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <span>Retrieving your order history & live tracking...</span>
      </div>
    `;

    const orders = await api(`/orders?customer_id=${state.activeShopperId}`);
    state.shopperOrders = orders;

    // Update metric counters
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.order_total) || 0), 0);
    const activeOrders = orders.filter(o => o.status === 'Placed' || o.status === 'Shipped').length;
    const pendingPay = orders.filter(o => o.payment_status === 'Pending').length;

    document.getElementById('shopperTotalOrdersVal').textContent = totalOrders;
    document.getElementById('shopperTotalSpentVal').textContent = formatCurrency(totalSpent);
    document.getElementById('shopperActiveOrdersVal').textContent = activeOrders;
    document.getElementById('shopperPendingPayVal').textContent = pendingPay;
    document.getElementById('userOrdersCountBadge').textContent = totalOrders;

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <div style="font-size: 36px; margin-bottom: 8px;">🛍️</div>
          <div class="empty-state-title" style="font-size: 16px;">No Orders Placed Yet</div>
          <div class="empty-state-desc" style="margin-bottom: 16px;">
            You haven't placed any orders under this customer account. Browse our catalog and experience atomic ACID checkout!
          </div>
          <button class="btn btn-primary" onclick="switchUserPortalTab('shop')">
            Browse Catalog & Place Order
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(o => {
      const isDelivered = o.status === 'Delivered';
      const isShipped = o.status === 'Shipped';
      const isPlaced = o.status === 'Placed';
      const isCancelled = o.status === 'Cancelled';
      const isPaid = o.payment_status === 'Paid';

      // Stepper progress line fill %
      let fillWidth = '0%';
      if (isDelivered) fillWidth = '100%';
      else if (isShipped) fillWidth = '66%';
      else if (isPlaced) fillWidth = '33%';

      return `
        <div class="order-tracking-card">
          <!-- Card Header -->
          <div class="order-track-header">
            <div>
              <div class="order-track-id">Order #${o.order_id}</div>
              <div class="order-track-meta">
                Placed on ${formatDate(o.order_date)} • Payment via ${escapeHtml(o.payment_method || 'UPI')}
              </div>
            </div>
            <div class="order-track-badges">
              <span class="badge badge-${o.status.toLowerCase()}">${escapeHtml(o.status)}</span>
              <span class="badge badge-${isPaid ? 'paid' : 'pending-pay'}">
                ${isPaid ? '✓ Paid' : '● Payment Pending'}
              </span>
            </div>
          </div>

          <!-- Visual Tracking Stepper -->
          <div class="tracking-stepper-box">
            <div class="tracking-stepper">
              <div class="tracking-stepper-line">
                <div class="tracking-stepper-line-fill" style="width: ${fillWidth};"></div>
              </div>

              <!-- Step 1: Placed -->
              <div class="tracking-step ${isPlaced || isShipped || isDelivered ? 'completed' : ''}">
                <div class="step-node">${isPlaced || isShipped || isDelivered ? '✓' : '1'}</div>
                <div class="step-label">Order Placed</div>
                <div class="step-subtext">Received in DB</div>
              </div>

              <!-- Step 2: Processing & Packed -->
              <div class="tracking-step ${isShipped || isDelivered ? 'completed' : (isPlaced ? 'active' : '')}">
                <div class="step-node">${isShipped || isDelivered ? '✓' : '2'}</div>
                <div class="step-label">Processing</div>
                <div class="step-subtext">Inventory Deducted</div>
              </div>

              <!-- Step 3: In Transit / Shipped -->
              <div class="tracking-step ${isDelivered ? 'completed' : (isShipped ? 'active' : '')}">
                <div class="step-node">${isDelivered ? '✓' : (isShipped ? '🚚' : '3')}</div>
                <div class="step-label">Dispatched</div>
                <div class="step-subtext">On The Way</div>
              </div>

              <!-- Step 4: Delivered -->
              <div class="tracking-step ${isDelivered ? 'completed' : ''}">
                <div class="step-node">${isDelivered ? '✓' : '4'}</div>
                <div class="step-label">Delivered</div>
                <div class="step-subtext">${isDelivered ? 'Handed Over' : 'Pending'}</div>
              </div>
            </div>
          </div>

          <!-- Order Card Footer & Actions -->
          <div class="order-track-footer">
            <div>
              <span style="font-size: 12px; color: var(--text-muted);">Total Order Amount:</span>
              <span class="order-track-total-val tabular-nums">${formatCurrency(o.order_total)}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              ${!isPaid ? `
                <button class="btn btn-primary btn-sm" onclick="payShopperOrder(${o.order_id}, ${o.order_total})" title="Instant settlement via UPI">
                  💳 Pay Now (₹${Number(o.order_total).toLocaleString('en-IN')})
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="viewOrderDetails(${o.order_id})">
                View Order Receipt & Items
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-danger text-center" style="padding: 24px;">Failed to load order tracking: ${escapeHtml(err.message)}</div>`;
  }
}

async function payShopperOrder(orderId, amount) {
  try {
    await api(`/payments/${orderId}`, { method: 'PUT' });
    showToast(`Payment of ₹${Number(amount).toLocaleString('en-IN')} marked as Paid!`);
    const currentCust = state.customers.find(c => c.customer_id === state.activeShopperId);
    logUserActivity('PAYMENT', `Shopper ${currentCust ? currentCust.name : 'Customer'} settled payment for Order #${orderId} (Amount: ₹${Number(amount).toLocaleString('en-IN')})`);
    loadShopperOrders();
  } catch (err) {
    showToast(`Payment failed: ${err.message}`, 'error');
  }
}

// ------------------------------------------
// SHOPPER CATALOG & ONE-CLICK CHECKOUT
// ------------------------------------------
async function loadShopperCatalog() {
  const catSelect = document.getElementById('shopperCatalogCatFilter');
  if (catSelect && state.categories) {
    const current = catSelect.value;
    catSelect.innerHTML = '<option value="">All Categories</option>' +
      state.categories.map(c => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join('');
    catSelect.value = current;
  }
  renderShopperCatalog();
  renderShopperCart();
}

function filterShopperCatalog() {
  renderShopperCatalog();
}

function renderShopperCatalog() {
  const grid = document.getElementById('shopperProductsGrid');
  if (!grid || !state.products) return;

  const search = document.getElementById('shopperCatalogSearch')?.value.trim().toLowerCase() || '';
  const catId = document.getElementById('shopperCatalogCatFilter')?.value || '';

  let list = state.products;
  if (catId) {
    list = list.filter(p => String(p.category_id) === String(catId));
  }
  if (search) {
    list = list.filter(p => 
      p.product_name.toLowerCase().includes(search) || 
      (p.category_name && p.category_name.toLowerCase().includes(search))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        No matching products found in catalog.
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(p => {
    const isOut = p.stock_qty <= 0;
    const isLow = p.stock_qty < 50;

    return `
      <div class="shopper-product-card">
        <div>
          <div class="shopper-product-cat">${escapeHtml(p.category_name || 'Electronics')}</div>
          <div class="shopper-product-title">${escapeHtml(p.product_name)}</div>
          <div class="shopper-product-price tabular-nums">${formatCurrency(p.price)}</div>
          <div class="shopper-stock-pill ${isLow ? 'low' : ''}">
            ${isOut ? '● Out of Stock' : (isLow ? `⚠ Only ${p.stock_qty} left` : `✓ In Stock (${p.stock_qty})`)}
          </div>
        </div>

        <div class="shopper-card-actions">
          <div style="display: flex; align-items: center; gap: 4px;">
            <button type="button" class="qty-control-btn" onclick="adjustShopperPickerQty(${p.product_id}, -1)">-</button>
            <span class="qty-display-box tabular-nums" id="shopperPickerQty_${p.product_id}">1</span>
            <button type="button" class="qty-control-btn" onclick="adjustShopperPickerQty(${p.product_id}, 1)">+</button>
          </div>
          <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="addShopperProductToCart(${p.product_id})" ${isOut ? 'disabled' : ''}>
            ${isOut ? 'Out of Stock' : '+ Add to Bag'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function adjustShopperPickerQty(productId, delta) {
  const el = document.getElementById(`shopperPickerQty_${productId}`);
  if (!el) return;
  let cur = parseInt(el.textContent, 10) || 1;
  cur = Math.max(1, cur + delta);
  el.textContent = cur;
}

function addShopperProductToCart(productId) {
  const prod = state.products.find(p => p.product_id === productId);
  if (!prod) return;

  const qtyEl = document.getElementById(`shopperPickerQty_${productId}`);
  const qtyToAdd = qtyEl ? (parseInt(qtyEl.textContent, 10) || 1) : 1;

  const currentInCart = state.shopperCart[productId] || 0;
  if (currentInCart + qtyToAdd > prod.stock_qty) {
    showToast(`Cannot add more: only ${prod.stock_qty} available in inventory`, 'error');
    return;
  }

  state.shopperCart[productId] = currentInCart + qtyToAdd;
  renderShopperCart();
  showToast(`Added ${qtyToAdd}x "${prod.product_name}" to shopping bag!`);
}

function updateShopperCartItemQty(productId, newQty) {
  if (newQty <= 0) {
    delete state.shopperCart[productId];
  } else {
    const prod = state.products.find(p => p.product_id === productId);
    if (prod && newQty > prod.stock_qty) {
      showToast(`Only ${prod.stock_qty} items available in inventory`, 'error');
      state.shopperCart[productId] = prod.stock_qty;
    } else {
      state.shopperCart[productId] = newQty;
    }
  }
  renderShopperCart();
}

function clearShopperCart() {
  state.shopperCart = {};
  renderShopperCart();
}

function renderShopperCart() {
  const container = document.getElementById('shopperCartItemsList');
  const countEl = document.getElementById('shopperCartCountText');
  const totalEl = document.getElementById('shopperCartTotalText');
  const checkoutBtn = document.getElementById('btnShopperPlaceOrder');

  const pids = Object.keys(state.shopperCart).map(Number);

  if (pids.length === 0) {
    if (container) {
      container.innerHTML = `<div class="empty-cart-msg">Your shopping bag is empty.<br>Select items from catalog to place an order.</div>`;
    }
    if (countEl) countEl.textContent = '0';
    if (totalEl) totalEl.textContent = '₹0.00';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  let totalItems = 0;
  let totalAmount = 0;

  container.innerHTML = pids.map(pid => {
    const prod = state.products.find(p => p.product_id === pid);
    if (!prod) return '';

    const qty = state.shopperCart[pid];
    const lineTotal = prod.price * qty;
    totalItems += qty;
    totalAmount += lineTotal;

    return `
      <div class="shopper-cart-item-row">
        <div style="flex: 1; padding-right: 8px;">
          <div style="font-weight: 600; color: var(--text-main); font-size: 12px;">${escapeHtml(prod.product_name)}</div>
          <div style="color: var(--text-muted); font-size: 11px;">₹${prod.price} × ${qty} = ${formatCurrency(lineTotal)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="qty-control-btn" style="width: 22px; height: 22px; font-size: 11px;" onclick="updateShopperCartItemQty(${pid}, ${qty - 1})">-</button>
          <span style="font-size: 12px; font-weight: 600; min-width: 18px; text-align: center;">${qty}</span>
          <button type="button" class="qty-control-btn" style="width: 22px; height: 22px; font-size: 11px;" onclick="updateShopperCartItemQty(${pid}, ${qty + 1})">+</button>
          <button type="button" onclick="updateShopperCartItemQty(${pid}, 0)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 4px; font-size: 14px;" title="Remove">✕</button>
        </div>
      </div>
    `;
  }).join('');

  if (countEl) countEl.textContent = totalItems;
  if (totalEl) totalEl.textContent = formatCurrency(totalAmount);
  if (checkoutBtn) checkoutBtn.disabled = false;
}

async function submitShopperOrder() {
  const pids = Object.keys(state.shopperCart).map(Number);
  if (pids.length === 0) {
    showToast('Your shopping bag is empty', 'error');
    return;
  }

  const items = pids.map(pid => ({
    product_id: pid,
    quantity: state.shopperCart[pid]
  }));

  const paymentMethod = document.getElementById('shopperPaymentMethod')?.value || 'UPI';
  const checkoutBtn = document.getElementById('btnShopperPlaceOrder');

  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Executing ACID Transaction...';
  }

  try {
    const result = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: state.activeShopperId,
        payment_method: paymentMethod,
        items
      })
    });

    const activeCust = state.customers.find(c => c.customer_id === state.activeShopperId);
    showToast(`🎉 Order #${result.order_id} placed successfully! Total: ${formatCurrency(result.order_total || result.total)}`);
    logUserActivity('ORDER', `Shopper ${activeCust ? activeCust.name : 'Customer'} created Order #${result.order_id} (Total: ${formatCurrency(result.order_total || result.total)}) via ${paymentMethod} with atomic stock deduction`);

    // Reset cart and reload
    clearShopperCart();
    
    // Switch to Track Orders tab to immediately see the new order in tracking stepper!
    switchUserPortalTab('track');
    loadProducts();
    loadStats();
  } catch (err) {
    showToast(`Order failed: ${err.message}`, 'error');
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Place Order (ACID Protected)';
    }
  }
}

// ==========================================
// 12. GENERIC CONFIRMATION MODAL
// ==========================================
function openConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalMessage').textContent = message;

  const btn = document.getElementById('confirmActionBtn');
  btn.onclick = () => {
    closeConfirmModal();
    if (onConfirm) onConfirm();
  };

  modal.classList.add('active');
}

function closeConfirmModal() {
  document.getElementById('confirmModal')?.classList.remove('active');
}

// ==========================================
// 13. BOOTSTRAP APPLICATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initUserSession();
  switchView('dashboard');
});
