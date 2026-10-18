/**
 * Learn-it: приём данных конспектов (проверка кодового слова, телеметрия, снимки работ).
 *
 * Один обработчик doPost принимает запросы Content-Type: text/plain (без preflight)
 * с JSON в теле. Поле action выбирает действие:
 *   checkWord    — проверка кодового слова группы; при верном слове возвращается группа;
 *   events       — пакет событий {schemaVersion, attemptId, trainerId, events, meta};
 *   saveSnapshot — сохранение снимка состояния работы (одна строка на ученика и урок);
 *   getSnapshot  — выдача последнего снимка для восстановления.
 *
 * Настройки хранятся в свойствах скрипта (Project Settings → Script properties):
 *   GROUP_WORDS      — JSON вида {"Компас ср":"слово1","Компас пт":"слово2","ФШ пн":"слово3"} (группа → слово или список слов);
 *   CODEWORDS        — то же в обратной записи: {"слово1":"Компас ср"} (слово → группа); достаточно одного из двух свойств;
 *   GROUP_WORDS_<id>, CODEWORDS_<id> — необязательно: отдельные слова для курса с courseId = <id>;
 *   ROOT_FOLDER_ID   — необязательно: id папки на Диске вместо папки «Learn-it результаты».
 * Подробная инструкция — README.md.
 */

var VERSION = '1.0.2';
var CONFIG = {
  ROOT_FOLDER_NAME: 'Learn-it результаты',
  UNVERIFIED_GROUP: 'Не проверена',
  LOCK_WAIT_MS: 20000,
  MAX_CELL: 45000,
  MAX_EVENTS_PER_PACKET: 200
};

var H = {
  events: ['Ключ', 'Время сервера', 'Время клиента', 'Ученик', 'Группа', 'attemptId', 'seq', 'Событие', 'Источник', 'elapsedMs', 'Контекст', 'Данные'],
  attempts: ['attemptId', 'Ученик', 'Группа', 'Начало', 'Последняя активность', 'Окончание', 'Решено задач', 'Всего задач', 'Статус', 'Событий', 'Макс. seq', 'Восстановлений', 'Группа проверена'],
  summary: ['Ключ', 'Ученик', 'Группа', 'attemptId', 'Задача', 'Засчитано', 'Запуски', 'Проверки', 'Подсказки (ступени)', 'Автоподсказки', 'Время до решения, с'],
  snapshots: ['Ключ', 'Ученик', 'Группа', 'attemptId', 'Сохранено', 'Состояние (JSON)'],
  submitted: ['Время', 'Ученик', 'Группа', 'attemptId', 'Решено задач', 'Файл на Диске', 'Итог без событий (JSON)']
};
var SHEET = { events: 'События', attempts: 'Попытки', summary: 'Сводка', snapshots: 'Снимки', submitted: 'Сданные работы' };

/* ============================== точки входа ============================== */

function doGet() {
  return json_({ ok: true, service: 'learnit-collector', version: VERSION });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!req || typeof req !== 'object') return json_({ ok: false, error: 'bad_json' });
  try {
    var action = req.action || (req.events ? 'events' : '');
    if (action === 'checkWord') return json_(actionCheckWord_(req));
    if (action === 'getSnapshot') return json_(actionGetSnapshot_(req));
    if (action === 'events' || action === 'saveSnapshot') {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(CONFIG.LOCK_WAIT_MS)) return json_({ ok: false, error: 'busy' });
      try {
        return json_(action === 'events' ? actionEvents_(req) : actionSaveSnapshot_(req));
      } finally {
        lock.releaseLock();
      }
    }
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'server_error', message: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================ кодовые слова ============================== */

