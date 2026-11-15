-- 2026-11-15: the Donut Dash commercial sits on its game's picture in the Arcade, like Rapid Refill's.
UPDATE games SET commercial = '/video/donut-dash-commercial-1.mp4', commercial_poster = '/img/donut-dash-commercial-poster-1.webp' WHERE kind = 'ar' AND title = 'Donut Dash' AND commercial = '';
