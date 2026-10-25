-- The requests board, the punch list and the watchdog (same shape as the Zombie Bike Parade HQ).
-- Aaron files changes from the pencil on the real site (Edit website) or from HQ; the team works them here.

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting',      -- awaiting | answered | waiting | done | archived
  priority TEXT NOT NULL DEFAULT 'normal',      -- low | normal | high
  created_by TEXT,
  page TEXT,                                    -- the page it was filed from, e.g. /story
  source TEXT NOT NULL DEFAULT 'hq',            -- hq | site (the pencil on the live site)
  picked_up_at TEXT,
  picked_up_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_requests_page ON requests(page);

CREATE TABLE IF NOT EXISTS request_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  asks INTEGER NOT NULL DEFAULT 0,              -- 1 when the reply asks the requester a question
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_request_messages_req ON request_messages(request_id, id);

-- Screenshots and PDFs. The bytes live in R2 (binding MEDIA), never in D1.
-- A file is uploaded first with no owner, then bound to a request, message or punch list item.
CREATE TABLE IF NOT EXISTS request_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER,
  message_id INTEGER,
  checklist_item_id INTEGER,
  r2_key TEXT NOT NULL,
  ext TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',           -- image | document
  filename TEXT,
  bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_request_attachments ON request_attachments(request_id, message_id);
CREATE INDEX IF NOT EXISTS idx_request_attachments_item ON request_attachments(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_request_attachments_unbound ON request_attachments(uploaded_by, created_at);

-- The punch list: what is left to do, broken into pieces, each with a recommendation already written.
CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  section_sort INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  detail TEXT,
  kind TEXT NOT NULL DEFAULT 'task',            -- task (we build) | question (you decide) | asset (you send)
  status TEXT NOT NULL DEFAULT 'open',          -- open | doing | done | dropped
  owner TEXT,                                   -- who it is waiting on
  suggestion TEXT,                              -- our recommendation for a question
  answer TEXT,                                  -- the decision
  answer_source TEXT,                           -- suggested | own
  notes TEXT,
  request_id INTEGER,                           -- set when promoted to a request thread
  source TEXT,
  added_by TEXT,
  last_edited_by TEXT,
  picked_up_at TEXT,
  picked_up_by TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checklist ON checklist_items(section_sort, sort, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_checklist_title ON checklist_items(section, title);
