const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const imageName = /^(?:plantilla-[12]|[a-f0-9-]{36})\.(?:jpg|png)$/;
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
function check(value, message) { if (!value) throw new Error(message); }
function text(value, limit = 4000) { return typeof value === 'string' && value.length <= limit; }
function validate(state) {
  check(state && state.version === 1, 'Formato de datos no compatible.');
  check(Array.isArray(state.templates) && state.templates.length > 0 && state.templates.length <= 100, 'Se requieren entre 1 y 100 plantillas.');
  const templateIds = new Set();
  for (const t of state.templates) {
    check(t && typeof t.id === 'string' && idPattern.test(t.id) && !templateIds.has(t.id), 'Identificador de plantilla no válido o duplicado.');
    templateIds.add(t.id);
    check(text(t.name, 160) && t.name.trim(), 'La plantilla necesita un nombre.');
    check(t.image === null || (typeof t.image === 'string' && imageName.test(t.image)), 'Nombre de imagen no permitido.');
    check(Array.isArray(t.fields) && t.fields.length <= 200, 'Máximo 200 campos por plantilla.');
    const ids = new Set();
    for (const f of t.fields) {
      check(f && typeof f.id === 'string' && idPattern.test(f.id) && !ids.has(f.id), 'Identificador de campo no válido o duplicado.'); ids.add(f.id);
      check(text(f.label, 160) && f.label.trim(), 'Cada campo necesita una etiqueta.');
      for (const key of ['left', 'top', 'width', 'height']) check(Number.isFinite(f[key]) && f[key] >= 0 && f[key] <= 100, 'Las medidas deben estar entre 0 y 100 %.');
      check(f.width >= 0.5 && f.height >= 0.5 && f.left + f.width <= 100.01 && f.top + f.height <= 100.01, 'El campo debe permanecer dentro de la página.');
      check(Number.isFinite(f.fontSize) && f.fontSize >= 6 && f.fontSize <= 72, 'Tamaño de letra entre 6 y 72.');
      check(['left','center','right'].includes(f.textAlign), 'Alineación no válida.');
      check(['none','uppercase','capitalize'].includes(f.textTransform), 'Formato de texto no válido.');
      check(/^#[0-9a-f]{6}$/i.test(f.color), 'Color no válido.');
      check(['400','500','600','700','800','900'].includes(String(f.fontWeight)), 'Peso de letra no válido.');
      check(text(f.fontFamily, 100) && /^[\w\s,"-]+$/.test(f.fontFamily), 'Fuente no válida.');
      check(Number.isFinite(f.letterSpacing) && f.letterSpacing >= 0 && f.letterSpacing <= 20, 'Espaciado no válido.');
      check(['normal','dni','email_list','mes_list','papeleta_src','fecha_src','copy_papeleta','copy_fecha'].includes(f.special), 'Tipo de campo no válido.');
    }
  }
  check(Array.isArray(state.documents) && state.documents.length <= 2000, 'Máximo 2000 documentos.');
  const documentIds = new Set();
  for (const d of state.documents) {
    check(d && typeof d.id === 'string' && idPattern.test(d.id) && !documentIds.has(d.id), 'Identificador de documento no válido o duplicado.'); documentIds.add(d.id);
    check(templateIds.has(d.templateId), 'El documento utiliza una plantilla inexistente.');
    check(text(d.title, 160) && d.title.trim(), 'El documento necesita un nombre.');
    check(text(d.updatedAt, 40) && Number.isFinite(Date.parse(d.updatedAt)), 'Fecha de documento no válida.');
    check(d.values && typeof d.values === 'object' && !Array.isArray(d.values) && Object.keys(d.values).length <= 200, 'Valores no válidos.');
    for (const [key,v] of Object.entries(d.values)) check(idPattern.test(key) && text(v), 'Contenido de campo no válido o demasiado largo.');
  }
  return state;
}

class Store {
  constructor(root, assets) { this.root = root; this.assets = assets; this.images = path.join(root, 'imagenes'); this.file = path.join(root, 'documentos.json'); }
  async initialize() {
    await fs.mkdir(this.images, { recursive: true });
    for (const name of ['plantilla-1.jpg', 'plantilla-2.jpg']) {
      try { await fs.copyFile(path.join(this.assets, name), path.join(this.images, name), require('node:fs').constants.COPYFILE_EXCL); }
      catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    try { return { state: validate(JSON.parse(await fs.readFile(this.file, 'utf8'))), recovered: false }; }
    catch (e) {
      if (e.code === 'ENOENT') {
        const state = validate({ version: 1, templates: JSON.parse(await fs.readFile(path.join(this.assets, 'templates.json'), 'utf8')), documents: [] });
        await this.save(state, false); return { state, recovered: false };
      }
      try {
        const state = validate(JSON.parse(await fs.readFile(this.file + '.bak', 'utf8')));
        // Preserve the damaged file for diagnosis before restoring the last good snapshot.
        await fs.copyFile(this.file, this.file + '.damaged-' + Date.now());
        await this.save(state, false); return { state, recovered: true };
      } catch { throw new Error('No se pueden leer los datos ni su copia automática. Conserva la carpeta datos y restaura un respaldo.'); }
    }
  }
  async save(state, preserve = true) {
    validate(state);
    for (const t of state.templates) if (t.image) await fs.access(path.join(this.images, t.image));
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    const handle = await fs.open(temporary, 'wx');
    try { await handle.writeFile(JSON.stringify(state, null, 2)); await handle.sync(); } finally { await handle.close(); }
    try {
      if (preserve) {
        try { await fs.copyFile(this.file, this.file + '.bak'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      await fs.rename(temporary, this.file);
    } finally { await fs.rm(temporary, { force: true }); }
  }
  async backup(state, destination) {
    validate(state);
    const folder = path.join(destination, 'SATH-respaldo-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0,8));
    await fs.mkdir(path.join(folder, 'imagenes'), {recursive:true});
    for (const name of new Set(state.templates.map(t => t.image).filter(Boolean))) await fs.copyFile(path.join(this.images,name),path.join(folder,'imagenes',name));
    await fs.writeFile(path.join(folder,'documentos.json'), JSON.stringify(state,null,2));
    return folder;
  }
  async restore(file) {
    const stat = await fs.lstat(file); check(stat.isFile() && stat.size <= 20 * 1024 * 1024, 'Archivo de respaldo demasiado grande o no válido.');
    const state = validate(JSON.parse(await fs.readFile(file, 'utf8')));
    const remap = new Map(); const pending = [];
    for (const t of state.templates) {
      if (!t.image) continue;
      if (!remap.has(t.image)) {
        const source = path.join(path.dirname(file), 'imagenes', t.image);
        const stat = await fs.lstat(source); check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 30*1024*1024, 'Imagen de respaldo no válida.');
        const bytes = await fs.readFile(source); check(imageType(bytes), 'El respaldo contiene una imagen no válida.');
        const name = randomUUID() + '.' + imageType(bytes); remap.set(t.image,name); pending.push({name,bytes});
      }
      t.image = remap.get(t.image);
    }
    for (const p of pending) await fs.writeFile(path.join(this.images,p.name),p.bytes,{flag:'wx'});
    await this.save(state); return state;
  }
}
function imageType(bytes) {
  if (bytes.length > 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  return null;
}
module.exports = {Store, validate, imageName, imageType};
