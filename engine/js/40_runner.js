
/* ---------- пояснения к ошибкам (безличные) ---------- */
function editDistance(a, b) {
  const m = a.length, n = b.length, d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const KNOWN_NAMES = ['print', 'input', 'int', 'str', 'float', 'len', 'range', 'round'];
const TURTLE_NAMES = ['forward', 'backward', 'left', 'right', 'penup', 'pendown', 'pencolor', 'pensize', 'goto', 'setheading', 'home', 'speed', 'circle', 'dot'];
const nearName = (n, list) => list.filter(k => n !== k && editDistance(n.toLowerCase(), k) <= 2)[0];
/* Разбор скобок и кавычек с учётом строк; возвращает {unclosedQuote:line, unclosedParen:line, extraClose:line} */
function scanBrackets(lines, upto) {
  const stack = [];
  let unclosedQuote = 0, extraClose = 0;
  for (let li = 0; li < upto && li < lines.length; li++) {
    const s = lines[li]; let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '#') break;
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(' || c === '[' || c === '{') stack.push(li + 1);
      else if (c === ')' || c === ']' || c === '}') { if (stack.length) stack.pop(); else if (!extraClose) extraClose = li + 1; }
    }
    if (q && !unclosedQuote) unclosedQuote = li + 1;
  }
  return { unclosedQuote: unclosedQuote, unclosedParen: stack.length ? stack[stack.length - 1] : 0, extraClose: extraClose };
}
function explain(type, msg, line, code) {
  const lines = String(code || '').split('\n');
  const src = lines[line - 1] || '', t = src.trim();
  const pre = n => (n ? 'Строка ' + n + ': ' : '');
  let ruLine = line;
  const wrap = (n, text) => ({ html: pre(n) + text, line: n });
  if (type === 'SyntaxError' || type === 'IndentationError') {
    const sc = scanBrackets(lines, lines.length);
    if (/^print\s+[^(\s=]/.test(t)) return wrap(line, 'после <code>print</code> требуются круглые скобки: <code>print("текст")</code> (SyntaxError).');
    if (sc.unclosedQuote) return wrap(sc.unclosedQuote, 'не закрыта кавычка: текст должен начинаться и заканчиваться одинаковой кавычкой (SyntaxError).');
    if (sc.unclosedParen) return wrap(sc.unclosedParen, 'не закрыта скобка: каждой «(» соответствует «)» (SyntaxError).');
    if (sc.extraClose) return wrap(sc.extraClose, 'лишняя закрывающая скобка (SyntaxError).');
    let k = line - 2; while (k >= 0 && !lines[k].trim()) k--;
    const prev = k >= 0 ? lines[k].replace(/\s+$/, '') : '';
    const indented = /^\s+\S/.test(src);
    if (/^(if|elif|else|for|while|def)\b/.test(t) && !/:\s*(#.*)?$/.test(t)) return wrap(line, 'в конце строки с <code>' + esc(t.split(/\s|:/)[0]) + '</code> отсутствует двоеточие (SyntaxError).');
    if (indented && !/:\s*(#.*)?$/.test(prev)) return wrap(line, 'лишний отступ: команды одного уровня начинаются с первого символа строки (IndentationError).');
    if (/:\s*(#.*)?$/.test(prev) && !indented && t) return wrap(line, 'после строки с двоеточием требуется отступ из четырёх пробелов (IndentationError).');
    return wrap(line, 'Python не смог разобрать запись. Требуется проверить кавычки, скобки и отступы в этой и предыдущей строках (SyntaxError).');
  }
  if (type === 'AttributeError') {
    const n = (String(msg).match(/attribute '([^']+)'/) || [])[1] || '', near = nearName(n, TURTLE_NAMES);
    return wrap(line, 'у модуля нет команды «<code>' + esc(n) + '</code>» (AttributeError).' + (near ? ' Возможно, подразумевается <code>' + near + '</code>.' : ' Причина — опечатка в названии команды.'));
  }
  if (type === 'ImportError' || type === 'ModuleNotFoundError') {
    const n = (String(msg).match(/No module named (\S+)/) || [])[1] || '', near = nearName(n, ['turtle']);
    return wrap(line, 'модуль «<code>' + esc(n) + '</code>» не найден (ImportError).' + (near ? ' Возможно, подразумевается <code>' + near + '</code>.' : ''));
  }
  if (type === 'NameError') {
    const n = (String(msg).match(/name '([^']+)'/) || [])[1] || '';
    if (n === 'turtle') return wrap(line, 'модуль <code>turtle</code> не подключён: первой строкой программы записывается <code>import turtle</code> (NameError).');
    let tip = '';
    const near = KNOWN_NAMES.filter(k => editDistance(n.toLowerCase(), k) <= 2 && n !== k)[0];
    if (near) tip = ' Возможно, подразумевается <code>' + near + '</code>.';
    else tip = ' Причина — опечатка в имени или имя не задано выше по тексту.';
    return wrap(line, 'имя «<code>' + esc(n) + '</code>» не определено (NameError).' + tip);
  }
  if (type === 'TypeError' && /concatenate|unsupported operand/.test(msg)) return wrap(line, 'текст и число нельзя объединять знаком «+» (TypeError). Число преобразуется в текст функцией <code>str()</code>.');
  if (type === 'TypeError' && /missing \d+ required/.test(msg)) return wrap(line, 'в команде не указан обязательный параметр: в скобках записывается число, например <code>forward(100)</code> (TypeError).');
  if (type === 'TypeError') return wrap(line, 'действие нельзя выполнить с такими значениями (TypeError): ' + esc(msg) + '.');
  if (type === 'ValueError' && /int\(\)/.test(msg)) return wrap(line, 'функция <code>int()</code> не смогла преобразовать введённый текст в целое число (ValueError).');
  if (type === 'ZeroDivisionError') return wrap(line, 'деление на ноль (ZeroDivisionError).');
  if (type === 'IndexError') return wrap(line, 'обращение к элементу, которого нет в списке (IndexError).');
  if (type === 'TimeLimitError') return { html: 'Программа работает слишком долго: возможно, цикл не заканчивается (TimeLimitError).', line: null };
  if (type === 'Stopped') return { html: 'Программа остановлена.', line: null };
  if (type === 'NoMoreInput') return { html: 'Программа запрашивает ввод чаще, чем предусмотрено тестом.', line: null };
  return wrap(ruLine, esc(type) + ': ' + esc(msg));
}
function parseError(e, code) {
  if (e && e.__stopped) return { type: 'Stopped', line: null, message: 'остановлено', ru: explain('Stopped').html };
  if (e && e.__noinput) return { type: 'NoMoreInput', line: null, message: 'нет больше ввода', ru: explain('NoMoreInput').html };
  const type = (e && e.tp$name) || 'Error';
  let message = '';
  try { message = e.args && e.args.v && e.args.v[0] ? String(e.args.v[0].v) : String(e); } catch (_) { message = String(e); }
  const line = (e && e.traceback && e.traceback[0] && e.traceback[0].lineno) || null;
  const x = explain(type, message, line, code);
  return { type: type, line: x.line === null ? null : (x.line || line), message: message, ru: x.html };
}

/* ---------- запуск Python (Skulpt) ---------- */
const Runner = { busy: false, stopFlag: false, pendingInput: null, owner: null };
const hiddenTurtle = document.createElement('div');
hiddenTurtle.id = 'turtle-hidden'; hiddenTurtle.hidden = true; document.body.appendChild(hiddenTurtle);
function readFile(f) {
  if (Sk.builtinFiles && Sk.builtinFiles.files[f] !== undefined) return Sk.builtinFiles.files[f];
  throw new Sk.builtin.ImportError('модуль не найден: ' + f);
}
const listeners = {};
const on = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
const emit = (type, data) => (listeners[type] || []).forEach(fn => { try { fn(Object.assign({ type: type, time: new Date() }, data)); } catch (e) { console.error(e); } });

async function runPython(code, opts) {
  opts = opts || {};
  if (!window.Sk) throw new Error('Python не загрузился');
  const inputs = opts.inputs ? opts.inputs.slice() : null;
  const typed = [];
  let output = '';
  Runner.stopFlag = false;
  Sk.configure({
    __future__: Sk.python3, read: readFile, yieldLimit: 50, execLimit: opts.timeLimit || null, inputfunTakesPrompt: true,
    output: text => { output += text; if (opts.onOutput) opts.onOutput(text); emit('output', { text: text, silent: !!opts.silent }); },
    inputfun: prompt => {
      if (inputs) {
        if (!inputs.length) { const err = new Error('no input'); err.__noinput = true; throw err; }
        const v = String(inputs.shift()); typed.push(v); emit('input', { prompt: prompt, value: v, silent: !!opts.silent }); return v;
      }
      return opts.onInput(prompt).then(v => { typed.push(v); emit('input', { prompt: prompt, value: v }); return v; });
    }
  });
  Sk.execLimit = opts.timeLimit || Number.POSITIVE_INFINITY;
  Sk.TurtleGraphics = { target: opts.turtleTarget || 'turtle-hidden', width: 400, height: 300, animate: !opts.silent };
  const t0 = performance.now();
  const restore = opts.trace ? installTrace() : null;
  const split = text => {          // строки «@@SEG …» — отрезки рисунка для автопроверки; в вывод не попадают
    const segs = [], rest = [];
    text.split('\n').forEach(l => { if (l.indexOf('@@SEG ') === 0) segs.push(l.split(' ').slice(1)); else rest.push(l); });
    return { text: rest.join('\n'), segments: segs };
  };
  try {
    await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true),
      { '*': () => { if (Runner.stopFlag) { const err = new Error('stop'); err.__stopped = true; throw err; } } });
    const sp = opts.trace ? split(output) : { text: output, segments: [] };
    return { ok: true, output: sp.text, segments: sp.segments, inputs: typed, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    const error = parseError(e, code);
    if (!opts.silent) emit('error', error);
    const sp = opts.trace ? split(output) : { text: output, segments: [] };
    return { ok: false, output: sp.text, segments: sp.segments, inputs: typed, error: error, ms: Math.round(performance.now() - t0) };
  } finally { if (restore) restore(); }
}
/* На время проверки модуль turtle подменяется записывающей версией (engine/turtle_trace.py). */
function dropModule(name) { try { Sk.sysmodules.mp$del_subscript(new Sk.builtin.str(name)); } catch (e) { /* модуль не загружен */ } }
function installTrace() {
  const f = Sk.builtinFiles.files, js = f['src/lib/turtle.js'];
  delete f['src/lib/turtle.js'];
  f['src/lib/turtle.py'] = TURTLE_TRACE_PY;
  dropModule('turtle');
  return () => { f['src/lib/turtle.js'] = js; delete f['src/lib/turtle.py']; dropModule('turtle'); };
}
function stopRun() { Runner.stopFlag = true; if (Runner.pendingInput) Runner.pendingInput.reject(); }

/* ---------- окно рисунка turtle ---------- */
const twin = $('#turtle-win');
let twinPlaced = false;
function openTurtle(anchor) {
  twin.hidden = false;
  if (!twinPlaced || window.innerWidth <= 720) {
    const r = (anchor || document.body).getBoundingClientRect();
    twin.style.left = Math.max(8, Math.min(window.innerWidth - twin.offsetWidth - 8, r.right - twin.offsetWidth - 16)) + 'px';
    twin.style.top = Math.max(8, Math.min(window.innerHeight - twin.offsetHeight - 8, r.top + 56)) + 'px';
    twinPlaced = true;
  }
}
$('#btn-close-turtle').onclick = () => { twin.hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !twin.hidden) twin.hidden = true; });
(function () {
  const h = $('#turtle-drag'); let sx, sy, ox, oy, drag = false;
  h.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = true; h.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = twin.offsetLeft; oy = twin.offsetTop; });
  h.addEventListener('pointermove', e => { if (!drag) return; twin.style.left = Math.min(Math.max(0, ox + e.clientX - sx), innerWidth - 80) + 'px'; twin.style.top = Math.min(Math.max(0, oy + e.clientY - sy), innerHeight - 40) + 'px'; });
  h.addEventListener('pointerup', () => { drag = false; });
})();
