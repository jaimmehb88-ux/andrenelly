// Windows CI smoke test for the actual packaged executable and native image module.
const {_electron:electron}=require('playwright-core');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {setTimeout:delay}=require('node:timers/promises');
(async()=>{
 if(process.platform!=='win32')throw new Error('Esta comprobación requiere el ejecutable Windows ya compilado.');
 const root=path.resolve(__dirname,'..'),directory=path.join(root,'dist','win-unpacked'),data=path.join(directory,'datos'),out=path.join(root,'.test-packaged');
 try{await fs.access(data);throw new Error('La carpeta datos ya existe. No se sobrescriben datos de una ejecución anterior.');}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.mkdir(data);await fs.mkdir(out,{recursive:true});
 const previous={version:1,templates:JSON.parse(await fs.readFile(path.join(root,'assets','templates.json'),'utf8')),documents:[{id:'anterior',title:'Documento v1 conservado',templateId:'hoja_1',updatedAt:new Date().toISOString(),values:{p_1:'CONSERVAR123'}}]};
 await fs.writeFile(path.join(data,'documentos.json'),JSON.stringify(previous));
 const fixture=path.join(out,'original.webp');await sharp({create:{width:60,height:80,channels:3,background:'#3a75e8'}}).webp().toFile(fixture);
 let app;
 try{
  app=await electron.launch({executablePath:path.join(directory,'SATH Escritorio.exe'),args:['--user-data-dir='+path.join(out,'perfil')],env:{...process.env},timeout:45000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);await page.locator('#document-title').waitFor();await page.locator('#skip-welcome').click().catch(()=>{});await page.evaluate(()=>window.sath.login('user2'));await page.evaluate(()=>{accessState={developer:true,pro:false};refreshAccess();});
  const loaded=await page.evaluate(()=>window.sath.load());assert.equal(loaded.version,require('../package.json').version);assert.equal(loaded.state.version,2);assert.equal(loaded.migrated,true);assert.equal(loaded.state.documents[0].values.p_1,'CONSERVAR123');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},fixture);
  const asset=await page.evaluate(()=>window.sath.importAsset());assert.ok(asset.name.endsWith('.webp'));assert.equal(asset.width,60);
  const projectId=await page.evaluate(async asset=>{const loaded=await window.sath.load();const id=crypto.randomUUID();loaded.state.projects.push({id,title:'Proyecto empaquetado',updatedAt:new Date().toISOString(),page:{width:794,height:1123},layers:[window.SathScene.imageLayer(crypto.randomUUID(),asset.name,'WEBP',asset)]});await window.sath.save(loaded.state);return id;},asset);
  const output=path.join(out,'salida.png');await fs.rm(output,{force:true});await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},output);
  const result=await page.evaluate(id=>window.sath.sceneOutput({projectId:id,kind:'png',dpi:96}),projectId);assert.equal(result,output);const metadata=await sharp(output).metadata();assert.equal(metadata.width,794);assert.equal(metadata.height,1123);
  console.log('PASS: ejecutable Windows empaquetado, migración v1 con respaldo, módulo nativo Sharp, WEBP y exportación PNG.');
 }catch(error){console.error(error);if(process.env.GITHUB_ACTIONS)console.error('::error title=Ejecutable Windows empaquetado::'+String(error.stack||error).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'));throw error;}
 finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await fs.rm(data,{recursive:true,force:true});}
})().catch(()=>{process.exitCode=1;});
