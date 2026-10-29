-- Coffee Time GA4 property (Smartz Graphics account, stream 16230827034). Only fills it while blank,
-- so a later edit in HQ > Settings always wins.
INSERT OR IGNORE INTO settings (key, value) VALUES ('ga4_id', '');
UPDATE settings SET value = 'G-25HJXMDMHZ' WHERE key = 'ga4_id' AND value = '';
