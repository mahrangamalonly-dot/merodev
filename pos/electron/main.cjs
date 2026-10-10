const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const net = require('net');
const { createServer } = require('../server.cjs');

const DEV_TOOLS = process.env.MERO_DEV_TOOLS === '1';
const PORT_START = Number(process.env.MERO_PORT || 4173);
const PORT_END = PORT_START + 50;

let server = null;
let win = null;

function findFreePort(start, end) {
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      const tester = net.createServer();
      tester.once('error', () => {
        if (port >= end) { reject(new Error('no_free_port')); return; }
        tryPort(port + 1);
      });
      tester.once('listening', () => tester.close(() => resolve(port)));
      tester.listen(port, '127.0.0.1');
    };
    tryPort(start);
  });
}

async function start() {
  let port = PORT_START;
  try {
    port = await findFreePort(PORT_START, PORT_END);
  } catch {
    port = 0;
  }

  server = createServer();
  await new Promise(resolve => {
    server.listen(port, '127.0.0.1', resolve);
    server.on('error', () => {
      server.listen(0, '127.0.0.1', resolve);
    });
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#07030f',
    title: 'Mero Dev POS',
    icon: path.join(__dirname, '..', 'assets', 'img', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);
  win.loadURL(`http://127.0.0.1:${actualPort}/`);

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

app.on('quit', () => {
  if (server) server.close();
});
