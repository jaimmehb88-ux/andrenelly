const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Store, validate, imageName } = require('./store.cjs');
const { printHTML } = require('./document.cjs');
const {Scanner}=require('./scanner.cjs');
const {importAsset}=require('./assets.cjs');
const {sceneOutput}=require('./output.cjs');
const Scene=require('./scene.js');
const sharp=require('sharp');
const scanThumbnails=new Map();
let thumbnailQueue=Promise.resolve();

protocol.registerSchemesAsPrivileged(['sath-image','sath-scan'].map(scheme=>({scheme,privileges:{standard:true,secure:true,supportFetchAPI:true}})));
// Development can place all runtime files in a writable workspace.
if (process.env.SATH_DATA_DIR && !app.isPackaged) app.setPath('userData', path.join(path.resolve(process.env.SATH_DATA_DIR), 'perfil'));
let mainWindow, store, state, scanner, recovered = false, migrated = false;
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
  ({state, recovered, migrated} = await store.initialize());
  scanner = new Scanner();
  await scanner.setFolder(state.settings.scanFolder,{wait:false});
  protocol.handle('sath-scan',async request=>{
    try{
      const url=new URL(request.url);if(url.hostname!=='local')return new Response('No permitido',{status:403});
      const token=url.pathname.slice(1),file=await scanner.resolve(token);
      if(url.searchParams.get('thumb')==='1'){
        if(!scanThumbnails.has(token)){
          const pending=thumbnailQueue.then(()=>sharp(file,{limitInputPixels:50_000_000}).rotate().resize({width:480,height:360,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer());
          thumbnailQueue=pending.catch(()=>{});scanThumbnails.set(token,pending);if(scanThumbnails.size>24)scanThumbnails.delete(scanThumbnails.keys().next().value);
        }
        return new Response(await scanThumbnails.get(token),{headers:{'Content-Type':'image/webp'}});
      }
      return net.fetch(pathToFileURL(file).href);
    }catch{return new Response('Imagen no disponible',{status:404});}
  });
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
      catch (error) { return {ok:false, error:error.code==='EEXIST'?'El archivo ya existe. Elige otro nombre para conservar el original.':error.message}; }
    });
  }
  handle('load', () => ({state, recovered, migrated, dataPath:store.root, version:app.getVersion()}));
  handle('save', incoming => exclusive(async () => {
    validate(incoming); if(incoming.version!==2)throw new Error('La aplicación requiere datos en formato v2.'); if(incoming.settings.scanFolder!==scanner.folder)throw new Error('Cambia la carpeta desde Seleccionar carpeta.'); await store.save(incoming); state = incoming; return true;
  }));
  async function pickAsset() {
    const selected=await dialog.showOpenDialog(mainWindow,{title:'Seleccionar imagen',filters:[{name:'Imágenes JPG, PNG o WEBP',extensions:['jpg','jpeg','png','webp']}],properties:['openFile']});
    if(selected.canceled)return null;return importAsset(selected.filePaths[0],store.images);
  }
  handle('import-image',async()=>{const asset=await pickAsset();return asset?.name||null;});
  handle('asset-import',pickAsset);
  handle('scan-folder',()=>exclusive(async()=>{
    const selection=await dialog.showOpenDialog(mainWindow,{title:'Carpeta de escaneos',properties:['openDirectory']});if(selection.canceled)return null;
    const folder=await fs.realpath(selection.filePaths[0]);const previous=scanner.folder;
    try{await scanner.setFolder(folder,{wait:false});state.settings.scanFolder=folder;await store.save(state);}catch(error){state.settings.scanFolder=previous;await scanner.setFolder(previous,{wait:false});throw error;}return scanner.snapshot();
  }));
  handle('scan-list',async all=>{if(typeof all!=='boolean')throw new Error('Opción no válida.');await scanner.refresh();return scanner.snapshot(all);});
  handle('scan-import',async token=>{if(typeof token!=='string')throw new Error('Imagen no válida.');return importAsset(await scanner.resolve(token),store.images);});
  scanner.on('change',snapshot=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('scan-change',snapshot);});
  handle('scene-output',async options=>{
    if(!options||!['pdf','print','png','jpg'].includes(options.kind))throw new Error('Formato de exportación no válido.');
    const project=state.projects.find(p=>p.id===options.projectId);if(!project)throw new Error('Guarda el proyecto antes de exportar.');
    return sceneOutput({projects:[structuredClone(project)],kind:options.kind,dpi:options.dpi||150,owner:mainWindow,root:store.root,images:store.images});
  });
  handle('batch-output',async options=>{
    if(!options||!Array.isArray(options.tokens)||!options.tokens.length||options.tokens.length>100||!['pdf','print'].includes(options.kind)||typeof options.landscape!=='boolean')throw new Error('Selecciona de 1 a 100 imágenes.');
    const projects=[],temporary=await fs.mkdtemp(path.join(store.root,'lote-'));
    try {
      for(const token of options.tokens){const file=await scanner.resolve(token),asset=await importAsset(file,temporary),page=options.landscape?{width:1123,height:794}:{...Scene.A4};projects.push({id:randomUUID(),title:path.basename(file),updatedAt:new Date().toISOString(),page,layers:[Scene.imageLayer(randomUUID(),asset.name,path.basename(file),asset,page)]});}
      return await sceneOutput({projects,kind:options.kind,owner:mainWindow,root:store.root,images:temporary});
    } finally {await fs.rm(temporary,{recursive:true,force:true});}
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
    await store.backup(state,path.join(store.root,'respaldos')); state = await store.restore(selection.filePaths[0]); await scanner.setFolder(state.settings.scanFolder,{wait:false}); return state;
  }));
  handle('open-folder', () => shell.openPath(store.root));
  handle('output', async options => {
    if (!options || !['pdf','print','png','jpg'].includes(options.kind) || typeof options.background !== 'boolean') throw new Error('Opción de salida no válida.');
    const document = state.documents.find(d => d.id === options.documentId); if (!document) throw new Error('Guarda un documento antes de imprimir.');
    const template = state.templates.find(t => t.id === document.templateId);
    if(['png','jpg'].includes(options.kind)) {
      const project={id:randomUUID(),title:document.title,updatedAt:new Date().toISOString(),page:{...Scene.A4},layers:Scene.templateLayers(template,document.values,randomUUID)};
      if(!options.background)project.layers.filter(l=>l.group==='background').forEach(l=>l.visible=false);
      return sceneOutput({projects:[project],kind:options.kind,dpi:150,owner:mainWindow,root:store.root,images:store.images});
    }
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
        await fs.writeFile(destination,bytes,{flag:'wx'}); return destination;
      }
      await new Promise((resolve,reject) => win.webContents.print({silent:false,printBackground:true,pageSize:'A4',margins:{marginType:'none'}},(success,reason) => success ? resolve() : reject(new Error(reason === 'cancelled' ? 'Impresión cancelada.' : 'No se pudo imprimir: ' + reason))));
      return true;
    } finally { win.destroy(); await fs.rm(file,{force:true}); }
  });
  handle('close', () => { mainWindow.forceClose = true; mainWindow.close(); });
  await mainWindow.loadFile(path.join(__dirname,'index.html')); mainWindow.show();
}
app.on('before-quit',()=>scanner?.close());
app.on('window-all-closed', () => app.quit());
