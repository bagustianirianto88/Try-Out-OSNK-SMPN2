const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TEST_DURATION_SECONDS = 90 * 60;

const db = new Database(path.join(__dirname, 'cbt.db'));

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
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
      student_id INTEGER UNIQUE NOT NULL,
      start_time INTEGER,
      current_question INTEGER DEFAULT 1,
      answers_json TEXT DEFAULT '{}',
      doubts_json TEXT DEFAULT '[]',
      finished INTEGER DEFAULT 0,
      online INTEGER DEFAULT 0,
      last_seen INTEGER,
      FOREIGN KEY(student_id) REFERENCES students(id)
    );
  `);

  const students = [
    ['Andi Pratama', 'andi01', '12345'],
    ['Bunga Lestari', 'bunga01', '12345'],
    ['Citra Nabila', 'citra01', '12345'],
    ['Dimas Saputra', 'dimas01', '12345'],
    ['Eka Wulandari', 'eka01', '12345']
  ];
  const insertStudent = db.prepare('INSERT OR IGNORE INTO students(name, username, password) VALUES (?, ?, ?)');
  students.forEach((s) => insertStudent.run(...s));

  const token = 'ABC123';
  db.prepare(`
    INSERT INTO proctor_state(id, username, password, active_token, updated_at)
    VALUES (1, 'bayu', 'admin', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(token, Date.now());

  const allStudents = db.prepare('SELECT id FROM students').all();
  const insSession = db.prepare('INSERT OR IGNORE INTO sessions(student_id) VALUES (?)');
  allStudents.forEach((s) => insSession.run(s.id));
}
initDb();

const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'osn-ipa-secret', resave: false, saveUninitialized: false }));

function getToken() {
  return db.prepare('SELECT active_token FROM proctor_state WHERE id=1').get().active_token;
}

function buildStudentStatusRow(studentId) {
  const row = db.prepare(`SELECT st.name, st.username, se.online, se.current_question, se.answers_json
    FROM students st JOIN sessions se ON st.id=se.student_id WHERE st.id=?`).get(studentId);
  const answers = Object.keys(JSON.parse(row.answers_json || '{}')).length;
  return { ...row, answered: answers };
}

app.get('/', (req, res) => {
  res.render('student-login', { error: null, token: getToken() });
});

app.post('/login', (req, res) => {
  const { username, password, token } = req.body;
  const student = db.prepare('SELECT * FROM students WHERE username=? AND password=?').get(username, password);
  if (!student || token !== getToken()) {
    return res.render('student-login', { error: 'Login gagal. Periksa username/password/token.', token: getToken() });
  }
  const sessionRow = db.prepare('SELECT * FROM sessions WHERE student_id=?').get(student.id);
  if (sessionRow.finished) {
    return res.redirect('/finished');
  }
  if (!sessionRow.start_time) {
    db.prepare('UPDATE sessions SET start_time=?, online=1, last_seen=? WHERE student_id=?').run(Date.now(), Date.now(), student.id);
  } else {
    db.prepare('UPDATE sessions SET online=1, last_seen=? WHERE student_id=?').run(Date.now(), student.id);
  }
  req.session.studentId = student.id;
  io.emit('student:update', buildStudentStatusRow(student.id));
  return res.redirect('/test');
});

app.get('/test', (req, res) => {
  if (!req.session.studentId) return res.redirect('/');
  const student = db.prepare('SELECT * FROM students WHERE id=?').get(req.session.studentId);
  const s = db.prepare('SELECT * FROM sessions WHERE student_id=?').get(student.id);
  const now = Date.now();
  const remaining = s.start_time ? Math.max(0, TEST_DURATION_SECONDS - Math.floor((now - s.start_time) / 1000)) : TEST_DURATION_SECONDS;
  if (remaining <= 0) {
    db.prepare('UPDATE sessions SET finished=1, online=0 WHERE student_id=?').run(student.id);
    return res.redirect('/finished');
  }
  res.render('test', {
    student,
    token: getToken(),
    questions,
    state: {
      currentQuestion: s.current_question,
      answers: JSON.parse(s.answers_json || '{}'),
      doubts: JSON.parse(s.doubts_json || '[]'),
      remaining
    }
  });
});

app.post('/api/save-answer', (req, res) => {
  if (!req.session.studentId) return res.status(401).json({ ok: false });
  const { questionNumber, answer, doubt } = req.body;
  const s = db.prepare('SELECT * FROM sessions WHERE student_id=?').get(req.session.studentId);
  const answers = JSON.parse(s.answers_json || '{}');
  const doubts = new Set(JSON.parse(s.doubts_json || '[]'));
  if (answer) answers[questionNumber] = answer;
  if (doubt) doubts.add(questionNumber); else doubts.delete(questionNumber);
  db.prepare('UPDATE sessions SET answers_json=?, doubts_json=?, current_question=?, last_seen=? WHERE student_id=?')
    .run(JSON.stringify(answers), JSON.stringify([...doubts]), questionNumber, Date.now(), req.session.studentId);
  io.emit('student:update', buildStudentStatusRow(req.session.studentId));
  res.json({ ok: true });
});

app.post('/api/finish', (req, res) => {
  if (!req.session.studentId) return res.status(401).json({ ok: false });
  db.prepare('UPDATE sessions SET finished=1, online=0 WHERE student_id=?').run(req.session.studentId);
  io.emit('student:update', buildStudentStatusRow(req.session.studentId));
  res.json({ ok: true, redirect: '/finished' });
});

app.get('/finished', (req, res) => res.render('finished'));

app.get('/proktor', (req, res) => res.render('proctor-login', { error: null }));
app.post('/proktor/login', (req, res) => {
  const { username, password } = req.body;
  const p = db.prepare('SELECT * FROM proctor_state WHERE id=1 AND username=? AND password=?').get(username, password);
  if (!p) return res.render('proctor-login', { error: 'Login proktor gagal.' });
  req.session.proctor = true;
  res.redirect('/proktor/dashboard');
});
app.get('/proktor/dashboard', (req, res) => {
  if (!req.session.proctor) return res.redirect('/proktor');
  const students = db.prepare(`SELECT st.id, st.name, st.username, se.online, se.current_question, se.answers_json
    FROM students st JOIN sessions se ON st.id=se.student_id ORDER BY st.name`).all()
    .map((r) => ({ ...r, answered: Object.keys(JSON.parse(r.answers_json || '{}')).length }));
  res.render('proctor-dashboard', { token: getToken(), students });
});

app.post('/proktor/generate-token', (req, res) => {
  if (!req.session.proctor) return res.status(403).end();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const token = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  db.prepare('UPDATE proctor_state SET active_token=?, updated_at=? WHERE id=1').run(token, Date.now());
  io.emit('token:update', token);
  res.json({ token });
});

app.post('/proktor/reset/:studentId', (req, res) => {
  if (!req.session.proctor) return res.status(403).end();
  const id = Number(req.params.studentId);
  db.prepare(`UPDATE sessions SET start_time=NULL,current_question=1,answers_json='{}',doubts_json='[]',finished=0,online=0,last_seen=NULL WHERE student_id=?`).run(id);
  io.emit('student:update', buildStudentStatusRow(id));
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('student:heartbeat', (studentId) => {
    db.prepare('UPDATE sessions SET online=1,last_seen=? WHERE student_id=?').run(Date.now(), studentId);
  });
});

setInterval(() => {
  const threshold = Date.now() - 15000;
  db.prepare('UPDATE sessions SET online=0 WHERE last_seen IS NULL OR last_seen < ?').run(threshold);
}, 5000);

server.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
