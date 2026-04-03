CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS state_snapshots (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_pending (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_recently_dispatched (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  dispatched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS confirmations_pending (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS confirmations_recent (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS escalation_active (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  next_action_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thread_histories (
  thread_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS digest_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  digest_date TEXT NOT NULL,
  period TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  delivered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_tracker (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_ingest_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chores_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finances_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grocery_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pets_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS school_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS travel_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relationship_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_status_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meals_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
