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
UPDATE games SET image = '/img/game-star-bugs-2d.webp' WHERE kind = '2d' AND title = 'Star Bugs';
-- The "as printed" online app was a failed experiment: remove it. /play now redirects to the games section.
DELETE FROM games WHERE url = '/play/';
-- Shorter, wider copy on the delivered card and order section.
UPDATE blocks SET value = 'Every one of our 1,000 first edition games has been delivered, many given away along the way. Thank you for playing, playtesting and carrying a copy home.'
  WHERE key = 'delivered_body' AND value LIKE 'We made 1,000 first edition games and every one%';
UPDATE blocks SET value = 'Coffee Time is delivered, and it is the happiest ending we could have hoped for. We made 1,000 first edition games and the very last ones were raffle prizes at the festival.

Every copy now lives on a board game shelf, or sits in a coffee shop or game shop waiting for friends to sit down and play. Thank you to everyone who played, playtested, cheered us on and carried a copy home.

**Want to say hello?** Write to us at [playcoffeetime@yahoo.com](mailto:playcoffeetime@yahoo.com).'
  WHERE key = 'orders_body' AND value LIKE 'Coffee Time is sold out%';
-- Nick Domke joins the team (photo is a placeholder until he sends one).
INSERT OR IGNORE INTO creators(name, role, place, bio, url, image, sort) VALUES('Nick Domke', 'Video Game Lead', 'Davis, CA', 'Leads the Da Vinci game club that is building Coffee Time Adventures, our first video game, and brings the Coffee Time universe to life in 3D.', 'https://dvgameclub.itch.io/', '/img/team-nick-domke.webp', 6);
