-- Migration number: 0004 	 2026-11-11T02:40:54.286Z
-- The roulette's result for a member's next nikki: how long to dance, and to which song.
-- One row per member, kept until a nikki is published, so it can't be rolled again.
CREATE TABLE rolls (
  user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  seconds INTEGER NOT NULL,
  track_id INTEGER NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

-- The dance time a draft was started with. NULL on drafts from before the roulette.
ALTER TABLE posts ADD COLUMN dance_seconds INTEGER;
