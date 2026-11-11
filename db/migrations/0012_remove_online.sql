-- The online games (Overtime, Rush Hour, Coffee Time as printed) were a failed experiment: gone.
DELETE FROM games WHERE kind = 'online';
DELETE FROM blocks WHERE key = 'online_title';
