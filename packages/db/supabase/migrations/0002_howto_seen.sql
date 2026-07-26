-- Which daily games this device has already been shown the how-to-play modal
-- for. Kept on the device row rather than in browser storage so it travels
-- with a recovery code: a player who restores their streaks on a new phone
-- should not be re-taught three games they already know.
--
-- text[] rather than a jsonb prefs blob: one concern, and marking a game seen
-- is a single array_append with no read-modify-write race.
alter table daily_devices
  add column seen_howto text[] not null default '{}';
