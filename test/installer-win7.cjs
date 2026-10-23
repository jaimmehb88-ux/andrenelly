const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {_electron:electron}=require('playwright-core');
const {setTimeout:delay}=require('node:timers/promises');
const root=path.resolve(__dirname,'..');
function execute(file,args){return new Promise((resolve,reject)=>{const child=spawn(file,args,{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Código de instalación: '+code)));});}
(async()=>{
  if(process.platform!=='win32')throw new Error('Esta prueba requiere Windows.');
  const arch=process.env.SATH_TARGET_ARCH;if(!['ia32','x64'].includes(arch))throw new Error('Arquitectura no válida.');
  const out=path.join(root,'.test-installed-win7');await fs.mkdir(out);
  const program=path.join(out,'programa'),data=path.join(program,'datos'),exe=path.join(program,'SATH Escritorio.exe');
  const installer=path.join(root,'dist',`SATH-Escritorio-3.0.0-Win7-${arch}-Instalador.exe`);
  await execute(installer,['/S','/D='+program]);
  const pe=await fs.readFile(exe),header=pe.readUInt32LE(0x3c);assert.equal(pe.readUInt16LE(header+4),arch==='ia32'?0x14c:0x8664);
  let app;
  try{
    app=await electron.launch({executablePath:exe,args:[],timeout:45000});
    const runtime=await app.evaluate(()=>({arch:process.arch,electron:process.versions.electron}));
    assert.equal(runtime.arch,arch);assert.equal(runtime.electron,'22.3.27');
    const page=await app.firstWindow();await page.locator('#app-version').waitFor();
    const loaded=await page.evaluate(()=>window.sath.load());assert.equal(loaded.version,'3.0.0');
    await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});app=null;
  }finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}}
  const original=await fs.readFile(path.join(data,'documentos.json'));
  await fs.writeFile(path.join(data,'conservar.txt'),'DATOS DEL USUARIO');
  await execute(installer,['/S','/D='+program]);
  assert.deepEqual(await fs.readFile(path.join(data,'documentos.json')),original);
  await execute(path.join(program,'Desinstalar SATH Escritorio.exe'),['/S']);
  for(let i=0;i<100;i++){
    try{await fs.access(exe);}catch{break;}
    await delay(150);
  }
  await assert.rejects(fs.access(exe));await assert.rejects(fs.access(path.join(program,'resources')));
  assert.deepEqual(await fs.readFile(path.join(data,'documentos.json')),original);
  assert.equal(await fs.readFile(path.join(data,'conservar.txt'),'utf8'),'DATOS DEL USUARIO');
  console.log(`PASS: ${arch}, Electron 22, instalación, reinstalación y desinstalación conservando datos.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
