const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Store, validate, imageName, imageType } = require('./store.cjs');
const { printHTML } = require('./document.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'sath-image', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
// Development can place all runtime files in a writable workspace.
if (process.env.SATH_DATA_DIR && !app.isPackaged) app.setPath('userData', path.join(path.resolve(process.env.SATH_DATA_DIR), 'perfil'));
let mainWindow, store, state, recovered = false;
let writeQueue = Promise.resolve();
const exclusive = task => {
  const next = writeQueue.then(task); writeQueue = next.catch(() => {}); return next;
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('No se pudo iniciar SATH', error.message); app.quit(); });
}
async function start() {
  const root = app.isPackaged ? path.join(path.dirname(process.execPath), 'datos') : process.env.SATH_DATA_DIR ? path.resolve(process.env.SATH_DATA_DIR) : path.join(app.getPath('userData'), 'datos');
  store = new Store(root, path.join(__dirname, '..', 'assets'));
  ({state, recovered} = await store.initialize());
  protocol.handle('sath-image', request => {
    const url = new URL(request.url); const name = url.pathname.slice(1);
    if (url.hostname !== 'local' || !imageName.test(name)) return new Response('No permitido',{status:403});
    return net.fetch(pathToFileURL(path.join(store.images,name)).href);
  });
  mainWindow = new BrowserWindow({ width:1460, height:950, minWidth:1050, minHeight:700, title:'SATH Escritorio', icon:path.join(__dirname,'..','assets','icon.png'), backgroundColor:'#f4f6fa', show:false, webPreferences:{ preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true, spellcheck:false } });
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.on('close', event => {
    if (!mainWindow.forceClose) { event.preventDefault(); mainWindow.webContents.send('request-close'); }
  });
  function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Solicitud no permitida.');
      try { return { ok:true, value:await fn(...args) }; }
      catch (error) { return {ok:false, error:error.message}; }
    });
  }
  handle('load', () => ({state, recovered, dataPath:store.root, version:app.getVersion()}));
  handle('save', incoming => exclusive(async () => {
    validate(incoming); await store.save(incoming); state = incoming; return true;
  }));
  handle('import-image', async () => {
    const selection = await dialog.showOpenDialog(mainWindow,{title:'Seleccionar imagen de plantilla A4',filters:[{name:'Imágenes JPG o PNG',extensions:['jpg','jpeg','png']}],properties:['openFile']});
    if (selection.canceled) return null;
    const file = selection.filePaths[0]; const stat = await fs.stat(file);
    if (stat.size > 30*1024*1024) throw new Error('La imagen supera 30 MB. Reduce su tamaño e inténtalo de nuevo.');
    const bytes = await fs.readFile(file); const ext = imageType(bytes); const image = nativeImage.createFromBuffer(bytes); const size = image.getSize();
    if (!ext || image.isEmpty() || size.width*size.height > 50_000_000) throw new Error('Selecciona una imagen JPG o PNG válida, de hasta 50 megapíxeles.');
    const name = randomUUID() + '.' + ext; await fs.writeFile(path.join(store.images,name),bytes,{flag:'wx'}); return name;
  });
  handle('backup', () => exclusive(async () => {
    const selection = await dialog.showOpenDialog(mainWindow,{title:'Elegir dónde guardar el respaldo',properties:['openDirectory','createDirectory']});
    if (selection.canceled) return null;
    return store.backup(state,selection.filePaths[0]);
  }));
  handle('restore', () => exclusive(async () => {
    const selection = await dialog.showOpenDialog(mainWindow,{title:'Abrir documentos.json de un respaldo SATH',filters:[{name:'Respaldo SATH',extensions:['json']}],properties:['openFile']});
    if (selection.canceled) return null;
    const answer = await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancelar','Restaurar respaldo'],defaultId:0,cancelId:0,message:'Se reemplazarán las plantillas y los documentos actuales.',detail:'Primero se creará una copia completa de los datos actuales dentro de datos/respaldos. El respaldo seleccionado debe tener su carpeta imagenes al lado.'});
    if (answer.response !== 1) return null;
    await store.backup(state,path.join(store.root,'respaldos')); state = await store.restore(selection.filePaths[0]); return state;
  }));
  handle('open-folder', () => shell.openPath(store.root));
  handle('output', async options => {
    if (!options || !['pdf','print'].includes(options.kind) || typeof options.background !== 'boolean') throw new Error('Opción de salida no válida.');
    const document = state.documents.find(d => d.id === options.documentId); if (!document) throw new Error('Guarda un documento antes de imprimir.');
    const template = state.templates.find(t => t.id === document.templateId);
    let destination;
    if (options.kind === 'pdf') {
      const result = await dialog.showSaveDialog(mainWindow,{title:'Guardar documento PDF',defaultPath:document.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_') + '.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
      if (result.canceled) return null; destination = result.filePath;
    }
    const file = path.join(store.root,'impresion-' + randomUUID() + '.html');
    const win = new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
    win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    try {
      await fs.writeFile(file,printHTML(template,document.values,store.images,options.background)); await win.loadFile(file);
      await win.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images, i => i.decode())]).then(() => true)`);
      if (options.kind === 'pdf') {
        const bytes = await win.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true,margins:{top:0,bottom:0,left:0,right:0}});
        await fs.writeFile(destination,bytes); return destination;
      }
      await new Promise((resolve,reject) => win.webContents.print({silent:false,printBackground:true,pageSize:'A4',margins:{marginType:'none'}},(success,reason) => success ? resolve() : reject(new Error(reason === 'cancelled' ? 'Impresión cancelada.' : 'No se pudo imprimir: ' + reason))));
      return true;
    } finally { win.destroy(); await fs.rm(file,{force:true}); }
  });
  handle('close', () => { mainWindow.forceClose = true; mainWindow.close(); });
  await mainWindow.loadFile(path.join(__dirname,'index.html')); mainWindow.show();
}
app.on('window-all-closed', () => app.quit());
