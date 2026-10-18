const { createServer } = require('./gas_mock');
const assert = require('assert');
const srv = createServer({ CODEWORDS: JSON.stringify({ 'Слово Кс': 'Компас ср', 'слово пт': 'Компас пт', 'REPLACE_ME_x': 'Плохая', 'слово фш': 'ФШ пн' }) }, require('path').join(__dirname, '..', 'K1', 'apps-script', 'Code.gs'));
const meta = (o) => Object.assign({ courseId: 'informatics-8-algorithms-python', courseTitle: 'Информатика 8', lessonId: 'K1', lessonTitle: 'К1 Алгоритмы и исполнители. Свойства алгоритмов', tasksTotal: 5, practiceTaskIds: ['p1','p2','p3','p4','p5'], word: 'слово кс', student: { firstName: 'Ана', lastName: 'Петрович' } }, o || {});
const ev = (seq, type, data, ctx) => ({ seq, eventType: type, eventVersion: 1, schemaVersion: 1, clientTime: new Date(Date.UTC(2026,9,21,8,0,seq)).toISOString(), elapsedMs: seq * 1000, trainerId: 'informatics-8-k01-lesson', trainerVersion: '1.0.0', eventSource: 'user', context: ctx || {}, data: data || {} });
(async () => {
  assert.deepStrictEqual(srv.get().ok, true);
  assert.deepStrictEqual(srv.post({ action: 'checkWord', word: ' слово  КС ', courseId: 'x' }), { ok: true, group: 'Компас ср' });
  assert.deepStrictEqual(srv.post({ action: 'checkWord', word: 'нет' }).error, 'bad_word');
  assert.deepStrictEqual(srv.post({ action: 'checkWord', word: 'REPLACE_ME_x' }).error, 'bad_word');
  assert.deepStrictEqual(srv.post('garbage').error, 'bad_json');
  assert.deepStrictEqual(srv.post({ action: 'zzz' }).error, 'unknown_action');
  const A = 'attempt-aaaa-1111';
  let r = srv.post({ schemaVersion: 1, attemptId: A, trainerId: 't', action: 'events', meta: meta(), events: [
    ev(1, 'attempt_started'), ev(2, 'access_checked'), ev(3, 'code_run', { taskId: 'p1' }), ev(4, 'code_checked', { taskId: 'p1' }), ev(5, 'hint_opened', { taskId: 'p1', kind: 'step', step: 1 }),
    ev(6, 'hint_opened', { taskId: 'p1', kind: 'auto' }), ev(7, 'task_solved', { taskId: 'p1', runs: 1, checks: 1, hints: 1, autoHints: 1, timeMs: 61000 }), ev(8, 'code_checked', { taskId: 'd2' }), ev(9, 'task_solved', { taskId: 'd2', runs: 1, checks: 1, hints: 0, autoHints: 0, timeMs: 5000 }) ] });
  assert.deepStrictEqual(r, { ok: true, accepted: 9, duplicates: 0 });
  // дубли
  r = srv.post({ attemptId: A, events: [ev(8, 'code_checked', { taskId: 'd2' }), ev(10, 'code_run', { taskId: 'p2' })], meta: meta() });
  assert.deepStrictEqual(r, { ok: true, accepted: 1, duplicates: 1 });
  // инъекция формул
  r = srv.post({ attemptId: 'attempt-bbbb', action: 'events', meta: meta({ student: { firstName: '=HYPERLINK("x")', lastName: '+Evil' } }), events: [ev(1, 'attempt_started')] });
  assert.strictEqual(r.ok, true);
  // завершение
  r = srv.post({ attemptId: A, action: 'events', meta: meta(), events: [ev(11, 'attempt_finished', { durationMs: 1 }),
    ev(12, 'result_submitted', { fields: {}, files: [{ field: 'file', name: 'x.json', content: { summary: { practiceSolved: 1, practiceTotal: 5 }, events: [1,2,3], items: [] } }] })] });
  assert.strictEqual(r.accepted, 2);
  // неверное слово — группа «Не проверена»
  r = srv.post({ attemptId: 'attempt-cccc', action: 'events', meta: meta({ word: 'мусор', student: { anonymous: true, anonCode: 'Аноним A-8C9F03' } }), events: [ev(1, 'attempt_started')] });
  assert.strictEqual(r.accepted, 1);
  // снимок
  r = srv.post({ action: 'saveSnapshot', attemptId: A, meta: meta(), snapshot: { attemptId: A, seq: 9, part: 'practice', codes: { p1: 'print(1)' }, answers: {} } });
  assert.strictEqual(r.ok, true);
  r = srv.post({ action: 'saveSnapshot', attemptId: A, meta: meta(), snapshot: { attemptId: A, seq: 12, part: 'summary', codes: { p1: 'print(2)' } } });
  r = srv.post({ action: 'getSnapshot', meta: meta() });
  assert.strictEqual(r.found, true); assert.strictEqual(r.snapshot.codes.p1, 'print(2)'); assert.strictEqual(r.maxSeq, 12);
  assert.strictEqual(srv.post({ action: 'getSnapshot', meta: meta({ student: { firstName: 'Нет', lastName: 'Такого' } }) }).found, false);
  assert.strictEqual(srv.post({ action: 'getSnapshot', meta: meta({ student: { anonymous: true, anonCode: 'Аноним A-1' } }) }).found, false);
  // дерево папок и таблицы
  const tree = (f, d = 0) => { let s = ' '.repeat(d) + '[' + f.name + ']\n'; f.files.forEach(x => s += ' '.repeat(d + 1) + x.name + '\n'); f.folders.forEach(x => s += tree(x, d + 1)); return s; };
  console.log(tree(srv.root));
  const books = Object.values(srv.files).filter(f => f.kind === 'sheet');
  for (const bk of books) {
    console.log('== ' + bk.name);
    bk.payload.sheets.forEach(sh => { console.log('  -- ' + sh.name + ' (' + (sh.getLastRow() - 1) + ' строк)'); if (!/События/.test(sh.name)) sh.data.filter(Boolean).forEach(r => console.log('    ', JSON.stringify(r.map(v => typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v)))); });
  }
  // нагрузка: 15 пакетов подряд, идемпотентность
  for (let i = 0; i < 3; i++) { srv.post({ attemptId: 'att-load', action: 'events', meta: meta(), events: Array.from({ length: 25 }, (_, k) => ev(i * 25 + k + 1, 'heartbeat')) }); }
  const evSheet = books.find(b => /К1/.test(b.name)).payload.getSheetByName('События');
  console.log('строк событий в таблице Компас ср:', evSheet.getLastRow() - 1);
  console.log('GAS TESTS OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
