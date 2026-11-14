-- Aaron, 2026-11-14: the commercial of a game sits next to that game. Rapid Refill AR is first.
ALTER TABLE games ADD COLUMN commercial TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN commercial_poster TEXT NOT NULL DEFAULT '';
UPDATE games SET commercial = '/video/rapid-refill-commercial-1.mp4', commercial_poster = '/img/rapid-refill-commercial-poster-1.webp' WHERE kind = 'ar' AND title = 'Rapid Refill' AND commercial = '';
