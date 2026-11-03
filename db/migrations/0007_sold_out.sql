-- The first edition is sold out: the last games were raffle prizes at the festival. Each update only
-- applies while the old wording is still in place, so anything edited in HQ since wins.
UPDATE blocks SET value = 'All 1,000 first edition games have found a home.'
  WHERE key = 'orders_intro' AND value = 'Coffee Time is now available!';
UPDATE blocks SET value = 'Coffee Time is sold out, and it is the happiest ending we could have hoped for. We made 1,000 first edition games, and the very last ones were given away as raffle prizes at the festival. Every single copy now lives on someone''s board game shelf, or sits in a coffee shop or game shop waiting for friends to sit down and play.

We are so honored to have produced 1,000 games. Thank you to everyone who played, playtested, cheered us on and carried a copy home. The Coffee Time story will keep being shared, one game night at a time.

**Want to say hello?** Write to us at [playcoffeetime@yahoo.com](mailto:playcoffeetime@yahoo.com).'
  WHERE key = 'orders_body' AND value LIKE 'We have completed a 5 year process%';
UPDATE blocks SET value = '5% of every sale went to [Purple Tree Café](https://www.purpletreecafe.org/)'
  WHERE key = 'charity_title' AND value = '5% of your purchase will go to [Purple Tree Café](https://www.purpletreecafe.org/)';
UPDATE blocks SET value = 'First edition: sold out'
  WHERE key = 'order_form_title' AND value = 'Order Coffee Time';
UPDATE settings SET value = '0' WHERE key = 'orders_open' AND value = '1';
