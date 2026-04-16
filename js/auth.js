// ============================================================
// auth.js — Authentication and session management
// ============================================================

const Auth = {
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.USER_KEY));
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!(this.getToken() && this.getUser());
  },

  async login(email, password) {
    const result = await API.login(email, password);
    if (!result) return { success: false, error: 'Tidak dapat terhubung ke server' };
    if (!result.success) return result;

    localStorage.setItem(CONFIG.TOKEN_KEY, result.token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(result.user));

    // Role-based redirect
    const redirectMap = {
      admin: 'admin.html',
      pengajar: 'teacher.html',
      siswa: 'student.html',
    };
    const target = redirectMap[result.user.role] || 'index.html';
    window.location.href = target;
    return result;
  },

  logout() {
    // Fire-and-forget: invalidate server token
    if (this.getToken()) {
      API.call('auth.logout', { token: this.getToken() }).catch(() => {});
    }
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    window.location.href = 'index.html';
  },

  /**
   * Call at top of each protected page's DOMContentLoaded.
   * Redirects to index.html if not authenticated or wrong role.
   * Returns the user object if valid.
   */
  guardPage(requiredRole) {
    const user = this.getUser();
    const token = this.getToken();

    if (!user || !token) {
      window.location.href = 'index.html';
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      window.location.href = 'index.html';
      return null;
    }

    return user;
  },
};

// ============================================================
// Shared UI helpers used across all pages
// ============================================================

const UI = {
  // Show a toast notification
  toast(message, type = 'info') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'toast';
    el.className = `toast toast-${type}`;
    el.textContent = message;
    document.body.appendChild(el);

    // Trigger animation
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  success(msg) { this.toast(msg, 'success'); },
  error(msg) { this.toast(msg, 'error'); },
  info(msg) { this.toast(msg, 'info'); },

  // Show/hide loading spinner in a button
  setButtonLoading(btn, loading) {
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Memproses...';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.originalText || btn.textContent;
      btn.disabled = false;
    }
  },

  // Show a loading state in a container
  showLoading(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (container) container.innerHTML = '<div class="loading-spinner"></div>';
  },

  showEmpty(container, message = 'Tidak ada data') {
    if (typeof container === 'string') container = document.getElementById(container);
    if (container) container.innerHTML = `<div class="empty-state">${message}</div>`;
  },

  // Format date YYYY-MM-DD → DD/MM/YYYY
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  // Format date for input[type=date] → YYYY-MM-DD
  toInputDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
  },

  // Build an HTML select element's options from an array
  buildOptions(arr, valueKey, labelKey, selectedValue = '') {
    return arr.map(item => {
      const val = item[valueKey] !== undefined ? item[valueKey] : item;
      const label = item[labelKey] !== undefined ? item[labelKey] : item;
      const sel = String(val) === String(selectedValue) ? ' selected' : '';
      return `<option value="${escapeHtml(String(val))}"${sel}>${escapeHtml(String(label))}</option>`;
    }).join('');
  },

  // Open modal
  openModal(html) {
    document.getElementById('modal-container').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
    // Focus first input
    setTimeout(() => {
      const first = document.querySelector('#modal-overlay input:not([type=hidden])');
      if (first) first.focus();
    }, 50);
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-container').innerHTML = '';
  },
};

// Close modal on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) UI.closeModal();
    });
  }
});

// Escape HTML to prevent XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Build a status badge HTML
function statusBadge(status, type = 'attendance') {
  const classes = {
    hadir: 'badge-success',
    absen: 'badge-danger',
    sakit: 'badge-warning',
    izin: 'badge-info',
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    active: 'badge-success',
    inactive: 'badge-secondary',
  };
  const labels = {
    hadir: 'Hadir', absen: 'Absen', sakit: 'Sakit', izin: 'Izin',
    pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak',
    active: 'Aktif', inactive: 'Nonaktif',
  };
  const cls = classes[status] || 'badge-secondary';
  const label = labels[status] || status;
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

// Format a boolean active field
function activeBadge(active) {
  const isActive = active === true || active === 'true' || active === 'TRUE';
  return statusBadge(isActive ? 'active' : 'inactive');
}

// Lazy-load SheetJS for Excel export
async function loadSheetJS() {
  if (window.XLSX) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'lib/xlsx.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Export data to Excel using SheetJS
async function exportToExcel(data, filename = 'laporan.xlsx', sheetName = 'Data') {
  await loadSheetJS();
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
