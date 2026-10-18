
/* ---------- проверка вывода ---------- */
const fold = s => String(s).replace(/ /g, ' ').replace(/[–—−]/g, '-');
function normLines(text) {
  const a = fold(text).replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, ''));
  while (a.length && a[a.length - 1] === '') a.pop();
  return a;
}
function compareOutput(got, expected) {
  const g = normLines(got), e = normLines(expected);
  if (g.length === e.length && g.every((l, i) => l === e[i])) return { ok: true, got: g, exp: e };
  const r = { ok: false, got: g, exp: e };
  if (!g.length) { r.kind = 'empty'; return r; }
  if (g.length !== e.length) { r.kind = 'count'; }
  const sg = g.slice().sort().join('\n'), se = e.slice().sort().join('\n');
  if (g.length === e.length && sg === se) { r.kind = 'order'; return r; }
  const n = Math.min(g.length, e.length);
  let k = -1;
  for (let i = 0; i < n; i++) if (g[i] !== e[i]) { k = i; break; }
  if (k < 0) { r.line = n + 1; return r; }
  r.line = k + 1;
  if (!r.kind) {
    if (g[k].toLowerCase() === e[k].toLowerCase()) r.kind = 'case';
    else if (g[k].replace(/\s+/g, '') === e[k].replace(/\s+/g, '')) r.kind = 'space';
    else r.kind = 'text';
  }
  return r;
}
const q = s => '«' + s + '»';
function failMessage(t, i, hidden, res, runErr) {
  const name = hidden ? 'скрытый тест ' + (i + 1) : 'тест ' + (i + 1);
  if (hidden) return 'Неверно: ' + name + '.';
  if (runErr) {
    if (runErr.type === 'TimeLimitError') return 'Неверно: ' + name + ' — программа не завершилась за отведённое время.';
    return 'Неверно: ' + name + ' — программа завершилась ошибкой ' + runErr.type + (runErr.line ? ' в строке ' + runErr.line : '') + '.';
  }
  if (res.kind === 'trace') return 'Неверно: ' + name + ' — ' + res.msg + '.';
  if (res.kind === 'empty') return 'Неверно: ' + name + ' — вывод пуст.';
  if (res.kind === 'order') return 'Неверно: ' + name + ' — строки выведены в другом порядке.';
  if (res.exp.length !== res.got.length && (res.line > Math.min(res.exp.length, res.got.length) || res.kind === 'count'))
    return 'Неверно: ' + name + ' — ожидалось строк: ' + res.exp.length + ', получено: ' + res.got.length + '.';
  const el = res.exp[res.line - 1], gl = res.got[res.line - 1];
  return 'Неверно: ' + name + ' — строка вывода ' + res.line + ': ожидалось ' + q(el === undefined ? '' : el) + ', получено ' + q(gl === undefined ? '' : gl) + '.';
}
function genericDiagnosis(res) {
  if (!res) return null;
  if (res.kind === 'trace') return res.empty ? 'На рисунке нет линий: перо должно быть опущено (pendown), а движение выполнено командой forward или backward.' : 'Рисунок отличается от образца. Команда <code>left</code> поворачивает черепаху налево (против часовой стрелки), <code>right</code> — направо; в начале черепаха смотрит вправо.';
  if (res.kind === 'empty') return 'Вывод пуст. Вывод на экран выполняется командой <code>print()</code>.';
  if (res.kind === 'order') return 'Все строки присутствуют, но порядок строк отличается от образца. Команды выполняются сверху вниз.';
  if (res.kind === 'count') return 'Число строк вывода отличается от образца: ожидалось ' + res.exp.length + ', получено ' + res.got.length + '. Каждая команда <code>print()</code> выводит одну строку.';
  if (res.kind === 'case') return 'В строке вывода ' + res.line + ' отличается регистр букв (заглавные и строчные).';
  if (res.kind === 'space') return 'В строке вывода ' + res.line + ' отличается число пробелов. Пробелы входят в вывод.';
  if (res.kind === 'text') return 'Строка вывода ' + res.line + ' отличается от образца. Требуется сравнить её с образцом посимвольно.';
  return null;
}

