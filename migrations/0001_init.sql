CREATE TABLE sessions (user TEXT NOT NULL, id TEXT NOT NULL, doc TEXT NOT NULL,
  updated_at INTEGER NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (user, id));
CREATE INDEX sessions_user_seq ON sessions (user, seq);
CREATE TABLE settings (user TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  updated_at INTEGER NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (user, key));
CREATE TABLE counters (user TEXT PRIMARY KEY, seq INTEGER NOT NULL);
