const path = require('path');
const express = require('express');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'cbt.db');

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

const now = Date.now();
const seedProctorStmt = db.prepare(`
  INSERT INTO proctor_state (id, username, password, active_token, updated_at)
  VALUES (1, 'bayu', 'admin', 'ABC123', ?)
  ON CONFLICT(id) DO UPDATE SET
    username = excluded.username,
    password = excluded.password
`);
seedProctorStmt.run(now);

const defaultStudents = [
  ['Andi Pratama', 'andi01', '12345'],
  ['Bunga Lestari', 'bunga01', '12345'],
  ['Citra Nabila', 'citra01', '12345'],
  ['Dimas Saputra', 'dimas01', '12345'],
  ['Eka Wulandari', 'eka01', '12345']
];

const insertStudentStmt = db.prepare(
  'INSERT OR IGNORE INTO students (name, username, password) VALUES (?, ?, ?)'
);
for (const student of defaultStudents) {
  insertStudentStmt.run(student[0], student[1], student[2]);
}

const allStudentIds = db.prepare('SELECT id FROM students').all();
const insertSessionStmt = db.prepare('INSERT OR IGNORE INTO sessions (student_id) VALUES (?)');
for (const { id } of allStudentIds) {
  insertSessionStmt.run(id);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Server aktif', db: DB_PATH });
});

io.on('connection', (socket) => {
  console.log('Socket terhubung:', socket.id);
  socket.on('disconnect', () => console.log('Socket terputus:', socket.id));
});

server.listen(PORT, () => {
  console.log(`CBT server running at http://localhost:${PORT}`);
  console.log(`SQLite DB: ${DB_PATH}`);
});
