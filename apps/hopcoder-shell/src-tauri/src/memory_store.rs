use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryItem {
    pub id: String,
    pub kind: String,
    pub project_id: Option<String>,
    pub session_id: Option<String>,
    pub key: String,
    pub value_json: String,
    pub created_at: i64,
    pub expires_at: Option<i64>,
}

pub struct MemoryStore {
    conn: Connection,
}

impl MemoryStore {
    pub fn new(db_path: &str) -> rusqlite::Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS memory (
              id TEXT PRIMARY KEY,
              kind TEXT NOT NULL CHECK (kind IN ('project', 'session')),
              project_id TEXT,
              session_id TEXT,
              key TEXT NOT NULL,
              value_json TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              expires_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_memory_project_kind_key
              ON memory (project_id, kind, key);
            CREATE INDEX IF NOT EXISTS idx_memory_session_kind_key
              ON memory (session_id, kind, key);
            CREATE INDEX IF NOT EXISTS idx_memory_expires_at
              ON memory (expires_at);
            "#,
        )?;
        Ok(Self { conn })
    }

    pub fn save(
        &self,
        kind: &str,
        project_id: Option<&str>,
        session_id: Option<&str>,
        key: &str,
        value_json: &str,
        expires_at: Option<i64>,
    ) -> rusqlite::Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            r#"
            INSERT INTO memory (id, kind, project_id, session_id, key, value_json, created_at, expires_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                id,
                kind,
                project_id,
                session_id,
                key,
                value_json,
                now,
                expires_at
            ],
        )?;
        Ok(id)
    }

    pub fn load_for_project(&self, project_id: &str) -> rusqlite::Result<Vec<MemoryItem>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, kind, project_id, session_id, key, value_json, created_at, expires_at
            FROM memory
            WHERE kind = 'project'
              AND project_id = ?1
              AND (expires_at IS NULL OR expires_at > strftime('%s','now'))
            ORDER BY created_at ASC
            "#,
        )?;

        let rows = stmt.query_map([project_id], |row| {
            Ok(MemoryItem {
                id: row.get(0)?,
                kind: row.get(1)?,
                project_id: row.get(2)?,
                session_id: row.get(3)?,
                key: row.get(4)?,
                value_json: row.get(5)?,
                created_at: row.get(6)?,
                expires_at: row.get(7)?,
            })
        })?;

        Ok(rows.filter_map(Result::ok).collect())
    }
}
