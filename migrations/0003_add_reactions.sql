-- Migration number: 0003 	 2026-11-05T07:25:02.973Z
-- One emoji reaction per member per post. The Worker checks the emoji against its allowed set.
CREATE TABLE reactions (
  post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
) WITHOUT ROWID;
