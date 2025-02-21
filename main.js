const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.maximize();

  win.setMenuBarVisibility(false);

  function checkServerReady() {
    http.get('http://localhost:3000', (res) => {
      if (res.statusCode === 200) {
        win.loadURL('http://localhost:3000');
      }
    }).on('error', (e) => {
      console.log('Aguardando servidor iniciar...');
      setTimeout(checkServerReady, 1000);
    });
  }

  checkServerReady();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
