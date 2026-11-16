-- Instagram renamed from @play_coffee_time to @playcoffeetime (2026-11-16) to match YouTube and TikTok.
UPDATE settings SET value = 'https://www.instagram.com/playcoffeetime/', updated_at = datetime('now') WHERE key = 'instagram' AND value = 'https://www.instagram.com/play_coffee_time/';
