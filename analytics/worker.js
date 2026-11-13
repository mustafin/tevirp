// Сборщик заходов для ТЕВИРП (Cloudflare Worker + KV).
// POST /hit  — игра сообщает имя и комнату; IP и страну берём из запроса.
// GET  /     — таблица заходов, под паролем (секрет ADMIN_KEY, логин любой).
const ALLOWED = ['https://mustafin.github.io', 'http://localhost:8770'];
const KEEP_DAYS = 180;

const cut = (v, n) => String(v ?? '').slice(0, n);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/hit') {
      const origin = req.headers.get('Origin') || '';
      if (!ALLOWED.includes(origin)) return new Response('forbidden', { status: 403 });
      let b = {};
      try { b = JSON.parse((await req.text()).slice(0, 500)); } catch {}
      const now = Date.now();
      // обратное время в ключе — список сразу приходит от новых к старым
      const key = `v:${9999999999999 - now}:${crypto.randomUUID().slice(0, 8)}`;
      await env.VISITS.put(key, '', {
        expirationTtl: KEEP_DAYS * 86400,
        metadata: {
          t: now,
          name: cut(b.name, 20),
          room: cut(b.room, 8),
          id: cut(b.id, 12),
          ip: req.headers.get('CF-Connecting-IP') || '',
          geo: [req.cf?.city, req.cf?.country].filter(Boolean).join(', '),
          ua: cut(req.headers.get('User-Agent'), 160),
        },
      });
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': origin } });
    }

    if (req.method === 'GET' && url.pathname === '/') {
      if (!env.ADMIN_KEY) return new Response('ADMIN_KEY is not set', { status: 500 });
      let pass = '';
      try { pass = atob((req.headers.get('Authorization') || '').replace(/^Basic /, '')).split(':').slice(1).join(':'); } catch {}
      if (pass !== env.ADMIN_KEY) {
        return new Response('auth required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="tevirp"' } });
      }
      const { keys } = await env.VISITS.list({ prefix: 'v:', limit: 1000 });
      const rows = keys.map((k) => k.metadata).filter(Boolean);
      const uniq = (f) => new Set(rows.map((r) => r[f])).size;
      const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ТЕВИРП — заходы</title>
<style>body{font:14px system-ui;margin:20px;background:#14121c;color:#f2eefc}table{border-collapse:collapse;width:100%}
td,th{padding:6px 10px;border-bottom:1px solid #3a3550;text-align:left;white-space:nowrap}td.ua{white-space:normal;color:#9d96b5;font-size:12px}
th{color:#9d96b5;font-weight:400}p{color:#9d96b5}</style>
<h2>Заходы в ТЕВИРП</h2>
<p>Последние ${rows.length} · уникальных IP: ${uniq('ip')} · игроков: ${uniq('id')} · комнат: ${uniq('room')}</p>
<table><tr><th>Когда</th><th>Имя</th><th>Комната</th><th>IP</th><th>Откуда</th><th>Устройство</th></tr>
${rows.map((r) => `<tr><td data-t="${Number(r.t)}"></td><td>${esc(r.name)}</td><td>${esc(r.room)}</td><td>${esc(r.ip)}</td><td>${esc(r.geo)}</td><td class="ua">${esc(r.ua)}</td></tr>`).join('\n')}
</table>
<script>document.querySelectorAll('[data-t]').forEach(td=>td.textContent=new Date(+td.dataset.t).toLocaleString('ru'))</script>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    return new Response('not found', { status: 404 });
  },
};
