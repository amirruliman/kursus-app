// ============================================================
// api.js — Central API client
// All calls go through API.call() which handles:
//   - Token injection from localStorage
//   - Unauthorized → auto logout + redirect
//   - Network error handling
// ============================================================

const API = {
  _loading: 0,

  async call(action, payload = {}) {
    const token = Auth.getToken();
    const body = { action, payload };
    if (token) body.token = token;

    try {
      // NOTE: Do NOT set Content-Type header — this avoids CORS preflight with GAS
      const res = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (!data.success && data.error === 'Unauthorized') {
        Auth.logout();
        return null;
      }

      return data;
    } catch (err) {
      console.error(`API error [${action}]:`, err);
      throw err;
    }
  },

  // ── Auth ──────────────────────────────────────────────────
  login: (email, password) =>
    API.call('auth.login', { email, password }),

  logout: () =>
    API.call('auth.logout'),

  // ── Users ─────────────────────────────────────────────────
  getUsers: (filters = {}) =>
    API.call('users.getUsers', filters),

  createUser: (data) =>
    API.call('users.createUser', data),

  updateUser: (id, data) =>
    API.call('users.updateUser', { id, ...data }),

  deleteUser: (id) =>
    API.call('users.deleteUser', { id }),

  resetPassword: (id, password) =>
    API.call('users.resetPassword', { id, password }),

  // ── Classes ───────────────────────────────────────────────
  getClasses: () =>
    API.call('classes.getClasses'),

  getClassDetails: (classId) =>
    API.call('classes.getClassDetails', { classId }),

  createClass: (data) =>
    API.call('classes.createClass', data),

  updateClass: (id, data) =>
    API.call('classes.updateClass', { id, ...data }),

  deleteClass: (id) =>
    API.call('classes.deleteClass', { id }),

  // ── Class Teachers ────────────────────────────────────────
  assignTeacher: (classId, teacherId) =>
    API.call('classTeachers.assignTeacher', { classId, teacherId }),

  removeTeacher: (linkId) =>
    API.call('classTeachers.removeTeacher', { linkId }),

  // ── Class Students ────────────────────────────────────────
  enrollStudent: (classId, studentId) =>
    API.call('classStudents.enrollStudent', { classId, studentId }),

  unenrollStudent: (enrollmentId) =>
    API.call('classStudents.unenrollStudent', { enrollmentId }),

  // ── Schedules ─────────────────────────────────────────────
  getSchedules: (classId) =>
    API.call('schedules.getSchedules', classId ? { classId } : {}),

  getTodaySchedules: () =>
    API.call('schedules.getTodaySchedules'),

  createSchedule: (data) =>
    API.call('schedules.createSchedule', data),

  updateSchedule: (id, data) =>
    API.call('schedules.updateSchedule', { id, ...data }),

  deleteSchedule: (id) =>
    API.call('schedules.deleteSchedule', { id }),

  // ── Attendance Sessions ───────────────────────────────────
  getSessions: (filters = {}) =>
    API.call('attendanceSessions.getSessions', filters),

  createSession: (classId, date) =>
    API.call('attendanceSessions.createSession', { classId, date }),

  getSessionDetails: (sessionId) =>
    API.call('attendanceSessions.getSessionDetails', { sessionId }),

  // ── Attendance Records ────────────────────────────────────
  saveAttendance: (sessionId, records) =>
    API.call('attendanceRecords.saveAttendance', { sessionId, records }),

  updateRecord: (recordId, status, notes = '') =>
    API.call('attendanceRecords.updateRecord', { recordId, status, notes }),

  getStudentAttendance: (filters = {}) =>
    API.call('attendanceRecords.getStudentAttendance', filters),

  // ── Schedule Requests ─────────────────────────────────────
  getScheduleRequests: (filters = {}) =>
    API.call('scheduleRequests.getRequests', filters),

  createScheduleRequest: (data) =>
    API.call('scheduleRequests.createRequest', data),

  approveScheduleRequest: (requestId) =>
    API.call('scheduleRequests.approveRequest', { requestId }),

  rejectScheduleRequest: (requestId) =>
    API.call('scheduleRequests.rejectRequest', { requestId }),

  // ── Reports ───────────────────────────────────────────────
  getAttendanceReport: (filters) =>
    API.call('reports.getAttendanceReport', filters),

  getClassAttendanceSummary: (classId) =>
    API.call('reports.getClassAttendanceSummary', { classId }),
};
