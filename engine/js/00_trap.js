window.addEventListener('error', function (e) {
  var m = document.getElementById('g-msg');
  if (!m) return;
  m.className = 'msg bad';
  m.textContent = 'Ошибка загрузки страницы: ' + (e.message || 'неизвестная ошибка') + ' (' + String(e.filename || '').split('/').pop().slice(0, 40) + ':' + (e.lineno || '?') + ')';
});
