# Panduan Setup Kursus App

## Langkah 1: Setup Google Sheets

1. Buka [Google Sheets](https://sheets.new) dan buat spreadsheet baru. Beri nama: **Kursus App DB**

2. Buat **8 tab** dengan nama dan header berikut (persis, case-sensitive):

| Tab | Header Row (baris 1) |
|-----|---------------------|
| Users | `id` `name` `email` `password_hash` `role` `active` `created_at` |
| Classes | `id` `name` `description` `active` `created_at` |
| ClassTeachers | `id` `class_id` `teacher_id` |
| ClassStudents | `id` `class_id` `student_id` `active` `enrolled_at` |
| Schedules | `id` `class_id` `day_of_week` `start_time` `end_time` `active` |
| AttendanceSessions | `id` `class_id` `date` `created_by` `created_at` |
| AttendanceRecords | `id` `session_id` `user_id` `user_role` `status` `notes` |
| ScheduleRequests | `id` `class_id` `teacher_id` `request_type` `schedule_id` `new_day` `new_start` `new_end` `reason` `status` `reviewed_by` `reviewed_at` `created_at` |

> Setiap kolom dipisahkan oleh tab. Isi header di baris pertama masing-masing tab.

---

## Langkah 2: Setup Google Apps Script

1. Buka spreadsheet tadi → klik **Extensions → Apps Script**

2. Di editor GAS, hapus isi default dan buat file-file berikut (klik **+** → Script):
   - `Code.gs` — isi dari `gas/Code.gs`
   - `Router.gs` — isi dari `gas/Router.gs`
   - `SheetHelper.gs` — isi dari `gas/SheetHelper.gs`
   - `Auth.gs` — isi dari `gas/Auth.gs`
   - `Users.gs` — isi dari `gas/Users.gs`
   - `Classes.gs` — isi dari `gas/Classes.gs`
   - `Schedules.gs` — isi dari `gas/Schedules.gs`
   - `Attendance.gs` — isi dari `gas/Attendance.gs`
   - `ScheduleRequests.gs` — isi dari `gas/ScheduleRequests.gs`
   - `Reports.gs` — isi dari `gas/Reports.gs`

3. **Dapatkan hash password Admin pertama:**
   - Di editor GAS, buka Console (klik ikon "▶ Run")
   - Jalankan fungsi `getPasswordHash` dengan mengetik di console:
     ```
     getPasswordHash('admin123')
     ```
   - Atau buat fungsi sementara di Code.gs:
     ```javascript
     function testHash() { Logger.log(hashPassword('admin123')); }
     ```
   - Jalankan `testHash()`, buka **View → Logs** untuk melihat hash

4. **Seed Admin pertama di Google Sheets** — di tab `Users`, isi baris 2:
   ```
   id: [klik Generate UUID atau tulis manual seperti: admin-001]
   name: Administrator
   email: admin@kursus.app
   password_hash: [paste hash dari langkah 3]
   role: admin
   active: TRUE
   created_at: 2024-01-01T00:00:00.000Z
   ```

5. **Deploy GAS sebagai Web App:**
   - Klik **Deploy → New Deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ⚠️ (wajib, ini yang memungkinkan akses dari GitHub Pages)
   - Klik **Deploy** → **Authorize access**
   - Salin URL yang muncul (berakhiran `/exec`)

6. **Setup daily trigger untuk cleanup token:**
   - Di GAS editor: klik ikon jam (**Triggers**)
   - Tambah trigger: Function `cleanExpiredTokens`, Event source: Time-driven, Type: Day timer

---

## Langkah 3: Konfigurasi Frontend

1. Buka file `js/config.js`
2. Ganti baris berikut dengan URL GAS Anda:
   ```javascript
   GAS_URL: 'https://script.google.com/macros/s/GANTI_INI/exec',
   ```

---

## Langkah 4: Deploy ke GitHub Pages

1. Buat repository GitHub baru (misal: `kursus-app`)
2. Upload semua file kecuali folder `gas/` ke repository
3. Di Settings repository → Pages → Source: **main branch, root folder**
4. Akses di: `https://username.github.io/kursus-app/`

---

## Catatan Penting

### Setiap Update Kode GAS
Setiap kali Anda mengubah kode GAS, Anda **harus** membuat deployment baru:
- Deploy → Manage Deployments → Edit (ikon pensil) → Version: **New version** → Deploy

### Keamanan
- Password disimpan sebagai SHA-256 hash di Google Sheets
- Token sesi disimpan di PropertiesService GAS (server-side), bukan di Sheets
- GAS di-deploy sebagai "Anyone" tapi autentikasi dilakukan di level aplikasi
- Cocok untuk penggunaan internal (sekolah/kursus kecil)

### Batasan
- GAS: 6 menit timeout per request (cukup untuk data ratusan record)
- PropertiesService: 500KB total (cukup untuk ratusan token aktif)
- Google Sheets: 10 juta sel per spreadsheet (lebih dari cukup)

### Nilai Status
| Field | Nilai valid |
|-------|------------|
| `role` | `admin`, `pengajar`, `siswa` |
| `status` (absensi) | `hadir`, `absen`, `sakit`, `izin` |
| `request_type` | `tambah`, `ubah`, `hapus` |
| `status` (request) | `pending`, `approved`, `rejected` |
| `active` | `TRUE`, `FALSE` (Google Sheets boolean) |
