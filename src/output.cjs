const {BrowserWindow,dialog}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {pagesHTML,validateProject}=require('./scene.js');
const safeName=s=>String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,140)||'Documento';
async function sceneOutput({projects,kind,dpi=150,owner,root,images}) {
  if(!['pdf','print','png','jpg'].includes(kind)||![96,150,300].includes(dpi))throw new Error('Formato o resolución no válida.');
  if(!Array.isArray(projects)||!projects.length||projects.length>100)throw new Error('Selecciona de 1 a 100 páginas.');
  projects.forEach(validateProject);
  if(['png','jpg'].includes(kind)&&projects.length!==1)throw new Error('Las imágenes se exportan de una en una. Para un lote usa PDF.');
  let destination;
  if(kind!=='print') {
    const result=await dialog.showSaveDialog(owner,{title:'Exportar '+kind.toUpperCase(),defaultPath:safeName(projects.length===1?projects[0].title:'Escaneos seleccionados')+'.'+kind,filters:[{name:kind.toUpperCase(),extensions:[kind]}]});
    if(result.canceled)return null;
    destination=result.filePath;if(path.extname(destination).toLowerCase()!=='.'+kind)destination+='.'+kind;
    try{await fs.lstat(destination);throw new Error('El archivo ya existe. Elige otro nombre: los archivos originales no se sobrescriben.');}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const raster=['png','jpg'].includes(kind),landscape=projects[0].page.width>projects[0].page.height;
  const width=raster?Math.round((landscape?297:210)/25.4*dpi):projects[0].page.width;
  const height=raster?Math.round((landscape?210:297)/25.4*dpi):projects[0].page.height;
  const win=new BrowserWindow({show:false,width:raster?Math.min(width,1024):width,height:raster?Math.min(height,768):height,frame:false,useContentSize:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:raster,backgroundThrottling:false}});
  win.removeMenu();
  if(raster)win.setContentSize(Math.min(width,1024),Math.min(height,768));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  const temporary=path.join(root,'salida-'+randomUUID()+'.html');
  try{
    await fs.writeFile(temporary,pagesHTML(projects,name=>pathToFileURL(path.join(images,name)).href));await win.loadFile(temporary);
    if(raster)await win.webContents.insertCSS(`html,body{width:${width}px;height:${height}px;overflow:hidden}.page{width:${width}px!important;height:${height}px!important}`);
    await win.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.querySelectorAll('image'),node=>{const image=new Image();image.src=node.getAttribute('href');return image.decode();})]).then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`);
    let bytes;
    if(kind==='pdf')bytes=await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,pageSize:{width:landscape?297000:210000,height:landscape?210000:297000},margins:{top:0,bottom:0,left:0,right:0}});
    else if(raster){
      // Capture at native resolution in tiles: Windows and virtual displays can
      // clamp large hidden windows. No scaling or second composition is used.
      const viewport=await win.webContents.executeJavaScript('({width:window.innerWidth,height:window.innerHeight})');
      const tileWidth=Math.min(viewport.width,1024),tileHeight=Math.min(viewport.height,768),tiles=[];
      if(tileWidth<1||tileHeight<1)throw new Error('No se pudo iniciar la exportación de imagen.');
      for(let top=0;top<height;top+=tileHeight)for(let left=0;left<width;left+=tileWidth){
        const w=Math.min(tileWidth,width-left),h=Math.min(tileHeight,height-top);
        await win.webContents.executeJavaScript(`document.querySelector('.page').style.transform='translate(-${left}px,-${top}px)';new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
        const image=await win.webContents.capturePage({x:0,y:0,width:w,height:h},{stayHidden:true,stayAwake:true});
        const metadata=await sharp(image.toPNG()).metadata();
        if(metadata.width<w||metadata.height<h)throw new Error('La pantalla no permite capturar esta imagen a resolución nativa.');
        // HiDPI screens can return extra physical pixels. Normalize only those
        // higher-resolution captures; never enlarge a clipped/low-res tile.
        const input=metadata.width===w&&metadata.height===h?image.toPNG():await sharp(image.toPNG()).resize(w,h).png().toBuffer();
        tiles.push({input,left,top});
      }
      const result=sharp({create:{width,height,channels:3,background:'#ffffff'}}).composite(tiles);
      bytes=kind==='png'?await result.png().toBuffer():await result.jpeg({quality:95}).toBuffer();
    }
    else {await new Promise((resolve,reject)=>win.webContents.print({silent:false,printBackground:true,pageSize:'A4',landscape,margins:{marginType:'none'}},(success,reason)=>success?resolve():reject(new Error('Impresión cancelada o no disponible: '+reason))));return true;}
    await fs.writeFile(destination,bytes,{flag:'wx'});return destination;
  }finally{win.destroy();await fs.rm(temporary,{force:true});}
}
module.exports={sceneOutput};
