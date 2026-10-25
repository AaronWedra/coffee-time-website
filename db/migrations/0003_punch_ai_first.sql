-- Aaron's rule: the vast majority of the punch list is handled by Claude. Only things that need a human
-- (an account login, a file only he has, a registrar click) stay with him. Guarded so HQ edits are never overwritten.
UPDATE checklist_items SET status='done', answer='Keep requests for now', answer_source='suggested', owner='Claude',
  notes='Decided for you: it matches how you sell today and nothing can be charged by mistake. Online payment can be added later as one more step.'
  WHERE title='Keep orders as requests, or take card payments online?' AND status='open' AND answer IS NULL;
UPDATE checklist_items SET status='done', answer='Keep quoting by email', answer_source='suggested', owner='Claude',
  notes='Decided for you. When you settle on a flat rate we print it on the order page.'
  WHERE title='How should shipping be quoted?' AND status='open' AND answer IS NULL;
UPDATE checklist_items SET owner='Claude', kind='task', detail='Claude does the Cloudflare side (add the zone, custom domains, SITE_URL, indexing). The only human step is changing the nameservers at the registrar, and Claude will give you the two exact lines to paste when it is time.'
  WHERE title='Point playcoffeetime.com at this site' AND status='open' AND notes IS NULL;
UPDATE checklist_items SET status='dropped', notes='Not needed as a task. Add reviews in HQ > Reviews any time, or just file it from the pencil.'
  WHERE title='Any newer reviews or press quotes' AND status='open' AND notes IS NULL;
UPDATE checklist_items SET status='dropped', notes='Done by using it: any change you file from the pencil is the test.'
  WHERE title='File one real change from the pencil' AND status='open' AND notes IS NULL;
UPDATE checklist_items SET owner='Claude', detail='Claude works this page by page from the requests you file with the pencil. Nothing for you to decide up front.'
  WHERE title='Beautify pass, page by page' AND status='open' AND notes IS NULL;
UPDATE checklist_items SET owner='Claude', detail='Claude sets up Resend and the domain verification as part of going live. The one human step is creating the free Resend account and pasting its key into Cloudflare, which Claude will walk you through when the domain has moved.'
  WHERE title='Turn on email alerts for new orders and sign-ups' AND status='open' AND answer IS NULL;
UPDATE checklist_items SET kind='task', owner='Aaron', detail='Only you can see this: open Wix > Domains and tell us who the registrar is (a screenshot through the pencil is enough). Claude handles everything after that.'
  WHERE title='Where is playcoffeetime.com registered?' AND status='open' AND answer IS NULL;
