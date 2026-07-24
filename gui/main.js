'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const net = require('net');

// Archivio dati dedicato per la versione pubblica (non condivide i template
// eventualmente salvati da altre build sullo stesso PC).
app.setName('LabelForge');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const { buildLabel, extractPlaceholders } = require('../lib/render');
const { sendNetwork, sendWindowsPrinterByName, sendUSBWindows, sendUSBUnix } = require('../lib/print');

// --- Cartelle template ---
// I template "di fabbrica" sono in bundle (sola lettura in app impacchettate),
// i template creati/modificati dall'utente vanno in una cartella scrivibile (userData).
function resolveBundledTemplatesDir() {
  const res = process.resourcesPath || '';
  const candidates = [
    path.join(__dirname, '..', 'templates'),
    path.join(res, 'templates'),
    path.join(res, 'app', 'templates'),
    path.join(res, 'app.asar', 'templates'),
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) { /* asar */ }
  }
  return candidates[0];
}

const BUNDLED_TEMPLATES_DIR = resolveBundledTemplatesDir();
let USER_TEMPLATES_DIR = null; // impostata a app-ready
let SETTINGS_FILE = null;

function ensureUserDirs() {
  USER_TEMPLATES_DIR = path.join(app.getPath('userData'), 'templates');
  SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
  try { fs.mkdirSync(USER_TEMPLATES_DIR, { recursive: true }); } catch (_) {}
}

// --- Impostazioni ---
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}
function saveSettings(obj) {
  try {
    const current = loadSettings();
    const merged = Object.assign({}, current, obj);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (e) {
    return { error: e.message };
  }
}

// --- Template ---
function readTemplateFile(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
}

// Elenco unito: i file in USER_TEMPLATES_DIR hanno precedenza su quelli bundled con lo stesso nome.
function listTemplateFiles() {
  const map = new Map(); // file -> { dir, editable }
  try {
    for (const f of fs.readdirSync(BUNDLED_TEMPLATES_DIR)) {
      if (f.endsWith('.json')) map.set(f, { dir: BUNDLED_TEMPLATES_DIR, editable: false });
    }
  } catch (_) {}
  try {
    for (const f of fs.readdirSync(USER_TEMPLATES_DIR)) {
      if (f.endsWith('.json')) map.set(f, { dir: USER_TEMPLATES_DIR, editable: true });
    }
  } catch (_) {}
  return map;
}

function templateSummary(file, dir, editable) {
  const t = readTemplateFile(dir, file);
  const elements = (t.elements || []).map((el, i) => ({
    index: i,
    label: el.label || `${el.type}${el.text ? ' — ' + el.text : ''}`,
    type: el.type,
    enabledDefault: el.enabled !== false,
  }));
  const meta = t.field_meta || {};
  const fields = extractPlaceholders(t).map((name) => {
    const m = meta[name] || {};
    return { name, label: m.label || null, type: m.type || 'text', options: m.options || null };
  });
  return {
    file,
    editable,
    name: t.name || file.replace('.json', ''),
    description: t.description || '',
    dpi: t.dpi || 203,
    width_mm: t.width_mm,
    height_mm: t.height_mm,
    tear_off: t.tear_off,
    fields,
    elements,
  };
}

function listTemplates() {
  const out = [];
  for (const [file, info] of listTemplateFiles()) {
    try { out.push(templateSummary(file, info.dir, info.editable)); } catch (_) {}
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// Carica il JSON completo di un template (per l'editor).
function loadTemplateRaw(file) {
  const map = listTemplateFiles();
  const info = map.get(file);
  if (!info) throw new Error('Template non trovato: ' + file);
  return readTemplateFile(info.dir, file);
}

// Carica per la stampa (qualunque sia la cartella).
function loadTemplateForPrint(file) {
  return loadTemplateRaw(file);
}

// Salva/crea un template nella cartella utente (scrivibile).
function saveTemplate(file, json) {
  const safe = path.basename(file).replace(/[^\w.\-]/g, '_');
  const name = safe.endsWith('.json') ? safe : safe + '.json';
  const full = path.join(USER_TEMPLATES_DIR, name);
  fs.writeFileSync(full, JSON.stringify(json, null, 2), 'utf8');
  return { ok: true, file: name };
}

function deleteTemplate(file) {
  const full = path.join(USER_TEMPLATES_DIR, path.basename(file));
  if (fs.existsSync(full)) { fs.unlinkSync(full); return { ok: true }; }
  return { ok: false, error: 'Solo i template personalizzati possono essere eliminati.' };
}

function listWindowsPrinters() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
      (err, stdout) => {
        if (err) return resolve([]);
        resolve(stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
      }
    );
  });
}