function normWord_(w) {
  return String(w == null ? '' : w).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/** Нормализация кодового слова: дополнительно кириллические буквы, похожие на латинские, приводятся к латинским
 *  (слово «8а-Ok» с кириллической «а» и слово «8a-Ok» с латинской «a» считаются одинаковыми). */
var LOOKALIKE = { 'а': 'a', 'в': 'b', 'е': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x' };
function normCode_(w) {
  return normWord_(w).replace(/[авекмнорстух]/g, function (c) { return LOOKALIKE[c]; });
}

/** Читает JSON-свойство (с отдельным вариантом для курса) или возвращает null. */
function readJsonProp_(name, courseId) {
  var props = PropertiesService.getScriptProperties();
  var raw = (courseId && props.getProperty(name + '_' + courseId)) || props.getProperty(name);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** Возвращает карту {нормализованное слово: группа} или null, если слова не заданы.
 *  Источники (допустимы оба, записи объединяются):
 *    GROUP_WORDS — {"Компас ср": "слово1", "ФШ пн": ["слово2", "слово3"]}  (группа → слово или список слов);
 *    CODEWORDS   — {"слово1": "Компас ср"}                                   (слово → группа). */
function loadCodewords_(courseId) {
  var map = {}, n = 0;
  var add = function (word, group) {
    var nk = normCode_(word);
    if (!nk || /^replace_me/.test(nk) || !group) return;   // заглушки не принимаются
    map[nk] = String(group); n++;
  };
  var byWord = readJsonProp_('CODEWORDS', courseId);
  if (byWord) Object.keys(byWord).forEach(function (w) { add(w, byWord[w]); });
  var byGroup = readJsonProp_('GROUP_WORDS', courseId);
  if (byGroup) Object.keys(byGroup).forEach(function (g) {
    [].concat(byGroup[g]).forEach(function (w) { add(w, g); });
  });
  return n ? map : null;
}

/** Группа по слову: строка, '' (слово неверно) или null (слова не настроены). */
function groupByWord_(word, courseId) {
  var map = loadCodewords_(courseId);
  if (!map) return null;
  var g = map[normCode_(word)];
  return g || '';
}

function actionCheckWord_(req) {
  var g = groupByWord_(req.word, req.courseId);
  if (g === null) return { ok: false, error: 'not_configured' };
  if (g === '') return { ok: false, error: 'bad_word' };
  return { ok: true, group: g };
}

/** Группа для записи данных: неверное или отсутствующее слово не блокирует приём. */
function resolveGroup_(meta) {
  var g = groupByWord_(meta && meta.word, meta && meta.courseId);
  if (g) return { group: g, verified: true };
  return { group: CONFIG.UNVERIFIED_GROUP, verified: false };
}

/* ============================== вспомогательное ============================ */

function tz_() { return Session.getScriptTimeZone() || 'Europe/Podgorica'; }
function stamp_(d) { return Utilities.formatDate(d || new Date(), tz_(), 'yyyy-MM-dd HH:mm:ss'); }

/** Защита от формул: строки, начинающиеся с = + - @, записываются как текст. Длина ограничивается. */
function safe_(v) {
  if (v == null) return '';
  if (typeof v === 'string') {
    if (v.length > CONFIG.MAX_CELL) v = v.slice(0, CONFIG.MAX_CELL - 20) + ' …[обрезано]';
    if (/^[=+\-@]/.test(v)) return "'" + v;
  }
  return v;
}
function jsonCell_(o) {
  var s;
  try { s = JSON.stringify(o); } catch (e) { s = ''; }
  return safe_(s === undefined ? '' : s);
}
function safeName_(s) {
  return String(s == null ? '' : s).replace(/[\\\/:*?"<>|\[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'без названия';
}

function studentOf_(meta) {
  var st = (meta && meta.student) || {};
  if (st.anonymous) {
    var code = String(st.anonCode || 'Аноним');
    return { key: normWord_(code), name: code, anonymous: true };
  }
  var last = String(st.lastName || '').trim(), first = String(st.firstName || '').trim();
  return { key: normWord_(last + ' ' + first), name: (last + ' ' + first).trim() || 'Без имени', anonymous: false };
}

/* ============================ Диск и таблицы =============================== */

function rootFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  return childFolder_(DriveApp.getRootFolder(), CONFIG.ROOT_FOLDER_NAME);
}
function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}
function groupFolder_(meta, group) {
  var course = safeName_((meta && (meta.courseTitle || meta.courseId)) || 'Курс');
  return childFolder_(childFolder_(rootFolder_(), course), safeName_(group));
}

function propGet_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function propSet_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }

/** Открывает таблицу по сохранённому id или создаёт новую в папке группы. */
function openOrCreate_(propKey, folderFn, title, create, init) {
  var id = propGet_(propKey);
  if (id) {
    try {
      var f = DriveApp.getFileById(id);
      if (!f.isTrashed()) return SpreadsheetApp.openById(id);
    } catch (e) { /* таблица удалена: создаётся заново */ }
  }
  if (!create) return null;
  var folder = folderFn();
  var found = folder.getFilesByName(title);
  while (found.hasNext()) {
    var cand = found.next();
    if (!cand.isTrashed() && cand.getMimeType() === MimeType.GOOGLE_SHEETS) {
      propSet_(propKey, cand.getId());
      return SpreadsheetApp.openById(cand.getId());
    }
  }
  var ss = SpreadsheetApp.create(title);
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);
  init(ss);
  propSet_(propKey, ss.getId());
  return ss;
}

function ensureSheet_(ss, name, header, first) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = first ? ss.getSheets()[0].setName(name) : ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function lessonBook_(meta, group, create) {
  var key = 'L|' + meta.courseId + '|' + group + '|' + meta.lessonId;
  var title = safeName_(meta.lessonTitle || meta.lessonId);
  return openOrCreate_(key, function () { return groupFolder_(meta, group); }, title, create, function (ss) {
    ensureSheet_(ss, SHEET.events, H.events, true);
    ensureSheet_(ss, SHEET.attempts, H.attempts);
    ensureSheet_(ss, SHEET.summary, H.summary);
    ensureSheet_(ss, SHEET.snapshots, H.snapshots);
    ensureSheet_(ss, SHEET.submitted, H.submitted);
  });
}
function journalBook_(meta, group) {
  var key = 'J|' + meta.courseId + '|' + group;
  return openOrCreate_(key, function () { return groupFolder_(meta, group); }, 'Журнал курса', true, function (ss) {
    var sh = ss.getSheets()[0].setName('Журнал');
    sh.getRange(1, 1, 1, 2).setValues([['Ключ', 'Ученик']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
}

function sheetOf_(ss, name, header) { return ss.getSheetByName(name) || ensureSheet_(ss, name, header); }

function colValues_(sh, col) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, col, last - 1, 1).getValues().map(function (r) { return r[0]; });
}
function appendRows_(sh, rows) {
  if (!rows.length) return;
  var last = sh.getLastRow();
  var need = last + rows.length - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need);
  sh.getRange(last + 1, 1, rows.length, rows[0].length).setValues(rows);
}
/** Номер строки (с 1) по значению в первом столбце или 0. */
function findRow_(sh, key) {
  var vals = colValues_(sh, 1);
  for (var i = 0; i < vals.length; i++) if (String(vals[i]) === String(key)) return i + 2;
  return 0;
}

/* ================================ события ================================== */

function actionEvents_(req) {
  var meta = req.meta || {};
  if (!req.attemptId || !Array.isArray(req.events)) return { ok: false, error: 'bad_request' };
  if (req.events.length > CONFIG.MAX_EVENTS_PER_PACKET) return { ok: false, error: 'too_many_events' };
  meta.courseId = meta.courseId || 'unknown-course';
  meta.lessonId = meta.lessonId || String(req.trainerId || 'unknown-lesson');
  var g = resolveGroup_(meta);
  var student = studentOf_(meta);
  var ss = lessonBook_(meta, g.group, true);
  var evSheet = sheetOf_(ss, SHEET.events, H.events);

  var seen = {};
  colValues_(evSheet, 1).forEach(function (k) { seen[k] = true; });
  var now = stamp_(), rows = [], fresh = [], duplicates = 0, maxSeq = 0;
  req.events.forEach(function (ev) {
    if (!ev || typeof ev.seq !== 'number' || !ev.eventType) return;
    var key = req.attemptId + ':' + ev.seq;
    if (seen[key]) { duplicates++; return; }
    seen[key] = true;
    fresh.push(ev);
    if (ev.seq > maxSeq) maxSeq = ev.seq;
    rows.push([key, now, safe_(ev.clientTime), safe_(student.name), safe_(g.group), safe_(req.attemptId), ev.seq, safe_(ev.eventType),
      safe_(ev.eventSource), ev.elapsedMs == null ? '' : ev.elapsedMs, jsonCell_(ev.context), jsonCell_(ev.data)]);
  });
  appendRows_(evSheet, rows);

  if (fresh.length) {
    updateAttempt_(ss, req, meta, g, student, fresh, maxSeq, now);
    updateSummary_(ss, req, g, student, fresh);
    fresh.forEach(function (ev) { if (ev.eventType === 'result_submitted') storeSubmitted_(ss, req, meta, g, student, ev, now); });
    updateJournal_(ss, meta, g, student);
  }
  return { ok: true, accepted: fresh.length, duplicates: duplicates };
}

function updateAttempt_(ss, req, meta, g, student, fresh, maxSeq, now) {
  var sh = sheetOf_(ss, SHEET.attempts, H.attempts);
  var row = findRow_(sh, req.attemptId);
  var cur = row ? sh.getRange(row, 1, 1, H.attempts.length).getValues()[0]
    : [req.attemptId, student.name, g.group, '', '', '', 0, (meta.tasksTotal || ''), 'идёт', 0, 0, 0, g.verified ? 'да' : 'нет'];
  fresh.forEach(function (ev) {
    if (ev.eventType === 'attempt_started' && !cur[3]) cur[3] = safe_(ev.clientTime);
    if (ev.eventType === 'attempt_finished') { cur[5] = safe_(ev.clientTime); cur[8] = 'завершена'; }
    if (ev.eventType === 'session_restored') cur[11] = Number(cur[11] || 0) + 1;
  });
  if (!cur[3]) cur[3] = safe_(fresh[0].clientTime);
  cur[4] = safe_(fresh[fresh.length - 1].clientTime || new Date().toISOString());   // по часам ученика: сопоставимо с началом попытки
  cur[9] = Number(cur[9] || 0) + fresh.length;
  cur[10] = Math.max(Number(cur[10] || 0), maxSeq);
  cur[12] = g.verified ? 'да' : 'нет';
  cur[6] = countSolved_(ss, req.attemptId, meta);
  if (row) sh.getRange(row, 1, 1, H.attempts.length).setValues([cur]);
  else appendRows_(sh, [cur]);
}

function practiceSet_(meta) {
  var set = {};
  (meta.practiceTaskIds || []).forEach(function (id) { set[id] = true; });
  return set;
}
function countSolved_(ss, attemptId, meta) {
  var sh = sheetOf_(ss, SHEET.summary, H.summary);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var set = practiceSet_(meta), n = 0;
  sh.getRange(2, 1, last - 1, 6).getValues().forEach(function (r) {
    if (String(r[3]) === String(attemptId) && r[5] === 'да' && (!meta.practiceTaskIds || set[r[4]])) n++;
  });
  return n;
}

function updateSummary_(ss, req, g, student, fresh) {
  var sh = sheetOf_(ss, SHEET.summary, H.summary);
  var last = sh.getLastRow();
  var data = last >= 2 ? sh.getRange(2, 1, last - 1, H.summary.length).getValues() : [];
  var index = {};
  data.forEach(function (r, i) { index[r[0]] = i; });
  var touched = {}, added = [];
  fresh.forEach(function (ev) {
    var d = ev.data || {};
    var task = d.taskId;
    if (!task || ['code_run', 'code_checked', 'hint_opened', 'task_solved'].indexOf(ev.eventType) < 0) return;
    var key = req.attemptId + ':' + task;
    var r;
    if (index[key] != null) r = data[index[key]];
    else {
      r = [key, student.name, g.group, req.attemptId, task, 'нет', 0, 0, 0, 0, ''];
      data.push(r); index[key] = data.length - 1; added.push(index[key]);
    }
    touched[index[key]] = true;
    if (ev.eventType === 'code_run') r[6] = Number(r[6]) + 1;
    else if (ev.eventType === 'code_checked') r[7] = Number(r[7]) + 1;
    else if (ev.eventType === 'hint_opened') { if (d.kind === 'auto') r[9] = Number(r[9]) + 1; else r[8] = Number(r[8]) + 1; }
    else if (ev.eventType === 'task_solved') {
      r[5] = 'да';
      if (typeof d.runs === 'number') r[6] = d.runs;
      if (typeof d.checks === 'number') r[7] = d.checks;
      if (typeof d.hints === 'number') r[8] = d.hints;
      if (typeof d.autoHints === 'number') r[9] = d.autoHints;
      r[10] = typeof d.timeMs === 'number' ? Math.round(d.timeMs / 1000) : '';
    }
  });
  Object.keys(touched).forEach(function (i) {
    var rowNo = Number(i) + 2;
    if (added.indexOf(Number(i)) >= 0) return;
    sh.getRange(rowNo, 1, 1, H.summary.length).setValues([data[i].map(safe_)]);
  });
  appendRows_(sh, added.map(function (i) { return data[i].map(safe_); }));
}

function storeSubmitted_(ss, req, meta, g, student, ev, now) {
  var d = ev.data || {}, files = d.files || [], f = files[0] || {};
  var content = f.content || {};
  var link = '';
  try {
    var folder = childFolder_(groupFolder_(meta, g.group), 'Файлы работ');
    var name = safeName_(meta.lessonId + ' ' + student.name + ' ' + req.attemptId.slice(0, 8)) + '.json';
    var file = folder.createFile(name, JSON.stringify(content, null, 1), MimeType.PLAIN_TEXT);
    link = file.getUrl();
  } catch (err) { link = 'не удалось сохранить файл: ' + err.message; }
  var brief = {};
  Object.keys(content).forEach(function (k) { if (k !== 'events' && k !== 'state') brief[k] = content[k]; });
  var sh = sheetOf_(ss, SHEET.submitted, H.submitted);
  var solved = content.summary && content.summary.practiceSolved != null ? content.summary.practiceSolved : '';
  appendRows_(sh, [[now, safe_(student.name), safe_(g.group), safe_(req.attemptId), solved, safe_(link), jsonCell_(brief)]]);
}

/** «Журнал курса»: строка на ученика, столбец на конспект: «решено/всего · минут». */
function updateJournal_(lessonSs, meta, g, student) {
  var total = meta.tasksTotal || 0;
  var at = sheetOf_(lessonSs, SHEET.attempts, H.attempts);
  var last = at.getLastRow();
  if (last < 2) return;
  var best = null;
  at.getRange(2, 1, last - 1, H.attempts.length).getValues().forEach(function (r) {
    if (normWord_(r[1]) !== student.key) return;
    var solved = Number(r[6] || 0);
    var mins = minutesBetween_(r[3], r[4]);
    if (!best || solved > best.solved || (solved === best.solved && mins > best.mins)) best = { solved: solved, mins: mins };
  });
  if (!best) return;
  var jb = journalBook_(meta, g.group);
  var sh = jb.getSheetByName('Журнал') || jb.getSheets()[0];
  var label = String(meta.lessonTitle || meta.lessonId).split(/\s+/)[0] || meta.lessonId;
  var lastCol = Math.max(sh.getLastColumn(), 2);
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var col = header.indexOf(label) + 1;
  if (!col) {
    col = lastCol + 1;
    sh.getRange(1, col).setValue(label).setFontWeight('bold');
  }
  var row = findRow_(sh, student.key);
  if (!row) {
    row = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(row, 1, 1, 2).setValues([[student.key, safe_(student.name)]]);
  }
  sh.getRange(row, col).setValue(best.solved + '/' + total + ' · ' + best.mins + ' мин');
}
/** Время ячейки в мс: Таблицы могут вернуть строку даты объектом Date. */
function ms_(v) {
  if (v instanceof Date) return v.getTime();
  return Date.parse(String(v));
}
function minutesBetween_(a, b) {
  var ta = ms_(a), tb = ms_(b);
  if (isNaN(ta) || isNaN(tb) || tb < ta) return 0;
  return Math.round((tb - ta) / 60000);
}

/* ================================= снимки ================================== */

function actionSaveSnapshot_(req) {
  var meta = req.meta || {};
  if (!req.attemptId || !req.snapshot) return { ok: false, error: 'bad_request' };
  var student = studentOf_(meta);
  if (student.anonymous) return { ok: true, skipped: 'anonymous' };
  meta.courseId = meta.courseId || 'unknown-course';
  meta.lessonId = meta.lessonId || 'unknown-lesson';
  var g = resolveGroup_(meta);
  var ss = lessonBook_(meta, g.group, true);
  var sh = sheetOf_(ss, SHEET.snapshots, H.snapshots);
  var snap = req.snapshot, text = JSON.stringify(snap);
  if (text.length > CONFIG.MAX_CELL) {
    var small = JSON.parse(text);
    Object.keys(small.codes || {}).forEach(function (k) { small.codes[k] = String(small.codes[k]).slice(0, 1500); });
    text = JSON.stringify(small);
  }
  var nowIso = new Date().toISOString();
  var row = [student.key, safe_(student.name), safe_(g.group), req.attemptId, nowIso, text.length > CONFIG.MAX_CELL ? '' : text];
  var at = findRow_(sh, student.key);
  if (at) sh.getRange(at, 1, 1, row.length).setValues([row]);
  else appendRows_(sh, [row]);
  return { ok: true, savedAt: nowIso };
}

function actionGetSnapshot_(req) {
  var meta = req.meta || {};
  var student = studentOf_(meta);
  if (student.anonymous) return { ok: true, found: false };
  meta.courseId = meta.courseId || 'unknown-course';
  meta.lessonId = meta.lessonId || 'unknown-lesson';
  var g = resolveGroup_(meta);
  var ss = lessonBook_(meta, g.group, false);
  if (!ss) return { ok: true, found: false };
  var sh = ss.getSheetByName(SHEET.snapshots);
  if (!sh) return { ok: true, found: false };
  var row = findRow_(sh, student.key);
  if (!row) return { ok: true, found: false };
  var r = sh.getRange(row, 1, 1, H.snapshots.length).getValues()[0];
  var snapshot;
  try { snapshot = JSON.parse(r[5]); } catch (e) { return { ok: true, found: false }; }
  var maxSeq = 0;
  var at = ss.getSheetByName(SHEET.attempts);
  if (at) {
    var ar = findRow_(at, r[3]);
    if (ar) maxSeq = Number(at.getRange(ar, 11).getValue() || 0);
  }
  var ts = ms_(r[4]);
  return { ok: true, found: true, snapshot: snapshot, savedAt: isNaN(ts) ? null : ts, maxSeq: maxSeq };
}

/* ============================ проверка настройки =========================== */

/** Запускается вручную из редактора: показывает в журнале, что настроено, а что нет. */
function testSetup() {
  var map = loadCodewords_('');
  Logger.log('Версия: ' + VERSION);
  Logger.log(map ? 'Кодовых слов: ' + Object.keys(map).length + '; группы: ' + Object.keys(map).map(function (k) { return map[k]; }).join(', ')
    : 'ОШИБКА: ни CODEWORDS, ни GROUP_WORDS не заданы или содержат только заглушки REPLACE_ME');
  try {
    Logger.log('Корневая папка на Диске: ' + rootFolder_().getUrl());
  } catch (e) { Logger.log('ОШИБКА доступа к Диску: ' + e.message); }
}

/** Запускается вручную из редактора: показывает, как скрипт прочитал свойства CODEWORDS и GROUP_WORDS (журнал виден только владельцу). */
function debugCodewords() {
  var props = PropertiesService.getScriptProperties();
  var shown = 0;
  [['CODEWORDS', 'слово → группа'], ['GROUP_WORDS', 'группа → слово']].forEach(function (p) {
    var raw = props.getProperty(p[0]);
    if (!raw) { Logger.log('Свойство ' + p[0] + ' не задано.'); return; }
    var src;
    try { src = JSON.parse(raw); } catch (e) { Logger.log('ОШИБКА: значение ' + p[0] + ' не является корректным JSON: ' + e.message + ' (в JSON допустимы только двойные кавычки)'); return; }
    Logger.log('Свойство ' + p[0] + ' (формат: ' + p[1] + '):');
    Object.keys(src).forEach(function (k) {
      var left = k, right = String(src[k]), flags = [];
      var words = p[0] === 'CODEWORDS' ? [left] : [].concat(src[k]).map(String);
      if (/^слово\s*\d*$/i.test(left) && p[0] === 'CODEWORDS') flags.push('«' + left + '» похоже на название-заглушку, а не на слово группы: в CODEWORDS слева должно быть само слово, справа — группа (или используйте GROUP_WORDS)');
      words.forEach(function (w) {
        if (/[а-яё]/i.test(w) && /[a-z]/i.test(w)) flags.push('слово «' + w + '» содержит и кириллицу, и латиницу');
        if (w !== w.trim()) flags.push('слово «' + w + '» с пробелом в начале или в конце');
      });
      Logger.log('  ' + left + ' → ' + (p[0] === 'CODEWORDS' ? right : words.join(', ')) + (flags.length ? '   [' + flags.join('; ') + ']' : ''));
      shown++;
    });
  });
  var map = loadCodewords_('');
  Logger.log(map ? 'Итог: принимаются слова — ' + Object.keys(map).length + ' шт.; группы: ' + Object.keys(map).map(function (k) { return map[k]; }).filter(function (g, i, a) { return a.indexOf(g) === i; }).join(', ') : 'Итог: ни одного рабочего слова нет.');
}

/** Показывает, какая группа соответствует слову (впишите слово в строку ниже и запустите функцию). */
function debugOneWord() {
  var word = 'ВПИШИТЕ СЛОВО';
  var g = groupByWord_(word, '');
  Logger.log(g === null ? 'CODEWORDS не настроено' : (g ? 'Слово «' + word + '» принято, группа: ' + g : 'Слово «' + word + '» не найдено'));
}
