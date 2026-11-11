-- Real game screenshots on the cards, and "delivered" instead of "sold" (we gave many away).
UPDATE games SET image = '/img/game-star-bugs.webp' WHERE image = '/img/poster-star-bugs.webp';
UPDATE games SET image = '/img/game-rapid-refill-ar.webp' WHERE kind = 'ar' AND image = '/img/rapid-refill.webp';
UPDATE games SET image = '/img/game-donut-dash-ar.webp' WHERE kind = 'ar' AND image = '/img/donut-dash.webp';
UPDATE games SET image = '/img/game-overtime.webp' WHERE image = '/img/poster-overtime.webp';
UPDATE games SET image = '/img/game-rush-hour.webp' WHERE image = '/img/poster-rush-hour.webp';
UPDATE games SET image = '/img/game-coffee-time-online.webp' WHERE image = '/img/poster-coffee-time-online.webp';
UPDATE blocks SET value = 'Delivered. 1,000 of 1,000.' WHERE key = 'cover_kicker' AND value = 'Sold out. 1,000 of 1,000.';
UPDATE blocks SET value = REPLACE(value, 'found a home, on family shelves', 'were delivered, to family shelves') WHERE key = 'cover_note';
UPDATE blocks SET value = 'All 1,000 first edition games have been delivered.' WHERE key = 'orders_intro' AND value = 'All 1,000 first edition games have found a home.';
UPDATE blocks SET value = 'Our board game is delivered. Now we make video games.' WHERE key = 'cover_tagline' AND value = 'Our board game sold out. Now we make video games.';
