const path = require('path');
const fs = require('fs');
const http = require('http');
const { app, BrowserWindow, ipcMain } = require('electron');
const keytar = require('keytar');

let staticServer = null;
let staticPort = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

// Import Mongo helpers from the project lib. These are TypeScript files but at runtime
// Node can require the compiled JS when using a production build. During dev we can
// require the TS transpiled output if available. We'll require via runtime path so
// consumers must run with `ts-node` or prebuild. As a simple approach, attempt to
// require the JS in lib, falling back to the TS file which should be transpiled by Next's build.
let mongo = null;
try {
  // prefer compiled .js if present
  mongo = require(path.join(__dirname, '..', 'lib', 'mongo.js'));
} catch (e) {
  try {
    mongo = require(path.join(__dirname, '..', 'lib', 'mongo.ts'));
  } catch (err) {
    console.warn('Could not require compiled lib/mongo.js; IPC sync handlers will throw until lib is available.');
  }
}

async function handleSyncPush(event, payload) {
  if (!mongo) throw new Error('Mongo helpers not available in main process');
  // Ensure we have a MONGODB_URI available: prefer stored credential in keytar
  try {
    const stored = await keytar.getPassword('studydash', 'mongodb');
    if (stored) process.env.MONGODB_URI = stored;
  } catch (err) {
    console.warn('keytar getPassword error', err);
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not configured. Set it in app settings.');
  const { upsertCourse, upsertTask, connectToMongo, closeMongo } = mongo;
  const db = await connectToMongo();
  let courses = payload.courses || [];
  let tasks = payload.tasks || [];
  for (const c of courses) {
    try {
      await upsertCourse(c);
    } catch (e) {
      console.error('Failed upsertCourse', e);
    }
  }
  for (const t of tasks) {
    try {
      await upsertTask(t);
    } catch (e) {
      console.error('Failed upsertTask', e);
    }
  }
  // keep connection open for reuse; return counts
  return { courses: courses.length, tasks: tasks.length };
}

function getOutDir() {
  const override = process.env.ELECTRON_OUT_DIR;
  if (override) return path.resolve(override);
  const base = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
  return path.join(base, 'out');
}

function resolveStaticFile(outDir, urlPath) {
  let pathname = (urlPath || '/').split('?')[0].split('#')[0];
  try { pathname = decodeURIComponent(pathname); } catch (err) {}
  pathname = pathname.replace(/\\/g, '/');
  if (pathname === '/') pathname = '/index.html';

  const hasExt = path.extname(pathname) !== '';
  let relPath = pathname;
  if (!hasExt) {
    const asHtml = `${pathname}.html`;
    const asIndex = path.join(pathname, 'index.html');
    const htmlPath = path.join(outDir, asHtml.replace(/^\/+/, ''));
    const indexPath = path.join(outDir, asIndex.replace(/^\/+/, ''));
    if (fs.existsSync(htmlPath)) relPath = asHtml;
    else if (fs.existsSync(indexPath)) relPath = asIndex;
  }

  relPath = relPath.replace(/^\/+/, '');
  const normalized = path.normalize(relPath);
  const filePath = path.join(outDir, normalized);
  if (!filePath.startsWith(outDir)) {
    return { filePath: '', exists: false, forbidden: true };
  }
  return { filePath, exists: fs.existsSync(filePath), forbidden: false };
}

function startStaticServer() {
  if (staticServer && staticPort) return Promise.resolve(staticPort);
  return new Promise((resolve, reject) => {
    const outDir = getOutDir();
    if (!fs.existsSync(outDir)) {
      reject(new Error(`Static export folder not found: ${outDir}`));
      return;
    }

    staticServer = http.createServer((req, res) => {
      const { filePath, exists, forbidden } = resolveStaticFile(outDir, req.url || '/');
      if (forbidden) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      if (!exists) {
        const notFoundPath = path.join(outDir, '404.html');
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (fs.existsSync(notFoundPath)) {
          fs.createReadStream(notFoundPath).pipe(res);
        } else {
          res.end('Not Found');
        }
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      fs.createReadStream(filePath).on('error', (err) => {
        res.statusCode = 500;
        res.end('Failed to read file');
      }).pipe(res);
    });

    staticServer.on('error', (err) => reject(err));
    staticServer.listen(0, '127.0.0.1', () => {
      const addr = staticServer.address();
      staticPort = typeof addr === 'object' && addr ? addr.port : null;
      if (!staticPort) {
        reject(new Error('Failed to start static server'));
        return;
      }
      resolve(staticPort);
    });
  });
}

function getLocalBackupPath() {
  return path.join(app.getPath('userData'), 'studydash-local-backup.json');
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devMode = (!app.isPackaged && process.env.NODE_ENV !== 'production');
  if (devMode) {
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    let triedStatic = false;
    win.webContents.on('did-fail-load', async () => {
      if (triedStatic) return;
      triedStatic = true;
      try {
        const port = await startStaticServer();
        await win.loadURL(`http://127.0.0.1:${port}/`);
      } catch (err) {
        console.error('Failed to load dev URL and static export:', err);
      }
    });
    await win.loadURL(devUrl);
    win.webContents.openDevTools();
    return;
  }

  try {
    const port = await startStaticServer();
    await win.loadURL(`http://127.0.0.1:${port}/`);
  } catch (err) {
    console.error('Failed to start static server for packaged app:', err);
    // As a last resort, try localhost in case an external server is running.
    await win.loadURL('http://localhost:3000');
  }
}

app.on('ready', () => {
  ipcMain.handle('sync:push', handleSyncPush);
  // credential handlers
  ipcMain.handle('credentials:set', async (ev, { service, account, value }) => {
    await keytar.setPassword(service || 'studydash', account || 'mongodb', value || '');
    return true;
  });
  ipcMain.handle('credentials:get', async (ev, { service, account }) => {
    const v = await keytar.getPassword(service || 'studydash', account || 'mongodb');
    return v || null;
  });
  ipcMain.handle('credentials:delete', async (ev, { service, account }) => {
    const ok = await keytar.deletePassword(service || 'studydash', account || 'mongodb');
    return ok;
  });
  ipcMain.handle('credentials:has', async (ev, { service, account }) => {
    const v = await keytar.getPassword(service || 'studydash', account || 'mongodb');
    return !!v;
  });
  // local backup file handlers (stored in userData on disk)
  ipcMain.handle('storage:path', async () => getLocalBackupPath());
  ipcMain.handle('storage:read', async () => {
    const p = getLocalBackupPath();
    try {
      const raw = await fs.promises.readFile(p, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
  });
  ipcMain.handle('storage:write', async (ev, payload) => {
    const p = getLocalBackupPath();
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    await fs.promises.writeFile(p, JSON.stringify(payload || {}, null, 2), 'utf8');
    return { ok: true, path: p };
  });
  createWindow().catch((err) => console.error('Failed to create window:', err));
});

app.on('window-all-closed', () => {
  // On macOS it's common for applications to stay open until the user quits explicitly
  if (process.platform !== 'darwin') {
    if (staticServer) {
      try { staticServer.close(); } catch (e) {}
      staticServer = null;
      staticPort = null;
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (staticServer) {
    try { staticServer.close(); } catch (e) {}
    staticServer = null;
    staticPort = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
