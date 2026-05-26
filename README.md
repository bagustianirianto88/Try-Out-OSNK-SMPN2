# OSN IPA SMP 2026 - CBT ANBK Clone

## Tahap 1 (Fondasi Proyek)

Struktur direktori saat ini:

```txt
.
├── README.md
├── package.json
├── server.js
├── cbt.db                  # akan dibuat otomatis saat server dijalankan
├── data/
│   └── questions.json
├── public/
│   └── style.css
├── scripts/
│   └── generateQuestions.js
└── views/
    ├── finished.ejs
    ├── proctor-dashboard.ejs
    ├── proctor-login.ejs
    ├── student-login.ejs
    └── test.ejs
```

## Menjalankan

```bash
npm install
npm start
```

Health check:
- `GET http://localhost:3000/health`

## Akun Default
- Proktor: `bayu / admin`
- Siswa dummy:
  - `andi01 / 12345`
  - `bunga01 / 12345`
  - `citra01 / 12345`
  - `dimas01 / 12345`
  - `eka01 / 12345`


## URL Akses
- Login Murid: `http://localhost:3000/`
- Login Proktor: `http://localhost:3000/proktor/login`
- Dashboard Proktor (setelah login): `http://localhost:3000/proktor`

## Submit Ujian Murid
- Saat murid berada di soal nomor 50, tombol **Soal Selanjutnya** berubah fungsi menjadi tombol penyelesaian ujian.
- Frontend akan memanggil `POST /api/student/finish` lalu diarahkan ke halaman `GET /finished`.

## Cara Proktor/Admin Memasukkan Soal & Kunci Jawaban
### Opsi 1 (disarankan): pakai script seeding
1. Siapkan dependency:
   ```bash
   npm install
   ```
2. Jalankan seed ke SQLite:
   ```bash
   npm run seed:questions
   ```
   Perintah ini akan membuat/memperbarui tabel `questions` dan mengisi 50 soal.

### Opsi 2: import via API (setelah login proktor)
- Endpoint: `POST /api/proctor/questions/import-json`
- Body JSON harus berisi field `questions` (array 50 item) dengan format:
  - `question_no`, `topic`, `question_html`, `option_a`, `option_b`, `option_c`, `option_d`, `answer_key`.
- Contoh singkat:
  ```json
  {
    "questions": [
      {
        "question_no": 1,
        "topic": "Besaran, Satuan dan Pengukuran",
        "question_html": "<p>...</p><p>[GAMBAR/GRAFIK ...]</p>",
        "option_a": "...",
        "option_b": "...",
        "option_c": "...",
        "option_d": "...",
        "answer_key": "A"
      }
    ]
  }
  ```

## Kelola Data Murid (Ganti Nama/Password/Tambah Murid)
Fitur ini menggunakan endpoint proktor, jadi **harus login proktor dulu** (`POST /api/proctor/login`).

### 1) Lihat daftar murid
- `GET /api/proctor/students`

### 2) Tambah murid baru
- `POST /api/proctor/students`
- Body JSON:
```json
{
  "name": "Nama Murid Baru",
  "username": "userbaru01",
  "password": "12345"
}
```

### 3) Ganti nama dan/atau password murid
- `PATCH /api/proctor/students/:studentId`
- Contoh ganti nama saja:
```json
{ "name": "Nama Baru" }
```
- Contoh ganti password saja:
```json
{ "password": "passwordBaru" }
```
- Contoh ganti keduanya:
```json
{ "name": "Nama Baru", "password": "passwordBaru" }
```

### Contoh cepat pakai curl
```bash
# login proktor (simpan cookie session)
curl -c cookie.txt -X POST http://localhost:3000/api/proctor/login \
  -H "Content-Type: application/json" \
  -d '{"username":"bayu","password":"admin"}'

# tambah murid
curl -b cookie.txt -X POST http://localhost:3000/api/proctor/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Siti Aulia","username":"siti01","password":"12345"}'

# ubah nama/password murid id=3
curl -b cookie.txt -X PATCH http://localhost:3000/api/proctor/students/3 \
  -H "Content-Type: application/json" \
  -d '{"name":"Citra Nabila Putri","password":"67890"}'
```
