-- Migration number: 0001 	 2026-11-05T05:07:38.567Z
-- Timestamps are Unix epoch milliseconds (Date.now()).

-- One row per tag/person. Only the SHA-256 hash of the tag token is stored.
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE COLLATE NOCASE, -- NULL until the tag is claimed
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  last_login_at INTEGER, -- set on each tag tap
  revoked_at INTEGER
);

-- One row per logged-in device. Only the SHA-256 hash of the cookie is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_user_id ON sessions (user_id);

-- Dance playlist. Every track must record its licence.
CREATE TABLE tracks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  license_type TEXT NOT NULL,
  license_details TEXT NOT NULL,
  attribution TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

-- Growth entries. A post is a draft until published_at is set.
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  photo_key TEXT, -- R2 key, NULL until uploaded
  thumb_key TEXT,
  track_id INTEGER REFERENCES tracks (id),
  music_started_at INTEGER,
  created_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX posts_user_published ON posts (user_id, published_at);

-- When each viewer last opened each owner's plant, for the "new" badge.
CREATE TABLE plant_views (
  viewer_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_viewed_at INTEGER NOT NULL,
  PRIMARY KEY (viewer_id, owner_id)
) WITHOUT ROWID;