/* ---------- проверка рисунка turtle: отрезки сравниваются как множества (порядок и направление не важны) ---------- */
const fmtN = n => { const r = Math.round(n * 10) / 10; return String(Math.abs(r - Math.round(r)) < 0.05 ? Math.round(r) : r).replace('-0', '0'); };
const fmtSeg = s => 'от (' + fmtN(s.x1) + '; ' + fmtN(s.y1) + ') до (' + fmtN(s.x2) + '; ' + fmtN(s.y2) + ')';
function toSegs(list) { return list.map(a => ({ x1: +a[0], y1: +a[1], x2: +a[2], y2: +a[3], c: String(a[4] === undefined ? 'black' : a[4]).toLowerCase(), w: a[5] === undefined ? 1 : +a[5] })); }
function mergeCollinear(segs) {
  const out = [];
  segs.forEach(s => {
    const l = out[out.length - 1];
    if (l && l.c === s.c && Math.hypot(l.x2 - s.x1, l.y2 - s.y1) < 0.05) {
      const ax = l.x2 - l.x1, ay = l.y2 - l.y1, bx = s.x2 - s.x1, by = s.y2 - s.y1;
      if (Math.abs(ax * by - ay * bx) < 0.01 * Math.hypot(ax, ay) * Math.hypot(bx, by) && ax * bx + ay * by > 0) { l.x2 = s.x2; l.y2 = s.y2; return; }
    }
    out.push(Object.assign({}, s));
  });
  return out;
}
function shiftToOrigin(segs) {
  if (!segs.length) return segs;
  const mx = Math.min.apply(null, segs.map(s => Math.min(s.x1, s.x2))), my = Math.min.apply(null, segs.map(s => Math.min(s.y1, s.y2)));
  return segs.map(s => Object.assign({}, s, { x1: s.x1 - mx, x2: s.x2 - mx, y1: s.y1 - my, y2: s.y2 - my }));
}
function compareTrace(gotRaw, spec) {
  const tol = spec.tol || 0.6, useColor = !!spec.colors;
  let G = mergeCollinear(toSegs(gotRaw)), E = mergeCollinear(toSegs(spec.segments));
  if (spec.relative) { G = shiftToOrigin(G); E = shiftToOrigin(E); }
  const near = (a, b) => Math.abs(a - b) <= tol;
  const same = (a, b, col) => (col ? a.c === b.c : true) && ((near(a.x1, b.x1) && near(a.y1, b.y1) && near(a.x2, b.x2) && near(a.y2, b.y2)) || (near(a.x1, b.x2) && near(a.y1, b.y2) && near(a.x2, b.x1) && near(a.y2, b.y1)));
  const match = col => {
    const used = new Array(G.length).fill(false), missing = [];
    E.forEach(e => { const i = G.findIndex((g, k) => !used[k] && same(e, g, col)); if (i < 0) missing.push(e); else used[i] = true; });
    return { missing: missing, extra: G.filter((g, k) => !used[k]) };
  };
  const m = match(useColor);
  if (!m.missing.length && !m.extra.length) return { ok: true, got: G.length, exp: E.length, kind: 'trace' };
  let msg;
  if (!G.length) msg = 'на рисунке нет линий';
  else if (useColor && !match(false).missing.length && !match(false).extra.length) msg = 'цвет линий отличается от образца';
  else if (m.missing.length) msg = 'не найден отрезок ' + fmtSeg(m.missing[0]);
  else msg = 'лишний отрезок ' + fmtSeg(m.extra[0]);
  return { ok: false, kind: 'trace', msg: msg, got: G.length, exp: E.length, empty: !G.length };
}
function drawTrace(el, spec) {
  const segs = toSegs(spec.segments);
  const xs = [0], ys = [0];
  segs.forEach(s => { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2); });
  const pad = 24, x0 = Math.min.apply(null, xs) - pad, x1 = Math.max.apply(null, xs) + pad, y0 = Math.min.apply(null, ys) - pad, y1 = Math.max.apply(null, ys) + pad;
  const W = x1 - x0, H = y1 - y0, X = x => x - x0, Y = y => y1 - y;
  let grid = '';
  for (let gx = Math.ceil(x0 / 20) * 20; gx <= x1; gx += 20) grid += '<line x1="' + X(gx) + '" y1="0" x2="' + X(gx) + '" y2="' + H + '" stroke="' + (gx === 0 ? '#9fb6dc' : '#e1e9f5') + '"/>';
  for (let gy = Math.ceil(y0 / 20) * 20; gy <= y1; gy += 20) grid += '<line x1="0" y1="' + Y(gy) + '" x2="' + W + '" y2="' + Y(gy) + '" stroke="' + (gy === 0 ? '#9fb6dc' : '#e1e9f5') + '"/>';
  const lines = segs.map(s => '<line x1="' + X(s.x1) + '" y1="' + Y(s.y1) + '" x2="' + X(s.x2) + '" y2="' + Y(s.y2) + '" stroke="' + (s.c === 'black' ? '#14201c' : esc(s.c)) + '" stroke-width="' + Math.max(2, s.w) + '" stroke-linecap="round"/>').join('');
  el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Образец рисунка" style="width:100%;max-width:' + Math.min(320, Math.max(160, W * 1.3)) + 'px;background:#fdfdfb;border:1px solid var(--line);border-radius:6px">' + grid + lines + '<circle cx="' + X(0) + '" cy="' + Y(0) + '" r="3.5" fill="#c8413a"/></svg><div class="legend">Образец рисунка. Клетка сетки — 20 шагов; красная точка — начало координат, откуда черепаха стартует (направление — вправо).</div>';
}
function stripComments(code) {
  return code.split('\n').map(l => {
    let q = null;
    for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '\\') i++; else if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '#') return l.slice(0, i); }
    return l;
  }).join('\n');
}
/* Требования к тексту программы: {need|forbid: 'регулярное выражение', flags, text, hidden, inComments} или {comments: N, text}. */
function countComments(code) {
  return code.split('\n').filter(l => stripComments(l).length < l.length).length;
}
function ruleResults(task, code) {
  const bare = stripComments(code);
  return (task.rules || []).map(r => {
    if (r.comments != null) return { rule: r, ok: countComments(code) >= r.comments };      // не меньше N комментариев
    const re = new RegExp(r.need || r.forbid, r.flags || ''), found = re.test(r.inComments ? code : bare);
    return { rule: r, ok: r.need ? found : !found };
  });
}
function taskAutoHint(task, code, outputs) {
  for (const h of task.autoHints || []) {
    if (h.re) {
      const m = new RegExp(h.re).test(code);
      if (h.absent ? !m : m) return h.text;
    } else if (h.countLt) {
      const c = (code.match(new RegExp(h.countLt.re, 'g')) || []).length;
      if (c < h.countLt.n) return h.text;
    } else if (h.outputLacks) {
      if (outputs.some(o => o.indexOf(h.outputLacks) < 0)) return h.text;
    }
  }
  return null;
}

