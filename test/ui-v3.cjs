const {_electron:electron}=require('playwright-core');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const sharp=require('sharp'),{randomUUID,createHash}=require('node:crypto');
const Scene=require('../src/scene.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.test-output-v3',randomUUID()),data=path.join(out,'datos');
const digest=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
 await fs.mkdir(path.join(data,'imagenes'),{recursive:true});
 const image=randomUUID()+'.png',original=await sharp({create:{width:200,height:120,channels:3,background:'#09764b'}}).png().toBuffer();
 await fs.writeFile(path.join(data,'imagenes',image),original);
 const layer={...Scene.imageLayer(randomUUID(),image,'Imagen v2',{width:200,height:120}),x:180,y:180,width:200,height:120};
 const previous={version:2,templates:JSON.parse(await fs.readFile(path.join(root,'assets/templates.json'),'utf8')),documents:[{id:'previo',title:'Documento v2',templateId:'hoja_1',updatedAt:new Date().toISOString(),values:{p_1:'CONSERVAR'}}],projects:[{id:randomUUID(),title:'Proyecto v2',updatedAt:new Date().toISOString(),page:{...Scene.A4},layers:[layer]}],settings:{scanFolder:null,autocomplete:{enabled:true,history:true,fields:{'hoja_1:p_1':{enabled:true,suggestions:['PREFERENCIA V2']}}}}};
 await fs.writeFile(path.join(data,'documentos.json'),JSON.stringify(previous));
 let app,page;const errors=[];
 async function launch(reduced=false){app=await electron.launch({args:[root],env:{...process.env,SATH_DATA_DIR:data},timeout:45000});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));if(reduced)await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#document-title').waitFor();}
 async function stop(){await page.evaluate(()=>flush());await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});}
 async function forbidden(){
  const results=await page.evaluate(async()=>{
   const api=window.sath,loaded=await api.load(),checks=[()=>api.setPro(true),()=>api.changePassword('intruso'),()=>api.scanList(),()=>api.scanFolder(),()=>api.scanImport('fake'),()=>api.importAsset(),()=>api.sceneOutput({}),()=>api.batchOutput({}),()=>api.restore(),()=>{const s=structuredClone(loaded.state);s.projects=[];return api.save(s);},()=>{const s=structuredClone(loaded.state);s.templates.push({...s.templates[0],id:'intruso'});return api.save(s);}];
   return Promise.all(checks.map(async fn=>{try{await fn();return 'PERMITIDO';}catch(e){return e.message;}}));
  });assert.ok(results.every(r=>/requiere/.test(r)),JSON.stringify(results));
 }
 async function login(password){await page.locator('#developer-mode').click();await page.locator('#developer-password').fill(password);await page.locator('#developer-login-form button[type=submit]').click();}
 try{
  await launch();
  await page.locator('#welcome img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  assert.equal(await page.locator('#welcome img').count(),2);assert.ok(await page.locator('#welcome').isVisible());
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#welcome img')).every(i=>getComputedStyle(i).opacity==='1'));await page.screenshot({path:path.join(out,'bienvenida.png')});await page.locator('#skip-welcome').click();await page.locator('#welcome').waitFor({state:'hidden'});assert.ok(await page.locator('#welcome').isHidden());
  let loaded=await page.evaluate(()=>window.sath.load());assert.deepEqual(loaded.state,previous);assert.deepEqual(loaded.access,{developer:false,pro:false});
  const marker=JSON.parse(await fs.readFile(path.join(data,'actualizacion-3.0.0.json'),'utf8'));assert.deepEqual(JSON.parse(await fs.readFile(path.join(marker.backup,'documentos.json'),'utf8')),previous);assert.equal(digest(await fs.readFile(path.join(marker.backup,'imagenes',image))),digest(original));
  assert.ok(await page.locator('[data-view=scans]').isHidden());await page.locator('[data-view=templates]').click();assert.ok(await page.locator('#new-template').isHidden());assert.ok(await page.getByRole('button',{name:'Usar plantilla',exact:true}).first().isVisible());await forbidden();
  await login('incorrecta');await page.locator('#developer-error').filter({hasText:'incorrecta'}).waitFor();await page.locator('#developer-password').fill('user2');await page.locator('#developer-login-form button[type=submit]').click();await page.locator('#developer-panel').waitFor();
  await page.locator('#dev-scans').click();await page.locator('#scene-editor').waitFor();
  // Exercise actual mouse events with page deltas rotated into screen axes.
  for(const zoom of ['0.5','1','2'])for(const rotation of [0,35,90]){
   await page.evaluate(rotation=>{selectedLayerId=projectNow().layers[0].id;Object.assign(layerNow(),{x:180,y:180,width:200,height:120,rotation});renderScene();},rotation);
   await page.locator('#scene-zoom').selectOption(zoom);await page.locator('.grip-se').scrollIntoViewIfNeeded();
   const before=await page.evaluate(()=>structuredClone(layerNow()));const box=await page.locator('.grip-se').boundingBox(),a=rotation*Math.PI/180,z=Number(zoom);
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+z*(40*Math.cos(a)-24*Math.sin(a)),box.y+box.height/2+z*(40*Math.sin(a)+24*Math.cos(a)),{steps:5});
   assert.match(await page.locator('.scene-handle.selected .resize-measures').textContent(),/px/);await page.mouse.up();
   const after=await page.evaluate(()=>structuredClone(layerNow()));assert.ok(after.width>before.width+30);assert.ok(Math.abs(after.width/after.height-200/120)<1e-6);
   await page.locator('#scene-undo').click();assert.equal(Number(await page.locator('#layer-width').inputValue()),200);await page.locator('#scene-redo').click();assert.ok(Number(await page.locator('#layer-width').inputValue())>230);
  }
  await page.locator('#scene-zoom').selectOption('1');await page.locator('#layer-keep-ratio').uncheck();await page.locator('.grip-se').scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>structuredClone(layerNow()));let box=await page.locator('.grip-se').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2,{steps:4});await page.mouse.up();
  let after=await page.evaluate(()=>structuredClone(layerNow()));assert.ok(Math.abs(after.width/after.height-before.width/before.height)>.01);
  await page.getByRole('button',{name:'Bloquear Imagen v2',exact:true}).click();assert.equal(await page.locator('.resize-grip').count(),0);await page.getByRole('button',{name:'Desbloquear Imagen v2',exact:true}).click();assert.equal(await page.locator('.resize-grip').count(),8);
  await page.evaluate(()=>flush());loaded=await page.evaluate(()=>window.sath.load());assert.equal(loaded.state.projects[0].layers[0].width,after.width);assert.equal(digest(await fs.readFile(path.join(data,'imagenes',image))),digest(original));
  await page.locator('#scene-zoom').selectOption('fit');await page.screenshot({path:path.join(out,'redimensionamiento.png'),fullPage:true});
  await page.locator('#developer-mode').click();await page.locator('#new-password').fill('nueva-v3');await page.locator('#repeat-password').fill('nueva-v3');await page.locator('#password-form button[type=submit]').click();await page.locator('#password-message').filter({hasText:'actualizada'}).waitFor();
  await page.locator('#toggle-pro').click();await page.locator('#toggle-pro').filter({hasText:'Desactivar'}).waitFor();await page.locator('#developer-logout').click();assert.ok(await page.locator('[data-view=scans]').isVisible());
  await assert.rejects(page.evaluate(()=>window.sath.setPro(false)));await stop();
  await launch(true);assert.ok(await page.locator('#welcome').isHidden());loaded=await page.evaluate(()=>window.sath.load());assert.deepEqual(loaded.access,{developer:false,pro:true});assert.equal(loaded.state.projects[0].layers[0].width,after.width);
  await login('user2');await page.locator('#developer-error').filter({hasText:'incorrecta'}).waitFor();await page.locator('#developer-password').fill('nueva-v3');await page.locator('#developer-login-form button[type=submit]').click();await page.locator('#developer-panel').waitFor();await page.locator('#toggle-pro').click();await page.locator('#toggle-pro').filter({hasText:'Activar'}).waitFor();await page.locator('#developer-logout').click();await forbidden();await stop();
  await launch(true);loaded=await page.evaluate(()=>window.sath.load());assert.deepEqual(loaded.access,{developer:false,pro:false});assert.deepEqual(loaded.state.settings,previous.settings);assert.deepEqual(loaded.state.documents,previous.documents);assert.equal(loaded.state.projects.length,1);await forbidden();
  assert.deepEqual(errors,[]);assert.ok(!(await fs.readFile(path.join(data,'acceso.json'),'utf8')).includes('nueva-v3'));
  console.log('PASS v3: logos, bienvenida omisible, movimiento reducido, migración v2 con respaldo, contraseña/cambio/cierre/reinicio, Pro persistente, 11 operaciones internas denegadas, mouse 50/100/200 % con giros 0/35/90°, proporción libre, bloqueo, deshacer/rehacer, autoguardado y originales intactos.');
 }finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}}
})().catch(error=>{console.error(error);process.exitCode=1;});
