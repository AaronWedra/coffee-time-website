-- 2026 focus: the games section is only the Coffee Time games. Remove the other game-club entries
-- added by 0009's first seed, and drop the AR Archer row.
DELETE FROM games WHERE title NOT IN ('Rapid Refill','Donut Dash','Star Bugs','Coffee Time Adventures','Overtime','Rush Hour','Coffee Time, as printed');
DELETE FROM games WHERE title = 'Coffee Time Adventures' AND kind <> '3d';
UPDATE games SET image='/img/poster-star-bugs.webp' WHERE title='Star Bugs' AND image='';
UPDATE games SET image='/img/rapid-refill.webp' WHERE title='Rapid Refill' AND image='';
UPDATE games SET image='/img/donut-dash.webp' WHERE title='Donut Dash' AND image='';
UPDATE blocks SET value='We are a small team in Davis, California, and we make video games set in the Coffee Time universe. Play them free in your browser, on your phone or on your own table in AR.' WHERE key='games_intro' AND value LIKE '%18 games%';
