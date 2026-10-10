const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { createServer, PORT } = require('../server.cjs');

const DEV_TOOLS = process.env.MERO_DEV_TOOLS === '1';

let server = null;
let win = null;

function createWindow() {
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
  win.loadURL(`http://127.0.0.1:${PORT}/`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV_TOOLS) win.webContents.openDevTools({ mode: 'bottom' });
}

app.whenReady().then(() => {
  server = createServer();
  server.listen(PORT, '127.0.0.1', () => createWindow());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (server) server.close();
});