async function doPrint({ file, data, copies, connection, enabledIndices, multiField, multiItems, rows }) {
  const template = loadTemplateForPrint(file);
  const mult = Number(copies) || 1;

  let dataList = [];
  if (Array.isArray(rows) && rows.length) {
    // Stampa in blocco da CSV: una etichetta per riga (× copie)
    for (const row of rows) {
      for (let i = 0; i < mult; i++) dataList.push({ ...data, ...row });
    }
  } else if (multiField && Array.isArray(multiItems) && multiItems.length) {
    for (const it of multiItems) {
      const q = (Number(it.qty) || 0) * mult;
      for (let i = 0; i < q; i++) dataList.push({ ...data, [multiField]: it.value });
    }
  } else {
    for (let i = 0; i < mult; i++) dataList.push({ ...data });
  }
  if (dataList.length === 0) {
    throw new Error('Nessuna etichetta da stampare: imposta almeno una quantità maggiore di 0.');
  }

  const opts = {};
  if (Array.isArray(enabledIndices)) opts.enabledIndices = enabledIndices;
  const zpl = buildLabel(template, dataList, opts);

  if (connection.type === 'printer') {
    if (!connection.printer) throw new Error('Seleziona una stampante.');
    await sendWindowsPrinterByName(connection.printer, zpl);
  } else if (connection.type === 'ip') {
    if (!connection.ip) throw new Error("Inserisci l'indirizzo IP della stampante.");
    await sendNetwork(connection.ip, Number(connection.port) || 9100, zpl);
  } else if (connection.type === 'usb') {
    if (!connection.usb) throw new Error('Inserisci la porta USB (es. USB001).');
    if (process.platform === 'win32') await sendUSBWindows(connection.usb, zpl);
    else await sendUSBUnix(connection.usb, zpl);
  } else {
    throw new Error('Metodo di connessione non valido.');
  }
  return { ok: true, count: dataList.length };
}

