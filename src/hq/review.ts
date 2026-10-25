// Edit website mode: the pencil.
//
// A teammate presses "Edit website" in HQ, browses the real public site, and files a change against the
// page they are looking at (with a pasted screenshot, and optionally by pointing at the exact thing),
// without switching back to HQ to describe where they were. It lands on the same Requests board.
//
// How it stays safe:
//   - The public site stays JavaScript-free for visitors. The pencil script is added to a page only when
//     the visitor has BOTH a real HQ session and the hq_review cookie (see inject() below, called from
//     worker.ts), and those responses are sent no-store so they can never be cached for a stranger.
//   - The script file itself is served only to a signed-in teammate.
//   - It runs in a shadow root so the site stylesheet and the widget cannot affect each other.
//   - Everything it posts goes to /hq/api, which needs the session and an X-HQ header.
import { Router, json, redirect, type Ctx } from '../lib/router.ts';
import { currentSession, type Session } from '../lib/auth.ts';
import { parseCookies } from '../lib/router.ts';

export const REVIEW_COOKIE = 'hq_review';

const cookie = (on: boolean, secure: boolean) =>
  `${REVIEW_COOKIE}=${on ? '1' : ''}; Path=/; HttpOnly; SameSite=Lax; ${secure ? 'Secure; ' : ''}Max-Age=${on ? 8 * 3600 : 0}`;

export function mountReview(hq: Router) {
  hq.get('/hq/review/start', async (c) => {
    const s = await currentSession(c);
    if (!s) return redirect('/hq?next=' + encodeURIComponent(c.url.pathname + c.url.search));
    const raw = c.url.searchParams.get('to') || '/';
    // Only ever bounce to a path on this site, never to a caller-supplied absolute URL.
    const to = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/hq') ? raw : '/';
    return new Response(null, { status: 302, headers: { location: to, 'set-cookie': cookie(true, c.url.protocol === 'https:'), 'cache-control': 'no-store' } });
  });

  hq.post('/hq/api/review/stop', async (c) => {
    if (!(await currentSession(c))) return json({ error: 'Sign in first.' }, 401);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'set-cookie': cookie(false, c.url.protocol === 'https:') } });
  });

  hq.get('/hq/review.js', async (c) => {
    if (!(await currentSession(c))) return new Response('Sign in to HQ first.', { status: 401 });
    return new Response(WIDGET, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'private, no-store' } });
  });
}

// Called from worker.ts for public-site HTML. Returns the response untouched unless review mode is on
// for a signed-in teammate.
export async function inject(c: Ctx, res: Response): Promise<Response> {
  if ((res.headers.get('content-type') || '').indexOf('text/html') < 0) return res;
  if (parseCookies(c.req)[REVIEW_COOKIE] !== '1') return res;
  const sess: Session | null = await currentSession(c).catch(() => null);
  if (!sess) return res;
  const page = await res.text();
  const tag = `<script nonce="${c.nonce}" src="/hq/review.js" defer></script>`;
  const out = page.includes('</body>') ? page.replace('</body>', tag + '</body>') : page + tag;
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'no-store');
  headers.set('vary', 'Cookie');
  headers.delete('content-length');
  return new Response(out, { status: res.status, headers });
}

