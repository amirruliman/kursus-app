// ============================================================
// config.js — App-wide configuration
// Update GAS_URL after deploying your Google Apps Script.
// ============================================================

const CONFIG = {
  // Replace this with your deployed GAS Web App URL
  // Deploy settings: Execute as Me, Access: Anyone (even anonymous)
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzKLu-YL2Za_-13YwdfDBqLnXwNSQQ25zIoThfi9QVSiBnwQrRO1v8jVRhhjzq-miWc1g/exec',

  APP_NAME: 'Kursus App',
  TOKEN_KEY: 'kursus_token',
  USER_KEY: 'kursus_user',
};

// Attendance status options
const STATUS_OPTIONS = [
  { value: '', label: '— Pilih —' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'absen', label: 'Absen' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'izin', label: 'Izin' },
];

// Day of week options (Indonesian)
const DAY_OPTIONS = [
  { value: 'Senin', label: 'Senin' },
  { value: 'Selasa', label: 'Selasa' },
  { value: 'Rabu', label: 'Rabu' },
  { value: 'Kamis', label: 'Kamis' },
  { value: 'Jumat', label: 'Jumat' },
  { value: 'Sabtu', label: 'Sabtu' },
  { value: 'Minggu', label: 'Minggu' },
];

const ROLE_LABELS = {
  admin: 'Admin',
  pengajar: 'Pengajar',
  siswa: 'Siswa',
};

const STATUS_LABELS = {
  hadir: 'Hadir',
  absen: 'Absen',
  sakit: 'Sakit',
  izin: 'Izin',
};

const REQUEST_TYPE_LABELS = {
  tambah: 'Tambah Jadwal',
  ubah: 'Ubah Jadwal',
  hapus: 'Hapus Jadwal',
};

const REQUEST_STATUS_LABELS = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};
