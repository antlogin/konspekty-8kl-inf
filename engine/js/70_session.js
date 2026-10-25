
/* ---------- итоговый JSON попытки ---------- */
function buildExport(withState) {
  const items = Object.keys(TASKS).filter(id => TASKS[id].kind === 'check').map(id => {
    const st = S.stats[id] || {}, sv = S.solved[id];
    return { taskId: id, practice: !!TASKS[id].practice, solved: !!sv, runs: st.runs || 0, checks: st.checks || 0, hints: st.hints || 0, autoHints: st.autoHints || 0,
      timeToSolveMs: sv ? sv.timeMs : null, points: null, maxPoints: null, lastCode: S.codes[id] != null ? S.codes[id] : TASKS[id].starter };
  });
  const solved = CFG.practiceTaskIds.filter(id => S.solved[id]).length;
  const o = {
    schemaVersion: CFG.schemaVersion, trainerId: CFG.trainerId, trainerVersion: CFG.trainerVersion, courseId: CFG.courseId, lessonId: CFG.lessonId, lessonTitle: CFG.lessonTitle,
    attemptId: S.attemptId, student: S.student, group: S.group, groupChecked: S.groupChecked,
    startedAt: new Date(S.startedAt).toISOString(), finishedAt: S.finishedAt ? new Date(S.finishedAt).toISOString() : null,
    durationMs: (S.finishedAt || Date.now()) - S.startedAt,
    summary: { practiceSolved: solved, practiceTotal: CFG.practiceTaskIds.length },
    items: items, answers: S.answers,
    events: allEvents.slice()
  };
  if (withState !== false) o.state = JSON.parse(JSON.stringify(S));
  return o;
}
/* ---------- zip: JSON работы сохраняется внутри архива (без сжатия, без внешних библиотек) ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(name, text) {
  const enc = new TextEncoder(), nameB = enc.encode(name), data = enc.encode(text), crc = crc32(data), d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const out = new Uint8Array(30 + nameB.length + data.length + 46 + nameB.length + 22), v = new DataView(out.buffer);
  let p = 0;
  const u16 = x => { v.setUint16(p, x, true); p += 2; }, u32 = x => { v.setUint32(p, x >>> 0, true); p += 4; };
  u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(time); u16(date); u32(crc); u32(data.length); u32(data.length); u16(nameB.length); u16(0);
  out.set(nameB, p); p += nameB.length; out.set(data, p); p += data.length;
  const cdStart = p;
  u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(time); u16(date); u32(crc); u32(data.length); u32(data.length); u16(nameB.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(0);
  out.set(nameB, p); p += nameB.length;
  const cdSize = p - cdStart;
  u32(0x06054b50); u16(0); u16(0); u16(1); u16(1); u32(cdSize); u32(cdStart); u16(0);
  return out;
}
/* Читает первый .json из zip (без сжатия или deflate) либо обычный JSON-файл. */
async function readWorkFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!(buf[0] === 0x50 && buf[1] === 0x4b)) return JSON.parse(new TextDecoder().decode(buf));
  const v = new DataView(buf.buffer);
  let e = buf.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip');
  let p = v.getUint32(e + 16, true);
  const count = v.getUint16(e + 10, true);
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + cl;
    if (!/\.json$/i.test(name)) continue;
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) return JSON.parse(new TextDecoder().decode(raw));
    if (method === 8 && window.DecompressionStream) {
      const text = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      return JSON.parse(text);
    }
    throw new Error('zip method');
  }
  throw new Error('zip empty');
}
function download(name, bytes, type) {
  const blob = new Blob([bytes], { type: type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const latin = t => String(t).replace(/[А-Яа-яЁё]/g, c => { const r = TRANSLIT[c.toLowerCase()] || ''; return c === c.toLowerCase() ? r : r.charAt(0).toUpperCase() + r.slice(1); });
function baseName() {
  const who = S.student.anonymous ? S.student.anonCode : (S.student.lastName + '_' + S.student.firstName);
  return CFG.lessonId + '_' + latin(who).replace(/[^A-Za-z0-9_-]+/g, '_');
}
const jsonName = () => baseName() + '.json';
const zipName = () => baseName() + '.zip';
function saveWork() { download(zipName(), makeZip(jsonName(), JSON.stringify(buildExport(true), null, 1)), 'application/zip'); }

/* ---------- завершение занятия ---------- */
let finishSeq = null;
function setSentMark(kind, text) { const m = $('#sent-mark'); m.className = 'sent-mark ' + (kind || ''); m.textContent = text || ''; }
async function finishLesson() {
  if (Runner.busy) stopRun();
  S.finished = true; S.finishedAt = Date.now();
  rec('attempt_finished', 'system', { pageId: S.part }, { durationMs: S.finishedAt - S.startedAt, practiceSolved: CFG.practiceTaskIds.filter(id => S.solved[id]).length });
  const exp = buildExport(false);
  if (JSON.stringify(exp).length > 900000) { exp.events = exp.events.slice(-400); exp.eventsTruncated = true; }
  const zipSize = makeZip(jsonName(), JSON.stringify(exp)).length;
  const ev = rec('result_submitted', 'system', { pageId: S.part }, {
    fields: { 'form-name': CFG.trainerId, student: S.student.anonymous ? S.student.anonCode : S.student.lastName + ' ' + S.student.firstName, group: S.group || '', attemptId: S.attemptId },
    files: [{ field: 'file', name: zipName(), size: zipSize, content: exp }]
  });
  finishSeq = ev.seq;
  const n = CFG.practiceTaskIds.filter(id => S.solved[id]).length;
  $('#finish-sum').textContent = 'Решено задач практикума: ' + n + ' из ' + CFG.practiceTaskIds.length + '. Время занятия: ' + Math.round((S.finishedAt - S.startedAt) / 60000) + ' мин.';
  flushStorageSync();
  if (!liveEndpoints().length) { setSentMark('bad', 'Сервер учителя не подключён. Архив с результатами сохраняется кнопкой «Сохранить работу».'); return; }
  setSentMark('', 'Ответы отправляются… Не закрывайте страницу.');
  const t0 = Date.now();
  // пакет завершения самый тяжёлый: ответ ждётся до 90 с, затем повторы каждые 10 с; об ошибке сообщается через 3 мин
  await flush('finish', { wait: true, timeout: 90000 });
  while (!checkSent(false) && Date.now() - t0 < 180000) {
    await new Promise(r => setTimeout(r, 10000));
    await flush('finish-retry', { wait: true, timeout: 90000 });
  }
  checkSent(true);
}
function checkSent(final) {
  if (finishSeq == null) return true;
  const still = liveEndpoints().some(ep => (T.queues[ep.name] || []).some(it => it.a === S.attemptId && it.e.seq === finishSeq));
  if (!still) { setSentMark('ok', '✓ Ответы переданы учителю'); finishSeq = null; return true; }
  if (final) setSentMark('bad', 'Нет связи с сервером учителя. Отправка повторится, пока страница открыта; для надёжности сохраните работу кнопкой «Сохранить работу».');
  return false;
}

/* ---------- сервер: проверка слова, снимки ---------- */
const normWord = w => String(w || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
async function checkWord(word) {
  if (!googleEp()) return { status: 'unavailable' };
  try {
    const r = await scriptCall('checkWord', { word: word, courseId: CFG.courseId, lessonId: CFG.lessonId }, 8000);
    if (r && r.ok === true && r.group) return { status: 'ok', group: r.group };
    if (r && r.ok === false && r.error === 'bad_word') return { status: 'bad' };
    return { status: 'unavailable' };
  } catch (e) { return { status: 'unavailable' }; }
}
function snapshotPayload() {
  const codes = {}; Object.keys(S.codes).forEach(k => { codes[k] = cap(S.codes[k], 6000); });
  return { attemptId: S.attemptId, seq: S.seq, startedAt: S.startedAt, part: S.part, done: S.done, codes: codes, answers: S.answers, revealed: S.revealed, qcheck: S.qcheck,
    stats: S.stats, solved: S.solved, firstOpened: S.firstOpened, finished: S.finished, finishedAt: S.finishedAt };
}
async function sendSnapshot() {
  if (!S || S.student.anonymous || !googleEp()) return;
  snapshotDirty = false; snapshotNow = false;
  try {
    const r = await scriptCall('saveSnapshot', { meta: makeMeta(), attemptId: S.attemptId, snapshot: snapshotPayload() }, 10000);
    if (!(r && r.ok === true)) snapshotDirty = true;
  } catch (e) { snapshotDirty = true; }
}
async function fetchSnapshot(student) {
  if (!googleEp() || student.anonymous) return null;
  try {
    const r = await scriptCall('getSnapshot', { meta: { courseId: CFG.courseId, courseTitle: CFG.courseTitle, lessonId: CFG.lessonId, lessonTitle: CFG.lessonTitle, group: access.group, groupChecked: access.checked, word: access.word, student: student } }, 8000);
    if (r && r.ok === true && r.found && r.snapshot) return r;
  } catch (e) { /* сервер недоступен: восстановление пропускается */ }
  return null;
}

/* ---------- запуск и восстановление сеанса ---------- */
function applyStateToUI() {
  Object.keys(SB).forEach(id => { SB[id].initCode(); SB[id].restoreHints && SB[id].restoreHints(); SB[id].markSolved(); });
  paintAllQuestions();
  updateProgress();
  const st = $('#chip-student');
  st.hidden = false;
  st.textContent = (S.student.anonymous ? S.student.anonCode : S.student.firstName + ' ' + S.student.lastName) + ' · ' + (S.group ? S.group + (S.groupChecked ? '' : ' (группа не проверена)') : 'группа не проверена');
  setSync(liveEndpoints().length ? (T.status === 'none' ? 'ok' : T.status) : 'none');
  if (!liveEndpoints().length) setSync('none');
  $('#finish-sum').textContent = '';
  setSentMark('', '');
  $('body').classList.remove('locked');
  $('#gate').hidden = true;
}
function enterNew(student, group, checked) {
  S = newState(student, group, checked); allEvents = [];
  store.del(K.events);
  T.meta[S.attemptId] = makeMeta();
  rec('attempt_started', 'system', { pageId: 'plan' }, { firstName: student.firstName || '', lastName: student.lastName || '', anonymous: !!student.anonymous, anonCode: student.anonCode || '', className: group || '', studentId: null, subjectId: CFG.subjectId, courseId: CFG.courseId, schoolId: CFG.schoolId });
  rec('access_checked', 'system', { pageId: 'plan' }, { group: checked ? group : null, checked: !!checked });
  applyStateToUI();
  openPart('plan', { initial: true });
  flushStorageSync();
  lastActivity = Date.now();
}
function resumeState(state, events, source, snapTime, serverMaxSeq) {
  S = state; allEvents = events || [];
  S.qcheck = S.qcheck || {};
  if (access && access.group) { S.group = access.group; S.groupChecked = !!access.checked; }
  let max = S.seq - 1;
  allEvents.forEach(e => { if (e.seq > max) max = e.seq; });
  Object.keys(T.queues).forEach(n => (T.queues[n] || []).forEach(it => { if (it.a === S.attemptId && it.e.seq > max) max = it.e.seq; }));
  if (serverMaxSeq && serverMaxSeq > max) max = serverMaxSeq;
  S.seq = max + 1;
  T.meta[S.attemptId] = makeMeta();
  applyStateToUI();
  rec('session_restored', 'system', { pageId: S.part }, { source: source, snapshotTime: snapTime ? new Date(snapTime).toISOString() : null });
  openPart(S.part || 'plan', { initial: true, restore: true, silent: true });
  rec('page_opened', 'navigation', { pageId: S.part }, { fromPage: null, restored: true });
  flushStorageSync();
  lastActivity = Date.now();
}

let skipServerRestore = false;   // выбрано «Начать заново» в диалоге браузера: серверный снимок не предлагается
const gate = {
  show(which) { $('#gate').hidden = false; $('body').classList.add('locked'); $('#gate-form').hidden = which !== 'form'; $('#gate-resume').hidden = which !== 'resume'; },
  msg(text, bad) { const m = $('#g-msg'); m.textContent = text || ''; m.className = 'msg' + (bad ? ' bad' : ''); },
  busy(b) { $('#g-go').disabled = b; $('#g-anon').disabled = b; $('#g-load').disabled = b; }
};
function prepareForm() {
  const hasWord = !!(access && access.word);
  $('#gate-word-box').hidden = hasWord;
  const gl = $('#gate-group-line');
  gl.hidden = !hasWord;
  if (hasWord) {
    gl.innerHTML = 'Группа: <b></b> <button type="button" class="link" id="g-change" style="padding:0 0 0 8px">сменить</button>';
    $('b', gl).textContent = access.checked && access.group ? access.group : 'не проверена';
    $('#g-change').onclick = () => { access = null; store.del(K.access); prepareForm(); $('#g-word').focus(); };
  }
  if (access) { $('#g-first').value = access.firstName || ''; $('#g-last').value = access.lastName || ''; }
  gate.show('form');
}
async function resolveAccess(word) {
  if (access && access.word && (!word || normWord(word) === normWord(access.word)) && access.checked) return { status: 'ok', group: access.group, word: access.word };
  const w = word || (access && access.word) || '';
  const r = await checkWord(w);
  r.word = w;
  return r;
}
function showResume(text, onContinue, onRestart) {
  $('#resume-text').textContent = text;
  gate.show('resume');
  $('#r-continue').onclick = onContinue;
  $('#r-restart').onclick = onRestart;
  $('#r-continue').focus();
}
async function submitGate(anon) {
  gate.msg('');
  const typedWord = $('#g-word').value.trim();
  const word = (access && access.word) ? access.word : typedWord;
  const first = $('#g-first').value.trim(), last = $('#g-last').value.trim();
  if (!word) { gate.msg('Требуется ввести кодовое слово группы.', true); return; }
  if (!anon && (!first || !last)) { gate.msg('Требуется ввести имя и фамилию или выбрать «Пройти анонимно».', true); return; }
  gate.busy(true); gate.msg('Проверка кодового слова…');
  const r = await resolveAccess(typedWord || word);
  gate.busy(false);
  if (r.status === 'bad') { gate.msg('Кодовое слово не найдено. Следует уточнить слово у учителя.', true); return; }
  const checked = r.status === 'ok';
  access = { word: r.word, group: checked ? r.group : null, checked: checked, firstName: anon ? (access && access.firstName) || '' : first, lastName: anon ? (access && access.lastName) || '' : last };
  jset(K.access, access);
  gate.msg(checked ? '' : 'Сервер проверки недоступен: работа продолжается, группа помечена как «не проверена».');
  const student = anon
    ? { anonymous: true, anonCode: 'Аноним A-' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0'), firstName: '', lastName: '' }
    : { anonymous: false, firstName: first, lastName: last };
  const skip = skipServerRestore; skipServerRestore = false;
  if (!anon && !skip) {
    const snap = await fetchSnapshot(student);
    if (snap) {
      return showResume('Найдена работа от ' + hhmm(snap.savedAt || snap.snapshot.savedAt || Date.now()) + '.', () => {
        const st = newState(student, access.group, checked);
        Object.assign(st, snap.snapshot);
        st.student = student; st.group = access.group; st.groupChecked = checked;
        resumeState(st, [], 'server', snap.savedAt, snap.maxSeq);
      }, () => enterNew(student, access.group, checked));
    }
  }
  enterNew(student, access.group, checked);
}
async function loadWorkFile(file) {
  gate.msg('');
  let obj;
  try { obj = await readWorkFile(file); } catch (e) { gate.msg('Файл не удалось прочитать: требуется архив .zip с работой, сохранённый кнопкой «Сохранить работу».', true); return; }
  if (!obj || obj.trainerId !== CFG.trainerId || !obj.state || !obj.attemptId) { gate.msg('Файл не относится к этому конспекту.', true); return; }
  const word = (access && access.word) || $('#g-word').value.trim();
  if (!word) { gate.msg('Для загрузки работы требуется кодовое слово группы.', true); return; }
  gate.busy(true);
  const r = await resolveAccess(word);
  gate.busy(false);
  if (r.status === 'bad') { gate.msg('Кодовое слово не найдено. Следует уточнить слово у учителя.', true); return; }
  const checked = r.status === 'ok';
  access = { word: r.word, group: checked ? r.group : null, checked: checked, firstName: obj.student.firstName || '', lastName: obj.student.lastName || '' };
  jset(K.access, access);
  const st = obj.state;
  st.group = access.group; st.groupChecked = checked;
  resumeState(st, obj.events || [], 'file', obj.state.savedAt || Date.parse(obj.finishedAt || obj.startedAt));
}
