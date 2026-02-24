const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const keytar = require('keytar');

let nextProcess = null;

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

function createWindow() {
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
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // In production packaging, start a background `next start` to serve the built app
    // and load it via localhost. This allows server routes (app/api) to work inside the packaged Electron app.
    const port = process.env.PORT || 3000;
    const appRoot = path.join(__dirname, '..');
    // Only spawn once
    if (!nextProcess) {
      // Use `npx next start -p <port>` to start the built Next server from the packaged app.
      nextProcess = spawn(process.execPath, [
        path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
        'start',
        '-p',
        String(port)
      ], {
        cwd: appRoot,
        env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
        stdio: 'inherit'
      });

      nextProcess.on('error', (err) => console.error('Failed to start next:', err));
      nextProcess.on('exit', (code) => console.log('next process exited with', code));
    }

    win.loadURL(`http://localhost:${port}`);
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
  createWindow();
});

app.on('window-all-closed', () => {
  // On macOS it's common for applications to stay open until the user quits explicitly
  if (process.platform !== 'darwin') {
    // ensure background next process is killed when app closes
    if (nextProcess) try { nextProcess.kill(); } catch (e) {}
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
