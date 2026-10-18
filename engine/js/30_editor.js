
/* ---------- подсветка синтаксиса Python ---------- */
const KW = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);
const BI = new Set(['print', 'input', 'int', 'str', 'float', 'len', 'range', 'round', 'abs', 'min', 'max', 'sum', 'list', 'sorted', 'type', 'bool']);
const isWordStart = c => /[A-Za-z_А-Яа-яЁё]/.test(c);
const isWordChar = c => /[A-Za-z0-9_А-Яа-яЁё]/.test(c);
function hlLine(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '#') { out += '<span class="t-cmt">' + esc(s.slice(i)) + '</span>'; break; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < s.length && s[j] !== c) { if (s[j] === '\\') j++; j++; }
      j = Math.min(j + 1, s.length);
      out += '<span class="t-str">' + esc(s.slice(i, j)) + '</span>'; i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i; while (j < s.length && /[0-9._]/.test(s[j])) j++;
      out += '<span class="t-num">' + esc(s.slice(i, j)) + '</span>'; i = j; continue;
    }
    if (isWordStart(c)) {
      let j = i; while (j < s.length && isWordChar(s[j])) j++;
      const w = s.slice(i, j);
      if (KW.has(w)) out += '<span class="t-kw">' + esc(w) + '</span>';
      else if (BI.has(w) && s[j] === '(') out += '<span class="t-bi">' + esc(w) + '</span>';
      else out += esc(w);
      i = j; continue;
    }
    out += esc(c); i++;
  }
  return out;
}
function decorateStaticCode(pre) {
  const lines = pre.textContent.replace(/\n+$/, '').split('\n');
  pre.innerHTML = lines.map((l, i) => '<span class="ln" data-n="' + (i + 1) + '">' + hlLine(l) + '</span>').join('');
}

/* ---------- лёгкий редактор: textarea с подсветкой поверх, номера строк ---------- */
function createEditor(host, opts) {
  host.innerHTML =
    '<div class="ed-gutter" aria-hidden="true"><div class="ed-gin"></div></div>' +
    '<div class="ed-main"><pre class="ed-hl" aria-hidden="true"><code></code></pre>' +
    '<textarea class="ed-ta" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea></div>';
  host.classList.add('ed');
  const ta = $('.ed-ta', host), code = $('.ed-hl code', host), gin = $('.ed-gin', host), hl = $('.ed-hl', host);
  ta.setAttribute('aria-label', opts.label || 'Код программы');
  let errLine = 0, escTab = false;

  function render() {
    const lines = ta.value.split('\n');
    code.innerHTML = lines.map((l, i) => '<span class="hl-line' + (i + 1 === errLine ? ' err' : '') + '">' + hlLine(l) + '</span>').join('');
    gin.innerHTML = lines.map((_, i) => '<div' + (i + 1 === errLine ? ' class="err"' : '') + '>' + (i + 1) + '</div>').join('');
    const rows = Math.max(opts.minRows || 6, Math.min(opts.maxRows || 16, lines.length + 1));
    host.style.setProperty('--rows', rows);
    sync();
  }
  function sync() {
    code.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
    gin.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
  }
  function insert(text) {
    ta.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function changeLines(dedent) {
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    const a = v.lastIndexOf('\n', s - 1) + 1;
    let b = v.indexOf('\n', e > s && v[e - 1] === '\n' ? e - 1 : e); if (b < 0) b = v.length;
    const lines = v.slice(a, b).split('\n');
    let firstDelta = 0, total = 0;
    const out = lines.map((l, i) => {
      let d;
      if (dedent) { const m = l.match(/^ {1,4}/); d = m ? -m[0].length : 0; l = l.replace(/^ {1,4}/, ''); }
      else { l = '    ' + l; d = 4; }
      if (i === 0) firstDelta = d; total += d; return l;
    });
    ta.setSelectionRange(a, b);
    insert(out.join('\n'));
    const ns = Math.max(a, s + firstDelta);
    ta.setSelectionRange(ns, s === e ? ns : Math.max(ns, e + total));
  }
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); opts.onRun && opts.onRun(); return; }
    if (ev.key === 'Escape') { escTab = true; return; }
    if (ev.key === 'Tab') {
      if (escTab) { escTab = false; return; }       // Esc, затем Tab — выход из редактора
      ev.preventDefault();
      if (ev.shiftKey) changeLines(true);
      else if (ta.selectionStart !== ta.selectionEnd && ta.value.slice(ta.selectionStart, ta.selectionEnd).indexOf('\n') >= 0) changeLines(false);
      else insert('    ');
      return;
    }
    escTab = false;
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.altKey) {
      const v = ta.value, s = ta.selectionStart;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const line = v.slice(ls, s);
      const indent = (line.match(/^ */) || [''])[0] + (/:\s*$/.test(line) ? '    ' : '');
      ev.preventDefault();
      insert('\n' + indent);
    }
  });
  ta.addEventListener('input', () => { errLine = 0; render(); opts.onChange && opts.onChange(ta.value); });
  ta.addEventListener('scroll', sync);
  ta.addEventListener('copy', () => opts.onClip && opts.onClip('copy'));
  ta.addEventListener('cut', () => opts.onClip && opts.onClip('cut'));
  ta.addEventListener('paste', ev => {
    const txt = ev.clipboardData ? ev.clipboardData.getData('text') : '';
    opts.onClip && opts.onClip('paste', txt.length);
  });
  return {
    el: ta,
    get: () => ta.value,
    set: v => { errLine = 0; ta.value = v; render(); },
    setErrLine: n => { errLine = n || 0; render(); if (n) scrollToLine(n); },
    focusLine: n => { const lines = ta.value.split('\n'); let pos = 0; for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1; ta.focus(); ta.setSelectionRange(pos, pos); scrollToLine(n); },
    focus: () => ta.focus(),
    refresh: render
  };
  function scrollToLine(n) {
    const lh = parseFloat(getComputedStyle(host).lineHeight) || 20;
    const top = (n - 1) * lh;
    if (top < ta.scrollTop || top > ta.scrollTop + ta.clientHeight - lh * 2) ta.scrollTop = Math.max(0, top - lh * 2);
    sync();
  }
}
