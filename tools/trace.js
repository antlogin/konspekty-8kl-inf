#!/usr/bin/env node
/* Печатает отрезки, которые рисует программа Python с модулем turtle (для записи образца в data.js):
   node tools/trace.js путь/к/решению.py */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..'), V = path.join(root, 'vendor', 'skulpt-1.2.0');
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(V, 'skulpt.min.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(V, 'skulpt-stdlib.js'), 'utf8'));
const files = Sk.builtinFiles.files;
delete files['src/lib/turtle.js'];
files['src/lib/turtle.py'] = fs.readFileSync(path.join(root, 'engine', 'turtle_trace.py'), 'utf8');
let out = '';
Sk.configure({ __future__: Sk.python3, read: f => { if (files[f] !== undefined) return files[f]; throw new Error('нет файла ' + f); }, output: t => { out += t; }, execLimit: 5000 });
Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, fs.readFileSync(process.argv[2], 'utf8'), true)).then(() => {
  const segs = out.split('\n').filter(l => l.startsWith('@@SEG ')).map(l => l.split(' ').slice(1));
  console.log(JSON.stringify(segs.map(s => s.slice(0, 4).map(Number))));
  console.log('цвета:', [...new Set(segs.map(s => s[4]))].join(', '), '| толщины:', [...new Set(segs.map(s => s[5]))].join(', '));
  console.log('остальной вывод:', JSON.stringify(out.split('\n').filter(l => !l.startsWith('@@SEG ')).join('\n')));
}, e => { console.error(String(e), e.traceback && e.traceback[0] && e.traceback[0].lineno); process.exit(1); });
