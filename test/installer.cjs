// Exercises the published installers in an isolated Windows CI user account.
const {_electron:electron}=require('playwright-core');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.test-installed'),program=path.join(out,'programa'),data=path.join(program,'datos');
const version=require('../package.json').version;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function present(file){try{await fs.access(file);return true;}catch{return false;}}
async function execute(file,args){await new Promise((resolve,reject)=>{const child=spawn(file,args,{stdio:'pipe'});let detail='';child.stdout.on('data',b=>detail+=b);child.stderr.on('data',b=>detail+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(path.basename(file)+' terminó con código '+code+' '+detail)));});}
async function open(){return electron.launch({executablePath:path.join(program,'SATH Escritorio.exe'),args:[],env:{...process.env},timeout:45000});}
async function close(app){const exit=new Promise(resolve=>app.process().once('exit',resolve));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.isVisible()).close());await exit;await app.close().catch(()=>{});await delay(700);}
(async()=>{
 if(process.platform!=='win32')throw new Error('La prueba de instalación requiere Windows.');
 if(await present(out))throw new Error('La carpeta de pruebas ya existe. No se sobrescribe una instalación anterior.');
 await fs.mkdir(out);
 let app;
 try{
  const oldInstaller=path.join(root,'.test-installers','SATH-Escritorio-1.0.1-Instalador.exe'),newInstaller=path.join(root,'.test-installers',`SATH-Escritorio-${version}-Instalador.exe`);
  await execute(oldInstaller,['/S','/D='+program]);assert.ok(await present(path.join(program,'SATH Escritorio.exe')));await fs.mkdir(path.join(data,'imagenes'),{recursive:true});
  const image=randomUUID()+'.jpg',imageBytes=await sharp({create:{width:60,height:80,channels:3,background:'#3482d9'}}).jpeg().toBuffer();await fs.writeFile(path.join(data,'imagenes',image),imageBytes);
  const templates=JSON.parse(await fs.readFile(path.join(root,'assets','templates.json'),'utf8'));templates[0].image=image;
  const oldState={version:1,templates,documents:[{id:'preservar',title:'Documento de actualización',templateId:templates[0].id,updatedAt:new Date().toISOString(),values:{p_1:'PAPELETA-PRESERVADA',p_custom_2:'12345678',p_custom_5:'PERSONA DE PRUEBA'}}]};
  await fs.writeFile(path.join(data,'documentos.json'),JSON.stringify(oldState));
  app=await open();let page=await app.firstWindow();page.setDefaultTimeout(20000);await page.locator('#document-title').waitFor();let loaded=await page.evaluate(()=>window.sath.load());assert.equal(loaded.version,'1.0.1');assert.equal(loaded.state.documents[0].values.p_1,'PAPELETA-PRESERVADA');await close(app);app=null;
  const beforeUpgrade=await fs.readFile(path.join(data,'documentos.json'));
  await execute(newInstaller,['/S','/D='+program]);assert.equal(digest(await fs.readFile(path.join(data,'documentos.json'))),digest(beforeUpgrade));assert.equal(digest(await fs.readFile(path.join(data,'imagenes',image))),digest(imageBytes));
  app=await open();page=await app.firstWindow();page.setDefaultTimeout(20000);await page.locator('#document-title').waitFor();loaded=await page.evaluate(()=>window.sath.load());assert.equal(loaded.version,version);assert.equal(loaded.state.version,2);assert.equal(loaded.migrated,true);assert.deepEqual(loaded.state.documents,oldState.documents);assert.equal(loaded.state.templates[0].image,image);assert.equal((await fs.readdir(path.join(data,'respaldos','migraciones'))).length,1);
  await page.evaluate(async image=>{const loaded=await window.sath.load();loaded.state.settings.autocomplete.fields['hoja_1:p_1']={enabled:true,suggestions:['SUGERENCIA-PRESERVADA']};loaded.state.projects.push({id:crypto.randomUUID(),title:'Proyecto conservado',updatedAt:new Date().toISOString(),page:{width:794,height:1123},layers:[window.SathScene.imageLayer(crypto.randomUUID(),image,'Imagen conservada',{width:60,height:80})]});await window.sath.save(loaded.state);},image);
  await close(app);app=null;const beforeReinstall=await fs.readFile(path.join(data,'documentos.json'));
  await execute(newInstaller,['/S','/D='+program]);assert.equal(digest(await fs.readFile(path.join(data,'documentos.json'))),digest(beforeReinstall));
  app=await open();page=await app.firstWindow();await page.locator('#document-title').waitFor();loaded=await page.evaluate(()=>window.sath.load());assert.equal(loaded.migrated,false);assert.equal(loaded.state.projects[0].title,'Proyecto conservado');assert.deepEqual(loaded.state.settings.autocomplete.fields['hoja_1:p_1'].suggestions,['SUGERENCIA-PRESERVADA']);await close(app);app=null;
  const beforeUninstall=await fs.readFile(path.join(data,'documentos.json'));
  await execute(path.join(program,'Desinstalar SATH Escritorio.exe'),['/S']);
  let removed=false;for(let attempt=0;attempt<200;attempt++){const registered=spawnSync('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SATH-Escritorio'],{stdio:'ignore'}).status===0;if(!registered&&!await present(path.join(program,'SATH Escritorio.exe'))&&!await present(path.join(program,'resources'))){removed=true;break;}await delay(150);}
  assert.ok(removed,'El desinstalador debe quitar el programa y su registro.');assert.equal(digest(await fs.readFile(path.join(data,'documentos.json'))),digest(beforeUninstall));assert.equal(digest(await fs.readFile(path.join(data,'imagenes',image))),digest(imageBytes));
  await fs.writeFile(path.join(out,'resultado.json'),JSON.stringify({oldVersion:'1.0.1',newVersion:version,install:true,upgradePreservedData:true,migrationBackedUp:true,reinstallPreservedData:true,uninstallPreservedData:true,originalImagePreserved:true},null,2));
  console.log('PASS: instaladores publicados, instalación 1.0.1, actualización '+version+', migración con respaldo, reinstalación, desinstalación y conservación de documentos, proyectos, sugerencias e imagen original.');
 }catch(error){console.error(error);if(process.env.GITHUB_ACTIONS)console.error('::error title=Instalación y actualización reales::'+String(error.stack||error).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'));throw error;}
 finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}}
})().catch(()=>{process.exitCode=1;});
