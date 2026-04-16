// ============================================================
// teacher.js — Teacher dashboard logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.guardPage('pengajar');
  if (!user) return;

  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

  TeacherApp.init();
});

// ── App Shell ────────────────────────────────────────────────

const TeacherApp = {
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
      dashboard: () => TeacherDashboard.load(),
      schedules: () => TeacherSchedules.load(),
      attendance: () => TeacherAttendance.load(),
      requests: () => TeacherRequests.load(),
    };
    loaders[name]?.();
  },
};

// ── Dashboard ────────────────────────────────────────────────

const TeacherDashboard = {
  async load() {
    try {
      const [todayRes, classesRes, requestsRes] = await Promise.all([
        API.getTodaySchedules(),
        API.getClasses(),
        API.getScheduleRequests({ status: 'pending' }),
      ]);

      // Stats
      document.getElementById('teacher-stats').innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Kelas Diampu</div>
          <div class="stat-value">${classesRes?.data?.length || 0}</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-label">Jadwal Hari Ini</div>
          <div class="stat-value">${todayRes?.data?.length || 0}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Permintaan Pending</div>
          <div class="stat-value">${requestsRes?.data?.length || 0}</div>
        </div>
      `;

      // Today's label
      const todayLabel = document.getElementById('today-label');
      if (todayLabel && todayRes?.today) todayLabel.textContent = todayRes.today;

      // Today's schedules
      const todayEl = document.getElementById('today-schedules');
      const todaySchedules = todayRes?.data || [];
      if (todaySchedules.length === 0) {
        todayEl.innerHTML = '<div class="empty-state" style="padding:16px;">Tidak ada jadwal mengajar hari ini</div>';
      } else {
        todayEl.innerHTML = `<div class="schedule-list">${
          todaySchedules.map(s => `
            <div class="schedule-item">
              <div class="schedule-time">${escapeHtml(s.start_time)} – ${escapeHtml(s.end_time)}</div>
              <div>
                <div class="schedule-class">${escapeHtml(s.class_name)}</div>
                <div class="schedule-day">${escapeHtml(s.day_of_week)}</div>
              </div>
            </div>
          `).join('')
        }</div>`;
      }

      // Classes list
      const classes = classesRes?.data || [];
      const classesEl = document.getElementById('teacher-classes');
      if (classes.length === 0) {
        classesEl.innerHTML = '<div class="empty-state" style="padding:16px;">Belum ditugaskan ke kelas manapun</div>';
      } else {
        classesEl.innerHTML = `<div class="schedule-list">${
          classes.map(c => `
            <div class="schedule-item">
              <div>
                <div class="schedule-class">${escapeHtml(c.name)}</div>
                <div class="schedule-day">${escapeHtml(c.description || '—')}</div>
              </div>
            </div>
          `).join('')
        }</div>`;
      }
    } catch (err) {
      document.getElementById('teacher-stats').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },
};

// ── Schedules ─────────────────────────────────────────────────

const TeacherSchedules = {
  async load() {
    UI.showLoading('schedules-view');
    try {
      const result = await API.getSchedules();
      if (!result?.success) throw new Error(result?.error);
      const schedules = result.data;
      const el = document.getElementById('schedules-view');
      if (schedules.length === 0) {
        el.innerHTML = '<div class="empty-state">Belum ada jadwal mengajar</div>';
        return;
      }

      // Group by class
      const byClass = {};
      schedules.forEach(s => {
        if (!byClass[s.class_name]) byClass[s.class_name] = [];
        byClass[s.class_name].push(s);
      });

      el.innerHTML = Object.entries(byClass).map(([className, scheds]) => `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <span class="card-title">${escapeHtml(className)}</span>
          </div>
          <div class="card-body">
            <div class="schedule-list">
              ${scheds.map(s => `
                <div class="schedule-item">
                  <div class="schedule-time">${escapeHtml(s.start_time)} – ${escapeHtml(s.end_time)}</div>
                  <div>
                    <div class="schedule-class">${escapeHtml(s.day_of_week)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      document.getElementById('schedules-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },
};

// ── Attendance ────────────────────────────────────────────────

const TeacherAttendance = {
  _currentParticipants: [],

  async load() {
    UI.showLoading('teacher-attendance-view');
    try {
      const result = await API.getSessions();
      if (!result?.success) throw new Error(result?.error);
      this.renderList(result.data);
    } catch (err) {
      document.getElementById('teacher-attendance-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  renderList(sessions) {
    const el = document.getElementById('teacher-attendance-view');
    if (sessions.length === 0) {
      el.innerHTML = '<div class="empty-state">Belum ada sesi absensi. Klik "Buka Sesi".</div>';
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
            ${sessions.map(s => `
              <tr>
                <td>${UI.formatDate(s.date)}</td>
                <td><strong>${escapeHtml(s.class_name)}</strong></td>
                <td class="td-actions">
                  <button class="btn btn-primary btn-sm" onclick="TeacherAttendance.openSession('${escapeHtml(s.id)}')">Isi Absensi</button>
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
        <span class="modal-title">Buka Sesi Absensi</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Kelas *</label>
          <select id="t-session-class">
            <option value="">— Pilih Kelas —</option>
            ${classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tanggal *</label>
          <input type="date" id="t-session-date" value="${UI.toInputDate()}">
        </div>
        <div id="t-session-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="TeacherAttendance.submitCreateSession()" id="t-session-btn">Buka Sesi</button>
      </div>
    `);
  },

  async submitCreateSession() {
    const classId = document.getElementById('t-session-class').value;
    const date = document.getElementById('t-session-date').value;
    const errEl = document.getElementById('t-session-error');
    const btn = document.getElementById('t-session-btn');
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
    UI.showLoading('teacher-attendance-view');
    try {
      const result = await API.getSessionDetails(sessionId);
      if (!result?.success) throw new Error(result?.error);
      this.renderSessionForm(result.data);
    } catch (err) {
      document.getElementById('teacher-attendance-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  renderSessionForm(data) {
    const { session, participants } = data;
    this._currentParticipants = participants;
    const el = document.getElementById('teacher-attendance-view');
    el.innerHTML = `
      <div style="margin-bottom:16px;">
        <button class="btn btn-secondary btn-sm" onclick="TeacherAttendance.load()">← Kembali</button>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <span class="card-title">Absensi: ${escapeHtml(session.class_name)}</span>
            <div class="text-muted text-sm" style="margin-top:2px;">Tanggal: ${UI.formatDate(session.date)}</div>
          </div>
          <button class="btn btn-primary" onclick="TeacherAttendance.submitAttendance('${escapeHtml(session.id)}')" id="t-save-btn">
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
            <tbody>
              ${participants.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.name)}</strong></td>
                  <td>${statusBadge(p.userRole, 'role')}</td>
                  <td>
                    <select class="status-select" id="t-status-${escapeHtml(p.userId)}">
                      ${STATUS_OPTIONS.map(opt => `<option value="${opt.value}"${opt.value===p.status?' selected':''}>${opt.label}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <input type="text" id="t-notes-${escapeHtml(p.userId)}" value="${escapeHtml(p.notes||'')}" placeholder="Catatan (opsional)" style="width:100%;max-width:200px;">
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async submitAttendance(sessionId) {
    const btn = document.getElementById('t-save-btn');
    UI.setButtonLoading(btn, true);
    try {
      const records = this._currentParticipants.map(p => ({
        userId: p.userId,
        userRole: p.userRole,
        status: document.getElementById(`t-status-${p.userId}`)?.value || '',
        notes: document.getElementById(`t-notes-${p.userId}`)?.value || '',
      })).filter(r => r.status !== '');

      const result = await API.saveAttendance(sessionId, records);
      if (!result?.success) { UI.error(result?.error || 'Gagal simpan'); return; }
      UI.success('Absensi berhasil disimpan');
    } catch (err) { UI.error(err.message); }
    finally { UI.setButtonLoading(btn, false); }
  },
};

// ── Schedule Requests ─────────────────────────────────────────

const TeacherRequests = {
  _classes: [],
  _schedules: [],

  async load() {
    UI.showLoading('requests-view');
    try {
      const [reqRes, classesRes] = await Promise.all([
        API.getScheduleRequests(),
        API.getClasses(),
      ]);
      if (!reqRes?.success) throw new Error(reqRes?.error);
      this._classes = classesRes?.data || [];
      this.render(reqRes.data);
    } catch (err) {
      document.getElementById('requests-view').innerHTML =
        `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  },

  render(requests) {
    const el = document.getElementById('requests-view');
    if (requests.length === 0) {
      el.innerHTML = '<div class="empty-state">Belum ada permintaan jadwal. Klik "Ajukan Permintaan".</div>';
      return;
    }
    el.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Kelas</th>
              <th>Tipe</th>
              <th>Perubahan</th>
              <th>Alasan</th>
              <th>Status</th>
              <th>Ditinjau Oleh</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => `
              <tr>
                <td>${escapeHtml(r.class_name)}</td>
                <td><span class="badge badge-info">${escapeHtml(REQUEST_TYPE_LABELS[r.request_type]||r.request_type)}</span></td>
                <td class="text-sm">
                  ${r.existing_schedule ? `<div class="text-muted">Saat ini: ${escapeHtml(r.existing_schedule.day_of_week)} ${escapeHtml(r.existing_schedule.start_time)}–${escapeHtml(r.existing_schedule.end_time)}</div>` : ''}
                  ${r.new_day ? `<div>Baru: ${escapeHtml(r.new_day)} ${escapeHtml(r.new_start)}–${escapeHtml(r.new_end)}</div>` : ''}
                </td>
                <td class="text-muted text-sm">${escapeHtml(r.reason || '—')}</td>
                <td>${statusBadge(r.status)}</td>
                <td class="text-muted text-sm">${escapeHtml(r.reviewer_name || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async openCreate() {
    const classesRes = await API.getClasses();
    this._classes = classesRes?.data || [];
    UI.openModal(`
      <div class="modal-header">
        <span class="modal-title">Ajukan Permintaan Jadwal</span>
        <button class="modal-close" onclick="UI.closeModal()">×</button>
      </div>
      <div class="modal-body" id="req-form-body">
        <div class="form-row">
          <div class="form-group">
            <label>Kelas *</label>
            <select id="req-class" onchange="TeacherRequests.onClassChange(this.value)">
              <option value="">— Pilih Kelas —</option>
              ${this._classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Tipe Permintaan *</label>
            <select id="req-type" onchange="TeacherRequests.onTypeChange(this.value)">
              <option value="">— Pilih Tipe —</option>
              <option value="tambah">Tambah Jadwal</option>
              <option value="ubah">Ubah Jadwal</option>
              <option value="hapus">Hapus Jadwal</option>
            </select>
          </div>
        </div>
        <div id="req-existing-schedule" class="form-group hidden">
          <label>Jadwal yang Diubah/Dihapus *</label>
          <select id="req-schedule-id">
            <option value="">— Pilih Jadwal —</option>
          </select>
        </div>
        <div id="req-new-schedule" class="hidden">
          <div class="form-group">
            <label>Hari Baru *</label>
            <select id="req-new-day">
              <option value="">— Pilih Hari —</option>
              ${DAY_OPTIONS.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Jam Mulai Baru *</label>
              <input type="time" id="req-new-start">
            </div>
            <div class="form-group">
              <label>Jam Selesai Baru *</label>
              <input type="time" id="req-new-end">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Alasan</label>
          <textarea id="req-reason" placeholder="Jelaskan alasan permintaan (opsional)"></textarea>
        </div>
        <div id="req-error" class="alert alert-danger hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="TeacherRequests.submitCreate()" id="req-submit-btn">Kirim Permintaan</button>
      </div>
    `);
  },

  async onClassChange(classId) {
    if (!classId) return;
    try {
      const result = await API.getSchedules(classId);
      this._schedules = result?.data || [];
      const sel = document.getElementById('req-schedule-id');
      sel.innerHTML = `<option value="">— Pilih Jadwal —</option>` +
        this._schedules.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.day_of_week)} ${escapeHtml(s.start_time)}–${escapeHtml(s.end_time)}</option>`).join('');
    } catch {}
  },

  onTypeChange(type) {
    const existingEl = document.getElementById('req-existing-schedule');
    const newEl = document.getElementById('req-new-schedule');
    existingEl.classList.toggle('hidden', type === 'tambah' || type === '');
    newEl.classList.toggle('hidden', type === 'hapus' || type === '');
  },

  async submitCreate() {
    const classId = document.getElementById('req-class').value;
    const requestType = document.getElementById('req-type').value;
    const scheduleId = document.getElementById('req-schedule-id')?.value;
    const newDay = document.getElementById('req-new-day')?.value;
    const newStart = document.getElementById('req-new-start')?.value;
    const newEnd = document.getElementById('req-new-end')?.value;
    const reason = document.getElementById('req-reason').value;
    const errEl = document.getElementById('req-error');
    const btn = document.getElementById('req-submit-btn');

    errEl.classList.add('hidden');
    if (!classId || !requestType) {
      errEl.textContent = 'Kelas dan tipe permintaan wajib diisi';
      errEl.classList.remove('hidden'); return;
    }
    if ((requestType === 'ubah' || requestType === 'hapus') && !scheduleId) {
      errEl.textContent = 'Pilih jadwal yang akan diubah/dihapus';
      errEl.classList.remove('hidden'); return;
    }
    if ((requestType === 'tambah' || requestType === 'ubah') && (!newDay || !newStart || !newEnd)) {
      errEl.textContent = 'Hari, jam mulai, dan jam selesai wajib diisi';
      errEl.classList.remove('hidden'); return;
    }

    UI.setButtonLoading(btn, true);
    try {
      const result = await API.createScheduleRequest({
        classId, requestType,
        scheduleId: scheduleId || '',
        newDay: newDay || '', newStart: newStart || '', newEnd: newEnd || '',
        reason,
      });
      if (!result?.success) { errEl.textContent = result?.error; errEl.classList.remove('hidden'); return; }
      UI.closeModal();
      UI.success('Permintaan berhasil dikirim. Menunggu persetujuan Admin.');
      this.load();
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    finally { UI.setButtonLoading(btn, false); }
  },
};
