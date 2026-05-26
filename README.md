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
