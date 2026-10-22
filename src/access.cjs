const fs = require('node:fs/promises');
const path = require('node:path');
const {randomBytes, scrypt, timingSafeEqual, randomUUID} = require('node:crypto');
const {promisify, isDeepStrictEqual} = require('node:util');
const derive = promisify(scrypt);

// Installation settings are owned by the main process, outside renderer state.
class Access {
  constructor(root) { this.file=path.join(root,'acceso.json'); this.developer=false; this.failures=0; this.retryAt=0; }
  async initialize() {
    try { this.config=JSON.parse(await fs.readFile(this.file,'utf8')); }
    catch(error) {
      if(error.code!=='ENOENT')throw error;
      this.config={version:1,pro:false,...await this.passwordRecord('user2')};
      await this.persist(this.config);
    }
    if(this.config.version!==1 || typeof this.config.pro!=='boolean' || !/^[a-f0-9]{32}$/.test(this.config.salt) || !/^[a-f0-9]{128}$/.test(this.config.hash))throw new Error('Configuración de acceso dañada. Conserva acceso.json y restaura su respaldo.');
    return this.status();
  }
  async passwordRecord(password) {
    if(typeof password!=='string'||password.length<4||password.length>256)throw new Error('La contraseña debe tener entre 4 y 256 caracteres.');
    const salt=randomBytes(16).toString('hex');
    return {salt,hash:(await derive(password,salt,64)).toString('hex')};
  }
  async persist(config) {
    const temp=this.file+'.'+randomUUID()+'.tmp';
    try { await fs.writeFile(temp,JSON.stringify(config,null,2),{flag:'wx',mode:0o600}); await fs.rename(temp,this.file); }
    finally { await fs.rm(temp,{force:true}); }
    this.config=config;
  }
  status() { return {developer:this.developer,pro:this.config.pro}; }
  requireDeveloper() { if(!this.developer)throw new Error('Se requiere una sesión de desarrollador autenticada.'); }
  requireTools() { if(!this.developer&&!this.config.pro)throw new Error('Esta función requiere modo Pro o una sesión de desarrollador.'); }
  async login(password) {
    if(Date.now()<this.retryAt)throw new Error('Demasiados intentos. Espera unos segundos.');
    if(typeof password!=='string'||password.length>256)throw new Error('Contraseña incorrecta.');
    const actual=await derive(password,this.config.salt,64);
    if(!timingSafeEqual(actual,Buffer.from(this.config.hash,'hex'))) {
      this.failures++;if(this.failures>=5)this.retryAt=Date.now()+3000;
      throw new Error('Contraseña incorrecta.');
    }
    this.failures=0;this.developer=true;return this.status();
  }
  logout() { this.developer=false;return this.status(); }
  async changePassword(password) { this.requireDeveloper();const record=await this.passwordRecord(password);await this.persist({...this.config,...record});return true; }
  async setPro(enabled) { this.requireDeveloper();if(typeof enabled!=='boolean')throw new Error('Opción Pro no válida.');await this.persist({...this.config,pro:enabled});return this.status(); }
  authorizeSave(current,incoming) {
    if(this.developer||this.config.pro)return;
    if(!isDeepStrictEqual(current.projects,incoming.projects)||current.settings.scanFolder!==incoming.settings.scanFolder) this.requireTools();
    const ids=new Set(current.templates.map(t=>t.id));
    if(incoming.templates.some(t=>!ids.has(t.id)))this.requireTools();
  }
}
module.exports={Access};
