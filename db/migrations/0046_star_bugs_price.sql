-- Aaron, 2026-11-16: Star Bugs AR is getting the $1.99 paywall too, and nothing on the site may call it free.
UPDATE games SET blurb = blurb || ' The full game is a one-time $1.99.' WHERE title = 'Star Bugs' AND kind = 'ar' AND instr(blurb, '$1.99') = 0;
UPDATE blocks SET value = replace(value, 'Play them free in your browser, on your phone or on your own table in AR.', 'Play them in your browser, on your phone or on your own table in AR.') WHERE key = 'games_intro' AND instr(value, 'Play them free in your browser') > 0;
