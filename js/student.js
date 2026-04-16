// ============================================================
// student.js — Student dashboard logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.guardPage('siswa');
  if (!user) return;

  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('dashboard-greeting').textContent = `Halo, ${user.name}!`;

  StudentApp.init();
});

const StudentApp = {
  init() {
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => this.loadSection(btn.dataset.section));
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeModal(); });
    this.loadSection('dashboard');
  },

  loadSection(name) {
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === name);
    });
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${name}`);
    if (target) target.classList.add('active');

    const loaders = {
      dashboard: () => StudentDashboard.load(),
      attendance: () => StudentAttendance.init(),
    };
    loaders[name]?.();
  },
};

// ── Dashboard ────────────────────────────────────────────────

const StudentDashboard = {
  async load() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = UI.toInputDate(firstDay);
    const endDate = UI.toInputDate(now);

    // Set current month label
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const monthLabel = document.getElementById('current-month-label');
    if (monthLabel) monthLabel.textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    try {
      const [attRes, classesRes] = await Promise.all([
        API.getStudentAttendance({ startDate, endDate }),
        API.getClasses(),
      ]);

      const summary = attRes?.summary || { total: 0, hadir: 0, absen: 0, sakit: 0, izin: 0 };
      const classes = classesRes?.data || [];

      // Stats
      document.getElementById('student-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total Sesi (Bulan Ini)</div><div class="stat-value">${summary.total}</div></div>
        <div class="stat-card success"><div class="stat-label">Hadir</div><div class="stat-value">${summary.hadir}</div></div>
        <div class="stat-card danger"><div class="stat-label">Absen</div><div class="stat-value">${summary.absen}</div></div>
        <div class="stat-card warning"><div class="stat-label">Sakit / Izin</div><div class="stat-value">${summary.sakit + summary.izin}</div></div>
      `;

      // Monthly chart / breakdown
      const chartEl = document.getElementById('monthly-chart');
      const pct = summary.total > 0 ? Math.round((summary.hadir / summary.total) * 100) : 0;
      chartEl.innerHTML = `
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span class="text-sm font-bold">Tingkat Kehadiran</span>
            <span class="text-sm font-bold" style="color:${pct>=75?'var(--success)':'var(--danger)'}">${pct}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${pct>=75?'success':'danger'}" style="width:${pct}%"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--success-light);border-radius:6px;padding:10px;">
            <div class="text-sm" style="color:var(--success);font-weight:700;">Hadir</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--success);">${summary.hadir}</div>
          </div>
          <div style="background:var(--danger-light);border-radius:6px;padding:10px;">
            <div class="text-sm" style="color:var(--danger);font-weight:700;">Absen</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--danger);">${summary.absen}</div>
          </div>
          <div style="background:var(--warning-light);border-radius:6px;padding:10px;">
            <div class="text-sm" style="color:var(--warning);font-weight:700;">Sakit</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--warning);">${summary.sakit}</div>
          </div>
          <div style="background:var(--info-light);border-radius:6px;padding:10px;">
            <div class="text-sm" style="color:var(--info);font-weight:700;">Izin</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--info);">${summary.izin}</div>
          </div>
        </div>
      `;

      // Classes
      const classesEl = document.getElementById('student-classes');
      if (classes.length === 0) {
        classesEl.innerHTML = '<div class="empty-state" style="padding:16px;">Belum terdaftar di kelas manapun</div>';
      } else {
        classesEl.innerHTML = `<div class="schedule-list">${
          classes.map(c => `
            <div class="schedule-item">
              <div>
                <div class="schedule-class">${escapeHtml(c.name)}</div>
                <div class="schedule-day">${escapeHtml(c.description || '—')}</div>
              </div>
              ${activeBadge(c.active)}
            </div>
          `).join('')
        }</div>`;
      }
    } catch (err) {
      document.getElementById('student-stats').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },
};

// ── Attendance Recap ──────────────────────────────────────────

const StudentAttendance = {
  _data: [],
  _summary: {},

  init() {
    // Set default date range (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('att-start').value = UI.toInputDate(firstDay);
    document.getElementById('att-end').value = UI.toInputDate(now);
    this.load();
  },

  async load() {
    const startDate = document.getElementById('att-start').value;
    const endDate = document.getElementById('att-end').value;

    if (!startDate || !endDate) {
      UI.error('Pilih rentang tanggal terlebih dahulu');
      return;
    }

    UI.showLoading('student-att-view');
    document.getElementById('student-att-summary').classList.add('hidden');

    try {
      const result = await API.getStudentAttendance({ startDate, endDate });
      if (!result?.success) throw new Error(result?.error);

      this._data = result.data;
      this._summary = result.summary;

      // Update print header
      const user = Auth.getUser();
      document.getElementById('print-title').textContent = `Rekap Kehadiran — ${user?.name || ''}`;
      document.getElementById('print-subtitle').textContent = `Periode: ${UI.formatDate(startDate)} s/d ${UI.formatDate(endDate)}`;

      // Summary
      const { total, hadir, absen, sakit, izin } = result.summary;
      const summaryEl = document.getElementById('student-att-summary');
      summaryEl.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${total}</div></div>
          <div class="stat-card success"><div class="stat-label">Hadir</div><div class="stat-value">${hadir}</div></div>
          <div class="stat-card danger"><div class="stat-label">Absen</div><div class="stat-value">${absen}</div></div>
          <div class="stat-card warning"><div class="stat-label">Sakit</div><div class="stat-value">${sakit}</div></div>
          <div class="stat-card"><div class="stat-label">Izin</div><div class="stat-value">${izin}</div></div>
        </div>
      `;
      summaryEl.classList.remove('hidden');

      // Table
      const el = document.getElementById('student-att-view');
      if (result.data.length === 0) {
        el.innerHTML = '<div class="empty-state">Tidak ada data kehadiran pada periode ini</div>';
        return;
      }

      el.innerHTML = `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kelas</th>
                <th>Status</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${result.data.map(r => `
                <tr>
                  <td>${UI.formatDate(r.date)}</td>
                  <td>${escapeHtml(r.class_name)}</td>
                  <td>${statusBadge(r.status)}</td>
                  <td class="text-muted text-sm">${escapeHtml(r.notes || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      document.getElementById('student-att-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  exportPdf() {
    window.print();
  },
};
