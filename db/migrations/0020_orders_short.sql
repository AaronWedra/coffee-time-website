-- Aaron, 2026-11-11: the sold-out paragraph takes too much height. Only shorten it where it is still
-- the long text this site wrote (0011); an HQ edit is left alone.
UPDATE blocks SET value = 'All 1,000 first edition games are delivered, the last ones as raffle prizes at the festival. Thank you to everyone who played, playtested and carried a copy home.

**Want to say hello?** Write to us at [playcoffeetime@yahoo.com](mailto:playcoffeetime@yahoo.com).' WHERE key = 'orders_body' AND (value LIKE 'Coffee Time is delivered, and it is%' OR value LIKE 'Coffee Time is sold out, and it is%');
