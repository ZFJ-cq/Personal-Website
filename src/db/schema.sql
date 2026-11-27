-- 作品 / 被测 App 共用一张表，用 kind 区分
CREATE TABLE IF NOT EXISTS works (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL CHECK (kind IN ('work','app')),
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  summary      TEXT,
  cover_url    TEXT,
  category     TEXT,
  status       TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('draft','wip','done','archived')),
  featured     INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  started_at   TEXT,
  finished_at  TEXT,
  meta         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_works_kind_sort ON works(kind, status, featured DESC, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_works_slug ON works(slug);

CREATE TABLE IF NOT EXISTS work_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'other'
             CHECK (type IN ('demo','repo','download','store','doc','other')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_links_work ON work_links(work_id, sort_order);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'tech' CHECK (kind IN ('tech','domain','testtype'))
);
CREATE TABLE IF NOT EXISTS work_tags (
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_work_tags_tag ON work_tags(tag_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  action     TEXT NOT NULL,
  target_id  INTEGER,
  payload    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slug_history (
  old_slug   TEXT PRIMARY KEY,
  new_slug   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,
  date       TEXT NOT NULL,
  path       TEXT NOT NULL,
  route_type TEXT NOT NULL,
  ref_host   TEXT,
  country    TEXT,
  device     TEXT CHECK (device IN ('mobile','tablet','desktop')),
  os         TEXT,
  browser    TEXT,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  is_bot     INTEGER NOT NULL DEFAULT 0,
  event      TEXT NOT NULL DEFAULT 'pageview',
  meta       TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_visits_date  ON visits(date, is_bot);
CREATE INDEX IF NOT EXISTS idx_visits_path  ON visits(path, date);
CREATE INDEX IF NOT EXISTS idx_visits_event ON visits(event, date);

CREATE TABLE IF NOT EXISTS stats_daily (
  date     TEXT PRIMARY KEY,
  pv       INTEGER NOT NULL DEFAULT 0,
  uv       INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  outbound INTEGER NOT NULL DEFAULT 0
);
