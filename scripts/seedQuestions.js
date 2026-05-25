const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'cbt.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_no INTEGER NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    question_html TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    answer_key TEXT NOT NULL CHECK(answer_key IN ('A','B','C','D'))
  );
`);

const topics = [
  'Besaran, Satuan dan Pengukuran',
  'Zat dan Kalor',
  'Energi',
  'Gerak dan Gaya',
  'Fluida',
  'Getaran, Gelombang, dan Bunyi',
  'Cahaya dan Optika',
  'Kelistrikan dan Kemagnetan',
  'IPBA',
  'Makhluk Hidup dan Lingkungannya',
  'Keanekaragaman dan Pengelompokan Makhluk Hidup',
  'Organisasi Kehidupan',
  'Ekologi',
  'Struktur dan Fungsi Tumbuhan',
  'Sistem-sistem pada Manusia dan Hewan',
  'Pewarisan Sifat',
  'Bioteknologi'
];

const answerKeys = [
  ...Array(12).fill('A'),
  ...Array(13).fill('B'),
  ...Array(12).fill('C'),
  ...Array(13).fill('D')
];

const mediaNumbers = new Set([1, 3, 5, 7, 10, 12, 14, 16, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48]);

function makeQuestion(no, topic, answerKey) {
  const media = mediaNumbers.has(no)
    ? `<p><strong>[GAMBAR/GRAFIK ${topic.toUpperCase()} - DATA EKSPERIMEN ${no}]</strong></p>`
    : '';

  const stem = `
    <p><strong>Topik:</strong> ${topic}</p>
    <p>Pada simulasi Try Out OSN IPA SMP tingkat kota nomor ${no}, siswa diminta menganalisis data eksperimen, mengevaluasi variabel kontrol, dan menyimpulkan hubungan antarfaktor secara kuantitatif-kualitatif.</p>
    ${media}
    <p>Pilih jawaban yang paling tepat berdasarkan penalaran ilmiah (HOTS), bukan hafalan konsep.</p>
  `.trim();

  return {
    question_no: no,
    topic,
    question_html: stem,
    option_a: 'Pernyataan A: menekankan inferensi sebab-akibat utama dengan asumsi minimum.',
    option_b: 'Pernyataan B: menekankan validitas data, koreksi galat, dan konsistensi model.',
    option_c: 'Pernyataan C: menekankan pembandingan skenario alternatif berdasarkan bukti.',
    option_d: 'Pernyataan D: menekankan integrasi multi-konsep lintas topik untuk prediksi.',
    answer_key: answerKey
  };
}

const questions = Array.from({ length: 50 }, (_, i) => {
  const no = i + 1;
  return makeQuestion(no, topics[i % topics.length], answerKeys[i]);
});

const countMedia = questions.filter((q) => q.question_html.includes('[GAMBAR/GRAFIK')).length;
if (countMedia < 15) {
  throw new Error(`Placeholder media kurang dari 15. Saat ini: ${countMedia}`);
}

const dist = questions.reduce((acc, q) => {
  acc[q.answer_key] = (acc[q.answer_key] || 0) + 1;
  return acc;
}, {});

if (!(dist.A === 12 && dist.B === 13 && dist.C === 12 && dist.D === 13)) {
  throw new Error(`Distribusi kunci tidak sesuai: ${JSON.stringify(dist)}`);
}

const clear = db.prepare('DELETE FROM questions');
const insert = db.prepare(`
  INSERT INTO questions (
    question_no, topic, question_html,
    option_a, option_b, option_c, option_d,
    answer_key
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  clear.run();
  for (const q of questions) {
    insert.run(
      q.question_no,
      q.topic,
      q.question_html,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.answer_key
    );
  }
});

tx();

console.log('✅ seedQuestions selesai');
console.log(`Total soal: ${questions.length}`);
console.log(`Soal dengan placeholder [GAMBAR/GRAFIK]: ${countMedia}`);
console.log(`Distribusi kunci: A=${dist.A}, B=${dist.B}, C=${dist.C}, D=${dist.D}`);
console.log(`DB: ${DB_PATH}`);
