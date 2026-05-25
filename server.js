const path = require('path');
const express = require('express');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'cbt.db');
const TEST_DURATION_SECONDS = 90 * 60;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'osn-ipa-2026-secret',
    resave: false,
    saveUninitialized: false
  })
);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ===== DB Bootstrap =====
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS proctor_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    active_token TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL UNIQUE,
    start_time INTEGER,
    current_question INTEGER NOT NULL DEFAULT 1,
    answers_json TEXT NOT NULL DEFAULT '{}',
    doubts_json TEXT NOT NULL DEFAULT '[]',
    finished INTEGER NOT NULL DEFAULT 0,
    online INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );
`);

const seedProctorStmt = db.prepare(`
  INSERT INTO proctor_state (id, username, password, active_token, updated_at)
  VALUES (1, 'bayu', 'admin', 'ABC123', ?)
  ON CONFLICT(id) DO UPDATE SET
    username = excluded.username,
    password = excluded.password
`);
seedProctorStmt.run(Date.now());

const defaultStudents = [
  ['Andi Pratama', 'andi01', '12345'],
  ['Bunga Lestari', 'bunga01', '12345'],
  ['Citra Nabila', 'citra01', '12345'],
  ['Dimas Saputra', 'dimas01', '12345'],
  ['Eka Wulandari', 'eka01', '12345']
];

const insertStudentStmt = db.prepare('INSERT OR IGNORE INTO students (name, username, password) VALUES (?, ?, ?)');
for (const student of defaultStudents) insertStudentStmt.run(student[0], student[1], student[2]);

const allStudentIds = db.prepare('SELECT id FROM students').all();
const insertSessionStmt = db.prepare('INSERT OR IGNORE INTO sessions (student_id) VALUES (?)');
for (const { id } of allStudentIds) insertSessionStmt.run(id);

// ===== Helpers =====
const questions = require('./data/questions.json');

function getActiveToken() {
  return db.prepare('SELECT active_token FROM proctor_state WHERE id = 1').get().active_token;
}

function getStudentMonitorRow(studentId) {
  const row = db.prepare(`
    SELECT s.id, s.name, s.username, se.online, se.current_question, se.answers_json, se.start_time, se.finished, se.last_seen
    FROM students s
    JOIN sessions se ON s.id = se.student_id
    WHERE s.id = ?
  `).get(studentId);

  const answered = Object.keys(JSON.parse(row.answers_json || '{}')).length;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    online: Boolean(row.online),
    currentQuestion: row.current_question,
    answered,
    total: 50,
    finished: Boolean(row.finished),
    lastSeen: row.last_seen
  };
}

function emitStudentStatus(studentId) {
  io.emit('proctor:student-status', getStudentMonitorRow(studentId));
}

function requireStudent(req, res, next) {
  if (!req.session.studentId) return res.status(401).json({ ok: false, message: 'Unauthorized student session' });
  return next();
}

// ===== Basic health =====
app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Server aktif', db: DB_PATH, now: new Date().toISOString() });
});

// ===== Tahap 2 Routes =====

// 1) Verifikasi login murid + token
app.post('/api/student/login', (req, res) => {
  const { username, password, token } = req.body;
  if (!username || !password || !token) {
    return res.status(400).json({ ok: false, message: 'username, password, token wajib diisi' });
  }

  if (token !== getActiveToken()) {
    return res.status(401).json({ ok: false, message: 'Token tidak valid' });
  }

  const student = db.prepare('SELECT * FROM students WHERE username = ? AND password = ?').get(username, password);
  if (!student) return res.status(401).json({ ok: false, message: 'Username/password salah' });

  const studentSession = db.prepare('SELECT * FROM sessions WHERE student_id = ?').get(student.id);
  if (!studentSession.start_time) {
    db.prepare('UPDATE sessions SET start_time = ?, online = 1, last_seen = ? WHERE student_id = ?').run(Date.now(), Date.now(), student.id);
  } else {
    db.prepare('UPDATE sessions SET online = 1, last_seen = ? WHERE student_id = ?').run(Date.now(), student.id);
  }

  req.session.studentId = student.id;
  req.session.role = 'student';

  emitStudentStatus(student.id);

  return res.json({
    ok: true,
    message: 'Login murid berhasil',
    student: { id: student.id, name: student.name, username: student.username }
  });
});

// 2) Verifikasi login proktor
app.post('/api/proctor/login', (req, res) => {
  const { username, password } = req.body;
  const proctor = db.prepare('SELECT * FROM proctor_state WHERE id = 1 AND username = ? AND password = ?').get(username, password);
  if (!proctor) return res.status(401).json({ ok: false, message: 'Login proktor gagal' });

  req.session.proctor = true;
  req.session.role = 'proctor';
  return res.json({ ok: true, message: 'Login proktor berhasil' });
});

// 3) Mengambil data soal untuk murid (dengan state ujian)
app.get('/api/student/questions', requireStudent, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE student_id = ?').get(req.session.studentId);
  const remainingSeconds = s.start_time
    ? Math.max(0, TEST_DURATION_SECONDS - Math.floor((Date.now() - s.start_time) / 1000))
    : TEST_DURATION_SECONDS;

  return res.json({
    ok: true,
    token: getActiveToken(),
    durationSeconds: TEST_DURATION_SECONDS,
    remainingSeconds,
    currentQuestion: s.current_question,
    answers: JSON.parse(s.answers_json || '{}'),
    doubts: JSON.parse(s.doubts_json || '[]'),
    questions
  });
});

// 4) Menyimpan jawaban murid (auto-save)
app.post('/api/student/answers', requireStudent, (req, res) => {
  const { questionNumber, answer, doubt = false } = req.body;

  if (!questionNumber || questionNumber < 1 || questionNumber > 50) {
    return res.status(400).json({ ok: false, message: 'questionNumber harus 1..50' });
  }
  if (answer && !['A', 'B', 'C', 'D'].includes(answer)) {
    return res.status(400).json({ ok: false, message: 'answer harus A/B/C/D' });
  }

  const s = db.prepare('SELECT * FROM sessions WHERE student_id = ?').get(req.session.studentId);
  const answers = JSON.parse(s.answers_json || '{}');
  const doubtsSet = new Set(JSON.parse(s.doubts_json || '[]'));

  if (answer) answers[questionNumber] = answer;
  if (doubt) doubtsSet.add(questionNumber);
  else doubtsSet.delete(questionNumber);

  db.prepare(`
    UPDATE sessions
    SET answers_json = ?, doubts_json = ?, current_question = ?, last_seen = ?, online = 1
    WHERE student_id = ?
  `).run(JSON.stringify(answers), JSON.stringify([...doubtsSet]), questionNumber, Date.now(), req.session.studentId);

  emitStudentStatus(req.session.studentId);

  return res.json({
    ok: true,
    message: 'Jawaban tersimpan',
    answered: Object.keys(answers).length,
    total: 50
  });
});

// Socket.io realtime event untuk status monitor proktor
io.on('connection', (socket) => {
  socket.on('student:heartbeat', (studentId) => {
    if (!studentId) return;
    db.prepare('UPDATE sessions SET online = 1, last_seen = ? WHERE student_id = ?').run(Date.now(), studentId);
    emitStudentStatus(studentId);
  });

  socket.on('proctor:request-initial-status', () => {
    const rows = db.prepare(`
      SELECT s.id
      FROM students s
      JOIN sessions se ON s.id = se.student_id
      ORDER BY s.name
    `).all();

    const payload = rows.map((r) => getStudentMonitorRow(r.id));
    socket.emit('proctor:initial-status', payload);
  });
});

// online/offline sweeper untuk dashboard proktor
setInterval(() => {
  const threshold = Date.now() - 15000;
  const staleRows = db.prepare('SELECT student_id FROM sessions WHERE online = 1 AND (last_seen IS NULL OR last_seen < ?)').all(threshold);

  db.prepare('UPDATE sessions SET online = 0 WHERE online = 1 AND (last_seen IS NULL OR last_seen < ?)').run(threshold);

  staleRows.forEach((r) => emitStudentStatus(r.student_id));
}, 5000);

server.listen(PORT, () => {
  console.log(`CBT server running at http://localhost:${PORT}`);
  console.log(`SQLite DB: ${DB_PATH}`);
});
