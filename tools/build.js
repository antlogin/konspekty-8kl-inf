#!/usr/bin/env node
/* Сборка конспекта: node tools/build.js K1 [K2 …]   или   node tools/build.js --all
   Склеивает engine/ (оформление, движок) + lessons/<id>/ (содержание) + Skulpt из vendor/ в один автономный HTML:
   <outDir>/<outName>.html и <outDir>/LOCAL_metodichka_<outName>.md (без outDir — по-старому: <id>/…, LOCAL_metodichka_<id>.md). Зависимостей нет (Node ≥ 18). */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const rd = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const course = JSON.parse(rd('course.json'));

function vendor(f) {
  const t = rd('vendor', 'skulpt-1.2.0', f);
  if (/<\/script/i.test(t)) throw new Error('В ' + f + ' встретилось </script: встраивание невозможно');
  return t;
}

function build(id) {
  const dir = path.join('lessons', id);
  const L = JSON.parse(rd(dir, 'lesson.json'));
  const cfg = {
    schemaVersion: 1, eventVersion: 1,
    trainerId: L.trainerId, trainerVersion: L.trainerVersion || '1.0.0',
    subjectId: course.subjectId, courseId: course.courseId, schoolId: null,
    endpoints: [
      { name: 'google', url: course.scriptUrl, enabled: true },
      { name: 'yandex', url: course.yandexUrl, enabled: !!course.yandexEnabled }
    ],
    flushIntervalMs: 30000,
    courseTitle: course.courseTitle, courseUrl: course.courseUrl,
    lessonId: L.id, lessonTitle: L.lessonTitle, practiceTaskIds: L.practiceTaskIds
  };
  const cfgText = '/* ===== НАСТРОЙКИ (создаются сборкой из course.json и lessons/' + id + '/lesson.json) =========\n' +
    '   Адрес веб-приложения Apps Script и адрес сайта курса задаются в course.json. */\n' +
    'const TELEMETRY_CONFIG = ' + JSON.stringify(cfg, null, 2) + ';\n';

  const menu = L.parts.map(p => '  <button type="button" data-part="' + p.id + '">' + esc(p.title) + '</button>').join('\n');
  const badges = (L.badges || []).map(b => '<span class="badge">' + b + '</span>').join('') + '\n    <span class="chip" id="chip-student" hidden></span>\n    <span class="chip" id="chip-sync" hidden></span>';
  const shell = rd('engine', 'shell.html')
    .replace(/{{TITLE}}/g, L.title).replace('{{EYEBROW}}', L.eyebrow).replace('{{LEAD}}', L.lead)
    .replace('{{BADGES}}', badges).replace('{{MENU}}', menu).replace('{{PAGES}}', rd(dir, 'pages.html'));

  const head = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + esc(L.title) + '</title>\n' +
    '<meta name="material:specification" content="HTML Material Specification Learn-it 4.3">\n' +
    '<meta name="material:version" content="' + course.materialVersion + '">\n' +
    '<meta name="catalog:title" content="' + esc(L.title) + '">\n<meta name="catalog:type" content="lesson">\n' +
    '<meta name="catalog:topic" content="' + esc(L.catalog.topic) + '">\n<meta name="catalog:description" content="' + esc(L.catalog.description) + '">\n' +
    '<meta name="catalog:tags" content="' + esc(L.catalog.tags) + '">\n' +
    (L.catalog.number != null ? '<meta name="catalog:number" content="' + esc(String(L.catalog.number)) + '">\n' : '') + '<style>\n' + rd('engine', 'css', 'style.css') + '</style>\n</head>\n<body class="locked">\n';

  const jsFiles = fs.readdirSync(path.join(root, 'engine', 'js')).filter(f => /^\d\d_.*\.js$/.test(f) && f !== '00_trap.js').sort();
  const app = jsFiles.map(f => rd('engine', 'js', f)).join('\n');
  const html = head + shell +
    '\n<script id="error-trap">\n' + rd('engine', 'js', '00_trap.js') + '</script>\n' +
    '<script id="skulpt-core">\n' + vendor('skulpt.min.js') + '\n</script>\n' +
    '<script id="skulpt-stdlib">\n' + vendor('skulpt-stdlib.js') + '\n</script>\n' +
    '<script id="turtle-trace">\nconst TURTLE_TRACE_PY = ' + JSON.stringify(rd('engine', 'turtle_trace.py')) + ';\n</script>\n' +
    '<script id="telemetry-config">\n' + cfgText + '</script>\n' +
    '<script id="lesson-data">\n' + rd(dir, 'data.js') + '\n</script>\n' +
    '<script id="lesson-app">\n' + app + '\n</script>\n</body>\n</html>\n';

  const outDir = path.join(root, L.outDir || L.id);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, L.outName + '.html');
  fs.writeFileSync(out, html);
  if (fs.existsSync(path.join(root, dir, 'methodichka.md')))
    fs.copyFileSync(path.join(root, dir, 'methodichka.md'), path.join(outDir, 'LOCAL_metodichka_' + (L.outDir ? L.outName : L.id) + '.md'));
  console.log(path.relative(root, out) + '  ' + (Buffer.byteLength(html) / 1048576).toFixed(2) + ' МБ');
}

const args = process.argv.slice(2);
const ids = args[0] === '--all' || !args.length
  ? fs.readdirSync(path.join(root, 'lessons')).filter(d => fs.existsSync(path.join(root, 'lessons', d, 'lesson.json')))
  : args;
ids.forEach(build);