// --- Finestra ---
function createWindow() {
  const s = loadSettings();
  const b = s.windowBounds || {};
  const win = new BrowserWindow({
    width: b.width || 1200,
    height: b.height || 820,
    x: b.x,
    y: b.y,
    minWidth: 900,
    minHeight: 600,
    title: 'LabelForge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  if (s.windowMaximized) win.maximize();
  win.loadFile(path.join(__dirname, 'index.html'));

  const persistBounds = () => {
    if (!win.isMaximized()) saveSettings({ windowBounds: win.getBounds() });
    saveSettings({ windowMaximized: win.isMaximized() });
  };
  win.on('resize', persistBounds);
  win.on('move', persistBounds);
}

// --- IPC ---
ipcMain.handle('list-templates', () => listTemplates());
ipcMain.handle('load-template-raw', (_e, file) => loadTemplateRaw(file));
ipcMain.handle('save-template', (_e, { file, json }) => {
  try { return saveTemplate(file, json); }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('delete-template', (_e, file) => {
  try { return deleteTemplate(file); }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('list-printers', () => listWindowsPrinters());

// Apri un file (CSV o JSON) e restituisci nome + contenuto testuale.
ipcMain.handle('pick-file', async (_e, kind) => {
  const filters = kind === 'csv'
    ? [{ name: 'CSV', extensions: ['csv', 'txt'] }]
    : [{ name: 'Template JSON', extensions: ['json'] }];
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  try {
    const content = fs.readFileSync(r.filePaths[0], 'utf8');
    return { canceled: false, name: path.basename(r.filePaths[0]), content };
  } catch (e) { return { canceled: true, error: e.message }; }
});

// Salva contenuto testuale scegliendo dove (Salva con nome).
ipcMain.handle('save-file', async (_e, { defaultName, content }) => {
  const r = await dialog.showSaveDialog({ defaultPath: defaultName || 'export.json' });
  if (r.canceled || !r.filePath) return { canceled: true };
  try { fs.writeFileSync(r.filePath, content, 'utf8'); return { canceled: false, path: r.filePath }; }
  catch (e) { return { canceled: true, error: e.message }; }
});

// Test rapido di raggiungibilità della stampante.
ipcMain.handle('test-connection', async (_e, connection) => {
  try {
    if (connection.type === 'ip') {
      await new Promise((resolve, reject) => {
        const sock = new net.Socket();
        sock.setTimeout(4000);
        sock.once('connect', () => { sock.destroy(); resolve(); });
        sock.once('timeout', () => { sock.destroy(); reject(new Error('timeout')); });
        sock.once('error', (err) => reject(err));
        sock.connect(Number(connection.port) || 9100, connection.ip);
      });
      return { ok: true, message: `Stampante raggiungibile su ${connection.ip}:${connection.port || 9100}.` };
    }
    if (connection.type === 'printer') {
      const printers = await listWindowsPrinters();
      const found = printers.includes(connection.printer);
      return found
        ? { ok: true, message: `Stampante "${connection.printer}" trovata in Windows.` }
        : { ok: false, error: `Stampante "${connection.printer}" non trovata tra quelle installate.` };
    }
    return { ok: true, message: 'Verifica manuale per la porta USB.' };
  } catch (e) {
    return { ok: false, error: 'Non raggiungibile: ' + e.message };
  }
});

// Matrice QR reale per l'anteprima (0/1 per modulo).
ipcMain.handle('qr-matrix', (_e, text) => {
  try {
    const qr = QRCode.create(String(text || ' '), { errorCorrectionLevel: 'M' });
    return { size: qr.modules.size, data: Array.from(qr.modules.data) };
  } catch (e) {
    return { size: 0, data: [] };
  }
});

// Immagine DataMatrix (PNG dataURL) per l'anteprima.
ipcMain.handle('dm-image', async (_e, text) => {
  try {
    const png = await bwipjs.toBuffer({ bcid: 'datamatrix', text: String(text || ' '), scale: 4, includetext: false });
    return 'data:image/png;base64,' + png.toString('base64');
  } catch (e) { return ''; }
});

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_e, obj) => saveSettings(obj));
ipcMain.handle('print', async (_e, payload) => {
  try { return await doPrint(payload); }
  catch (err) { return { ok: false, error: err.message }; }
});

// Crea automaticamente il collegamento sul Desktop al primo avvio dell'app impacchettata.
function ensureDesktopShortcut() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const s = loadSettings();
  if (s.shortcutCreated) return;
  try {
    const lnk = path.join(app.getPath('desktop'), 'LabelForge.lnk');
    shell.writeShortcutLink(lnk, 'create', {
      target: process.execPath,
      description: 'Zebra ZD410 label printer',
      icon: process.execPath,
      iconIndex: 0,
    });
    saveSettings({ shortcutCreated: true });
  } catch (_) { /* ignora se non riesce */ }
}

ipcMain.handle('create-desktop-shortcut', () => {
  if (process.platform !== 'win32') return { ok: false, error: 'Solo su Windows.' };
  try {
    const target = app.isPackaged ? process.execPath : process.execPath; // in dev punta a electron.exe
    const lnk = path.join(app.getPath('desktop'), 'LabelForge.lnk');
    shell.writeShortcutLink(lnk, 'create', { target, description: 'Zebra ZD410 label printer', icon: target, iconIndex: 0 });
    saveSettings({ shortcutCreated: true });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

app.whenReady().then(() => {
  ensureUserDirs();
  createWindow();
  ensureDesktopShortcut();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
