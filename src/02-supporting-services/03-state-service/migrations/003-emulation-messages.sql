CREATE TABLE IF NOT EXISTS emulation_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  source_type TEXT NOT NULL CHECK (source_type IN ('text', 'reaction', 'image')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emulation_messages_thread_time
  ON emulation_messages (thread_id, created_at);
