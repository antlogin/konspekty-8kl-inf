
/* ---------- события браузера: видимость, фокус, сеть, буфер, простой, heartbeat ---------- */
let lastActivity = Date.now(), idle = false;
function bindBrowserEvents() {
  const ok = () => !!S;
  document.addEventListener('visibilitychange', () => {
    if (!ok()) return;
    if (document.hidden) { rec('visibility_hidden', 'browser', {}, {}); flushStorageSync(); flush('hidden', { keepalive: true }); sendSnapshot(); }
    else { rec('visibility_visible', 'browser', {}, {}); markActive(); }
  });
  window.addEventListener('blur', () => { if (ok()) rec('window_blur', 'browser', {}, {}); });
  window.addEventListener('focus', () => { if (ok()) { rec('window_focus', 'browser', {}, {}); markActive(); } });
  window.addEventListener('online', () => { if (ok()) { rec('online', 'browser', {}, {}); flush('online'); } });
  window.addEventListener('offline', () => { if (ok()) rec('offline', 'browser', {}, {}); });
  window.addEventListener('pagehide', () => { if (ok()) { flushStorageSync(); flush('pagehide', { keepalive: true }); sendSnapshot(); } });
  // буфер обмена: содержимое не сохраняется, у paste — только длина вставки (в редакторе события пишет сам редактор)
  document.addEventListener('copy', e => { if (ok() && !e.target.closest('.ed')) rec('copy', 'user', {}, {}); });
  document.addEventListener('cut', e => { if (ok() && !e.target.closest('.ed')) rec('cut', 'user', {}, {}); });
  document.addEventListener('paste', e => { if (ok() && !e.target.closest('.ed')) rec('paste', 'user', {}, { textLength: (e.clipboardData ? e.clipboardData.getData('text').length : 0) }); });
  // простой: движения мыши и нажатия клавиш не записываются, учитывается только время последнего действия
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'].forEach(t => document.addEventListener(t, () => { lastActivity = Date.now(); if (idle) markActive(); }, { passive: true, capture: true }));
  setInterval(() => {
    if (!ok() || document.hidden) return;
    if (!idle && Date.now() - lastActivity >= 60000) { idle = true; rec('idle_started', 'timer', {}, { thresholdMs: 60000 }); }
  }, 5000);
  setInterval(() => {
    if (!ok()) return;
    rec('heartbeat', 'timer', {}, { visible: !document.hidden, online: navigator.onLine, idle: idle });
  }, 60000);
  setInterval(() => { if (ok()) flush('timer'); checkSent(false); }, CFG.flushIntervalMs);
  setInterval(() => { if (ok() && (snapshotNow || snapshotDirty)) sendSnapshot(); }, 60000);
  setInterval(() => { if (ok() && snapshotNow) sendSnapshot(); }, 2000);
}
function markActive() {
  lastActivity = Date.now();
  if (idle) { idle = false; if (S) rec('idle_ended', 'timer', {}, {}); }
}

/* ---------- запуск ---------- */
// Каждый этап запускается отдельно: сбой в одном месте не отключает форму входа, а причина показывается в форме.
function reportBootError(where, e) {
  console.error(where, e);
  const m = $('#g-msg');
  if (m) { m.className = 'msg bad'; m.textContent = 'Ошибка загрузки страницы (' + where + '): ' + (e && e.message ? e.message : e); }
}
function step(where, fn) { try { fn(); } catch (e) { reportBootError(where, e); } }
function boot() {
  step('форма входа', () => {
    $('#gate-form').addEventListener('submit', e => { e.preventDefault(); submitGate(false); });
    $('#g-go').addEventListener('click', e => { e.preventDefault(); submitGate(false); });
    $('#g-anon').addEventListener('click', () => submitGate(true));
    $('#g-load').addEventListener('click', () => $('#g-file').click());
    $('#g-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadWorkFile(f); });
  });
  step('телеметрия', loadTele);
  step('блок-схемы', () => {
    $$('.flow-fig').forEach(buildFlow); $$('pre.code.py').forEach(decorateStaticCode);
    $$('.trace-fig[data-trace]').forEach(el => drawTrace(el, { segments: JSON.parse(el.dataset.trace) }));   // статичные образцы рисунков в теории
  });
  step('песочницы', () => { $$('.sbx').forEach(h => { const id = h.dataset.task; createSandbox(h, id, TASKS[id]); }); });
  step('вопросы', buildQuestions);
  step('меню', () => {
    partOrder = $$('#menu button[data-part]').map(b => b.dataset.part);
    partTitle = {}; $$('#menu button[data-part]').forEach(b => { partTitle[b.dataset.part] = b.textContent; });
    bindNav();
  });
  step('события браузера', bindBrowserEvents);
  step('кнопки итога', () => {
    $('#btn-finish').addEventListener('click', finishLesson);
    $('#btn-save').addEventListener('click', () => { saveWork(); });
  });
  step('начальное состояние', () => {
    const st = jget(K.state), ev = jget(K.events);
    if (st && st.attemptId && st.student && access && access.word) {
      showResume('Найдена работа от ' + hhmm(st.savedAt || st.startedAt) + ' (' + (st.student.anonymous ? st.student.anonCode : st.student.firstName + ' ' + st.student.lastName) + ').',
        () => resumeState(st, ev && ev.attemptId === st.attemptId ? ev.events : [], 'browser', st.savedAt),
        () => { store.del(K.state); store.del(K.events); skipServerRestore = true; prepareForm(); $('#g-first').focus(); });
    } else prepareForm();
  });
  step('Python', () => {
    if (!window.Sk) reportBootError('Python', new Error('интерпретатор Python не загрузился; следует обновить страницу'));
  });
  window.lessonSandbox = {
    on: on, run: (code, o) => runPython(code, Object.assign({ silent: true, timeLimit: 3000 }, o || {})),
    sandboxes: SB, tasks: TASKS, state: () => S, events: () => allEvents, queue: () => T.queues, flush: flush, openPart: openPart,
    finish: finishLesson, snapshot: sendSnapshot, config: CFG
  };
}
boot();
})();
