const fs = require('node:fs/promises');
const {watch} = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {EventEmitter} = require('node:events');
const {inspectImage} = require('./assets.cjs');
class Scanner extends EventEmitter {
  constructor({interval=2000,stability=650,inspect=inspectImage}={}) {
    super();this.folder=null;this.interval=interval;this.stability=stability;this.inspect=inspect;this.entries=[];this.cache=new Map();this.tokens=new Map();this.generation=0;this.message='Selecciona una carpeta para empezar.';this.running=null;
    this.poll=setInterval(()=>this.refresh().catch(()=>{}),interval);this.poll.unref();
  }
  async setFolder(folder,{wait=true}={}) {
    this.generation++;this.watcher?.close();this.watcher=null;this.folder=folder;this.cache.clear();this.tokens.clear();this.entries=[];this.running=null;this.again=false;
    this.message=folder?'Revisando imágenes…':'Selecciona una carpeta para empezar.';
    this.emit('change',this.snapshot());
    const pending=this.refresh();if(wait)return pending;pending.catch(()=>{});return this.snapshot();
  }
  subscribe() {
    if (!this.folder || this.watcher) return;
    try {
      const watcher=watch(this.folder,()=>{clearTimeout(this.debounce);this.debounce=setTimeout(()=>this.refresh().catch(()=>{}),250);this.debounce.unref();});
      this.watcher=watcher;watcher.on('error',()=>{watcher.close();if(this.watcher===watcher)this.watcher=null;});watcher.unref();
    } catch {this.watcher=null;}
  }
  snapshot(all=false) { return {folder:this.folder,message:this.message,total:this.entries.length,entries:(all?this.entries:this.entries.slice(0,6)).map(({file,...entry})=>entry)}; }
  async refresh() {
    if(this.running) {await this.running;if(this.again){this.again=false;return this.refresh();}return this.snapshot();}
    const running=this.scan();this.running=running;try{await running;}finally{if(this.running===running)this.running=null;}return this.snapshot();
  }
  async scan() {
    const generation=this.generation,folder=this.folder;
    if (!folder) {this.emit('change',this.snapshot());return;}
    let children;
    try {children=await fs.readdir(folder,{withFileTypes:true});this.subscribe();}
    catch {if(generation===this.generation){this.entries=[];this.tokens.clear();this.message='La carpeta no está disponible. Se volverá a comprobar automáticamente.';this.watcher?.close();this.watcher=null;this.emit('change',this.snapshot());}return;}
    if(children.length>10000){this.message='La carpeta supera 10 000 elementos. Elige una carpeta más pequeña.';this.entries=[];this.emit('change',this.snapshot());return;}
    const rows=[],seen=new Set();let pending=0,invalid=0,unsupported=0;
    for(const child of children) {
      if(generation!==this.generation){this.again=true;return;}
      if(!child.isFile()||child.isSymbolicLink())continue;
      if(!/\.(jpe?g|png|webp)$/i.test(child.name)){if(/\.(tiff?|bmp|gif|pdf|heic)$/i.test(child.name))unsupported++;continue;}
      const file=path.join(folder,child.name);seen.add(file);
      try {
        const stat=await fs.stat(file);const key=stat.size+':'+stat.mtimeMs;let cached=this.cache.get(file);
        if(!cached||cached.key!==key){if(cached?.token)this.tokens.delete(cached.token);cached={key,firstSeen:Date.now()};this.cache.set(file,cached);}
        if(Date.now()-cached.firstSeen<this.stability||Date.now()-stat.mtimeMs<this.stability){pending++;continue;}
        if(!cached.info&&!cached.error){try{const {bytes,...info}=await this.inspect(file);cached.info=info;cached.token=randomUUID();}catch(error){cached.error=error.message;}}
        if(cached.error){invalid++;continue;}
        if(generation!==this.generation){this.again=true;return;}
        const row={token:cached.token,file,name:child.name,mtimeMs:stat.mtimeMs,size:stat.size,width:cached.info.width,height:cached.info.height};
        rows.push(row);this.tokens.set(cached.token,row);
      }catch{/* Deleted while being scanned. */}
    }
    if(generation!==this.generation){this.again=true;return;}
    for(const [file,cached] of this.cache)if(!seen.has(file)){this.cache.delete(file);if(cached.token)this.tokens.delete(cached.token);}
    this.entries=rows.sort((a,b)=>b.mtimeMs-a.mtimeMs||a.name.localeCompare(b.name));
    this.message=[`${rows.length} imágenes disponibles`,pending?`${pending} esperando que termine la copia`:null,invalid?`${invalid} archivos dañados o no compatibles`:null,unsupported?`${unsupported} formatos omitidos (usa JPG, PNG o WEBP)`:null].filter(Boolean).join(' · ');
    this.emit('change',this.snapshot());
    if(pending){clearTimeout(this.retry);this.retry=setTimeout(()=>this.refresh().catch(()=>{}),this.stability+50);this.retry.unref();}
  }
  async resolve(token) {
    const row=this.tokens.get(token);if(!row)throw new Error('La imagen cambió o ya no existe. Actualiza la galería.');
    const stat=await fs.lstat(row.file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==row.size||stat.mtimeMs!==row.mtimeMs)throw new Error('La imagen se está modificando. Espera y actualiza la galería.');
    return row.file;
  }
  close(){clearInterval(this.poll);clearTimeout(this.debounce);clearTimeout(this.retry);this.watcher?.close();this.generation++;}
}
module.exports={Scanner};
