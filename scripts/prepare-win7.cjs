// Isolate the legacy runtime and lockfile from the current Windows 10/11 build.
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const arch=process.argv[2];
  if(!['x64','ia32'].includes(arch))throw new Error('Uso: node scripts/prepare-win7.cjs x64|ia32');
  const root=path.resolve(__dirname,'..'),out=path.join(root,'.win7-build');
  // Refuse to overwrite an existing staging directory or any user's data.
  await fs.mkdir(out);
  for(const directory of ['src','assets','build','test'])await fs.cp(path.join(root,directory),path.join(out,directory),{recursive:true,errorOnExist:true,force:false});
  const current=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  const legacy=JSON.parse(await fs.readFile(path.join(root,'compat/win7/package.json'),'utf8'));
  if(current.version!==legacy.version)throw new Error('Actualiza la versión del perfil Windows 7.');
  legacy.scripts={...current.scripts,'dist:win':`electron-builder --win nsis --${arch} --publish never`};
  legacy.build={...current.build,npmRebuild:false,electronVersion:legacy.devDependencies.electron};
  legacy.build.win={...current.build.win,target:[{target:'nsis',arch:[arch]}],artifactName:`SATH-Escritorio-\${version}-Win7-${arch}-Instalador.\${ext}`};
  await fs.writeFile(path.join(out,'package.json'),JSON.stringify(legacy,null,2)+'\n');
  await fs.copyFile(path.join(root,'compat/win7/package-lock.json'),path.join(out,'package-lock.json'));
  let installer=await fs.readFile(path.join(out,'build/windows.nsi'),'utf8');
  if(arch==='ia32'){
    installer=installer.replace(/  \$\{IfNot\} \$\{RunningX64\}[\s\S]*?  \$\{EndIf\}\n/,'');
    installer=installer.replaceAll('SetRegView 64','SetRegView 32').replaceAll('win-unpacked','win-ia32-unpacked');
  }
  installer=installer.replace('!include "FileFunc.nsh"','!include "FileFunc.nsh"\n!include "WinVer.nsh"');
  installer=installer.replace('Function .onInit','Function .onInit\n  ${IfNot} ${AtLeastWin7}\n    MessageBox MB_OK|MB_ICONSTOP "Se necesita Windows 7 SP1 o posterior."\n    Abort\n  ${EndIf}');
  await fs.writeFile(path.join(out,'build/windows.nsi'),installer);
  console.log(`Perfil Windows 7 ${arch}: ${out}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
