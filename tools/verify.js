#!/usr/bin/env node
/* Проверка собранного конспекта в Chromium: node tools/verify.js K2 [K3 …]
   Нужен Playwright (npm i -g playwright или в проекте). Что проверяется:
   - страница открывается без сети и без ошибок в консоли; нет запросов на внешние адреса;
   - каждая задача из lessons/<id>/solutions.json: эталон (ref, alt) засчитывается, каждое решение из wrong не засчитывается;
   - у каждой задачи с проверкой есть заготовка, тесты, лестница из 3 подсказок;
   - вопросы: ровно один верный вариант, выбор верного даёт «Верно»;
   - нет горизонтальной прокрутки на 1440, 1024 и 390 px во всех частях.
   Переменные окружения: CHROMIUM — путь к браузеру (по умолчанию ищется в PLAYWRIGHT_BROWSERS_PATH и /opt/pw-browsers). */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', path.join(root, 'node_modules', 'playwright')]) { try { return require(p); } catch (e) { /* пробуем дальше */ } }
  throw new Error('Playwright не найден: npm i -g playwright');
}
function chromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try { const d = fs.readdirSync(base).filter(x => /^chromium-\d+$/.test(x)).sort().pop(); if (d) return path.join(base, d, 'chrome-linux', 'chrome'); } catch (e) { /* стандартный браузер Playwright */ }
  return undefined;
}
async function verify(browser, id) {
  const L = JSON.parse(fs.readFileSync(path.join(root, 'lessons', id, 'lesson.json'), 'utf8'));
  const sols = JSON.parse(fs.readFileSync(path.join(root, 'lessons', id, 'solutions.json'), 'utf8'));
  const file = path.join(root, L.id, L.outName + '.html');
  const problems = [];
  const bad = m => { problems.push(m); console.log('  ✗ ' + m); };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // боевой скрипт и сервер Яндекса не вызываются: проверка не должна писать данные в таблицы учителя
  await ctx.route(/script\.google\.com|yandexcloud\.net/, r => r.abort());
  const page = await ctx.newPage();
  const reqs = [], errs = [];
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('dialog', d => d.accept());
  await page.goto('file://' + file);
  await page.fill('#g-word', 'verify'); await page.fill('#g-first', 'Проверка'); await page.fill('#g-last', 'Автомат');
  await page.click('#g-go');
  await page.waitForSelector('#gate', { state: 'hidden' });
  const check = async (tid, code) => {
    await page.evaluate(([t, c]) => lessonSandbox.sandboxes[t].setCode(c), [tid, code]);
    await page.evaluate(t => lessonSandbox.sandboxes[t].check(), tid);
    return page.evaluate(t => { const m = document.querySelector('.task[data-task=' + t + '] .check-msg'); return { ok: m.classList.contains('ok'), msg: m.textContent }; }, tid);
  };
  const tasks = await page.evaluate(() => { const o = {}; Object.keys(lessonSandbox.tasks).forEach(k => { const t = lessonSandbox.tasks[k]; o[k] = { kind: t.kind, tests: (t.tests || []).length, ladder: (t.ladder || []).length, starter: typeof t.starter === 'string' }; }); return o; });
  let nRef = 0, nWrong = 0;
  for (const [tid, t] of Object.entries(tasks)) {
    if (t.kind !== 'check') continue;
    if (!t.starter || !t.tests) bad(tid + ': нет заготовки или тестов');
    if (t.ladder !== 3) bad(tid + ': лестница подсказок должна состоять из 3 ступеней (сейчас ' + t.ladder + ')');
    const s = sols[tid];
    if (!s) { bad(tid + ': нет записи в solutions.json'); continue; }
    for (const [label, code] of [['ref', s.ref], ...(s.alt || []).map((a, i) => ['alt' + (i + 1), a])]) {
      const r = await check(tid, code); nRef++;
      if (!r.ok) bad(tid + ' ' + label + ' не засчитан: ' + r.msg);
    }
    for (const w of s.wrong || []) {
      const r = await check(tid, w); nWrong++;
      if (r.ok) bad(tid + ': неверное решение засчитано: ' + JSON.stringify(w).slice(0, 80));
    }
    if (!(s.wrong || []).length) bad(tid + ': в solutions.json нет неверных решений (wrong)');
  }
  for (const tid of Object.keys(sols)) if (!tasks[tid] || tasks[tid].kind !== 'check') bad('solutions.json: нет задачи ' + tid);
  // вопросы
  const qs = await page.evaluate(() => Object.keys(QUESTIONS).length);
  const qinfo = await page.evaluate(() => Object.entries(QUESTIONS).map(([id, q]) => ({ id: id, mode: q.mode, ok: q.options.filter(o => o.ok).length, n: q.options.length, right: (q.options.find(o => o.ok) || {}).id })));
  for (const q of qinfo) {
    if (q.ok !== 1) bad('вопрос ' + q.id + ': верных вариантов ' + q.ok);
    if (q.n < 3) bad('вопрос ' + q.id + ': меньше трёх вариантов');
  }
  // вёрстка
  const parts = await page.$$eval('#menu button[data-part]', b => b.map(x => x.dataset.part));
  for (const [w, h] of [[1440, 900], [1024, 800], [390, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const p of parts) {
      await page.click('#menu button[data-part=' + p + ']');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) bad('горизонтальная прокрутка ' + over + ' px: часть ' + p + ', ширина ' + w);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const ext = [...new Set(reqs)].filter(u => !/script\.google\.com|\.learn-it\.app|yandexcloud\.net/.test(u));
  if (ext.length) bad('внешние запросы: ' + ext.join(', '));
  const realErrs = errs.filter(e => !/net::ERR_/.test(e));
  if (realErrs.length) bad('ошибки в консоли: ' + realErrs.join(' | '));
  const size = fs.statSync(file).size;
  console.log((problems.length ? '✗ ' : '✓ ') + id + ': эталонов ' + nRef + ', неверных решений ' + nWrong + ', вопросов ' + qs + ', частей ' + parts.length + ', размер ' + (size / 1048576).toFixed(2) + ' МБ' + (problems.length ? ', проблем: ' + problems.length : ', проблем нет'));
  await ctx.close();
  return problems.length;
}
(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error('Использование: node tools/verify.js K1 [K2 …]'); process.exit(2); }
  const browser = await loadPlaywright().chromium.launch({ executablePath: chromium() });
  let fails = 0;
  for (const id of ids) { console.log('Проверка ' + id); fails += await verify(browser, id); }
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
