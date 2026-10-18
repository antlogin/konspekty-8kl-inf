
/* ---------- блок-схемы (inline SVG, ГОСТ 19.701), строятся программно ---------- */
let flowSeq = 0;
function wrapText(text, max) {
  const words = text.split(/\s+/), lines = []; let cur = '';
  words.forEach(w => { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
  if (cur) lines.push(cur);
  return lines;
}
function buildFlow(el) {
  const nodes = el.dataset.flow.split('|').map(s => { const i = s.indexOf(':'); return { type: s.slice(0, i), text: s.slice(i + 1) }; });
  const mini = el.classList.contains('flow-mini');       // компактный блок для таблиц-обозначений
  const W = mini ? 170 : 340, cx = W / 2, gap = 24, id = 'fa' + (++flowSeq);
  let y = 6, parts = [], prevBottom = null;
  nodes.forEach(n => {
    const lines = wrapText(n.text, mini ? 14 : (n.type === 'io' ? 30 : 28));
    const h = Math.max(38, lines.length * 17 + 16);
    const w = mini ? ((n.type === 'start' || n.type === 'end') ? 100 : 150) : ((n.type === 'start' || n.type === 'end') ? 130 : 280);
    const x = cx - w / 2;
    if (prevBottom !== null) { parts.push('<line x1="' + cx + '" y1="' + prevBottom + '" x2="' + cx + '" y2="' + (y - 1) + '" stroke="#123d32" stroke-width="1.5" marker-end="url(#' + id + ')"/>'); }
    let shape;
    if (n.type === 'start' || n.type === 'end') shape = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="#e5f1ec" stroke="#123d32" stroke-width="1.5"/>';
    else if (n.type === 'io') { const s = 14; shape = '<polygon points="' + (x + s) + ',' + y + ' ' + (x + w) + ',' + y + ' ' + (x + w - s) + ',' + (y + h) + ' ' + x + ',' + (y + h) + '" fill="#fff6dc" stroke="#123d32" stroke-width="1.5"/>'; }
    else if (n.type === 'cond') shape = '<polygon points="' + cx + ',' + y + ' ' + (x + w) + ',' + (y + h / 2) + ' ' + cx + ',' + (y + h) + ' ' + x + ',' + (y + h / 2) + '" fill="#fff" stroke="#123d32" stroke-width="1.5"/>';
    else shape = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fff" stroke="#123d32" stroke-width="1.5"/>';
    const ty = y + h / 2 - (lines.length - 1) * 8.5 + 4.5;
    const txt = '<text x="' + cx + '" text-anchor="middle">' + lines.map((l, i) => '<tspan x="' + cx + '" y="' + (ty + i * 17) + '">' + esc(l) + '</tspan>').join('') + '</text>';
    parts.push(shape + txt);
    prevBottom = y + h; y += h + gap;
  });
  const H = y - gap + 8;
  el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs><marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#123d32"/></marker></defs>' + parts.join('') + '</svg>';
}

/* ---------- вопросы с выбором ---------- */
function seeded(id) {                    // детерминированное перемешивание: зерно — id вопроса
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
function shuffled(id, opts) {
  const r = seeded(id), a = opts.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  if (a[0].ok) a.push(a.shift());          // верный вариант не стоит первым
  return a;
}
function optHtml(o) {
  if (o.pre != null) return '<pre>' + o.pre.split('\n').map(l => l === '' ? '<span class="muted">(пустая строка)</span>' : esc(l)).join('\n') + '</pre>';
  return '<span>' + esc(o.text) + '</span>';
}
function buildQuestion(id) {
  const Q = QUESTIONS[id];
  const el = document.createElement('div');
  el.className = 'q'; el.dataset.q = id;
  const opts = shuffled(id, Q.options);
  el.innerHTML =
    (Q.num ? '<div class="qnum">' + esc(Q.num) + '</div>' : '') +
    '<div class="qtext">' + esc(Q.text) + '</div>' +
    (Q.code ? '<pre class="code py qcode">' + esc(Q.code) + '</pre>' : '') +
    '<fieldset class="choice-list"><legend>Выберите один вариант</legend><div class="q-opts">' +
    opts.map((o, i) => '<div class="choice-option" data-o="' + o.id + '"><input type="radio" name="' + id + '" id="' + id + '-' + o.id + '" value="' + o.id + '"><label class="choice" for="' + id + '-' + o.id + '">' + optHtml(o) + '</label></div>').join('') +
    '</div></fieldset>' +
    (Q.mode === 'check' ? '<div class="actions" style="margin-top:10px"><button class="btn accent b-qcheck" type="button">Проверить</button></div>' : '') +
    '<div class="verdict" role="status" aria-live="polite"></div>' +
    (Q.mode === 'reveal' ? '<details class="selfcheck"><summary>Проверить себя</summary><div class="ans"></div></details>' : '');
  const code = $('.qcode', el); if (code) decorateStaticCode(code);
  $$('input', el).forEach(inp => inp.addEventListener('change', () => onAnswer(id, inp.value, inp.id)));
  const qb = $('.b-qcheck', el);
  if (qb) qb.addEventListener('click', () => checkQuestion(id));
  const det = $('details', el);
  if (det) det.addEventListener('toggle', () => { if (det.open && !S.revealed[id]) { S.revealed[id] = true; touch(); } if (det.open) revealQuestion(id); });
  return el;
}
function onAnswer(id, val, controlId) {
  const prev = S.answers[id] ? [S.answers[id]] : [];
  S.answers[id] = val;
  if (QUESTIONS[id].mode === 'check') { const c = S.qcheck[id] || { n: 0 }; S.qcheck[id] = { n: c.n, shown: false }; }
  rec('answer_changed', 'user', { questionId: id, controlId: controlId }, { previousAnswer: prev, answer: [val] });
  paintQuestion(id);
}
function paintQuestion(id) {
  const Q = QUESTIONS[id], el = $('.q[data-q="' + id + '"]'); if (!el) return;
  const val = S.answers[id], verdict = $('.verdict', el);
  $$('.choice-option', el).forEach(o => { o.classList.remove('correct', 'wrong'); const inp = $('input', o); inp.checked = (inp.value === val); });
  if (Q.mode === 'instant' && val) {
    const opt = Q.options.find(o => o.id === val), ok = !!opt.ok;
    $('.choice-option[data-o="' + val + '"]', el).classList.add(ok ? 'correct' : 'wrong');
    verdict.className = 'verdict ' + (ok ? 'ok' : 'bad');
    verdict.innerHTML = ok ? '✓ Верно. ' + esc(Q.explain) : '✗ Неверно. Ответ можно изменить.';
  } else if (Q.mode === 'check') {
    const c = S.qcheck[id];
    if (val && c && c.shown) {
      const ok = !!Q.options.find(o => o.id === val).ok;
      $('.choice-option[data-o="' + val + '"]', el).classList.add(ok ? 'correct' : 'wrong');
      verdict.className = 'verdict ' + (ok ? 'ok' : 'bad');
      verdict.innerHTML = ok ? '✓ Верно. ' + esc(Q.explain) : '✗ Неверно. Ответ можно изменить и проверить повторно.';
    } else { verdict.className = 'verdict'; verdict.textContent = ''; }
  } else if (Q.mode === 'reveal') {
    if (S.revealed[id]) revealQuestion(id);
  }
}
function checkQuestion(id) {
  const Q = QUESTIONS[id], val = S.answers[id], verdict = $('.q[data-q="' + id + '"] .verdict');
  if (!val) { verdict.className = 'verdict'; verdict.textContent = 'Требуется выбрать вариант ответа.'; return; }
  const c = S.qcheck[id] || { n: 0 };
  S.qcheck[id] = { n: c.n + 1, shown: true };
  const ok = !!Q.options.find(o => o.id === val).ok;
  rec('answers_checked', 'user', { questionId: id }, { checkNo: c.n + 1, units: [{ unitId: id, questionId: id, correct: ok, checks: c.n + 1 }] });
  paintQuestion(id);
  touch();
}
function revealQuestion(id) {
  const Q = QUESTIONS[id], el = $('.q[data-q="' + id + '"]'), val = S.answers[id];
  const right = Q.options.find(o => o.ok);
  $$('.choice-option', el).forEach(o => o.classList.remove('correct', 'wrong'));
  $('.choice-option[data-o="' + right.id + '"]', el).classList.add('correct');
  if (val && val !== right.id) $('.choice-option[data-o="' + val + '"]', el).classList.add('wrong');
  const lab = right.text || right.pre.replace(/\n/g, ' / ').replace(/ \/ \/ /g, ' / (пустая строка) / ');
  $('.ans', el).innerHTML = '<p><b>Ответ:</b> ' + esc(lab) + '.</p><p>' + esc(Q.explain) + '</p>';
  const det = $('details', el); if (S.revealed[id]) det.open = true;
}
function buildQuestions() {
  $$('[data-qgroup]').forEach(box => {
    Object.keys(QUESTIONS).filter(id => QUESTIONS[id].group === box.dataset.qgroup).forEach(id => box.appendChild(buildQuestion(id)));
  });
  $$('.q-slot').forEach(slot => slot.appendChild(buildQuestion(slot.dataset.q)));
}
function paintAllQuestions() { Object.keys(QUESTIONS).forEach(paintQuestion); }

/* ---------- части конспекта ---------- */
function paintMenu() {
  $$('#menu button[data-part]').forEach(b => {
    const p = b.dataset.part;
    if (S && S.part === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    b.classList.toggle('done', !!(S && S.done[p]));
  });
  const i = partOrder.indexOf(S.part);
  $('#btn-prev').disabled = i <= 0;
  $('#btn-next').disabled = i >= partOrder.length - 1;
}
function openPart(p, how) {
  how = how || {};
  if (!S || partOrder.indexOf(p) < 0) return;
  const from = S.part;
  if (!how.initial && from !== p) {
    S.done[from] = true;
    rec('page_left', 'navigation', { pageId: from }, { toPage: p });
  }
  S.part = p;
  $$('.page').forEach(sec => sec.classList.toggle('active', sec.dataset.part === p));
  paintMenu();
  if (!how.silent) {
    if (!how.initial && from === p) { /* повторное открытие той же части */ }
    rec('page_opened', 'navigation', { pageId: p }, { fromPage: how.initial ? null : from });
    rec('section_opened', 'navigation', { pageId: p }, { part: p, title: partTitle[p] });
  }
  if (!how.restore) { window.scrollTo(0, 0); const h = $('#h-' + p); if (h) h.focus({ preventScroll: true }); }
  touch();
}
function bindNav() {
  $$('#menu button[data-part]').forEach(b => b.addEventListener('click', () => openPart(b.dataset.part)));
  $('#btn-prev').addEventListener('click', () => { const i = partOrder.indexOf(S.part); if (i > 0) openPart(partOrder[i - 1]); });
  $('#btn-next').addEventListener('click', () => { const i = partOrder.indexOf(S.part); if (i < partOrder.length - 1) openPart(partOrder[i + 1]); });
}
