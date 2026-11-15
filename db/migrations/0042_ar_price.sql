-- Aaron, 2026-11-15: the AR versions of Donut Dash and Rapid Refill cost $1.99 for the full game on Android (level 1 free),
-- and are free on iPhone and iPad. Say so on the cards, and stop calling the whole arcade free.
UPDATE games SET blurb = blurb || ' In AR: free on iPhone, $1.99 for the full game on Android.' WHERE title IN ('Donut Dash', 'Rapid Refill') AND kind = 'ar' AND instr(blurb, '$1.99') = 0;
UPDATE blocks SET value = 'Arcade' WHERE key = 'cover_kicker' AND value = 'Free arcade';
UPDATE blocks SET value = 'Video games in your browser, on your phone and on your table in AR. Most are free.' WHERE key = 'cover_note' AND value = 'Free video games in your browser, on your phone and on your table in AR.';
UPDATE blocks SET value = 'Play in your browser, on your phone, or on your table in AR.' WHERE key = 'zone_vg_sub' AND value = 'Play free in your browser, on your phone, or on your table in AR.';
