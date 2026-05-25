const fs = require('fs');
const path = require('path');

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
  'Sistem pada Manusia dan Hewan',
  'Pewarisan Sifat',
  'Bioteknologi'
];

const answerPool = [
  ...Array(12).fill('A'),
  ...Array(13).fill('B'),
  ...Array(12).fill('C'),
  ...Array(13).fill('D')
];

const mediaIndexes = new Set([1,3,5,7,10,12,15,18,21,24,27,30,33,36,39,42,45,48]);

const questions = Array.from({ length: 50 }, (_, i) => {
  const number = i + 1;
  const topic = topics[i % topics.length];
  const includeMedia = mediaIndexes.has(number);
  const mediaBlock = includeMedia
    ? '<div class="bg-gray-200 p-4 text-center border" style="margin:8px 0;">[GAMBAR/GRAFIK ANALISIS SOAL]</div>'
    : '';

  return {
    id: number,
    topic,
    question_html: `<p><strong>Topik:</strong> ${topic}</p><p>Pada studi kasus OSN IPA, peserta diminta menganalisis data eksperimen nomor ${number}. Tentukan kesimpulan paling tepat berdasarkan prinsip ilmiah, evaluasi variabel kontrol, dan prediksi dampak perubahan parameter terhadap hasil akhir.</p>${mediaBlock}<p>Pilih jawaban yang paling logis dan didukung data.</p>`,
    options: {
      A: 'Kesimpulan A: fokus pada hubungan sebab-akibat utama dan asumsi minimum.',
      B: 'Kesimpulan B: mengutamakan validitas data, koreksi galat, dan konsistensi model.',
      C: 'Kesimpulan C: menekankan interpretasi alternatif melalui pendekatan komparatif.',
      D: 'Kesimpulan D: mengintegrasikan multi-konsep lintas topik untuk prediksi terbaik.'
    },
    answer_key: answerPool[i]
  };
});

const outPath = path.join(__dirname, '..', 'data', 'questions.json');
fs.writeFileSync(outPath, JSON.stringify(questions, null, 2));
console.log(`Generated ${questions.length} questions at ${outPath}`);
