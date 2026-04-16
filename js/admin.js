// ============================================================
// admin.js — Admin dashboard logic
// ============================================================

// ── Page Init ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.guardPage('admin');
  if (!user) return;

  // Set user info in sidebar
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

  AdminApp.init();
});

// ── App Shell ────────────────────────────────────────────────

const AdminApp = {
  currentSection: 'dashboard',

  init() {
    // Wire up sidebar nav
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.loadSection(btn.dataset.section);
      });
    });

    // Mobile sidebar toggle
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') UI.closeModal();
    });

    this.loadSection('dashboard');
    this.loadPendingCount();
  },

  loadSection(name) {
    // Update nav active state
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === name);
    });

    // Hide all sections, show target
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${name}`);
    if (target) target.classList.add('active');

    this.currentSection = name;

    // Load data for section
    const loaders = {
      dashboard: () => AdminDashboard.load(),
      users: () => AdminUsers.load(),
      classes: () => AdminClasses.load(),
      attendance: () => AdminAttendance.load(),
      'schedule-requests': () => AdminRequests.load('pending'),
      reports: () => AdminReports.init(),
    };
    loaders[name]?.();
  },

  async loadPendingCount() {
    try {
      const result = await API.getScheduleRequests({ status: 'pending' });
      if (result?.success) {
        const count = result.data.length;
        const badge = document.getElementById('pending-badge');
        if (badge) {
          badge.textContent = count;
          badge.classList.toggle('hidden', count === 0);
        }
      }
    } catch {}
  },
};

// ── Dashboard ────────────────────────────────────────────────

const AdminDashboard = {
  async load() {
    try {
      const [usersRes, classesRes, requestsRes] = await Promise.all([
        API.getUsers(),
        API.getClasses(),
        API.getScheduleRequests({ status: 'pending' }),
      ]);

      // Stats
      const users = usersRes?.data || [];
      const statsEl = document.getElementById('dashboard-stats');
      statsEl.innerHTML = `
        <div class="stat-card primary">
          <div class="stat-label">Total Pengguna</div>
          <div class="stat-value">${users.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pengajar</div>
          <div class="stat-value">${users.filter(u=>u.role==='pengajar').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Siswa</div>
          <div class="stat-value">${users.filter(u=>u.role==='siswa').length}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Permintaan Pending</div>
          <div class="stat-value">${requestsRes?.data?.length || 0}</div>
        </div>
      `;

      // Classes list
      const classes = classesRes?.data || [];
      const classesEl = document.getElementById('dashboard-classes');
      if (classes.length === 0) {
        classesEl.innerHTML = '<div class="empty-state">Belum ada kelas</div>';
      } else {
        classesEl.innerHTML = `<div class="schedule-list">${
          classes.slice(0, 5).map(c => `
            <div class="schedule-item">
              <div>
                <div class="schedule-class">${escapeHtml(c.name)}</div>
                <div class="schedule-day">${escapeHtml(c.description || '-')}</div>
              </div>
              ${activeBadge(c.active)}
            </div>
          `).join('')
        }</div>`;
      }

      // Pending requests
      const requests = requestsRes?.data || [];
      const reqEl = document.getElementById('dashboard-requests');
      if (requests.length === 0) {
        reqEl.innerHTML = '<div class="empty-state">Tidak ada permintaan pending</div>';
      } else {
        reqEl.innerHTML = `<div class="schedule-list">${
          requests.slice(0, 5).map(r => `
            <div class="schedule-item">
              <div style="flex:1">
                <div class="schedule-class">${escapeHtml(r.teacher_name)}</div>
                <div class="schedule-day">${escapeHtml(REQUEST_TYPE_LABELS[r.request_type] || r.request_type)} — ${escapeHtml(r.class_name)}</div>
              </div>
              ${statusBadge('pending')}
            </div>
          `).join('')
        }</div>`;
      }
    } catch (err) {
      document.getElementById('dashboard-stats').innerHTML = `<div class="alert alert-danger">Gagal memuat data: ${escapeHtml(err.message)}</div>`;
    }
  },
};

// ── Users ────────────────────────────────────────────────────

const AdminUsers = {
  _data: [],
  _filtered: [],

  async load() {
    UI.showLoading('users-table-wrap');
    try {
      const result = await API.getUsers();
      if (!result?.success) throw new Error(result?.error || 'Gagal memuat pengguna');
      this._data = result.data;
      this._filtered = [...this._data];
      this.applyFilters();
    } catch (err) {
      document.getElementById('users-table-wrap').innerHTML =
        `<div class="alert alert-danger" style="margin:16px;">${escapeHtml(err.message)}</div>`;
    }
  },

  applyFilters() {
    const search = document.getElementById('user-search')?.value.toLowerCase() || '';
    const role = document.getElementById('user-role-filter')?.value || '';
    this._filtered = this._data.filter(u => {
      const matchSearch = !search ||
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search);
      const matchRole = !role || u.role === role;
      return matchSearch && matchRole;
    });
    this.render();
  },

  search(val) { this.applyFilters(); },
  filterByRole(val) { this.applyFilters(); },

  render() {
    const el = document.getElementById('users-table-wrap');
    if (this._filtered.length === 0) {
      el.innerHTML = '<div class="empty-state">Tidak ada pengguna ditemukan</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th class="td-actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${this._filtered.map(u => `
            <tr>
              <td><strong>${escapeHtml(u.name)}</strong></td>
              <td class="text-muted">${escapeHtml(u.email)}</td>
              <td>${statusBadge(u.role, 'role')}</td>
              <td>${activeBadge(u.active)}</td>
              <td class="td-actions">
                <div class="btn-group">
                  <button class="btn btn-secondary btn-sm" onclick="AdminUsers.openEdit('${escapeHtml(u.id)}')">Edit</button>
                  <button class="btn btn-ghost btn-sm" onclick="AdminUsers.openResetPassword('${escapeHtml(u.id)}', '${escapeHtml(u.name)}')">Reset PW</button>
                  <button class="btn btn-danger btn-sm" onclick="AdminUsers.confirmDelete('${escapeHtml(u.id)}', '${escapeHtml(u.name)}')">Hapus</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  openCreate() {
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Tambah Pengguna</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <form class="modal-body" id="user-form" onsubmit="AdminUsers.submitCreate(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Nama Lengkap *</label>
            <input type="text" name="name" required placeholder="Nama lengkap">
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" name="email" required placeholder="email@contoh.com">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Password *</label>
            <input type="password" name="password" required placeholder="Min. 6 karakter" minlength="6">
          </div>
          <div class="form-group">
            <label>Role *</label>
            <select name="role" required>
              <option value="">— Pilih Role —</option>
              <option value="admin">Admin</option>
              <option value="pengajar">Pengajar</option>
              <option value="siswa">Siswa</option>
            </select>
          </div>
        </div>
        <div id="user-form-error" class="alert alert-danger hidden"></div>
      </form>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminUsers.submitCreate(null)" id="user-submit-btn">Simpan</button>
      </div>
    `);
  },

  async submitCreate(e) {
    if (e) e.preventDefault();
    const form = document.getElementById('user-form');
    const errEl = document.getElementById('user-form-error');
    const btn = document.getElementById('user-submit-btn');
    const data = Object.fromEntries(new FormData(form));

    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);

    try {
      const result = await API.createUser(data);
      if (!result?.success) {
        errEl.textContent = result?.error || 'Gagal menyimpan pengguna';
        errEl.classList.remove('hidden');
        return;
      }
      UI.closeModal();
      UI.success('Pengguna berhasil ditambahkan');
      this.load();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      UI.setButtonLoading(btn, false);
    }
  },

  openEdit(id) {
    const user = this._data.find(u => u.id === id);
    if (!user) return;
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Edit Pengguna</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <form class="modal-body" id="user-edit-form">
        <input type="hidden" name="id" value="${escapeHtml(user.id)}">
        <div class="form-row">
          <div class="form-group">
            <label>Nama Lengkap *</label>
            <input type="text" name="name" value="${escapeHtml(user.name)}" required>
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" name="email" value="${escapeHtml(user.email)}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Role *</label>
            <select name="role" required>
              <option value="admin"${user.role==='admin'?' selected':''}>Admin</option>
              <option value="pengajar"${user.role==='pengajar'?' selected':''}>Pengajar</option>
              <option value="siswa"${user.role==='siswa'?' selected':''}>Siswa</option>
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="active">
              <option value="true"${user.active===true||user.active==='true'||user.active==='TRUE'?' selected':''}>Aktif</option>
              <option value="false"${user.active===false||user.active==='false'||user.active==='FALSE'?' selected':''}>Nonaktif</option>
            </select>
          </div>
        </div>
        <div id="user-edit-error" class="alert alert-danger hidden"></div>
      </form>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminUsers.submitEdit()" id="user-edit-btn">Simpan</button>
      </div>
    `);
  },

  async submitEdit() {
    const form = document.getElementById('user-edit-form');
    const errEl = document.getElementById('user-edit-error');
    const btn = document.getElementById('user-edit-btn');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id;
    delete data.id;

    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);

    try {
      const result = await API.updateUser(id, data);
      if (!result?.success) {
        errEl.textContent = result?.error || 'Gagal menyimpan';
        errEl.classList.remove('hidden');
        return;
      }
      UI.closeModal();
      UI.success('Pengguna berhasil diperbarui');
      this.load();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      UI.setButtonLoading(btn, false);
    }
  },

  openResetPassword(id, name) {
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Reset Password — ${escapeHtml(name)}</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Password Baru *</label>
          <input type="password" id="new-password" placeholder="Min. 6 karakter" minlength="6">
        </div>
        <div id="reset-pw-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-warning" onclick="AdminUsers.submitResetPassword('${escapeHtml(id)}')" id="reset-pw-btn">Reset</button>
      </div>
    `);
  },

  async submitResetPassword(id) {
    const pw = document.getElementById('new-password').value;
    const errEl = document.getElementById('reset-pw-error');
    const btn = document.getElementById('reset-pw-btn');

    if (!pw || pw.length < 6) {
      errEl.textContent = 'Password minimal 6 karakter';
      errEl.classList.remove('hidden');
      return;
    }

    UI.setButtonLoading(btn, true);
    try {
      const result = await API.resetPassword(id, pw);
      if (!result?.success) {
        errEl.textContent = result?.error || 'Gagal reset password';
        errEl.classList.remove('hidden');
        return;
      }
      UI.closeModal();
      UI.success('Password berhasil direset');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      UI.setButtonLoading(btn, false);
    }
  },

  confirmDelete(id, name) {
    UI.openModal(`
      <div class="confirm-body">
        <div class="confirm-icon">⚠️</div>
        <div class="confirm-message">Hapus pengguna "${escapeHtml(name)}"?</div>
        <div class="confirm-submessage">Pengguna akan dinonaktifkan dan tidak bisa login.</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="AdminUsers.doDelete('${escapeHtml(id)}')" id="delete-btn">Hapus</button>
      </div>
    `);
  },

  async doDelete(id) {
    const btn = document.getElementById('delete-btn');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.deleteUser(id);
      if (!result?.success) { UI.error(result?.error || 'Gagal hapus'); return; }
      UI.closeModal();
      UI.success('Pengguna berhasil dihapus');
      this.load();
    } catch (err) {
      UI.error(err.message);
    } finally {
      UI.setButtonLoading(btn, false);
    }
  },
};

// ── Classes ──────────────────────────────────────────────────

const AdminClasses = {
  _data: [],
  _currentClass: null,

  async load() {
    UI.showLoading('classes-view');
    try {
      const result = await API.getClasses();
      if (!result?.success) throw new Error(result?.error || 'Gagal memuat kelas');
      this._data = result.data;
      this.renderList();
    } catch (err) {
      document.getElementById('classes-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  renderList() {
    const el = document.getElementById('classes-view');
    if (this._data.length === 0) {
      el.innerHTML = '<div class="empty-state">Belum ada kelas. Klik "Tambah Kelas" untuk memulai.</div>';
      return;
    }
    el.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nama Kelas</th>
              <th>Deskripsi</th>
              <th>Status</th>
              <th class="td-actions">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this._data.map(c => `
              <tr>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td class="text-muted">${escapeHtml(c.description || '—')}</td>
                <td>${activeBadge(c.active)}</td>
                <td class="td-actions">
                  <div class="btn-group">
                    <button class="btn btn-primary btn-sm" onclick="AdminClasses.openDetail('${escapeHtml(c.id)}')">Detail</button>
                    <button class="btn btn-secondary btn-sm" onclick="AdminClasses.openEdit('${escapeHtml(c.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="AdminClasses.confirmDelete('${escapeHtml(c.id)}', '${escapeHtml(c.name)}')">Hapus</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async openDetail(classId) {
    UI.showLoading('classes-view');
    try {
      const [detailRes, allUsersRes] = await Promise.all([
        API.getClassDetails(classId),
        API.getUsers(),
      ]);
      if (!detailRes?.success) throw new Error(detailRes?.error);
      const cls = detailRes.data;
      const allUsers = allUsersRes?.data || [];
      const teachers = allUsers.filter(u => u.role === 'pengajar');
      const students = allUsers.filter(u => u.role === 'siswa');
      this._currentClass = cls;

      const el = document.getElementById('classes-view');
      el.innerHTML = `
        <div style="margin-bottom:16px;">
          <button class="btn btn-secondary btn-sm" onclick="AdminClasses.load()">← Kembali ke Daftar Kelas</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <!-- Class Info -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">${escapeHtml(cls.name)}</span>
              <button class="btn btn-secondary btn-sm" onclick="AdminClasses.openEdit('${escapeHtml(cls.id)}')">Edit</button>
            </div>
            <div class="card-body">
              <div class="detail-item"><label>Deskripsi</label><span>${escapeHtml(cls.description || '—')}</span></div>
              <div class="detail-item" style="margin-top:10px;"><label>Status</label><span>${activeBadge(cls.active)}</span></div>
            </div>
          </div>

          <!-- Schedules -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Jadwal (${cls.schedules.length})</span>
              <button class="btn btn-primary btn-sm" onclick="AdminSchedules.openCreate('${escapeHtml(cls.id)}')">+ Jadwal</button>
            </div>
            <div class="card-body" id="schedules-list">
              ${cls.schedules.length === 0
                ? '<div class="empty-state" style="padding:16px;">Belum ada jadwal</div>'
                : cls.schedules.map(s => `
                  <div class="list-item">
                    <div>
                      <strong>${escapeHtml(s.day_of_week)}</strong>
                      <span class="text-muted"> ${escapeHtml(s.start_time)} – ${escapeHtml(s.end_time)}</span>
                    </div>
                    <div class="btn-group">
                      <button class="btn btn-ghost btn-sm" onclick="AdminSchedules.openEdit('${escapeHtml(s.id)}', '${escapeHtml(s.day_of_week)}', '${escapeHtml(s.start_time)}', '${escapeHtml(s.end_time)}', '${escapeHtml(cls.id)}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="AdminSchedules.confirmDelete('${escapeHtml(s.id)}', '${escapeHtml(cls.id)}')">Hapus</button>
                    </div>
                  </div>
                `).join('')}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <!-- Teachers -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Pengajar (${cls.teachers.length})</span>
              <button class="btn btn-primary btn-sm" onclick="AdminClasses.openAssignTeacher('${escapeHtml(cls.id)}')">+ Tambah</button>
            </div>
            <div class="card-body" id="teachers-list">
              ${cls.teachers.length === 0
                ? '<div class="empty-state" style="padding:16px;">Belum ada pengajar</div>'
                : cls.teachers.map(t => `
                  <div class="list-item">
                    <span>${escapeHtml(t.name)}</span>
                    <button class="btn btn-danger btn-sm" onclick="AdminClasses.removeTeacher('${escapeHtml(t.linkId)}', '${escapeHtml(cls.id)}')">Hapus</button>
                  </div>
                `).join('')}
            </div>
          </div>

          <!-- Students -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Siswa (${cls.students.length})</span>
              <button class="btn btn-primary btn-sm" onclick="AdminClasses.openEnrollStudent('${escapeHtml(cls.id)}')">+ Daftarkan</button>
            </div>
            <div class="card-body" id="students-list">
              ${cls.students.length === 0
                ? '<div class="empty-state" style="padding:16px;">Belum ada siswa</div>'
                : cls.students.map(s => `
                  <div class="list-item">
                    <span>${escapeHtml(s.name)}</span>
                    <button class="btn btn-danger btn-sm" onclick="AdminClasses.unenrollStudent('${escapeHtml(s.enrollmentId)}', '${escapeHtml(cls.id)}')">Keluarkan</button>
                  </div>
                `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      document.getElementById('classes-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  openCreate() {
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Tambah Kelas</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body" id="class-form-body">
        <div class="form-group">
          <label>Nama Kelas *</label>
          <input type="text" id="cls-name" required placeholder="Nama kelas">
        </div>
        <div class="form-group">
          <label>Deskripsi</label>
          <textarea id="cls-desc" placeholder="Deskripsi kelas (opsional)"></textarea>
        </div>
        <div id="class-form-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminClasses.submitCreate()" id="cls-submit">Simpan</button>
      </div>
    `);
  },

  async submitCreate() {
    const name = document.getElementById('cls-name').value.trim();
    const desc = document.getElementById('cls-desc').value.trim();
    const errEl = document.getElementById('class-form-error');
    const btn = document.getElementById('cls-submit');

    if (!name) { errEl.textContent = 'Nama kelas wajib diisi'; errEl.classList.remove('hidden'); return; }

    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.createClass({ name, description: desc });
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      UI.success('Kelas berhasil ditambahkan');
      this.load();
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.remove('hidden');
    } finally {
      UI.setButtonLoading(btn, false);
    }
  },

  openEdit(id) {
    const cls = this._data.find(c => c.id === id) || this._currentClass;
    if (!cls) return;
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Edit Kelas</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nama Kelas *</label>
          <input type="text" id="cls-edit-name" value="${escapeHtml(cls.name)}" required>
        </div>
        <div class="form-group">
          <label>Deskripsi</label>
          <textarea id="cls-edit-desc">${escapeHtml(cls.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="cls-edit-active">
            <option value="true"${cls.active===true||cls.active==='true'?' selected':''}>Aktif</option>
            <option value="false"${cls.active===false||cls.active==='false'?' selected':''}>Nonaktif</option>
          </select>
        </div>
        <div id="cls-edit-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminClasses.submitEdit('${escapeHtml(id)}')" id="cls-edit-btn">Simpan</button>
      </div>
    `);
  },

  async submitEdit(id) {
    const name = document.getElementById('cls-edit-name').value.trim();
    const desc = document.getElementById('cls-edit-desc').value.trim();
    const active = document.getElementById('cls-edit-active').value;
    const errEl = document.getElementById('cls-edit-error');
    const btn = document.getElementById('cls-edit-btn');

    if (!name) { errEl.textContent = 'Nama kelas wajib diisi'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.updateClass(id, { name, description: desc, active: active === 'true' });
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      UI.success('Kelas berhasil diperbarui');
      // Refresh current view
      if (this._currentClass && this._currentClass.id === id) {
        this.openDetail(id);
      } else {
        this.load();
      }
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.remove('hidden');
    } finally {
      UI.setButtonLoading(btn, false);
    }
  },

  confirmDelete(id, name) {
    UI.openModal(`
      <div class="confirm-body">
        <div class="confirm-icon">⚠️</div>
        <div class="confirm-message">Hapus kelas "${escapeHtml(name)}"?</div>
        <div class="confirm-submessage">Kelas akan dinonaktifkan.</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="AdminClasses.doDelete('${escapeHtml(id)}')" id="cls-del-btn">Hapus</button>
      </div>
    `);
  },

  async doDelete(id) {
    const btn = document.getElementById('cls-del-btn');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.deleteClass(id);
      if (!result?.success) { UI.error(result?.error); return; }
      UI.closeModal();
      UI.success('Kelas berhasil dihapus');
      this.load();
    } catch (err) { UI.error(err.message); }
    finally { UI.setButtonLoading(btn, false); }
  },

  async openAssignTeacher(classId) {
    const allUsersRes = await API.getUsers({ role: 'pengajar' });
    const teachers = allUsersRes?.data || [];
    const current = this._currentClass?.teachers || [];
    const currentIds = current.map(t => t.id);
    const available = teachers.filter(t => !currentIds.includes(t.id));

    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Tambah Pengajar</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Pilih Pengajar *</label>
          <select id="assign-teacher-id">
            <option value="">— Pilih Pengajar —</option>
            ${available.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${escapeHtml(t.email)})</option>`).join('')}
          </select>
        </div>
        <div id="assign-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminClasses.submitAssignTeacher('${escapeHtml(classId)}')" id="assign-btn">Tambahkan</button>
      </div>
    `);
  },

  async submitAssignTeacher(classId) {
    const teacherId = document.getElementById('assign-teacher-id').value;
    const errEl = document.getElementById('assign-error');
    const btn = document.getElementById('assign-btn');
    if (!teacherId) { errEl.textContent = 'Pilih pengajar terlebih dahulu'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.assignTeacher(classId, teacherId);
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      UI.success('Pengajar berhasil ditambahkan');
      this.openDetail(classId);
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    finally { UI.setButtonLoading(btn, false); }
  },

  async removeTeacher(linkId, classId) {
    if (!confirm('Hapus pengajar dari kelas ini?')) return;
    try {
      const result = await API.removeTeacher(linkId);
      if (!result?.success) { UI.error(result?.error); return; }
      UI.success('Pengajar dihapus dari kelas');
      this.openDetail(classId);
    } catch (err) { UI.error(err.message); }
  },

  async openEnrollStudent(classId) {
    const allUsersRes = await API.getUsers({ role: 'siswa' });
    const students = allUsersRes?.data || [];
    const current = this._currentClass?.students || [];
    const currentIds = current.map(s => s.id);
    const available = students.filter(s => !currentIds.includes(s.id));

    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Daftarkan Siswa</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Pilih Siswa *</label>
          <select id="enroll-student-id">
            <option value="">— Pilih Siswa —</option>
            ${available.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.email)})</option>`).join('')}
          </select>
        </div>
        <div id="enroll-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminClasses.submitEnroll('${escapeHtml(classId)}')" id="enroll-btn">Daftarkan</button>
      </div>
    `);
  },

  async submitEnroll(classId) {
    const studentId = document.getElementById('enroll-student-id').value;
    const errEl = document.getElementById('enroll-error');
    const btn = document.getElementById('enroll-btn');
    if (!studentId) { errEl.textContent = 'Pilih siswa terlebih dahulu'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.enrollStudent(classId, studentId);
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      UI.success('Siswa berhasil didaftarkan');
      this.openDetail(classId);
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    finally { UI.setButtonLoading(btn, false); }
  },

  async unenrollStudent(enrollmentId, classId) {
    if (!confirm('Keluarkan siswa dari kelas ini?')) return;
    try {
      const result = await API.unenrollStudent(enrollmentId);
      if (!result?.success) { UI.error(result?.error); return; }
      UI.success('Siswa dikeluarkan dari kelas');
      this.openDetail(classId);
    } catch (err) { UI.error(err.message); }
  },
};

// ── Schedules (within class detail) ─────────────────────────

const AdminSchedules = {
  openCreate(classId) {
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Tambah Jadwal</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Hari *</label>
          <select id="sched-day">
            <option value="">— Pilih Hari —</option>
            ${DAY_OPTIONS.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Jam Mulai *</label>
            <input type="time" id="sched-start">
          </div>
          <div class="form-group">
            <label>Jam Selesai *</label>
            <input type="time" id="sched-end">
          </div>
        </div>
        <div id="sched-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminSchedules.submitCreate('${escapeHtml(classId)}')" id="sched-btn">Simpan</button>
      </div>
    `);
  },

  async submitCreate(classId) {
    const day = document.getElementById('sched-day').value;
    const start = document.getElementById('sched-start').value;
    const end = document.getElementById('sched-end').value;
    const errEl = document.getElementById('sched-error');
    const btn = document.getElementById('sched-btn');
    if (!day || !start || !end) { errEl.textContent = 'Semua field wajib diisi'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.createSchedule({ classId, dayOfWeek: day, startTime: start, endTime: end });
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      UI.success('Jadwal berhasil ditambahkan');
      AdminClasses.openDetail(classId);
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    finally { UI.setButtonLoading(btn, false); }
  },

  openEdit(id, day, start, end, classId) {
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Edit Jadwal</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Hari *</label>
          <select id="sched-edit-day">
            ${DAY_OPTIONS.map(d => `<option value="${d.value}"${d.value===day?' selected':''}>${d.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Jam Mulai *</label>
            <input type="time" id="sched-edit-start" value="${escapeHtml(start)}">
          </div>
          <div class="form-group">
            <label>Jam Selesai *</label>
            <input type="time" id="sched-edit-end" value="${escapeHtml(end)}">
          </div>
        </div>
        <div id="sched-edit-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminSchedules.submitEdit('${escapeHtml(id)}','${escapeHtml(classId)}')" id="sched-edit-btn">Simpan</button>
      </div>
    `);
  },

  async submitEdit(id, classId) {
    const day = document.getElementById('sched-edit-day').value;
    const start = document.getElementById('sched-edit-start').value;
    const end = document.getElementById('sched-edit-end').value;
    const errEl = document.getElementById('sched-edit-error');
    const btn = document.getElementById('sched-edit-btn');
    if (!day || !start || !end) { errEl.textContent = 'Semua field wajib diisi'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.updateSchedule(id, { dayOfWeek: day, startTime: start, endTime: end });
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      UI.success('Jadwal berhasil diperbarui');
      AdminClasses.openDetail(classId);
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    finally { UI.setButtonLoading(btn, false); }
  },

  async confirmDelete(id, classId) {
    if (!confirm('Hapus jadwal ini?')) return;
    try {
      const result = await API.deleteSchedule(id);
      if (!result?.success) { UI.error(result?.error); return; }
      UI.success('Jadwal dihapus');
      AdminClasses.openDetail(classId);
    } catch (err) { UI.error(err.message); }
  },
};

// ── Attendance ───────────────────────────────────────────────

const AdminAttendance = {
  _sessions: [],

  async load() {
    UI.showLoading('attendance-view');
    try {
      const result = await API.getSessions();
      if (!result?.success) throw new Error(result?.error);
      this._sessions = result.data;
      this.renderList();
    } catch (err) {
      document.getElementById('attendance-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  renderList() {
    const el = document.getElementById('attendance-view');
    if (this._sessions.length === 0) {
      el.innerHTML = '<div class="empty-state">Belum ada sesi absensi. Klik "Buat Sesi".</div>';
      return;
    }
    el.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kelas</th>
              <th class="td-actions">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this._sessions.map(s => `
              <tr>
                <td>${UI.formatDate(s.date)}</td>
                <td><strong>${escapeHtml(s.class_name)}</strong></td>
                <td class="td-actions">
                  <button class="btn btn-primary btn-sm" onclick="AdminAttendance.openSession('${escapeHtml(s.id)}')">Isi Absensi</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async openCreateSession() {
    const classesRes = await API.getClasses();
    const classes = classesRes?.data || [];
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Buat Sesi Absensi</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Kelas *</label>
          <select id="session-class">
            <option value="">— Pilih Kelas —</option>
            ${classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tanggal *</label>
          <input type="date" id="session-date" value="${UI.toInputDate()}">
        </div>
        <div id="session-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AdminAttendance.submitCreateSession()" id="session-btn">Buat Sesi</button>
      </div>
    `);
  },

  async submitCreateSession() {
    const classId = document.getElementById('session-class').value;
    const date = document.getElementById('session-date').value;
    const errEl = document.getElementById('session-error');
    const btn = document.getElementById('session-btn');
    if (!classId || !date) { errEl.textContent = 'Kelas dan tanggal wajib dipilih'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    UI.setButtonLoading(btn, true);
    try {
      const result = await API.createSession(classId, date);
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      this.renderSessionForm(result.data);
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    finally { UI.setButtonLoading(btn, false); }
  },

  async openSession(sessionId) {
    UI.showLoading('attendance-view');
    try {
      const result = await API.getSessionDetails(sessionId);
      if (!result?.success) throw new Error(result?.error);
      this.renderSessionForm(result.data);
    } catch (err) {
      document.getElementById('attendance-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  renderSessionForm(data) {
    const { session, participants } = data;
    const el = document.getElementById('attendance-view');
    el.innerHTML = `
      <div style="margin-bottom:16px;">
        <button class="btn btn-secondary btn-sm" onclick="AdminAttendance.load()">← Kembali</button>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <span class="card-title">Absensi: ${escapeHtml(session.class_name)}</span>
            <div class="text-muted text-sm" style="margin-top:2px;">Tanggal: ${UI.formatDate(session.date)}</div>
          </div>
          <button class="btn btn-primary" onclick="AdminAttendance.submitAttendance('${escapeHtml(session.id)}')" id="save-attendance-btn">
            Simpan Absensi
          </button>
        </div>
        <div class="card-body attendance-form">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Role</th>
                <th>Status</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody id="attendance-rows">
              ${participants.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.name)}</strong></td>
                  <td>${statusBadge(p.userRole, 'role')}</td>
                  <td>
                    <select class="status-select" id="status-${escapeHtml(p.userId)}" data-user-id="${escapeHtml(p.userId)}" data-user-role="${escapeHtml(p.userRole)}">
                      ${STATUS_OPTIONS.map(opt => `<option value="${opt.value}"${opt.value===p.status?' selected':''}>${opt.label}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <input type="text" id="notes-${escapeHtml(p.userId)}" value="${escapeHtml(p.notes||'')}" placeholder="Catatan (opsional)" style="width:100%;max-width:200px;">
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    // Store participants for later
    this._currentParticipants = participants;
    this._currentSessionId = session.id;
  },

  async submitAttendance(sessionId) {
    const btn = document.getElementById('save-attendance-btn');
    UI.setButtonLoading(btn, true);
    try {
      const records = (this._currentParticipants || []).map(p => ({
        userId: p.userId,
        userRole: p.userRole,
        status: document.getElementById(`status-${p.userId}`)?.value || '',
        notes: document.getElementById(`notes-${p.userId}`)?.value || '',
      })).filter(r => r.status !== '');

      const result = await API.saveAttendance(sessionId, records);
      if (!result?.success) { UI.error(result?.error || 'Gagal simpan'); return; }
      UI.success('Absensi berhasil disimpan');
    } catch (err) { UI.error(err.message); }
    finally { UI.setButtonLoading(btn, false); }
  },
};

// ── Schedule Requests ─────────────────────────────────────────

const AdminRequests = {
  _currentStatus: 'pending',

  async load(status = 'pending') {
    this._currentStatus = status;
    UI.showLoading('requests-view');
    try {
      const result = await API.getScheduleRequests(status ? { status } : {});
      if (!result?.success) throw new Error(result?.error);
      this.render(result.data);
    } catch (err) {
      document.getElementById('requests-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  switchTab(status, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.load(status);
  },

  render(requests) {
    const el = document.getElementById('requests-view');
    if (requests.length === 0) {
      el.innerHTML = '<div class="empty-state">Tidak ada permintaan</div>';
      return;
    }
    el.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Pengajar</th>
              <th>Kelas</th>
              <th>Tipe</th>
              <th>Perubahan</th>
              <th>Alasan</th>
              <th>Status</th>
              <th class="td-actions">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => `
              <tr>
                <td>${escapeHtml(r.teacher_name)}</td>
                <td>${escapeHtml(r.class_name)}</td>
                <td><span class="badge badge-info">${escapeHtml(REQUEST_TYPE_LABELS[r.request_type]||r.request_type)}</span></td>
                <td class="text-sm">
                  ${r.existing_schedule ? `<div class="text-muted">Saat ini: ${escapeHtml(r.existing_schedule.day_of_week)} ${escapeHtml(r.existing_schedule.start_time)}–${escapeHtml(r.existing_schedule.end_time)}</div>` : ''}
                  ${r.new_day ? `<div>Baru: ${escapeHtml(r.new_day)} ${escapeHtml(r.new_start)}–${escapeHtml(r.new_end)}</div>` : ''}
                </td>
                <td class="text-muted text-sm">${escapeHtml(r.reason || '—')}</td>
                <td>${statusBadge(r.status)}</td>
                <td class="td-actions">
                  ${r.status === 'pending' ? `
                    <div class="btn-group">
                      <button class="btn btn-success btn-sm" onclick="AdminRequests.approve('${escapeHtml(r.id)}')">Setujui</button>
                      <button class="btn btn-danger btn-sm" onclick="AdminRequests.reject('${escapeHtml(r.id)}')">Tolak</button>
                    </div>
                  ` : `<span class="text-muted text-sm">${escapeHtml(r.reviewer_name||'—')}</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async approve(requestId) {
    if (!confirm('Setujui permintaan ini? Jadwal akan diperbarui.')) return;
    try {
      const result = await API.approveScheduleRequest(requestId);
      if (!result?.success) { UI.error(result?.error); return; }
      UI.success('Permintaan disetujui dan jadwal diperbarui');
      this.load(this._currentStatus);
      AdminApp.loadPendingCount();
    } catch (err) { UI.error(err.message); }
  },

  async reject(requestId) {
    if (!confirm('Tolak permintaan ini?')) return;
    try {
      const result = await API.rejectScheduleRequest(requestId);
      if (!result?.success) { UI.error(result?.error); return; }
      UI.success('Permintaan ditolak');
      this.load(this._currentStatus);
      AdminApp.loadPendingCount();
    } catch (err) { UI.error(err.message); }
  },
};

// ── Reports ───────────────────────────────────────────────────

const AdminReports = {
  _data: [],

  async init() {
    // Set default date range (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('report-start').value = UI.toInputDate(firstDay);
    document.getElementById('report-end').value = UI.toInputDate(now);

    // Load filter options
    try {
      const [classesRes, usersRes] = await Promise.all([API.getClasses(), API.getUsers()]);
      const classes = classesRes?.data || [];
      const users = usersRes?.data || [];

      const classSelect = document.getElementById('report-class');
      classes.forEach(c => {
        const opt = new Option(c.name, c.id);
        classSelect.appendChild(opt);
      });

      const userSelect = document.getElementById('report-user');
      users.forEach(u => {
        const opt = new Option(`${u.name} (${ROLE_LABELS[u.role]||u.role})`, u.id);
        userSelect.appendChild(opt);
      });
    } catch {}
  },

  async generate() {
    const startDate = document.getElementById('report-start').value;
    const endDate = document.getElementById('report-end').value;
    const classId = document.getElementById('report-class').value;
    const userId = document.getElementById('report-user').value;
    const userRole = document.getElementById('report-role').value;

    if (!startDate || !endDate) { UI.error('Pilih rentang tanggal terlebih dahulu'); return; }

    UI.showLoading('report-view');
    document.getElementById('report-summary').classList.add('hidden');
    document.getElementById('report-actions').classList.add('hidden');

    try {
      const filters = { startDate, endDate };
      if (classId) filters.classId = classId;
      if (userId) filters.userId = userId;
      if (userRole) filters.userRole = userRole;

      const result = await API.getAttendanceReport(filters);
      if (!result?.success) throw new Error(result?.error);

      this._data = result.data;
      const summary = result.summary;

      // Summary cards
      const summaryEl = document.getElementById('report-summary');
      summaryEl.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-label">Total Catatan</div><div class="stat-value">${summary.total}</div></div>
          <div class="stat-card success"><div class="stat-label">Hadir</div><div class="stat-value">${summary.hadir}</div></div>
          <div class="stat-card danger"><div class="stat-label">Absen</div><div class="stat-value">${summary.absen}</div></div>
          <div class="stat-card warning"><div class="stat-label">Sakit</div><div class="stat-value">${summary.sakit}</div></div>
          <div class="stat-card"><div class="stat-label">Izin</div><div class="stat-value">${summary.izin}</div></div>
        </div>
      `;
      summaryEl.classList.remove('hidden');

      // Report table
      const reportEl = document.getElementById('report-view');
      if (result.data.length === 0) {
        reportEl.innerHTML = '<div class="empty-state">Tidak ada data untuk filter yang dipilih</div>';
      } else {
        reportEl.innerHTML = `
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kelas</th>
                  <th>Nama</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                ${result.data.map(r => `
                  <tr>
                    <td>${UI.formatDate(r.date)}</td>
                    <td>${escapeHtml(r.class_name)}</td>
                    <td>${escapeHtml(r.user_name)}</td>
                    <td><span class="badge badge-secondary">${escapeHtml(ROLE_LABELS[r.user_role]||r.user_role)}</span></td>
                    <td>${statusBadge(r.status)}</td>
                    <td class="text-muted text-sm">${escapeHtml(r.notes||'—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        document.getElementById('report-actions').classList.remove('hidden');
      }
    } catch (err) {
      document.getElementById('report-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  async exportExcel() {
    if (!this._data || this._data.length === 0) { UI.error('Tidak ada data untuk diunduh'); return; }
    try {
      const exportData = this._data.map(r => ({
        'Tanggal': UI.formatDate(r.date),
        'Kelas': r.class_name,
        'Nama': r.user_name,
        'Email': r.user_email,
        'Role': ROLE_LABELS[r.user_role] || r.user_role,
        'Status': STATUS_LABELS[r.status] || r.status,
        'Catatan': r.notes || '',
      }));
      const start = document.getElementById('report-start').value;
      const end = document.getElementById('report-end').value;
      await exportToExcel(exportData, `laporan-absensi-${start}-${end}.xlsx`, 'Absensi');
      UI.success('File Excel berhasil diunduh');
    } catch (err) { UI.error('Gagal export Excel: ' + err.message); }
  },

  exportPdf() {
    window.print();
  },
};
