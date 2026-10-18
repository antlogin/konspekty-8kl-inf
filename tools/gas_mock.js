// Мок сервисов Google Apps Script для проверки Code.gs в Node
const vm = require('vm'), fs = require('fs');
function createServer(props, codePath) {
  let idc = 0;
  const files = {};                       // id → file
  class Sheet {
    constructor(name, ss) { this.name = name; this.ss = ss; this.data = []; this.maxRows = 1000; this.frozen = 0; }
    setName(n) { this.name = n; return this; }
    setFrozenRows(n) { this.frozen = n; return this; }
    getMaxRows() { return this.maxRows; }
    getLastRow() { let l = 0; this.data.forEach((r, i) => { if (r && r.some(v => v !== '' && v != null)) l = i + 1; }); return l; }
    getLastColumn() { let c = 0; this.data.forEach(r => { if (r) r.forEach((v, j) => { if (v !== '' && v != null) c = Math.max(c, j + 1); }); }); return c; }
    insertRowsAfter(after, n) { this.maxRows += n; }
    getRange(r, c, nr, nc) {
      const sh = this; nr = nr || 1; nc = nc || 1;
      if (r < 1 || c < 1 || r + nr - 1 > sh.maxRows) throw new Error('Range out of bounds: ' + r + ',' + nr + ' max ' + sh.maxRows);
      const rng = {
        getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; },
        getValue() { return rng.getValues()[0][0]; },
        setValues(v) {
          if (v.length !== nr || v.some(x => x.length !== nc)) throw new Error('setValues size mismatch ' + v.length + 'x' + (v[0] || []).length + ' vs ' + nr + 'x' + nc);
          v.forEach((row, i) => row.forEach((val, j) => {
            if (typeof val === 'string') { if (val.length > 50000) throw new Error('cell too long'); if (val[0] === "'") val = val.slice(1); else if (/^=/.test(val)) throw new Error('FORMULA INJECTION ' + val); }
            const R = r - 1 + i; sh.data[R] = sh.data[R] || []; sh.data[R][c - 1 + j] = val;
          })); return rng;
        },
        setValue(val) { return rng.setValues([[val]]); },
        setFontWeight() { return rng; }
      };
      return rng;
    }
  }
  class Spreadsheet {
    constructor(title) { this.id = 'ss' + (++idc); this.sheets = [new Sheet('Лист1', this)]; files[this.id] = new File(this.id, title, 'sheet', this); }
    getId() { return this.id; }
    getSheets() { return this.sheets; }
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
    insertSheet(n) { const s = new Sheet(n, this); this.sheets.push(s); return s; }
  }
  class File {
    constructor(id, name, kind, payload) { this.id = id; this.name = name; this.kind = kind; this.payload = payload; this.trashed = false; this.parent = null; }
    getId() { return this.id; } getUrl() { return 'https://drive.example/' + this.id; } isTrashed() { return this.trashed; }
    getMimeType() { return this.kind === 'sheet' ? 'application/vnd.google-apps.spreadsheet' : 'text/plain'; }
    moveTo(folder) { if (this.parent) this.parent.files = this.parent.files.filter(f => f !== this); this.parent = folder; folder.files.push(this); return this; }
    getName() { return this.name; }
  }
  class Folder {
    constructor(name) { this.id = 'f' + (++idc); this.name = name; this.folders = []; this.files = []; }
    getFoldersByName(n) { const a = this.folders.filter(f => f.name === n); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; }
    createFolder(n) { const f = new Folder(n); this.folders.push(f); return f; }
    getFilesByName(n) { const a = this.files.filter(f => f.name === n); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; }
    createFile(n, content) { const f = new File('fl' + (++idc), n, 'text', content); f.parent = this; this.files.push(f); files[f.id] = f; return f; }
    getUrl() { return 'https://drive.example/' + this.id; }
  }
  const root = new Folder('root');
  const P = Object.assign({}, props);
  let locked = false;
  const ctx = {
    console, JSON, Date, Object, Array, String, Number, Math, isNaN, parseInt, Error, RegExp,
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ content: s, setMimeType() { return this; }, getContent() { return s; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (locked) return false; locked = true; return true; }, releaseLock: () => { locked = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in P ? P[k] : null), setProperty: (k, v) => { P[k] = v; } }) },
    Session: { getScriptTimeZone: () => 'Europe/Podgorica' },
    Utilities: { formatDate: (d, tz, f) => d.toISOString().replace('T', ' ').slice(0, 19) },
    MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet', PLAIN_TEXT: 'text/plain' },
    DriveApp: { getRootFolder: () => root, getFolderById: () => root, getFileById: id => { if (!files[id]) throw new Error('no file'); return files[id]; } },
    SpreadsheetApp: { create: t => new Spreadsheet(t), openById: id => { if (!files[id]) throw new Error('no ss'); return files[id].payload; } },
    Logger: { log: console.log }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx);
  return {
    post(body) { return JSON.parse(vm.runInContext('doPost', ctx)({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent()); },
    get() { return JSON.parse(vm.runInContext('doGet', ctx)().getContent()); },
    root, files, props: P, ctx
  };
}
module.exports = { createServer };
