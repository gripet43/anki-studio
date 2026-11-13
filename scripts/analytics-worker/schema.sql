CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  install_id TEXT NOT NULL,
  event TEXT NOT NULL,
  version TEXT,
  os TEXT,
  anki_version TEXT,
  locale TEXT,
  tz_offset INTEGER,
  country TEXT,
  colo TEXT,
  props TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_install ON events(install_id);
CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
