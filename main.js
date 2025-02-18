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


  // Maximizar a janela assim que for criada
  win.maximize();

  // Remover a barra de menu
  win.setMenuBarVisibility(false); // Isso oculta a barra de menus

  // Função para verificar se o servidor está rodando na porta 3000
  function checkServerReady() {
    http.get('http://localhost:3000', (res) => {
      if (res.statusCode === 200) {
        // Quando o servidor estiver pronto, carregue a URL
        win.loadURL('http://localhost:3000');
      }
    }).on('error', (e) => {
      // Se o servidor não estiver pronto, tenta novamente após 1 segundo
      console.log('Aguardando servidor iniciar...');
      setTimeout(checkServerReady, 1000);
    });
  }

  // Verifique se o servidor está pronto para receber conexões
  checkServerReady();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
