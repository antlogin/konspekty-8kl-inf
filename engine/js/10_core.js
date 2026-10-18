(function () {
'use strict';
const CFG = TELEMETRY_CONFIG;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; };
const uuid = () => {
  if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) { /* ниже запасной вариант */ } }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
};
const hhmm = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const isLiveUrl = u => !!u && /^https:\/\//.test(u) && !/REPLACE_ME/.test(u);

/* ---------- память браузера: localStorage, при недоступности — память вкладки ---------- */
const mem = {};
const store = {
  get(k) { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch (e) { /* недоступно */ } return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  set(k, v) { try { localStorage.setItem(k, v); delete mem[k]; return true; } catch (e) { mem[k] = v; return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* недоступно */ } delete mem[k]; }
};
const jget = k => { try { const v = store.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const jset = (k, o) => store.set(k, JSON.stringify(o));
const KP = 'learnit:' + CFG.courseId + ':';
const K = { access: KP + 'access', state: KP + CFG.lessonId + ':state', events: KP + CFG.lessonId + ':events', tele: KP + 'telemetry' };

/* ---------- состояние попытки ---------- */
let S = null;                 // состояние текущей попытки
let allEvents = [];           // все события текущей попытки (для файла «Сохранить работу»)
let access = jget(K.access) || null;   // {word, group, checked, firstName, lastName}
let partOrder = ['plan'];     // порядок и названия частей берутся из меню (lesson.json → parts)
let partTitle = { plan: 'План занятия' };

function newState(student, group, checked) {
  return { v: 1, attemptId: uuid(), seq: 1, startedAt: Date.now(), student: student, group: group, groupChecked: checked,
    part: 'plan', done: {}, codes: {}, answers: {}, revealed: {}, qcheck: {}, stats: {}, solved: {}, firstOpened: {}, finished: false, finishedAt: null };
}
const stat = id => (S.stats[id] = S.stats[id] || { runs: 0, checks: 0, hints: 0, autoHints: 0, errors: 0 });

let saveTimer = null, snapshotDirty = false, snapshotNow = false;
function saveStateNow() {
  if (!S) return;
  S.savedAt = Date.now();
  jset(K.state, S);
}
function touch() {            // любое изменение состояния: сохранение через ~1 с
  snapshotDirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveStateNow(); }, 1000);
}
let evTimer = null;
function saveEventsSoon() {
  if (evTimer) return;
  evTimer = setTimeout(() => { evTimer = null; saveEventsNow(); }, 1500);
}
function saveEventsNow() {
  if (!S) return;
  let list = allEvents;
  for (let i = 0; i < 4; i++) {
    if (store.set(K.events, JSON.stringify({ attemptId: S.attemptId, events: list }))) return;
    list = list.slice(Math.floor(list.length / 2));   // при нехватке места хранятся последние события
  }
}
function flushStorageSync() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saveStateNow(); saveEventsNow(); saveTele();
}

/* ---------- телеметрия ---------- */
const T = { queues: {}, meta: {}, sending: {}, status: 'none' };
function loadTele() {
  const o = jget(K.tele);
  if (o) { T.queues = o.queues || {}; T.meta = o.meta || {}; }
}
function saveTele() {
  // метаданные хранятся только для попыток, у которых есть неотправленные события
  const need = {};
  Object.keys(T.queues).forEach(n => (T.queues[n] || []).forEach(it => { need[it.a] = true; }));
  if (S) need[S.attemptId] = true;
  Object.keys(T.meta).forEach(a => { if (!need[a]) delete T.meta[a]; });
  jset(K.tele, { queues: T.queues, meta: T.meta });
}
const liveEndpoints = () => CFG.endpoints.filter(e => e.enabled && isLiveUrl(e.url));
function makeMeta() {
  return {
    courseId: CFG.courseId, courseTitle: CFG.courseTitle, courseUrl: CFG.courseUrl,
    lessonId: CFG.lessonId, lessonTitle: CFG.lessonTitle, tasksTotal: CFG.practiceTaskIds.length, practiceTaskIds: CFG.practiceTaskIds,
    group: S.group, groupChecked: S.groupChecked, word: access ? access.word : '',
    student: { firstName: S.student.firstName || '', lastName: S.student.lastName || '', anonymous: !!S.student.anonymous, anonCode: S.student.anonCode || '' }
  };
}
function setSync(st) {
  T.status = st;
  const chip = $('#chip-sync');
  if (!chip) return;
  const map = { none: ['Сервер учителя не подключён', true], sending: ['Отправка…', false], ok: ['✓ Данные переданы', false], fail: ['⚠ Нет связи с сервером учителя; работа сохраняется в браузере', true] };
  const m = map[st] || map.none;
  chip.textContent = m[0];
  chip.classList.toggle('warn', m[1]);
  chip.hidden = !S;
}

