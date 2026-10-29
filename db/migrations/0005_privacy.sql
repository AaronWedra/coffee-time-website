-- Privacy page (/privacy): the analytics and cookies note that Google Analytics Terms section 7 asks for.
-- Editable in HQ > Page copy. INSERT OR IGNORE, so it never overwrites an HQ edit.

INSERT OR IGNORE INTO blocks(key,label,kind,value,page,sort) VALUES('privacy_title','Privacy page: headline','line','Privacy','privacy',60);
INSERT OR IGNORE INTO blocks(key,label,kind,value,page,sort) VALUES('privacy_intro','Privacy page: intro','text','This page explains what Coffee Time collects when you visit this site.','privacy',61);
INSERT OR IGNORE INTO blocks(key,label,kind,value,page,sort) VALUES('privacy_analytics','Privacy page: analytics and cookies','text','We use Google Analytics to understand how people use this site: which pages are visited, roughly where visitors are (city level), what kind of device and browser they use, and how they found us. Google Analytics sets small cookies (named _ga) to tell a returning visitor from a new one. We shorten your IP address before it is stored, Google''s advertising features are turned off, and we never sell or share this information. Anything you type into a form on this site goes only to us, never to Google Analytics.

You can opt out at any time by installing Google''s opt-out browser add-on ([https://tools.google.com/dlpage/gaoptout](https://tools.google.com/dlpage/gaoptout)). Google explains how it uses this data at [https://policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites).','privacy',62);
INSERT OR IGNORE INTO blocks(key,label,kind,value,page,sort) VALUES('privacy_questions','Privacy page: questions line (the email address follows it)','line','Questions? Contact us:','privacy',63);
