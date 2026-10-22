const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {Access}=require('../src/access.cjs');
const {Store}=require('../src/store.cjs');
const Scene=require('../src/scene.js');
test('acceso principal: hash, errores, cierre, reinicio, contraseña y Pro persistente',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sath-access-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 let a=new Access(root);assert.deepEqual(await a.initialize(),{developer:false,pro:false});
 const disk=await fs.readFile(a.file,'utf8');assert.ok(!disk.includes('user2'));assert.equal(JSON.parse(disk).hash.length,128);
 await assert.rejects(a.login('incorrecta'));assert.throws(()=>a.requireTools());await assert.rejects(a.setPro(true));await assert.rejects(a.changePassword('nueva'));
 await a.login('user2');await a.setPro(true);await a.changePassword('nueva-clave');a.logout();a.requireTools();await assert.rejects(a.setPro(false));
 a=new Access(root);await a.initialize();assert.equal(a.status().developer,false);assert.equal(a.status().pro,true);await assert.rejects(a.login('user2'));await a.login('nueva-clave');await a.setPro(false);a.logout();assert.throws(()=>a.requireTools());
});
test('guardar no permite introducir proyectos ni crear plantillas mediante IPC sin Pro',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sath-policy-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const a=new Access(root);await a.initialize();
 const original={projects:[],templates:[{id:'base'}],settings:{scanFolder:null},documents:[]};
 a.authorizeSave(original,{...original,documents:[{title:'Permitido'}]});
 assert.throws(()=>a.authorizeSave(original,{...original,projects:[{}]}));
 assert.throws(()=>a.authorizeSave(original,{...original,templates:[...original.templates,{id:'extra'}]}));
 assert.throws(()=>a.authorizeSave(original,{...original,settings:{scanFolder:'otra'}}));
});
test('redimensionar: ocho controles, giros, límites y ancla opuesta estable',()=>{
 for(const rotation of [0,30,90,-125,180])for(const direction of ['nw','n','ne','e','se','s','sw','w'])for(const keep of [true,false]){
  const start={x:100,y:150,width:200,height:120,rotation};const result=Scene.resizeLayer(start,direction,35,21,keep);
  assert.ok(result.width>=1&&result.height>=1);if(direction.length===2&&keep)assert.ok(Math.abs(result.width/result.height-200/120)<1e-10);
  const sx=direction.includes('e')?1:direction.includes('w')?-1:0,sy=direction.includes('s')?1:direction.includes('n')?-1:0;
  const angle=rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const anchor=l=>({x:l.x+l.width/2-c*sx*l.width/2+s*sy*l.height/2,y:l.y+l.height/2-s*sx*l.width/2-c*sy*l.height/2});
  assert.ok(Math.abs(anchor(start).x-anchor(result).x)<1e-8);assert.ok(Math.abs(anchor(start).y-anchor(result).y)<1e-8);
 }
 const start={x:100,y:100,width:200,height:100,rotation:0};
 for(const delta of [-1e6,1e6]){const result=Scene.resizeLayer(start,'se',delta,delta,true);assert.ok(result.width<=6000&&result.height>=1);assert.equal(result.width/result.height,2);}
});
test('respaldo 3.0 previo incluye datos v2, imágenes huérfanas y preferencias sin cambios',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sath-upgrade-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const store=new Store(root,path.resolve('assets'));const {state}=await store.initialize();state.settings.autocomplete.history=true;await store.save(state);
 await fs.writeFile(path.join(store.images,'conservar-original.txt'),'sin referencia');await fs.writeFile(path.join(root,'preferencias.json'),'configuración');
 const before=await fs.readFile(store.file);const folder=await store.backupForUpgrade('3.0.0');assert.deepEqual(await fs.readFile(path.join(folder,'documentos.json')),before);
 assert.equal(await fs.readFile(path.join(folder,'imagenes','conservar-original.txt'),'utf8'),'sin referencia');assert.equal(await fs.readFile(path.join(folder,'preferencias.json'),'utf8'),'configuración');assert.deepEqual(await fs.readFile(store.file),before);assert.equal(await store.backupForUpgrade('3.0.0'),undefined);
});
test('si el respaldo 3.0 falla, conserva documentos v2 y no crea marcador de actualización',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sath-backup-failure-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const store=new Store(root,path.resolve('assets'));await store.initialize();const original=await fs.readFile(store.file);
 await fs.writeFile(path.join(root,'respaldos'),'destino bloqueado');await assert.rejects(store.backupForUpgrade('3.0.0'));
 assert.deepEqual(await fs.readFile(store.file),original);await assert.rejects(fs.access(path.join(root,'actualizacion-3.0.0.json')));
});