/* ---------- песочница (редактор + вывод + ошибки + проверка) ---------- */
const SB = {};          // id → объект песочницы
const firstOpenObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting && S) {
      const id = en.target.dataset.task;
      if (!S.firstOpened[id]) { S.firstOpened[id] = Date.now(); touch(); }
    }
  });
}, { threshold: 0.3 }) : null;

function printTo(con, text, cls) {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  s.textContent = text;
  con.appendChild(s);
  if (con.textContent.length > 20000) { while (con.textContent.length > 16000 && con.firstChild) con.removeChild(con.firstChild); }
  con.scrollTop = con.scrollHeight;
  return s;
}

function createSandbox(host, id, task) {
  const isCheck = task.kind === 'check';
  host.innerHTML =
    '<div class="task' + (task.star ? ' star' : '') + '" data-task="' + id + '">' +
    '<div class="task-head"><h3>' + esc(task.title) + (task.star ? '' : '') + '</h3><span class="pill ok solved-pill" hidden>✓ Засчитано</span></div>' +
    '<div class="task-statement">' + task.statement + '</div>' +
    '<div class="sbx-cols">' +
      '<div class="pane"><div class="pane-head"><span>Редактор · Python 3</span></div><div class="ed-host"></div>' +
        '<div class="toolbar">' +
          '<button class="btn primary b-run" type="button">Запустить</button>' +
          '<button class="btn b-stop" type="button" disabled>Остановить</button>' +
          (isCheck ? '<button class="btn accent b-check" type="button">Проверить</button><button class="btn b-hint" type="button">Подсказка</button>' : '') +
          '<button class="btn b-reset" type="button">Сбросить код</button>' +
          '<span class="kbd">Ctrl+Enter — запуск</span>' +
        '</div></div>' +
      '<div class="right">' +
        '<div class="pane"><div class="pane-head"><span>Вывод программы</span><button class="btn b-showturtle" type="button" hidden style="min-height:24px;padding:0 8px">Рисунок</button></div><div class="console" aria-live="polite"></div></div>' +
        '<div class="pane errpane" style="margin-top:10px"><div class="pane-head"><span class="err-title">Сообщения об ошибках</span></div><div class="errs" aria-live="polite"><span class="empty">Ошибок нет.</span></div></div>' +
      '</div>' +
    '</div>' +
    (isCheck ? '<div class="check-msg" role="status" aria-live="polite"></div><div class="check-detail"></div><div class="hints"></div>' : '') +
    '</div>';
  const root = $('.task', host);
  $$('.flow-fig', root).forEach(buildFlow);
  $$('pre.code.py', root).forEach(decorateStaticCode);
  const tfig = $('.trace-fig', root);
  if (tfig && task.tests && task.tests[0] && task.tests[0].trace) drawTrace(tfig, task.tests[0].trace);
  const con = $('.console', root), errBox = $('.errs', root), errPane = $('.errpane', root);
  const bRun = $('.b-run', root), bStop = $('.b-stop', root), bCheck = $('.b-check', root), bHint = $('.b-hint', root), bReset = $('.b-reset', root), bTurtle = $('.b-showturtle', root);
  const msg = $('.check-msg', root), detail = $('.check-detail', root), hintsBox = $('.hints', root);

  const ed = createEditor($('.ed-host', root), {
    label: 'Код: ' + task.title, minRows: task.rows || 6, maxRows: 16,
    onRun: () => runInteractive(),
    onChange: v => { S.codes[id] = v; touch(); },
    onClip: (kind, len) => { if (kind === 'paste') rec('paste', 'user', { taskId: id }, { textLength: len }); else rec(kind, 'user', { taskId: id }, {}); }
  });
  const sb = { id: id, task: task, root: root, ed: ed, ladder: 0 };
  SB[id] = sb;
  if (firstOpenObserver) { host.dataset.task = id; firstOpenObserver.observe(host); }

  sb.setCode = v => { ed.set(v); if (S) { S.codes[id] = v; } };
  sb.getCode = () => ed.get();
  sb.initCode = () => ed.set((S && S.codes[id] != null) ? S.codes[id] : task.starter);
  sb.reset = () => { ed.set(task.starter); S.codes[id] = task.starter; showError(null); con.textContent = ''; msg.textContent = ''; msg.className = 'check-msg'; if (detail) detail.innerHTML = ''; };

  function setBusy(b) {
    Runner.busy = b; Runner.owner = b ? sb : null;
    $$('.b-run,.b-check,.b-reset').forEach(x => { x.disabled = b; });
    $$('.b-stop').forEach(x => { x.disabled = !(b && x === bStop); });
    if (!b) $$('.b-hint').forEach(x => { const o = SB[x.closest('.task').dataset.task]; x.disabled = o.ladder >= (o.task.ladder || []).length; });
  }
  sb.setBusy = setBusy;

  function showError(err) {
    errPane.classList.toggle('has-error', !!err && err.type !== 'Stopped');
    if (!err) { errBox.innerHTML = '<span class="empty">Ошибок нет.</span>'; $('.err-title', root).textContent = 'Сообщения об ошибках'; ed.setErrLine(0); return; }
    $('.err-title', root).textContent = err.type === 'Stopped' ? 'Программа остановлена' : (err.line ? 'Ошибка в строке ' + err.line : 'Ошибка');
    errBox.innerHTML = '<div class="ru">' + err.ru + '</div>' + (err.type === 'Stopped' ? '' : '<div class="raw"></div>');
    const raw = $('.raw', errBox); if (raw) raw.textContent = err.type + ': ' + err.message;
    if (err.line) {
      ed.setErrLine(err.line);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn goto'; b.textContent = 'Перейти к строке ' + err.line;
      b.onclick = () => ed.focusLine(err.line);
      errBox.appendChild(b);
    }
  }

  function askInput(prompt) {
    if (prompt) printTo(con, prompt);
    return new Promise((resolve, reject) => {
      const inp = document.createElement('input');
      inp.setAttribute('aria-label', 'Ввод для программы'); inp.autocomplete = 'off';
      con.appendChild(inp); inp.focus(); con.scrollTop = con.scrollHeight;
      Runner.pendingInput = { reject: () => { inp.remove(); const err = new Error('stop'); err.__stopped = true; reject(err); } };
      inp.addEventListener('keydown', ev => {
        if (ev.key !== 'Enter') return;
        const v = inp.value; inp.remove(); Runner.pendingInput = null;
        printTo(con, v, 'typed'); printTo(con, '\n'); resolve(v);
      });
    });
  }

  async function runInteractive() {
    if (Runner.busy || !window.Sk) return;
    const code = ed.get();
    showError(null); con.textContent = '';
    const usesTurtle = /\bturtle\b/.test(code);
    $('#turtle').innerHTML = ''; bTurtle.hidden = !usesTurtle;
    if (usesTurtle) openTurtle(root); else twin.hidden = true;
    setBusy(true);
    stat(id).runs++;
    emit('run', { code: code });
    const r = await runPython(code, { onInput: askInput, onOutput: t => printTo(con, t), turtleTarget: usesTurtle ? 'turtle' : null });
    setBusy(false);
    if (r.ok) printTo(con, (r.output && !r.output.endsWith('\n') ? '\n' : '') + '— программа завершена —', 'sys');
    else { printTo(con, (r.output && !r.output.endsWith('\n') ? '\n' : '') + '— программа прервана —', 'err'); showError(r.error); stat(id).errors++; }
    rec('code_run', 'user', { taskId: id }, {
      taskId: id, code: cap(code, 20000), output: cap(r.output, 5000), inputs: r.inputs || [],
      error: r.ok ? null : { type: r.error.type, line: r.error.line, text: cap(r.error.message, 300) }, durationMs: r.ms
    });
  }
  bRun.onclick = runInteractive;
  bStop.onclick = stopRun;
  bTurtle.onclick = () => openTurtle(root);
  bReset.onclick = () => {
    if (Runner.busy) return;
    if (!window.confirm('Вернуть заготовку кода? Текущий код будет заменён.')) return;
    sb.reset(); rec('code_reset', 'user', { taskId: id }, { taskId: id });
  };

  /* --- подсказки --- */
  function addHint(html, kind, step) {
    const d = document.createElement('div'); d.className = 'hint';
    d.innerHTML = '<b>' + (kind === 'auto' ? 'Что не так.' : 'Подсказка ' + step + ' из ' + task.ladder.length + '.') + '</b> ' + html;
    hintsBox.appendChild(d);
    rec('hint_opened', 'user', { taskId: id }, { taskId: id, kind: kind === 'auto' ? 'auto' : 'step', step: kind === 'auto' ? null : step, text: cap(d.textContent, 400) });
  }
  if (bHint) bHint.onclick = () => {
    if (sb.ladder >= task.ladder.length) return;
    sb.ladder++; stat(id).hints++;
    addHint(task.ladder[sb.ladder - 1], 'step', sb.ladder);
    if (sb.ladder >= task.ladder.length) bHint.disabled = true;
  };
  sb.restoreHints = () => {          // после восстановления открытые подсказки показываются заново
    hintsBox && (hintsBox.innerHTML = '');
    sb.ladder = Math.min(stat(id).hints, (task.ladder || []).length);
    for (let i = 0; i < sb.ladder; i++) {
      const d = document.createElement('div'); d.className = 'hint';
      d.innerHTML = '<b>Подсказка ' + (i + 1) + ' из ' + task.ladder.length + '.</b> ' + task.ladder[i];
      hintsBox.appendChild(d);
    }
    if (bHint) bHint.disabled = sb.ladder >= (task.ladder || []).length;
  };

  /* --- проверка --- */
  async function check() {
    if (Runner.busy || !window.Sk || !isCheck) return;
    const code = ed.get();
    setBusy(true);
    msg.className = 'check-msg'; msg.textContent = 'Проверка…'; detail.innerHTML = '';
    const results = [], outputs = [];
    for (let i = 0; i < task.tests.length; i++) {
      const t = task.tests[i];
      const r = await runPython(code, { inputs: t.input || [], silent: true, timeLimit: 2000, trace: !!t.trace });
      let cmp;
      if (!r.ok) cmp = { ok: false, kind: 'error', got: normLines(r.output), exp: normLines(t.expected || '') };
      else if (t.trace) { cmp = compareTrace(r.segments, t.trace); if (cmp.ok && t.expected != null) cmp = compareOutput(r.output, t.expected); }
      else cmp = compareOutput(r.output, t.expected);
      results.push({ t: t, run: r, cmp: cmp, passed: r.ok && cmp.ok });
      outputs.push(r.output);
      if (r.error && r.error.type === 'TimeLimitError') break;
    }
    setBusy(false);
    stat(id).checks++;
    const checkNo = stat(id).checks;
    const rules = ruleResults(task, code), badRule = rules.find(x => !x.ok);
    const testsOk = results.length === task.tests.length && results.every(r => r.passed);
    const allOk = testsOk && !badRule;
    // сообщение
    let text;
    if (allOk) text = 'Верно';
    else if (!testsOk) {
      const i = results.findIndex(r => !r.passed), r = results[i];
      text = failMessage(r.t, i, !!r.t.hidden, r.cmp, r.run.ok ? null : r.run.error);
    } else text = 'Неверно: ' + (badRule.rule.hidden ? 'не выполнено скрытое требование к программе.' : badRule.rule.text);
    msg.className = 'check-msg ' + (allOk ? 'ok' : 'bad');
    msg.textContent = (allOk ? '✓ ' : '✗ ') + text;
    // сравнение ожидаемого и полученного выводится только при неверном результате (верный результат показывается один раз — в сообщении)
    const many = results.length > 1;
    detail.innerHTML = allOk ? '' : results.filter(r => !r.passed && !r.t.hidden && r.cmp.kind !== 'trace').map(r => {
      const i = results.indexOf(r);
      const got = r.run.ok ? r.run.output.replace(/\n$/, '') : (r.run.output.replace(/\n$/, '') + (r.run.output ? '\n' : '') + '[' + r.run.error.type + ']');
      return '<div class="t">' + (many ? '<h5>Тест ' + (i + 1) + '</h5>' : '') + '<div class="cmp"><div><div class="lab">Ожидалось</div><pre>' + esc(r.t.expected) + '</pre></div><div><div class="lab">Получено</div><pre>' + esc(got === '' ? '(пусто)' : got) + '</pre></div></div></div>';
    }).join('');
    // подсказка по результату проверки
    hintsBox.querySelectorAll('.hint.auto').forEach(n => n.remove());
    if (!allOk) {
      const first = results.find(r => !r.passed);
      let h = taskAutoHint(task, code, outputs);
      if (!h && !first && badRule && !badRule.rule.hidden) h = badRule.rule.hint || null;
      if (!h && first && first.run.ok) h = genericDiagnosis(first.cmp);
      if (!h && first && !first.run.ok) h = first.run.error.ru;
      if (h) { const d = document.createElement('div'); d.className = 'hint auto'; d.innerHTML = '<b>Что не так.</b> ' + h; hintsBox.appendChild(d); stat(id).autoHints++; rec('hint_opened', 'system', { taskId: id }, { taskId: id, kind: 'auto', step: null, text: cap(d.textContent, 400) }); }
    }
    rec('code_checked', 'user', { taskId: id }, {
      taskId: id, checkNo: checkNo, code: cap(code, 20000), result: allOk ? 'верно' : 'неверно',
      tests: results.map((r, i) => ({ n: i + 1, hidden: !!r.t.hidden, passed: r.passed, output: cap(r.run.output, 2000), error: r.run.ok ? null : r.run.error.type, trace: r.cmp.kind === 'trace' ? { got: r.cmp.got, expected: r.cmp.exp, note: r.cmp.msg || null } : undefined })),
      rules: rules.map(x => ({ text: x.rule.text, hidden: !!x.rule.hidden, ok: x.ok }))
    });
    emit('check', { passed: allOk, code: code });
    if (allOk && !S.solved[id]) {
      const st = stat(id);
      const timeMs = S.firstOpened[id] ? Date.now() - S.firstOpened[id] : null;
      S.solved[id] = { at: Date.now(), timeMs: timeMs, runs: st.runs, checks: st.checks, hints: st.hints };
      rec('task_solved', 'system', { taskId: id }, { taskId: id, runs: st.runs, checks: st.checks, hints: st.hints, autoHints: st.autoHints, timeMs: timeMs });
      sb.markSolved();
      updateProgress();
    }
    touch(); snapshotNow = true;
    flush('check');
  }
  if (bCheck) bCheck.onclick = check;
  sb.check = check;
  sb.markSolved = () => { const p = $('.solved-pill', root); if (p) p.hidden = !S.solved[id]; };
  sb.run = runInteractive;
  return sb;
}

function updateProgress() {
  const n = CFG.practiceTaskIds.filter(id => S && S.solved[id]).length, tot = CFG.practiceTaskIds.length;
  $('#pr-count').textContent = 'Решено: ' + n + ' из ' + tot;
  $('#pr-bar').style.width = (100 * n / tot) + '%';
  $('#nav-prog').textContent = 'Практикум: ' + n + ' из ' + tot;
}
