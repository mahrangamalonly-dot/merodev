const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const net = require('net');
const { createServer, findFreePort, PORT } = require('../server.cjs');

const DEV_TOOLS = process.env.MERO_DEV_TOOLS === '1';
let server = null;
let win = null;

async function start() {
  let port = PORT;
  try { port = await findFreePort(PORT, PORT + 50); } catch { port = 0; }

  server = createServer();
  await new Promise(resolve => {
    server.listen(port, '127.0.0.1', resolve);
    server.on('error', () => server.listen(0, '127.0.0.1', resolve));
  });

  const address = server.address();
  const actual = typeof address === 'object' && address ? address.port : port;

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#07030f',
    title: 'Mero POS Pro',
    icon: path.join(__dirname, '..', 'assets', 'img', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });

  win.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);
  win.loadURL(`http://127.0.0.1:${actual}/`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV_TOOLS) win.webContents.openDevTools({ mode: 'bottom' });
}

app.whenReady().then(start).catch(err => {
  console.error('فشل تشغيل التطبيق:', err);
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && !server) start();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => { if (server) server.close(); });
