// js/api.js — Centralised API client with error handling

// Change this to your deployed backend URL when deploying
const API_BASE = 'https://sales-tracker-api.onrender.com';

/**
 * Core fetch wrapper: adds base URL, handles errors, returns parsed JSON.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };
  const config = { ...defaults, ...options };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok) {
    const msg = data?.errors?.[0]?.msg || data?.message || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

// ── Sales endpoints ──────────────────────────────────────────────────────────
const SalesAPI = {
  getAll:  (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/sales${qs ? '?' + qs : ''}`);
  },
  create:  (body)  => apiFetch('/sales', { method: 'POST', body }),
  delete:  (id)    => apiFetch(`/sales/${id}`, { method: 'DELETE' }),
  getById: (id)    => apiFetch(`/sales/${id}`),
};

// ── Analytics endpoints ───────────────────────────────────────────────────────
const AnalyticsAPI = {
  summary:    () => apiFetch('/analytics/summary'),
  trend:      () => apiFetch('/analytics/trend'),
  categories: () => apiFetch('/analytics/categories'),
  products:   () => apiFetch('/analytics/products'),
};

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Format a number as USD currency */
function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

/** Format ISO date string as readable date */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Return a CSS badge class based on category name */
function categoryClass(cat) {
  const map = {
    'Electronics':    'badge-electronics',
    'Appliances':     'badge-appliances',
    'Footwear':       'badge-footwear',
    'Sports':         'badge-sports',
    'Home & Office':  'badge-office',
    'Clothing':       'badge-clothing',
    'Food & Beverage':'badge-food',
    'Other':          'badge-other',
  };
  return map[cat] || 'badge-other';
}

/** Show a toast notification */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut .25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

/** Set loading state on a button */
function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.original;
    btn.disabled = false;
  }
}