// The widget. Plain browser JavaScript (no build step). No backticks and no ${ in here, it is a template literal.
const WIDGET = String.raw`(function () {
  if (document.getElementById('hq-review-host')) return;
  var nonce = (document.currentScript && document.currentScript.nonce) || '';
  var host = document.createElement('div');
  host.id = 'hq-review-host';
  host.setAttribute('data-nosnippet', '');
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });
  var staff = '';
  var pending = [];
  var busy = 0;
  var lastError = '';
  var pointed = '';
  var picking = false;

  var css = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:54px;height:54px;border-radius:999px;border:0;background:#fff245;color:#320158;font-size:26px;font-weight:800;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.35)}',
    '.fab:hover{background:#ffe600}',
    '.panel{position:fixed;right:16px;bottom:82px;z-index:2147483000;width:350px;max-width:calc(100vw - 32px);max-height:calc(100vh - 110px);overflow:auto;background:#fff;color:#1f1330;border:1px solid #d8cfe3;border-radius:16px;padding:14px;box-shadow:0 10px 40px rgba(0,0,0,.3);display:none}',
    '.panel.open{display:block}',
    'h4{margin:0 0 4px;font-size:15px;font-weight:800}',
    '.sub{margin:0 0 8px;font-size:11px;color:#6b5a7d;word-break:break-all}',
    'textarea{width:100%;min-height:92px;padding:8px;font-size:14px;border:1px solid #d8cfe3;border-radius:10px;resize:vertical}',
    'textarea:focus{outline:2px solid #8b3dc7;outline-offset:1px}',
    '.row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap}',
    '.mini{font-size:11px;color:#6b5a7d}',
    'button.act{border:1px solid #d8cfe3;background:#f6f1fa;border-radius:8px;padding:5px 9px;font-size:12px;cursor:pointer;color:#1f1330}',
    'button.act:hover{background:#ece3f4}',
    'button.go{background:#6d2aa0;color:#fff;border:0;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer}',
    'button.go:disabled{opacity:.45;cursor:default}',
    '.thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.thumb{position:relative}',
    '.thumb img{width:58px;height:58px;object-fit:cover;border-radius:8px;border:1px solid #d8cfe3;display:block}',
    '.thumb .doc{width:58px;height:58px;border:1px solid #d8cfe3;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:800;background:#f6f1fa}',
    '.thumb button{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:999px;border:1px solid #d8cfe3;background:#fff;font-size:11px;line-height:1;cursor:pointer;padding:0}',
    '.drop.over{outline:2px dashed #8b3dc7;outline-offset:2px;border-radius:10px}',
    '.chip{display:inline-flex;gap:6px;align-items:center;margin-top:8px;background:#f3e9fb;border:1px solid #d8cfe3;border-radius:8px;padding:4px 8px;font-size:11px;max-width:100%}',
    '.chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.chip button{border:0;background:none;cursor:pointer;font-size:13px;padding:0;color:#6b5a7d}',
    '.past{margin-top:10px;border-top:1px solid #ece3f4;padding-top:8px;font-size:11px}',
    '.past a{color:#5a1f8a;display:block;padding:2px 0;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.past a:hover{text-decoration:underline}',
    '.ok{color:#2f7a3d;font-weight:700}',
    '.gotit{color:#2f7a3d;font-weight:700}',
    '.err{color:#b3261e}',
    '.st{color:#8a7a9b}',
    '.hl{position:fixed;z-index:2147482999;pointer-events:none;border:2px solid #fff245;outline:2px solid #6d2aa0;background:rgba(109,42,160,.12);border-radius:4px;display:none}',
    '.hint{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483001;background:#320158;color:#fff;font-size:13px;padding:8px 14px;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.35);display:none}',
    'a.hq{font-size:11px;color:#5a1f8a}'
  ].join('');
  var st = document.createElement('style');
  if (nonce) st.setAttribute('nonce', nonce);
  st.textContent = css;
  root.appendChild(st);

  var wrap = document.createElement('div');
  wrap.innerHTML = [
    '<button class="fab" title="Request a change to this page" aria-label="Request a change to this page">&#9998;</button>',
    '<div class="hl" id="hl"></div><div class="hint" id="hint">Click the thing you mean. Esc to cancel.</div>',
    '<div class="panel" role="dialog" aria-label="Request a change">',
      '<h4>Change this page</h4>',
      '<p class="sub">Reviewing as <b id="who"></b> &middot; <span id="p"></span></p>',
      '<div class="drop" id="drop"><textarea id="t" placeholder="What should be different here? Paste a screenshot right in."></textarea></div>',
      '<div id="pt"></div>',
      '<div class="row"><span><button class="act" id="pick">Attach file</button> <button class="act" id="point">Point at it</button></span><span class="mini" id="st">or paste, or drag one in</span></div>',
      '<input type="file" id="f" multiple accept="image/*,application/pdf" hidden>',
      '<div class="thumbs" id="th"></div>',
      '<div class="row"><button class="act" id="exit">Leave Edit website</button><button class="go" id="send" disabled>File request</button></div>',
      '<div class="row"><a class="hq" href="/hq/requests" target="_blank">Open the Requests board</a></div>',
      '<div class="past" id="past"></div>',
    '</div>'
  ].join('');
  root.appendChild(wrap);

  var $ = function (id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); };
  var panel = root.querySelector('.panel');
  var ta = $('t'), thumbs = $('th'), send = $('send'), status = $('st'), hl = $('hl'), hint = $('hint');

  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'X-HQ': '1' }, opts.headers || {});
    return fetch(path, opts);
  }

  function refresh() {
    send.disabled = busy > 0 || (!ta.value.trim() && !pending.length && !pointed);
    status.className = 'mini';
    if (busy > 0) status.textContent = 'uploading ' + busy + '...';
    else if (lastError) { status.textContent = lastError; status.className = 'mini err'; }
    else status.textContent = 'or paste, or drag one in';
    thumbs.textContent = '';
    pending.forEach(function (a) {
      var d = document.createElement('div'); d.className = 'thumb';
      if (a.kind === 'image') { var img = document.createElement('img'); img.src = a.url; img.alt = a.filename; d.appendChild(img); }
      else { var s = document.createElement('div'); s.className = 'doc'; s.textContent = String(a.ext).toUpperCase(); d.appendChild(s); }
      var x = document.createElement('button'); x.textContent = '×'; x.title = 'Remove';
      x.onclick = function () {
        pending = pending.filter(function (p) { return p.id !== a.id; });
        api('/hq/api/attachments/' + a.id + '/delete', { method: 'POST' }).catch(function () {});
        refresh();
      };
      d.appendChild(x); thumbs.appendChild(d);
    });
    var box = $('pt'); box.textContent = '';
    if (pointed) {
      var c = document.createElement('div'); c.className = 'chip';
      var sp = document.createElement('span'); sp.textContent = 'Pointing at: ' + pointed; c.appendChild(sp);
      var rm = document.createElement('button'); rm.textContent = '×'; rm.title = 'Stop pointing';
      rm.onclick = function () { pointed = ''; refresh(); };
      c.appendChild(rm); box.appendChild(c);
    }
  }

  // Every failure is shown until the next attempt. A rejected upload that vanishes silently looks exactly
  // like a screenshot that was attached, and people file the request believing it was.
  function fail(msg) { lastError = msg; refresh(); }

  function upload(files) {
    Array.prototype.forEach.call(files, function (f) {
      var named = /\.(jpe?g|png|webp|gif|pdf)$/i.test(f.name || '');
      if (!/^image\/|pdf$/.test(f.type) && !named) { fail('Cannot use ' + (f.name || 'that file') + '. Images and PDFs only.'); return; }
      if (/heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name || '')) { fail('That is an iPhone HEIC photo, which will not upload. In Settings, Camera, Formats, choose Most Compatible, or send it to yourself and save it as a JPEG.'); return; }
      if (f.size > 20 * 1024 * 1024) { fail((f.name || 'That file') + ' is ' + Math.round(f.size / 1048576) + ' MB. The limit is 20 MB.'); return; }
      lastError = ''; busy++; refresh();
      var fd = new FormData();
      fd.append('file', f, f.name || 'pasted-screenshot.png');
      api('/hq/api/attachments', { method: 'POST', body: fd })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.id) pending.push(res.j);
          else fail((res.j && res.j.error) || 'That upload was refused. Try a JPEG or PNG.');
        })
        .catch(function () { fail('That upload did not go through. Check your connection and try again.'); })
        .then(function () { busy--; refresh(); });
    });
  }

  function loadPast() {
    api('/hq/api/page-thread?page=' + encodeURIComponent(location.pathname))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var box = $('past'); box.textContent = '';
        if (!d.requests || !d.requests.length) return;
        var t = document.createElement('div'); t.className = 'mini'; t.textContent = 'Already filed on this page'; box.appendChild(t);
        d.requests.forEach(function (r) {
          var a = document.createElement('a'); a.href = '/hq/requests/' + r.id; a.target = '_blank';
          a.textContent = '#' + r.id + ' ' + r.title;
          var tag = document.createElement('span'); tag.className = r.picked_up_by ? 'gotit' : 'st';
          tag.textContent = '  ' + (r.picked_up_by ? r.picked_up_by + ' is on it' : r.status);
          a.appendChild(tag); box.appendChild(a);
        });
      }).catch(function () {});
  }

  // A short, readable description of an element: enough for a person to find it again.
  function describe(el) {
    var parts = [], n = el, depth = 0;
    while (n && n.nodeType === 1 && n !== document.body && depth < 4) {
      var s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (n.className && typeof n.className === 'string') s += '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.');
      parts.unshift(s); n = n.parentElement; depth++;
    }
    var txt = (el.innerText || el.alt || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 70);
    return parts.join(' > ') + (txt ? ' ("' + txt + '")' : '');
  }

  function onMove(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === host) return;
    var r = el.getBoundingClientRect();
    hl.style.display = 'block'; hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px'; hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
  }
  function stopPicking() {
    picking = false; hl.style.display = 'none'; hint.style.display = 'none';
    document.removeEventListener('mousemove', onMove, true); document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey, true);
    panel.classList.add('open');
  }
  function onClick(e) {
    if (!picking) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el === host) return;
    e.preventDefault(); e.stopPropagation();
    if (el) pointed = describe(el);
    stopPicking(); refresh(); ta.focus();
  }
  function onKey(e) { if (e.key === 'Escape') stopPicking(); }
  $('point').onclick = function () {
    picking = true; panel.classList.remove('open'); hint.style.display = 'block';
    document.addEventListener('mousemove', onMove, true); document.addEventListener('click', onClick, true); document.addEventListener('keydown', onKey, true);
  };

  root.querySelector('.fab').onclick = function () {
    var open = panel.classList.toggle('open');
    if (open) { $('p').textContent = location.pathname; loadPast(); ta.focus(); }
  };
  $('pick').onclick = function () { $('f').click(); };
  $('f').onchange = function (e) { upload(e.target.files); e.target.value = ''; };
  ta.oninput = refresh;

  var drop = $('drop');
  drop.addEventListener('paste', function (e) {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) { e.preventDefault(); upload(e.clipboardData.files); }
  });
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) upload(e.dataTransfer.files); });

  send.onclick = function () {
    var text = ta.value.trim();
    var ctx = ['Viewport: ' + window.innerWidth + 'x' + window.innerHeight];
    if (pointed) ctx.unshift('Pointing at: ' + pointed);
    var body = (text ? text + '\n\n' : '') + ctx.join('\n');
    send.disabled = true;
    api('/hq/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: (text.slice(0, 80) || (pointed ? 'About ' + pointed.slice(0, 50) : 'Screenshot')) + ' [' + location.pathname + ']', body: body, page: location.pathname, source: 'site', attachment_ids: pending.map(function (a) { return a.id; }) })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.j && res.j.error) || 'failed');
        ta.value = ''; pending = []; pointed = ''; lastError = ''; refresh(); loadPast();
        status.textContent = 'Filed. It is on the board now.'; status.className = 'mini ok';
        setTimeout(function () { panel.classList.remove('open'); refresh(); }, 1500);
      })
      .catch(function (e) { status.textContent = 'Could not file that (' + e.message + '). Try again.'; status.className = 'mini err'; send.disabled = false; });
  };

  $('exit').onclick = function () {
    api('/hq/api/review/stop', { method: 'POST' }).then(function () { location.reload(); });
  };

  api('/hq/api/me').then(function (r) { return r.json(); }).then(function (m) { staff = m.staff || ''; $('who').textContent = staff; }).catch(function () {});
  refresh();
})();
`;
