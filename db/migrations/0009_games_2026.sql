-- 2026 redesign: the video games are the story now. Games get a kind (2d, 3d, ar) and an engine,
-- and a game is unique per title and kind so a re-seed can never double the list.
ALTER TABLE games ADD COLUMN kind TEXT NOT NULL DEFAULT '2d';
ALTER TABLE games ADD COLUMN engine TEXT NOT NULL DEFAULT '';
DROP INDEX IF EXISTS ux_games_title;
CREATE UNIQUE INDEX IF NOT EXISTS ux_games_title_kind ON games(title, kind);
UPDATE games SET engine = 'GameMaker' WHERE title IN ('Rapid Refill', 'Donut Dash') AND engine = '';
-- The cover words, only if nobody has edited them in HQ yet.
UPDATE blocks SET value = 'Sold out. 1,000 of 1,000.' WHERE key = 'cover_kicker' AND value = 'Press start';
UPDATE blocks SET value = 'Our board game sold out. Now we make video games.' WHERE key = 'cover_tagline' AND value = 'The board game where coffee heroes race King Tea.';
