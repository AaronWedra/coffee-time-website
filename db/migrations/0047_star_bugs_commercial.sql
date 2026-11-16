-- 2026-11-16: the Star Bugs commercial sits on its game's picture in the Arcade, like Rapid Refill's and Donut Dash's.
UPDATE games SET commercial = '/video/star-bugs-commercial-1.mp4', commercial_poster = '/img/star-bugs-commercial-poster-1.webp' WHERE kind = 'ar' AND title = 'Star Bugs' AND commercial = ''