function rec(type, source, ctx, data) {
  const ev = {
    seq: S.seq++, eventType: type, eventVersion: CFG.eventVersion, schemaVersion: CFG.schemaVersion,
    clientTime: new Date().toISOString(), elapsedMs: Date.now() - S.startedAt,
    trainerId: CFG.trainerId, trainerVersion: CFG.trainerVersion, eventSource: source,
    context: Object.assign({ pageId: S.part }, ctx || {}), data: data || {}
  };
  allEvents.push(ev);
  saveEventsSoon();
  T.meta[S.attemptId] = makeMeta();
  const eps = liveEndpoints();
  eps.forEach(ep => { (T.queues[ep.name] = T.queues[ep.name] || []).push({ a: S.attemptId, e: ev }); });
  saveTele();
  touch();
  if (eps.length) {
    const longest = Math.max.apply(null, eps.map(ep => T.queues[ep.name].length));
    if (longest >= 25) flush('queue');
  } else if (T.status !== 'none') setSync('none');
  return ev;
}

async function postJSON(ep, obj, opts) {
  opts = opts || {};
  const body = JSON.stringify(obj);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  try {
    const res = await fetch(ep.url, {
      method: 'POST', body: body, signal: ctl.signal, redirect: 'follow',
      headers: { 'Content-Type': ep.name === 'google' ? 'text/plain;charset=utf-8' : 'application/json' },
      keepalive: !!(opts.keepalive && body.length < 60000)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}
function envelope(ep, attemptId, events) {
  const base = { schemaVersion: CFG.schemaVersion, attemptId: attemptId, trainerId: CFG.trainerId, events: events };
  if (ep.name !== 'google') return base;
  base.action = 'events';
  base.meta = T.meta[attemptId] || (S && S.attemptId === attemptId ? makeMeta() : {});
  return base;
}
async function flushEndpoint(ep, opts) {
  const q = T.queues[ep.name];
  if (!q || !q.length || T.sending[ep.name]) return;
  T.sending[ep.name] = true;
  setSync('sending');
  try {
    while (q.length) {
      const a = q[0].a, batch = [];
      for (const it of q) { if (it.a !== a || batch.length >= 25) break; batch.push(it); }
      let ok = false;
      try {
        const r = await postJSON(ep, envelope(ep, a, batch.map(i => i.e)), opts);
        ok = !!(r && r.ok === true);
      } catch (e) { ok = false; }
      if (!ok) { setSync('fail'); return; }
      q.splice(0, batch.length);        // пакет удаляется только после HTTP 200 и ok: true
      saveTele();
    }
    setSync('ok');
  } finally { T.sending[ep.name] = false; }
}
async function flush(reason, opts) {
  const eps = liveEndpoints();
  if (!eps.length) { setSync('none'); return; }
  await Promise.all(eps.map(ep => flushEndpoint(ep, opts)));
}
const pendingCount = () => liveEndpoints().reduce((n, ep) => n + ((T.queues[ep.name] || []).length), 0);
const googleEp = () => liveEndpoints().find(e => e.name === 'google') || null;

/* запросы к скрипту, не входящие в очередь событий */
async function scriptCall(action, payload, timeout) {
  const ep = googleEp();
  if (!ep) throw new Error('unavailable');
  return postJSON(ep, Object.assign({ action: action, schemaVersion: CFG.schemaVersion }, payload), { timeout: timeout || 8000 });
}
