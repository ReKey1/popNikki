-- Migration number: 0002 	 2026-11-05T05:17:13.436Z
-- Tracks keep only a title and the R2 key of the audio file.
ALTER TABLE tracks DROP COLUMN artist;
ALTER TABLE tracks DROP COLUMN license_type;
ALTER TABLE tracks DROP COLUMN license_details;
ALTER TABLE tracks DROP COLUMN attribution;
ALTER TABLE tracks DROP COLUMN active;
