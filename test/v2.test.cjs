const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const sharp=require('sharp');
const {randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {Store,validate,migrate}=require('../src/store.cjs');
const {Scanner}=require('../src/scanner.cjs');
const Scene=require('../src/scene.js');
const Completion=require('../src/completion.js');
const assets=path.resolve(__dirname,'../assets');
const initial=()=>({version:1,templates:structuredClone(require('../assets/templates.json')),documents:[]});
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'sath-v2-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=new Store(path.join(root,'datos'),assets);const loaded=await store.initialize();return{root,store,state:loaded.state};}
const makeProject=()=>({id:randomUUID(),title:'Proyecto',updatedAt:new Date().toISOString(),page:{...Scene.A4},layers:[]});
test('migra v1 con respaldo completo previo, preserva datos y no repite la migración',async t=>{
 const {root,store}=await fixture(t);const old=initial();old.documents.push({id:'persona',templateId:'hoja_1',title:'Anterior',updatedAt:new Date().toISOString(),values:{p_custom_2:'12345678',p_custom_5:'ANA PÉREZ'}});
 await fs.writeFile(store.file,JSON.stringify(old));const result=await store.initialize();assert.equal(result.migrated,true);assert.equal(result.state.version,2);assert.deepEqual(result.state.documents,old.documents);assert.equal(result.state.settings.autocomplete.history,false);
 const folder=path.join(store.root,'respaldos','migraciones');const backups=await fs.readdir(folder);assert.equal(backups.length,1);assert.deepEqual(JSON.parse(await fs.readFile(path.join(folder,backups[0],'documentos.json'),'utf8')),old);assert.ok((await fs.stat(path.join(folder,backups[0],'imagenes','plantilla-1.jpg'))).size>0);
 assert.equal((await store.initialize()).migrated,false);assert.equal((await fs.readdir(folder)).length,1);
});
test('un fallo al crear el respaldo impide modificar los datos v1',async t=>{
 const{store}=await fixture(t);const old=JSON.stringify(initial());await fs.writeFile(store.file,old);store.backup=async()=>{throw new Error('Sin espacio para respaldo');};await assert.rejects(store.initialize(),/Sin espacio/);assert.equal(await fs.readFile(store.file,'utf8'),old);
});
test('sugerencias manuales, historial optativo y desactivación por campo',()=>{
 const state=migrate(initial()),t=state.templates[0],f=t.fields.find(f=>f.special==='dni');state.documents.push({id:'previo',templateId:t.id,title:'A',updatedAt:new Date().toISOString(),values:{[f.id]:'12345678'}});
 assert.deepEqual(Completion.suggestions(state,t,f,'otro'),[]);state.settings.autocomplete.fields[t.id+':'+f.id]={enabled:true,suggestions:['87654321']};assert.deepEqual(Completion.suggestions(state,t,f,'otro'),['87654321']);
 state.settings.autocomplete.history=true;assert.deepEqual(Completion.suggestions(state,t,f,'otro'),['87654321','12345678']);state.settings.autocomplete.fields[t.id+':'+f.id].enabled=false;assert.deepEqual(Completion.suggestions(state,t,f,'otro'),[]);state.settings.autocomplete.enabled=false;assert.deepEqual(Completion.candidates(state,{id:'otro'},'12345678'),[]);
});
test('DNI recupera solo datos personales entre plantillas, sin sustituir datos de trámite',()=>{
 const state=migrate(initial()),a=state.templates[0],b=state.templates[1];const source={id:'previo',title:'Persona',templateId:a.id,updatedAt:new Date().toISOString(),values:{p_custom_2:'12345678',p_custom_5:'MARÍA PÉREZ',p_custom_6:'AVENIDA 10',p_1:'NO COPIAR'}};state.documents.push(source);state.settings.autocomplete.history=true;
 assert.equal(Completion.candidates(state,{id:'nuevo'},'12345678').length,1);const values=Completion.personValues(state,b,source);assert.equal(values.p_custom_2,'MARÍA PÉREZ');assert.equal(values.p_custom_4,'12345678');assert.equal(values.p_custom_5,'AVENIDA 10');assert.ok(!Object.values(values).includes('NO COPIAR'));
});
test('el validador rechaza capas y sugerencias malformadas',()=>{
 const state=migrate(initial());state.projects.push(makeProject());state.projects[0].layers.push(Scene.imageLayer(randomUUID(),'../fuera.jpg','Imagen',{width:100,height:100}));assert.throws(()=>validate(state),/Archivo de imagen/);
 state.projects=[];state.settings.autocomplete.fields['hoja_1:p_1']={enabled:true,suggestions:['a'.repeat(4001)]};assert.throws(()=>validate(state),/Sugerencias/);
});
test('composición única conserva orden, filtros, recorte, rotación y exclusión de capas',()=>{
 const p=makeProject(),image=Scene.imageLayer(randomUUID(),'plantilla-1.jpg','Fondo',{width:794,height:1123});image.rotation=23.5;image.crop={x:.1,y:.2,width:.5,height:.6};image.brightness=120;image.contrast=80;image.grayscale=100;p.layers.push(image);const text=Scene.textLayer(randomUUID(),'<script> & prueba');p.layers.push(text);let svg=Scene.renderSVG(p,n=>'file:///'+n);
 assert.ok(svg.includes('rotate(23.5)'));assert.ok(svg.includes('viewBox="0.1 0.2 0.5 0.6"'));assert.ok(svg.includes('brightness(120%) contrast(80%) grayscale(100%)'));assert.ok(svg.includes('&lt;script&gt; &amp; prueba'));assert.ok(svg.indexOf('<image')<svg.indexOf('<text'));
 image.visible=false;svg=Scene.renderSVG(p,n=>n);assert.ok(!svg.includes('<image'));assert.ok(svg.includes('<text'));text.visible=false;assert.ok(!Scene.renderSVG(p,n=>n).includes('<text'));
});
test('plantillas convierten fondo y campos enlazados a capas independientes',()=>{
 const old=initial(),p=makeProject();p.layers=Scene.templateLayers(old.templates[0],{p_1:'ABC123'},randomUUID);assert.equal(p.layers[0].group,'background');assert.equal(p.layers[0].locked,true);assert.equal(p.layers.filter(l=>l.text==='ABC123').length,2);Scene.validateProject(p);
});
test('respaldo y restauración incluyen proyectos, WEBP, ajustes y sugerencias',async t=>{
 const{root,store,state}=await fixture(t);const name=randomUUID()+'.webp';const bytes=await sharp({create:{width:40,height:30,channels:3,background:'#45a1d9'}}).webp().toBuffer();await fs.writeFile(path.join(store.images,name),bytes);
 const project=makeProject();project.layers=[Scene.imageLayer(randomUUID(),name,'Escaneo',{width:40,height:30})];project.layers[0].rotation=10;project.layers[0].visible=false;state.projects.push(project);state.settings.autocomplete.fields['hoja_1:p_1']={enabled:true,suggestions:['AB']};await store.save(state);
 const backup=await store.backup(state,root),restored=await store.restore(path.join(backup,'documentos.json'));assert.equal(restored.projects[0].layers[0].rotation,10);assert.equal(restored.projects[0].layers[0].visible,false);assert.notEqual(restored.projects[0].layers[0].image,name);assert.deepEqual(await fs.readFile(path.join(store.images,restored.projects[0].layers[0].image)),bytes);assert.deepEqual(restored.settings.autocomplete,state.settings.autocomplete);
});
test('escáner ordena las últimas seis y admite WEBP, cambios, borrados y carpeta desconectada',async t=>{
 const{root}=await fixture(t),folder=path.join(root,'escaneos');await fs.mkdir(folder);const bytes=await sharp({create:{width:35,height:40,channels:3,background:'#2050aa'}}).png().toBuffer();
 for(let i=0;i<8;i++){const file=path.join(folder,`foto-${i}.png`);await fs.writeFile(file,bytes);const when=new Date(Date.now()-20000+i*1000);await fs.utimes(file,when,when);}
 await fs.writeFile(path.join(folder,'dañada.jpg'),'no es imagen');await fs.writeFile(path.join(folder,'otro.pdf'),'no soportado');
 const scanner=new Scanner({interval:999999,stability:0});t.after(()=>scanner.close());await scanner.setFolder(folder);const list=scanner.snapshot();assert.equal(list.entries.length,6);assert.equal(list.entries[0].name,'foto-7.png');assert.equal(scanner.snapshot(true).entries.length,8);assert.match(list.message,/dañados/);assert.match(list.message,/omitidos/);
 const oldToken=list.entries[0].token;await fs.rm(path.join(folder,'foto-7.png'));await scanner.refresh();await assert.rejects(scanner.resolve(oldToken));assert.equal(scanner.snapshot().entries[0].name,'foto-6.png');
 const webp=path.join(folder,'nueva.webp');await sharp(bytes).webp().toFile(webp);await scanner.refresh();assert.equal(scanner.snapshot().entries[0].name,'nueva.webp');assert.ok(await scanner.resolve(scanner.snapshot().entries[0].token));
 await fs.rename(folder,folder+'-offline');await scanner.refresh();assert.equal(scanner.snapshot().entries.length,0);assert.match(scanner.snapshot().message,/no está disponible/);await fs.rename(folder+'-offline',folder);await scanner.refresh();assert.equal(scanner.snapshot().entries[0].name,'nueva.webp');
});
test('no muestra archivos incompletos; los vuelve a validar al terminar de copiarse',async t=>{
 const{root}=await fixture(t),folder=path.join(root,'copias');await fs.mkdir(folder);const file=path.join(folder,'entrada.png');const scanner=new Scanner({interval:999999,stability:30});t.after(()=>scanner.close());await fs.writeFile(file,Buffer.from([137,80,78,71,13,10,26,10]));await scanner.setFolder(folder);assert.equal(scanner.snapshot().entries.length,0);await delay(45);await scanner.refresh();assert.equal(scanner.snapshot().entries.length,0);
 await sharp({create:{width:10,height:10,channels:3,background:'red'}}).png().toFile(file);await scanner.refresh();assert.equal(scanner.snapshot().entries.length,0);await delay(45);await scanner.refresh();assert.equal(scanner.snapshot().entries.length,1);
});
test('cambiar de carpeta no espera a una lectura anterior y descarta sus resultados tardíos',async t=>{
 const{root}=await fixture(t),a=path.join(root,'lenta'),b=path.join(root,'rapida');await fs.mkdir(a);await fs.mkdir(b);const bytes=await sharp({create:{width:10,height:10,channels:3,background:'blue'}}).png().toBuffer();await fs.writeFile(path.join(a,'lenta.png'),bytes);await fs.writeFile(path.join(b,'rapida.png'),bytes);const when=new Date(Date.now()-1000);await fs.utimes(path.join(a,'lenta.png'),when,when);await fs.utimes(path.join(b,'rapida.png'),when,when);
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);const scanner=new Scanner({interval:999999,stability:0,inspect:async file=>{if(file.includes('lenta.png')){started();await gate;}return{width:10,height:10};}});t.after(()=>scanner.close());
 await scanner.setFolder(a,{wait:false});await ready;await scanner.setFolder(b);assert.equal(scanner.snapshot().entries[0].name,'rapida.png');release();await delay(10);assert.equal(scanner.snapshot().entries[0].name,'rapida.png');
});
