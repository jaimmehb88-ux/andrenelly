'use strict';
const $ = id => document.getElementById(id);
const api = window.sath;
let state, activeDocumentId, activeTemplateId, activeFieldId, dataPath;
let timer, saveChain = Promise.resolve(), revision = 0, savedRevision = 0, closing = false;
let toastTimer, view = 'documents';
const uid = () => crypto.randomUUID();
const currentDocument = () => state.documents.find(d => d.id === activeDocumentId);
const currentTemplate = () => state.templates.find(t => t.id === activeTemplateId);
const imageURL = name => 'sath-image://local/' + name;
function el(tag, className, content) { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; }
function toast(message, error = false) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').className = error ? 'error' : ''; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, error ? 9000 : 4500); }
function saveStatus(message, kind = '') { $('save-status').className = kind; $('save-status').replaceChildren(el('i'),document.createTextNode(message)); }
function changed() {
  revision++; saveStatus('Guardando cambios…','saving'); clearTimeout(timer); timer = setTimeout(() => flush().catch(() => {}),450);
}
async function flush() {
  clearTimeout(timer);
  if (savedRevision === revision) return saveChain;
  const snapshot = structuredClone(state), target = revision;
  const task = saveChain.catch(() => {}).then(() => api.save(snapshot)).then(() => {
    savedRevision = target;
    if (savedRevision === revision) saveStatus('Todos los cambios guardados');
  }).catch(error => { saveStatus('No se pudo guardar. Reintenta antes de cerrar.','error'); toast(error.message,true); throw error; });
  saveChain = task; return task;
}
async function action(task) { try { await task(); } catch (error) { toast(error.message,true); } }
function showView(next) {
  if(next==='scans'&&!toolsAllowed())return;
  if(next==='scans'&&!toolsAllowed())return;
  view = next;
  for (const name of ['documents','templates','scans','settings']) $(name + '-view').hidden = name !== next;
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active',b.dataset.view === next));
  $('breadcrumb').textContent = {documents:'Documentos',templates:'Plantillas A4',settings:'Datos y respaldos',scans:'Escaneos Pro'}[next];
  if (next === 'templates') renderTemplates();
  if (next === 'documents') renderDocuments();
  if(next === 'scans') {renderGallery();renderScene();}
  requestAnimationFrame(resizePapers);
}
function refreshCounts() { $('document-count').textContent = state.documents.length; $('template-count').textContent = state.templates.length; }
function renderList() {
  refreshCounts(); const list = $('document-list'); list.replaceChildren();
  const query = $('search').value.toLocaleLowerCase('es');
  const documents = [...state.documents].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).filter(d => (d.title + ' ' + state.templates.find(t => t.id === d.templateId)?.name).toLocaleLowerCase('es').includes(query));
  $('list-count').textContent = documents.length;
  for (const d of documents) {
    const b = el('button','document-item' + (d.id === activeDocumentId ? ' active' : ''));
    b.append(el('strong','',d.title),el('small','doc-type',state.templates.find(t => t.id === d.templateId)?.name),el('small','',new Date(d.updatedAt).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})));
    b.onclick = () => { activeDocumentId = d.id; renderDocuments(); }; list.append(b);
  }
  if (!documents.length) list.append(el('p','no-results',query ? 'No hay coincidencias.' : 'Aquí aparecerán tus documentos.'));
}
function renderDocuments() {
  renderList(); const d = currentDocument(); $('empty-state').hidden = !!d; $('document-editor').hidden = !d;
  if (!d) return;
  const t = state.templates.find(t => t.id === d.templateId);
  $('document-title').value = d.title; $('document-template-name').textContent = t.name;
  const form = $('fields-form'); form.replaceChildren();
  for (const f of t.fields.filter(f => !f.special.startsWith('copy_'))) {
    const label = el('label','field-label',f.label); label.htmlFor = 'input-' + f.id;
    const input = el('input'); input.id = 'input-' + f.id; input.name = f.id; input.maxLength = 4000; input.value = d.values[f.id] || ''; input.placeholder = 'Escribe aquí…';
    if (f.special === 'dni') { input.maxLength = 8; input.inputMode = 'numeric'; input.pattern = '[0-9]{8}'; input.title = 'DNI de 8 dígitos'; }
    if (f.special === 'email_list') input.type = 'email';
    input.style.textTransform = f.textTransform;
    input.oninput = () => {
      input.setCustomValidity('');
      let value = input.value;
      if (f.special === 'dni') value = value.replace(/\D/g,'').slice(0,8);
      if (f.textTransform === 'uppercase') value = value.toUpperCase();
      input.value = value; d.values[f.id] = value; d.updatedAt = new Date().toISOString();
      changed(); updateDocumentPaper(); updateProgress();
    };
    label.append(input);
    if (f.special === 'dni') label.append(el('span','field-hint','8 dígitos, sin espacios.'));
    if (f.special === 'mes_list') {
      const list = el('datalist'); list.id = 'months-' + f.id;
      for (const month of ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']) { const option = el('option'); option.value = month; list.append(option); }
      input.setAttribute('list',list.id); label.append(list);
    }
    form.append(label);
  }
  form.onsubmit = event => event.preventDefault(); updateProgress();
  decorateForm();
  drawPaper($('document-paper'),t,d.values); $('document-paper').dataset.template = t.id; $('document-paper').dataset.background = String($('with-background').checked); requestAnimationFrame(resizePapers);
}
function valueFor(f,t,values) {
  const source = f.special === 'copy_papeleta' ? 'papeleta_src' : f.special === 'copy_fecha' ? 'fecha_src' : null;
  let value = values[source ? t.fields.find(field => field.special === source)?.id : f.id] || '';
  if (f.textTransform === 'uppercase') value = value.toUpperCase();
  if (f.textTransform === 'capitalize') value = value.replace(/(^|[\s-])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toUpperCase());
  return value;
}
function styleOverlay(node,f) {
  Object.assign(node.style,{left:f.left + '%',top:f.top + '%',width:f.width + '%',height:f.height + '%',fontFamily:f.fontFamily,fontSize:f.fontSize + 'px',fontWeight:f.fontWeight,color:f.color,letterSpacing:f.letterSpacing + 'px',justifyContent:{left:'flex-start',center:'center',right:'flex-end'}[f.textAlign]});
}
function drawPaper(paper,t,values,editable = false) {
  paper.replaceChildren();
  if (t.image && (editable || $('with-background').checked)) { const img = el('img','background'); img.src = imageURL(t.image); img.alt = 'Plantilla ' + t.name; img.onerror = () => toast('No se encuentra la imagen de esta plantilla. Reemplázala en Plantillas A4.',true); paper.append(img); }
  for (const f of t.fields) {
    const node = el('div','overlay' + (editable && f.id === activeFieldId ? ' selected' : ''), editable ? f.label : valueFor(f,t,values));
    node.dataset.field = f.id; styleOverlay(node,f);
    if (editable) { node.tabIndex = 0; node.setAttribute('role','button'); node.setAttribute('aria-label','Mover campo ' + f.label); node.onpointerdown = event => startDrag(event,node,f); node.onkeydown = event => {
      const delta = event.shiftKey ? 1 : .1;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault(); activeFieldId = f.id;
        f.left = Math.max(0,Math.min(100-f.width,f.left + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0)));
        f.top = Math.max(0,Math.min(100-f.height,f.top + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0)));
        changed(); styleOverlay(node,f); renderFieldTools();
      } else if (event.key === 'Enter') { activeFieldId = f.id; renderTemplateEditor(); }
    }; }
    paper.append(node);
  }
}
function updateDocumentPaper() {
  const d = currentDocument(); if (!d) return; const t = state.templates.find(t => t.id === d.templateId);
  // Retain the image while typing to avoid reloading it for each keystroke.
  const paper = $('document-paper');
  if (paper.dataset.template !== t.id || paper.dataset.background !== String($('with-background').checked) || paper.children.length !== t.fields.length + (t.image && $('with-background').checked ? 1 : 0)) {
    drawPaper(paper,t,d.values); paper.dataset.template = t.id; paper.dataset.background = String($('with-background').checked);
  } else paper.querySelectorAll('.overlay').forEach(node => { const f = t.fields.find(f => f.id === node.dataset.field); node.textContent = valueFor(f,t,d.values); styleOverlay(node,f); });
}
function updateProgress() {
  const d = currentDocument(); if (!d) return;
  const fields = state.templates.find(t => t.id === d.templateId).fields.filter(f => !f.special.startsWith('copy_'));
  const percent = fields.length ? Math.round(fields.filter(f => (d.values[f.id] || '').trim()).length / fields.length*100) : 0;
  $('completion').textContent = percent + ' %'; $('progress').style.width = percent + '%';
}
function resizePapers() {
  for (const [viewport,paper] of [[$('preview-viewport'),$('document-paper')],[$('template-viewport'),$('template-paper')]]) {
    if (!viewport.clientWidth) continue;
    let scale = (viewport.clientWidth - 40) / 793.700787;
    if (paper.id === 'document-paper' && $('zoom').value !== 'fit') scale = Number($('zoom').value);
    const stage = paper.parentElement; stage.style.width = 793.700787*scale + 'px'; stage.style.height = 1122.519685*scale + 'px'; paper.style.transform = `scale(${scale})`;
  }
}
function openNewDocument(templateId) {
  $('new-template-select').replaceChildren();
  state.templates.forEach(t => { const o = el('option','',t.name); o.value = t.id; $('new-template-select').append(o); });
  if (templateId) $('new-template-select').value = templateId;
  $('new-title').value = ''; $('new-dialog').showModal(); $('new-title').focus();
}
function confirmDelete(title,description) {
  return new Promise(resolve => {
    $('confirm-title').textContent = title; $('confirm-description').textContent = description;
    const done = result => { $('confirm-dialog').close(); resolve(result); };
    $('cancel-confirm').onclick = () => done(false); $('accept-confirm').onclick = () => done(true);
    $('confirm-dialog').oncancel = event => {event.preventDefault(); done(false);}; $('confirm-dialog').showModal();
  });
}
function renderTemplates() {
  refreshCounts(); $('templates-grid').replaceChildren();
  for (const t of state.templates) {
    const card = el('div','template-card'); const thumbnail = el('div','template-thumbnail');
    if (t.image) { const img = el('img'); img.src = imageURL(t.image); img.alt = t.name; thumbnail.append(img); } else thumbnail.append(el('div','blank','＋'));
    const content = el('div','template-card-content'); content.append(el('h2','',t.name),el('p','',`${t.fields.length} campos · Formato A4`));
    const actions = el('div','template-card-actions'); const use = el('button','primary','Usar plantilla'); const edit = el('button','','Editar');
    use.onclick = () => openNewDocument(t.id); edit.onclick = () => { activeTemplateId = t.id; activeFieldId = t.fields[0]?.id; renderTemplateEditor(); $('template-editor').scrollIntoView({behavior:'smooth',block:'start'}); }; actions.append(use,edit); content.append(actions); card.append(thumbnail,content); $('templates-grid').append(card);
  }
  if (activeTemplateId) renderTemplateEditor();
}
function renderTemplateEditor() {
  const t = currentTemplate(); $('template-editor').hidden = !t; if (!t) return;
  $('template-name').value = t.name; renderFieldTools(); drawPaper($('template-paper'),t,{},true); requestAnimationFrame(resizePapers);
}
function renderFieldTools() {
  const t = currentTemplate(); if (!t) return;
  $('field-list').replaceChildren();
  for (const f of t.fields) { const b = el('button',f.id === activeFieldId ? 'active' : '',f.label); b.onclick = () => {activeFieldId = f.id;renderTemplateEditor();}; $('field-list').append(b); }
  const form = $('field-properties'); form.replaceChildren(); form.onsubmit = e => e.preventDefault();
  const f = t.fields.find(f => f.id === activeFieldId); if (!f) return;
  function property(key,label,type,options) {
    const container = el('label', ['label','special','fontFamily'].includes(key) ? 'wide' : '',label);
    const input = el(type === 'select' ? 'select' : 'input'); input.id = 'prop-' + key;
    if (options) for (const [value,name] of options) { const option = el('option','',name); option.value = value; input.append(option); }
    if (type !== 'select') input.type = type;
    if (type === 'number') { input.step = key === 'fontSize' ? '1' : '0.1'; input.min = ['width','height'].includes(key) ? '.5' : key === 'fontSize' ? '6' : '0'; input.max = key === 'fontSize' ? '72' : key === 'letterSpacing' ? '20' : '100'; }
    if (key === 'label') input.maxLength = 160;
    input.value = type === 'number' ? Number(f[key].toFixed(2)) : f[key]; input.onchange = () => {
      const value = type === 'number' ? Number(input.value) : input.value;
      if (!input.checkValidity() || (key === 'label' && !value.trim())) { input.reportValidity(); input.value = f[key]; return; }
      f[key] = value;
      f.width = Math.min(f.width,100-f.left); f.height = Math.min(f.height,100-f.top);
      if (f.width < .5) { f.width = .5; f.left = 99.5; } if (f.height < .5) {f.height = .5;f.top=99.5;}
      changed(); renderTemplateEditor();
    }; container.append(input); form.append(container);
  }
  property('label','Nombre del campo','text');
  for (const [key,name] of [['left','Izquierda (%)'],['top','Arriba (%)'],['width','Ancho (%)'],['height','Alto (%)'],['fontSize','Tamaño de letra'],['letterSpacing','Espaciado']]) property(key,name,'number');
  property('textAlign','Alineación','select',[['left','Izquierda'],['center','Centro'],['right','Derecha']]);
  property('fontWeight','Grosor','select',[['400','Normal'],['700','Negrita'],['900','Muy gruesa']]);
  property('fontFamily','Fuente','select',[['Arial, sans-serif','Arial'],['Verdana, sans-serif','Verdana'],['Helvetica, sans-serif','Helvetica'],['Consolas, monospace','Consolas'],['"Arial Black", sans-serif','Arial Black']]);
  property('color','Color','color'); property('textTransform','Texto','select',[['uppercase','MAYÚSCULAS'],['none','Original'],['capitalize','Iniciales']]);
  property('special','Tipo de campo','select',[['normal','Texto libre'],['dni','DNI de 8 dígitos'],['email_list','Correo electrónico'],['mes_list','Mes'],['papeleta_src','Número de papeleta'],['fecha_src','Fecha de papeleta'],['copy_papeleta','Copia automática: papeleta'],['copy_fecha','Copia automática: fecha']]);
  const remove = el('button','danger subtle wide','Eliminar campo'); remove.type = 'button'; remove.onclick = () => action(async () => {
    if (!await confirmDelete('¿Eliminar este campo?','Se quitará de esta plantilla y de sus documentos. Los demás campos permanecerán.')) return;
    t.fields = t.fields.filter(x => x.id !== f.id); for (const d of state.documents.filter(d => d.templateId === t.id)) delete d.values[f.id]; activeFieldId = t.fields[0]?.id; changed(); renderTemplateEditor();
  }); form.append(remove);
}
function startDrag(event,node,f) {
  if (event.button !== 0) return; event.preventDefault(); activeFieldId = f.id;
  $('template-paper').querySelectorAll('.overlay').forEach(n => n.classList.toggle('selected',n === node)); renderFieldTools();
  const box = $('template-paper').getBoundingClientRect(); const initial = {x:event.clientX,y:event.clientY,left:f.left,top:f.top}; node.setPointerCapture(event.pointerId);
  node.onpointermove = move => { f.left = Math.max(0,Math.min(100-f.width,initial.left+(move.clientX-initial.x)/box.width*100)); f.top = Math.max(0,Math.min(100-f.height,initial.top+(move.clientY-initial.y)/box.height*100)); styleOverlay(node,f); };
  const done = () => {node.onpointermove = null;node.onpointerup = null;node.onpointercancel = null;changed();renderFieldTools();}; node.onpointerup = done; node.onpointercancel = done;
}
async function output(kind) {
  const d = currentDocument(); if (!d) return;
  if (!$('fields-form').reportValidity()) {toast('Revisa los campos marcados antes de continuar.',true);return;}
  await flush(); const buttons = [$('pdf-document'),$('print-document'),$('png-document'),$('jpg-document')]; buttons.forEach(b => b.disabled = true);
  try { const result = await api.output({kind,documentId:d.id,background:$('with-background').checked}); if (result) toast(kind === 'print' ? 'Documento enviado a impresión.' : kind.toUpperCase()+' guardado correctamente.'); }
  finally {buttons.forEach(b => b.disabled = false);}
}
async function init() {
  if (!api) { saveStatus('Abre esta aplicación desde SATH Escritorio.','error'); return; }
  const loaded = await api.load(); state = loaded.state; dataPath = loaded.dataPath; accessState=loaded.access; accessState=loaded.access;
  $('data-path').textContent = dataPath; $('app-version').textContent = 'Versión ' + loaded.version;
  activeDocumentId = [...state.documents].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id;
  if (loaded.recovered) toast('Se recuperó la última copia automática. Revisa tus documentos y crea un respaldo.',true);
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => showView(b.dataset.view));
  $('new-document').onclick = $('empty-new').onclick = () => openNewDocument();
  $('cancel-new').onclick = () => $('new-dialog').close();
  $('new-form').onsubmit = event => {
    event.preventDefault(); if (!event.target.reportValidity()) return;
    if (state.documents.length >= 2000) {toast('Se alcanzó el límite de 2000 documentos. Respalda y elimina los que ya no necesitas.',true);return;}
    const d = {id:uid(),title:$('new-title').value.trim(),templateId:$('new-template-select').value,values:{},updatedAt:new Date().toISOString()};
    if (!d.title) return;
    state.documents.push(d); activeDocumentId = d.id; changed(); $('new-dialog').close(); showView('documents');
  };
  $('search').oninput = renderList;
  $('document-title').onchange = event => { const d = currentDocument();const title=event.target.value.trim();if (!title) {event.target.value=d.title;return;} d.title=title;d.updatedAt=new Date().toISOString();changed();renderList(); };
  $('duplicate-document').onclick = () => { if(state.documents.length>=2000){toast('Límite de 2000 documentos alcanzado.',true);return;}const d=structuredClone(currentDocument()); d.id=uid();d.title=(d.title.slice(0,150)+' (copia)');d.updatedAt=new Date().toISOString();state.documents.push(d);activeDocumentId=d.id;changed();renderDocuments(); };
  $('delete-document').onclick = () => action(async () => {const d=currentDocument();if (!await confirmDelete('¿Eliminar este documento?',d.title + ' se eliminará de este equipo. Esta acción no modifica la plantilla.'))return;state.documents=state.documents.filter(x=>x.id!==d.id);activeDocumentId=state.documents[0]?.id;changed();renderDocuments();});
  $('with-background').onchange = updateDocumentPaper; $('zoom').onchange=resizePapers;
  $('pdf-document').onclick=()=>action(()=>output('pdf'));$('print-document').onclick=()=>action(()=>output('print'));$('png-document').onclick=()=>action(()=>output('png'));$('jpg-document').onclick=()=>action(()=>output('jpg'));
  $('new-template').onclick=()=>{if(!toolsAllowed())return;if(!toolsAllowed())return;if(state.templates.length>=100){toast('Límite de 100 plantillas alcanzado.',true);return;}const t={id:uid(),name:'Nueva plantilla',image:null,fields:[]};state.templates.push(t);activeTemplateId=t.id;activeFieldId=null;changed();renderTemplates();};
  $('template-name').onchange=e=>{const name=e.target.value.trim();if(!name){e.target.value=currentTemplate().name;return;}currentTemplate().name=name;changed();renderTemplates();};
  $('close-template').onclick=()=>{activeTemplateId=null;$('template-editor').hidden=true;};
  $('import-image').onclick=()=>action(async()=>{const t=currentTemplate();const name=await api.importImage();if(name){t.image=name;changed();renderTemplates();toast('Imagen guardada en la carpeta del programa.');}});
  $('duplicate-template').onclick=()=>{if(!toolsAllowed())return;if(!toolsAllowed())return;if(state.templates.length>=100){toast('Límite de 100 plantillas alcanzado.',true);return;}const t=structuredClone(currentTemplate());t.id=uid();t.name=t.name.slice(0,150)+' (copia)';state.templates.push(t);activeTemplateId=t.id;changed();renderTemplates();};
  $('delete-template').onclick=()=>action(async()=>{const t=currentTemplate();if(state.templates.length===1){toast('Conserva al menos una plantilla.',true);return;}if(state.documents.some(d=>d.templateId===t.id)){toast('Esta plantilla tiene documentos. Elimínalos primero o conserva la plantilla.',true);return;}if(!await confirmDelete('¿Eliminar esta plantilla?',t.name+' se quitará de la biblioteca.'))return;state.templates=state.templates.filter(x=>x.id!==t.id);activeTemplateId=null;changed();renderTemplates();$('template-editor').hidden=true;});
  $('add-field').onclick=()=>{const t=currentTemplate();if(t.fields.length>=200){toast('Máximo 200 campos por plantilla.',true);return;}const f={id:uid(),label:'Nuevo campo',left:15,top:25,width:35,height:3,fontFamily:'Arial, sans-serif',fontSize:14,fontWeight:'400',textAlign:'left',textTransform:'uppercase',letterSpacing:0,color:'#000000',special:'normal'};t.fields.push(f);activeFieldId=f.id;changed();renderTemplateEditor();};
  $('open-folder').onclick=()=>action(async()=>{const error=await api.openFolder();if(error)throw new Error(error);});
  $('backup').onclick=()=>action(async()=>{await flush();const folder=await api.backup();if(folder)toast('Respaldo completo guardado en:\n'+folder);});
  $('restore').onclick=()=>action(async()=>{await flush();const restored=await api.restore();if(restored){state=restored;activeDocumentId=state.documents[0]?.id;activeTemplateId=null;revision++;savedRevision=revision;$('document-paper').dataset.template='';renderDocuments();renderTemplates();resetScansAfterRestore();toast('Respaldo restaurado. Se conservó una copia de los datos anteriores.');}});
  api.onClose(()=>action(async()=>{if(closing)return;closing=true;try{await flush();await api.close();}finally{closing=false;}}));
  window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();action(async()=>{await flush();toast('Cambios guardados.');});}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='n'){event.preventDefault();if(!$('new-dialog').open)openNewDocument();}});
  new ResizeObserver(resizePapers).observe($('app-shell')||document.querySelector('.app-shell'));
  initAutocomplete(); initScans(); initAccessUI(); initAccessUI();
  if(loaded.migrated)toast('Datos actualizados a la versión 2. Se creó un respaldo completo de la versión anterior.');
  renderDocuments(); refreshCounts();
}
init().catch(error=>{saveStatus('No se pudo cargar la información.','error');toast(error.message,true);});
