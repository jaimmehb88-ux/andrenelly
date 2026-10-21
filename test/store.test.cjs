const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {Store,validate,imageType} = require('../src/store.cjs');
const {printHTML,valueFor} = require('../src/document.cjs');
const assets = path.resolve(__dirname,'../assets');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'sath-store-')); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const store = new Store(path.join(root,'datos'),assets); const {state}=await store.initialize(); return {store,state,root};
}
test('inicia con plantillas sin valores personales y persiste documentos',async t=>{
  const {store,state}=await fixture(t); assert.equal(state.templates.length,2);assert.deepEqual(state.documents,[]);
  state.documents.push({id:'doc_1',templateId:state.templates[0].id,title:'Solicitud',updatedAt:new Date().toISOString(),values:{p_1:'12345'}});
  await store.save(state);const loaded=await store.initialize();assert.equal(loaded.state.documents[0].values.p_1,'12345');assert.equal(loaded.recovered,false);
  assert.equal(imageType(await fs.readFile(path.join(store.images,state.templates[0].image))),'jpg');
});
test('rechaza rutas, referencias huérfanas, identificadores duplicados y medidas fuera de A4',async t=>{
  const {state}=await fixture(t);
  const cases=[s=>s.templates[0].image='../otro.jpg',s=>delete s.templates[0].id,s=>s.templates[0].fields[0].left=99,s=>s.templates.push(structuredClone(s.templates[0])),s=>s.documents.push({id:'doc',templateId:'inexistente',title:'Prueba',updatedAt:new Date().toISOString(),values:{}})];
  for(const mutate of cases){const clone=structuredClone(state);mutate(clone);assert.throws(()=>validate(clone));}
});
test('recupera la copia automática y conserva el archivo dañado',async t=>{
  const {store,state}=await fixture(t);await store.save(state);await fs.writeFile(store.file,'datos dañados');
  const loaded=await store.initialize();assert.equal(loaded.recovered,true);assert.equal(loaded.state.templates.length,2);
  assert.ok((await fs.readdir(store.root)).some(name=>name.includes('.damaged-')));
});
test('no sobrescribe datos cuando tampoco se puede leer el respaldo automático',async t=>{
  const {store}=await fixture(t);await fs.writeFile(store.file,'archivo dañado');await assert.rejects(store.initialize(),/No se pueden leer/);assert.equal(await fs.readFile(store.file,'utf8'),'archivo dañado');
});
test('respaldo completo y restauración incluyen imágenes, remapean nombres y recuperan documentos',async t=>{
  const {store,state,root}=await fixture(t);
  state.documents.push({id:'doc',templateId:state.templates[0].id,title:'Original',updatedAt:new Date().toISOString(),values:{p_1:'5678'}});
  await store.save(state);const backup=await store.backup(state,root);
  state.documents=[];await store.save(state);
  const restored=await store.restore(path.join(backup,'documentos.json'));assert.equal(restored.documents[0].title,'Original');assert.notEqual(restored.templates[0].image,'plantilla-1.jpg');
  assert.deepEqual(await fs.readFile(path.join(store.images,restored.templates[0].image)),await fs.readFile(path.join(assets,'plantilla-1.jpg')));
});
test('un respaldo sin imagen no sustituye los datos actuales',async t=>{
  const {store,state,root}=await fixture(t);const backup=await store.backup(state,root);await fs.rm(path.join(backup,'imagenes','plantilla-1.jpg'));
  const before=await fs.readFile(store.file,'utf8');await assert.rejects(store.restore(path.join(backup,'documentos.json')));assert.equal(await fs.readFile(store.file,'utf8'),before);
});
test('impresión copia campos enlazados, escapa texto y permite quitar el fondo',async t=>{
  const {state,store}=await fixture(t);const template=state.templates[0];const copy=template.fields.find(f=>f.special==='copy_papeleta');const source=template.fields.find(f=>f.special==='papeleta_src');const values={[source.id]:'<script>123</script>'};
  assert.equal(valueFor(copy,template,values),'<SCRIPT>123</SCRIPT>');
  const html=printHTML(template,values,store.images,true);assert.ok(html.includes('&lt;SCRIPT&gt;123'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('<img'));assert.ok(!printHTML(template,values,store.images,false).includes('<img'));
});

test('iniciales respetan las letras acentuadas',()=>{assert.equal(valueFor({id:'nombre',special:'normal',textTransform:'capitalize'},{fields:[]},{nombre:'maría pérez'}),'María Pérez');});
