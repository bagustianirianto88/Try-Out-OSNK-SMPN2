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
