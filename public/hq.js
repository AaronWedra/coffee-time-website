// HQ progressive enhancement. Pages work without this; it adds uploads, shortcuts, local times, theme, the ? bubble.
(function () {
  var body = document.body, csrf = body.getAttribute('data-csrf') || '';
  function api(path, opts) { opts = opts || {}; opts.credentials = 'same-origin'; opts.headers = Object.assign({ 'X-HQ': '1' }, opts.headers || {}); return fetch(path, opts); }

  // Theme
  try { if (localStorage.getItem('hq-theme') === 'dark') body.classList.add('dark'); } catch (e) {}
  var t = document.getElementById('hq-theme');
  function label() { if (t) t.textContent = body.classList.contains('dark') ? 'Light mode' : 'Dark mode'; }
  label();
  if (t) t.onclick = function () { body.classList.toggle('dark'); try { localStorage.setItem('hq-theme', body.classList.contains('dark') ? 'dark' : 'light'); } catch (e) {} label(); };

  // Mobile menu
  var m = document.getElementById('hq-menu'), side = document.getElementById('hq-side');
  if (m && side) m.onclick = function () { side.classList.toggle('open'); };

  // Local times
  Array.prototype.forEach.call(document.querySelectorAll('time.loc'), function (el) {
    var d = new Date(el.textContent.trim().replace(' ', 'T') + 'Z');
    if (!isNaN(d)) el.textContent = d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  });

  // Arrow keys move between requests
  var th = document.querySelector('.thread');
  if (th) document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    var to = e.key === 'ArrowLeft' ? th.getAttribute('data-prev') : e.key === 'ArrowRight' ? th.getAttribute('data-next') : '';
    if (to) location.href = '/hq/requests/' + to;
  });

  // Attachment boxes: paste, drag, or pick; files upload now and their ids ride along in the hidden field.
  Array.prototype.forEach.call(document.querySelectorAll('[data-attach]'), function (box) {
    var ta = box.querySelector('textarea'), ids = box.querySelector('input[name=attachment_ids]'), thumbs = box.querySelector('.att-thumbs'), bar = box.querySelector('.att-bar');
    if (!ids || !thumbs) return;
    var list = [], note = document.createElement('span'); note.className = 'att-hint'; if (bar) bar.appendChild(note);
    var pick = document.createElement('input'); pick.type = 'file'; pick.multiple = true; pick.accept = 'image/*,application/pdf'; pick.hidden = true; box.appendChild(pick);
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'att-pick'; btn.textContent = 'Attach file'; if (bar) bar.insertBefore(btn, note);
    btn.onclick = function () { pick.click(); };
    function sync() {
      ids.value = list.map(function (a) { return a.id; }).join(',');
      thumbs.textContent = '';
      list.forEach(function (a) {
        var d = document.createElement('span'); d.className = 'thumb';
        if (a.kind === 'image') { var i = document.createElement('img'); i.src = a.url; i.alt = a.filename || ''; d.appendChild(i); } else d.textContent = a.filename || a.ext;
        var x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.onclick = function () { list = list.filter(function (p) { return p.id !== a.id; }); api('/hq/api/attachments/' + a.id + '/delete', { method: 'POST' }); sync(); };
        d.appendChild(x); thumbs.appendChild(d);
      });
    }
    function up(files) {
      Array.prototype.forEach.call(files, function (f) {
        if (/hei[cf]/i.test(f.type + f.name)) { note.textContent = 'HEIC photos will not upload. Save it as JPEG first.'; return; }
        if (f.size > 20 * 1048576) { note.textContent = (f.name || 'File') + ' is over 20 MB.'; return; }
        note.textContent = 'uploading...';
        var fd = new FormData(); fd.append('file', f, f.name || 'pasted-screenshot.png');
        api('/hq/api/attachments', { method: 'POST', body: fd }).then(function (r) { return r.json().then(function (j) { return [r.ok, j]; }); }).then(function (res) {
          if (res[0] && res[1].id) { list.push(res[1]); note.textContent = ''; sync(); } else note.textContent = res[1].error || 'Upload refused.';
        }).catch(function () { note.textContent = 'Upload failed. Check your connection.'; });
      });
    }
    pick.onchange = function () { up(pick.files); pick.value = ''; };
    if (ta) ta.addEventListener('paste', function (e) { if (e.clipboardData && e.clipboardData.files.length) { e.preventDefault(); up(e.clipboardData.files); } });
    box.addEventListener('dragover', function (e) { e.preventDefault(); });
    box.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) up(e.dataTransfer.files); });
  });

  // The ? bubble: ask about the HQ page you are on.
  if (csrf) {
    var b = document.createElement('button'); b.className = 'ask-fab'; b.type = 'button'; b.textContent = '?'; b.title = 'Ask for help with this page';
    var p = document.createElement('div'); p.className = 'ask-panel';
    p.innerHTML = '<b>Stuck or want a change on this page?</b><textarea placeholder="Tell us what you need"></textarea><div><button type="button" class="btn go">Send</button> <span class="ask-msg"></span></div>';
    body.appendChild(p); body.appendChild(b);
    b.onclick = function () { p.classList.toggle('open'); };
    p.querySelector('.go').onclick = function () {
      var v = p.querySelector('textarea').value.trim(), msg = p.querySelector('.ask-msg'); if (!v) return;
      var path = body.getAttribute('data-path') || location.pathname;
      api('/hq/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: v.slice(0, 80) + ' [' + path + ']', body: v, page: path, source: 'hq', attachment_ids: [] }) })
        .then(function (r) { if (!r.ok) throw 0; p.querySelector('textarea').value = ''; msg.textContent = 'Sent. It is on the Requests board.'; setTimeout(function () { p.classList.remove('open'); msg.textContent = ''; }, 1600); })
        .catch(function () { msg.textContent = 'Could not send. Try again.'; });
    };
  }
})();
