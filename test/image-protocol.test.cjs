const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {registerImageProtocol}=require('../src/image-protocol.cjs');
test('Electron 22: imágenes, miniaturas, permisos y archivos ausentes',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sath-protocol-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const file=path.join(directory,'original.png');await fs.writeFile(file,Buffer.from('imagen'));
  let handler;
  registerImageProtocol({protocol:{registerBufferProtocol:(scheme,fn)=>{assert.equal(scheme,'sath-image');handler=fn;}}},'sath-image',async request=>{
    if(request.url==='denied')throw Object.assign(new Error('No permitido'),{statusCode:403});
    if(request.url==='thumb')return {data:Buffer.from('miniatura'),mimeType:'image/webp'};
    return {path:request.url==='missing'?file+'.missing':file};
  });
  const get=url=>new Promise(resolve=>handler({url},resolve));
  const original=await get('original');assert.equal(original.statusCode,200);assert.equal(original.mimeType,'image/png');assert.equal(original.data.toString(),'imagen');
  const thumb=await get('thumb');assert.equal(thumb.mimeType,'image/webp');assert.equal(thumb.data.toString(),'miniatura');
  assert.equal((await get('denied')).statusCode,403);assert.equal((await get('missing')).statusCode,404);
});
test('Electron actual conserva la carga de archivo y responde a errores',async()=>{
  let handler;
  registerImageProtocol({protocol:{handle:(_,fn)=>handler=fn},net:{fetch:url=>url}},'sath-image',async request=>{
    if(request.url==='denied')throw Object.assign(new Error(),{statusCode:403});
    if(request.url==='thumb')return {data:Buffer.from('miniatura'),mimeType:'image/webp'};
    return {path:path.resolve('imagen.png')};
  });
  assert.match(await handler({url:'original'}),/^file:/);
  assert.equal((await handler({url:'denied'})).status,403);
  const thumb=await handler({url:'thumb'});assert.equal(thumb.headers.get('content-type'),'image/webp');assert.equal(await thumb.text(),'miniatura');
});
