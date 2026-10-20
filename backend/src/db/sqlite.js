const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('overnight_chats.db');

// Initialize tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      group_id TEXT,
      group_name TEXT,
      sender TEXT,
      content TEXT,
      timestamp INTEGER,
      summarized INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      group_name TEXT,
      line_one TEXT,
      line_two TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function saveMessage({ platform, groupId, groupName, sender, content, timestamp }) {
  // Filter out empty noise or 1-word "ok/lol" replies right at ingestion
  if (!content || content.trim().length < 3) return;
  
  const stmt = db.prepare(`
    INSERT INTO messages (platform, group_id, group_name, sender, content, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(platform, groupId, groupName, sender, content.trim(), timestamp);
  stmt.finalize();
}

function getUnsummarizedMessages(groupId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sender, content FROM messages WHERE group_id = ? AND summarized = 0 ORDER BY timestamp ASC`,
      [groupId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function markGroupSummarized(groupId) {
  db.run(`UPDATE messages SET summarized = 1 WHERE group_id = ?`, [groupId]);
}

function clearAllData() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM messages', (err) => { if (err) reject(err); });
      db.run('DELETE FROM summaries', (err) => { if (err) reject(err); });
      db.run("DELETE FROM sqlite_sequence WHERE name IN ('messages', 'summaries')", (err) => {
        if (err) return reject(err);
        // VACUUM rewrites the file so the deleted rows are not left behind on disk
        db.run('VACUUM', (vacErr) => (vacErr ? reject(vacErr) : resolve()));
      });
    });
  });
}

module.exports = { db, saveMessage, getUnsummarizedMessages, markGroupSummarized, clearAllData };