'use strict';
let scanSnapshot={folder:null,message:'Selecciona una carpeta para empezar.',entries:[],total:0};
let selectedProjectId=null,selectedLayerId=null,sceneZoom='fit',scenePan=false;
let scanSelected=new Map(),sceneHistory={id:null,undo:[],redo:[]},lastGallery='',sceneBusy=false;
const projectNow=()=>state.projects.find(p=>p.id===selectedProjectId);
const layerNow=()=>projectNow()?.layers.find(l=>l.id===selectedLayerId);
function initScans(){
  const section=el('section');section.id='scans-view';section.hidden=true;
  section.innerHTML=`<div class="page-heading"><div><div class="eyebrow">CAPTURA · EDICIÓN · ENTREGA</div><h1>Escaneos Pro<span class="pro-badge">2.0</span></h1><p>Tu carpeta, siempre al día. Edita sin tocar los originales.</p></div><button class="primary" id="scan-folder">Seleccionar carpeta</button></div>
  <div class="panel scan-folder-panel"><div><strong>Carpeta vigilada</strong><code id="scan-path">Sin configurar</code><p id="scan-status" role="status"></p></div><div><button id="scan-refresh">Actualizar</button><button id="scan-browse">Ver toda la carpeta</button></div></div>
  <div class="scan-section-title"><h2>Las 6 imágenes más recientes</h2><span>Por fecha de modificación · actualización automática</span></div><div id="scan-gallery" class="scan-gallery"></div>
  <div class="scan-selection"><span id="scan-selected-count">0 seleccionadas</span><button id="scan-clear">Quitar selección</button><button id="scan-batch">PDF / imprimir selección</button></div>
  <div class="panel projects-bar"><div><strong>Proyectos guardados</strong><select id="project-select" aria-label="Proyectos de escaneo guardados"></select></div><div><button id="new-project">＋ Nuevo proyecto</button><button id="scene-from-template">Cargar plantilla o documento</button><button id="delete-project" class="danger subtle">Eliminar proyecto</button></div></div>
  <div id="scene-empty" class="panel empty-state"><span class="empty-icon">▧</span><h2>Un espacio para cada edición</h2><p>Abre una imagen de la galería, crea un proyecto<br>o carga uno de tus documentos A4.</p></div>
  <div id="scene-editor" class="panel" hidden><div class="scene-title-row"><input id="project-title" maxlength="160" aria-label="Nombre del proyecto de escaneo"><span class="help">Guardado automático · originales protegidos</span></div>
    <div class="scene-toolbar"><div><button id="scene-add-image">＋ Imagen</button><button id="scene-add-text">＋ Texto</button><button id="scene-undo" title="Ctrl + Z">↶ Deshacer</button><button id="scene-redo" title="Ctrl + Mayús + Z">↷ Rehacer</button></div><div><button id="scene-pan" aria-pressed="false">✋ Desplazar</button><label>Zoom<select id="scene-zoom"><option value="fit">Ajustar</option><option value="0.5">50 %</option><option value="0.75">75 %</option><option value="1">100 %</option><option value="1.5">150 %</option><option value="2">200 %</option></select></label><label>Página<select id="scene-orientation"><option value="portrait">A4 vertical</option><option value="landscape">A4 horizontal</option></select></label></div></div>
    <div class="scene-workspace"><aside class="scene-layers"><div class="panel-title"><h2>Capas</h2><span id="layer-count">0</span></div><p class="help">Lo visible aquí se imprime y se exporta. La primera capa de la lista está encima.</p><label class="check-row"><input type="checkbox" id="scene-background"> Incluir fondo de plantilla</label><label class="check-row"><input type="checkbox" id="scene-fields"> Incluir campos del formulario</label><div id="scene-layer-list"></div><div class="layer-order"><button id="layer-up">↑ Subir</button><button id="layer-down">↓ Bajar</button></div><button id="layer-delete" class="danger subtle full">Eliminar capa</button></aside>
      <div class="scene-center"><div id="scene-viewport" class="scene-viewport"><div id="scene-stage"><div id="scene-canvas"></div><div id="scene-handles"></div></div></div><p class="help scene-tip">Arrastra una capa para moverla · flechas: 1 px · Mayús + flechas: 10 px · Ctrl + Z: deshacer</p></div>
      <aside class="scene-inspector"><h2>Propiedades</h2><form id="scene-properties"></form></aside></div>
    <div class="scene-output"><span>Exportar lo que ves</span><label>Resolución<select id="scene-dpi"><option value="96">96 ppp</option><option value="150" selected>150 ppp</option><option value="300">300 ppp</option></select></label><button data-scene-output="png">PNG</button><button data-scene-output="jpg">JPG</button><button data-scene-output="print">Imprimir</button><button class="primary" data-scene-output="pdf">↓ PDF</button></div>
  </div>`;
  document.querySelector('main').append(section);
  const send=el('button','','Editar en Escaneos Pro');send.id='document-to-scans';send.onclick=()=>{const d=currentDocument();if(!d)return;const t=state.templates.find(t=>t.id===d.templateId);newSceneProject(d.title,SathScene.templateLayers(t,d.values,uid));showView('scans');};document.querySelector('.document-toolbar .toolbar-actions').prepend(send);
  $('scan-folder').onclick=()=>action(async()=>{await flush();const result=await api.scanFolder();if(result){state.settings.scanFolder=result.folder;changed();await flush();receiveScans(result);}});
  $('scan-refresh').onclick=()=>action(async()=>receiveScans(await api.scanList()));
  $('scan-browse').onclick=()=>action(openScanBrowser);
  $('scan-clear').onclick=()=>{scanSelected.clear();lastGallery='';renderGallery();};$('scan-batch').onclick=openBatchDialog;
  $('new-project').onclick=()=>newSceneProject();$('project-select').onchange=e=>selectProject(e.target.value);
  $('delete-project').onclick=()=>action(async()=>{const p=projectNow();if(!p)return;if(!await confirmDelete('¿Eliminar este proyecto?',p.title+' se eliminará. Las imágenes originales y los demás proyectos se conservan.'))return;state.projects=state.projects.filter(x=>x.id!==p.id);selectedProjectId=state.projects[0]?.id||null;selectedLayerId=null;sceneHistory={id:null,undo:[],redo:[]};changed();renderScene();});
  $('scene-from-template').onclick=openSceneTemplateDialog;
  $('project-title').onchange=e=>{const p=projectNow(),title=e.target.value.trim();if(!title){e.target.value=p.title;return;}sceneEdit(()=>p.title=title);};
  $('scene-add-image').onclick=()=>action(async()=>{const p=projectNow();if(!p)return;const asset=await api.importAsset();if(asset){sceneEdit(()=>{const l=SathScene.imageLayer(uid(),asset.name,'Imagen',asset,p.page);p.layers.push(l);selectedLayerId=l.id;});}});
  $('scene-add-text').onclick=()=>{const p=projectNow();if(p)sceneEdit(()=>{const l=SathScene.textLayer(uid());p.layers.push(l);selectedLayerId=l.id;});};
  $('scene-undo').onclick=()=>travelScene(false);$('scene-redo').onclick=()=>travelScene(true);
  $('scene-zoom').onchange=e=>{sceneZoom=e.target.value;sizeScene();};
  $('scene-pan').onclick=()=>{scenePan=!scenePan;$('scene-pan').setAttribute('aria-pressed',String(scenePan));$('scene-viewport').classList.toggle('panning',scenePan);};
  $('scene-orientation').onchange=e=>sceneEdit(()=>{projectNow().page=e.target.value==='landscape'?{width:1123,height:794}:{width:794,height:1123};});
  for(const [id,group] of [['scene-background','background'],['scene-fields','fields']])$(id).onchange=e=>sceneEdit(()=>projectNow().layers.filter(l=>l.group===group).forEach(l=>l.visible=e.target.checked));
  $('layer-up').onclick=()=>moveLayer(1);$('layer-down').onclick=()=>moveLayer(-1);$('layer-delete').onclick=()=>action(removeLayer);
  document.querySelectorAll('[data-scene-output]').forEach(button=>button.onclick=()=>action(async()=>{
    const p=projectNow();if(!p||sceneBusy)return;await flush();setSceneBusy(true);
    try{const result=await api.sceneOutput({projectId:p.id,kind:button.dataset.sceneOutput,dpi:Number($('scene-dpi').value)});if(result)toast(button.dataset.sceneOutput==='print'?'Documento enviado a impresión.':'Exportación guardada correctamente.');}finally{setSceneBusy(false);}
  }));
  $('scene-viewport').onpointerdown=event=>{if(!scenePan||event.button!==0)return;event.preventDefault();const viewport=$('scene-viewport'),start={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(event.pointerId);viewport.onpointermove=move=>{viewport.scrollLeft=start.left-(move.clientX-start.x);viewport.scrollTop=start.top-(move.clientY-start.y);};const stop=()=>{viewport.onpointermove=null;viewport.onpointerup=null;viewport.onpointercancel=null;};viewport.onpointerup=stop;viewport.onpointercancel=stop;};
  new ResizeObserver(sizeScene).observe($('scene-viewport'));
  scanSnapshot.folder=state.settings.scanFolder;scanSnapshot.message=scanSnapshot.folder?'Revisando imágenes…':'Selecciona una carpeta para empezar.';renderGallery();
  api.onScans(receiveScans);action(async()=>receiveScans(await api.scanList()));
  window.addEventListener('keydown',event=>{
    if(view!=='scans'||document.querySelector('dialog[open]')||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
    const command=event.ctrlKey||event.metaKey;
    if(command&&event.key.toLowerCase()==='z'){event.preventDefault();travelScene(event.shiftKey);return;}
    if(command&&event.key.toLowerCase()==='y'){event.preventDefault();travelScene(true);return;}
    if(event.key==='Delete'){event.preventDefault();action(removeLayer);return;}
    const l=layerNow();if(!l||l.locked||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?10:1;
    sceneEdit(()=>{l.x=Math.max(-6000,Math.min(6000,l.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)));l.y=Math.max(-6000,Math.min(6000,l.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)));});
  });
  selectedProjectId=state.projects[0]?.id||null;renderScene();
}
function setSceneBusy(busy){sceneBusy=busy;document.querySelectorAll('[data-scene-output]').forEach(b=>b.disabled=busy);}
function receiveScans(snapshot){scanSnapshot=snapshot;renderGallery();}
function renderGallery(){
  if(!$('scan-gallery'))return;
  $('scan-path').textContent=scanSnapshot.folder||'Sin configurar';$('scan-status').textContent=scanSnapshot.message;$('scan-selected-count').textContent=scanSelected.size+' seleccionadas';$('scan-batch').disabled=!scanSelected.size;
  const fingerprint=JSON.stringify(scanSnapshot)+[...scanSelected.keys()].join(',');if(lastGallery===fingerprint)return;lastGallery=fingerprint;
  $('scan-gallery').replaceChildren();
  if(!scanSnapshot.entries.length){$('scan-gallery').append(el('div','scan-gallery-empty',scanSnapshot.folder?'No hay imágenes listas para mostrar. Los archivos nuevos aparecerán al terminar de copiarse.':'Elige la carpeta donde tu escáner guarda las imágenes.'));return;}
  for(const row of scanSnapshot.entries){const card=el('article','scan-card'+(scanSelected.has(row.token)?' selected':''));const label=el('label','scan-image-select');const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=scanSelected.has(row.token);checkbox.setAttribute('aria-label','Seleccionar '+row.name);checkbox.onchange=()=>toggleScan(row,checkbox.checked);
    const image=el('img');image.src='sath-scan://local/'+row.token+'?thumb=1';image.alt=row.name;image.loading='lazy';image.onerror=()=>{image.alt='Imagen cambió; actualiza la galería';};label.append(checkbox,image);const body=el('div','scan-card-info');const title=el('strong','',row.name);title.title=row.name;const edit=el('button','','Editar imagen');edit.onclick=()=>action(()=>openScannedImage(row));body.append(title,el('small','',new Date(row.mtimeMs).toLocaleString('es-PE')),edit);card.append(label,body);$('scan-gallery').append(card);}
}
function toggleScan(row,checked){if(checked&&scanSelected.size>=100){toast('Máximo 100 imágenes por lote.',true);lastGallery='';renderGallery();return;}if(checked)scanSelected.set(row.token,row);else scanSelected.delete(row.token);lastGallery='';renderGallery();}
async function openScanBrowser(){
  const snapshot=await api.scanList(true);if(!snapshot.folder){toast('Selecciona primero una carpeta.',true);return;}
  const dialog=el('dialog','wide-dialog');dialog.id='scan-browser';dialog.innerHTML='<div class="eyebrow">EXPLORADOR DE CARPETA</div><h2>Todas tus imágenes</h2><p>Selecciona imágenes para un PDF o abre cualquiera en el editor.</p><input id="scan-browser-search" placeholder="Buscar por nombre…" aria-label="Buscar imagen en carpeta"><div id="scan-browser-rows" class="scan-browser-rows"></div><div class="dialog-actions"><button id="scan-browser-close">Cerrar</button></div>';document.body.append(dialog);
  const draw=()=>{const query=$('scan-browser-search').value.toLowerCase();$('scan-browser-rows').replaceChildren();for(const row of snapshot.entries.filter(r=>r.name.toLowerCase().includes(query))){const item=el('div','browser-image-row');const check=el('input');check.type='checkbox';check.checked=scanSelected.has(row.token);check.setAttribute('aria-label','Seleccionar '+row.name);check.onchange=()=>{toggleScan(row,check.checked);check.checked=scanSelected.has(row.token);};const info=el('div');info.append(el('strong','',row.name),el('small','',new Date(row.mtimeMs).toLocaleString('es-PE')));const open=el('button','','Editar');open.onclick=()=>action(async()=>{dialog.close();dialog.remove();await openScannedImage(row);});item.append(check,info,open);$('scan-browser-rows').append(item);}if(!$('scan-browser-rows').children.length)$('scan-browser-rows').append(el('p','help','No hay coincidencias o las imágenes todavía se están copiando.'));};$('scan-browser-search').oninput=draw;$('scan-browser-close').onclick=()=>{dialog.close();dialog.remove();};dialog.oncancel=()=>setTimeout(()=>dialog.remove());draw();dialog.showModal();
}
function newSceneProject(title='Nuevo proyecto',layers=[]){
  if(state.projects.length>=500){toast('Máximo 500 proyectos. Respalda y elimina los antiguos.',true);return;}
  const project={id:uid(),title:title.slice(0,160),updatedAt:new Date().toISOString(),page:{...SathScene.A4},layers};state.projects.push(project);selectedProjectId=project.id;selectedLayerId=layers.at(-1)?.id||null;sceneHistory={id:project.id,undo:[],redo:[]};changed();renderScene();return project;
}
async function openScannedImage(row){const asset=await api.scanImport(row.token);const layer=SathScene.imageLayer(uid(),asset.name,row.name,asset);newSceneProject(row.name,[layer]);showView('scans');$('scene-editor').scrollIntoView({behavior:'smooth',block:'start'});}
function selectProject(id){selectedProjectId=id;selectedLayerId=null;sceneHistory={id,undo:[],redo:[]};renderScene();}
function rememberScene(before){
  const p=projectNow();if(sceneHistory.id!==p.id)sceneHistory={id:p.id,undo:[],redo:[]};sceneHistory.undo.push(before);sceneHistory.redo=[];
  while(sceneHistory.undo.length>50||sceneHistory.undo.length>1&&JSON.stringify(sceneHistory.undo).length>5_000_000)sceneHistory.undo.shift();
}
function sceneEdit(edit){const p=projectNow();if(!p)return;const before=structuredClone(p);edit();try{SathScene.validateProject(p);}catch(error){state.projects[state.projects.indexOf(p)]=before;toast(error.message,true);renderScene();return;}rememberScene(before);p.updatedAt=new Date().toISOString();changed();renderScene();}
function travelScene(redo){const p=projectNow();if(!p||sceneHistory.id!==p.id)return;const source=redo?sceneHistory.redo:sceneHistory.undo,target=redo?sceneHistory.undo:sceneHistory.redo;if(!source.length)return;target.push(structuredClone(p));const next=source.pop();next.updatedAt=new Date().toISOString();state.projects[state.projects.indexOf(p)]=next;if(!next.layers.some(l=>l.id===selectedLayerId))selectedLayerId=null;changed();renderScene();}
function renderProjectSelect(){const select=$('project-select');select.replaceChildren();for(const p of [...state.projects].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){const o=el('option','',p.title);o.value=p.id;select.append(o);}select.value=selectedProjectId||'';}
function renderScene(){
  if(!$('scene-editor'))return;renderProjectSelect();const p=projectNow();$('scene-empty').hidden=!!p;$('scene-editor').hidden=!p;$('delete-project').disabled=!p;if(!p)return;
  $('project-title').value=p.title;$('scene-orientation').value=p.page.width>p.page.height?'landscape':'portrait';
  $('scene-undo').disabled=sceneHistory.id!==p.id||!sceneHistory.undo.length;$('scene-redo').disabled=sceneHistory.id!==p.id||!sceneHistory.redo.length;
  renderSceneCanvas();renderLayerList();renderSceneProperties();requestAnimationFrame(sizeScene);
}
function renderSceneCanvas(){
  const p=projectNow();if(!p)return;$('scene-canvas').innerHTML=SathScene.renderSVG(p,imageURL);$('scene-handles').replaceChildren();
  for(const l of p.layers.filter(l=>l.visible)){const handle=el('div','scene-handle'+(l.id===selectedLayerId?' selected':'')+(l.locked?' locked':''));handle.dataset.layer=l.id;handle.tabIndex=0;handle.setAttribute('role','button');handle.setAttribute('aria-label','Seleccionar capa '+l.name);Object.assign(handle.style,{left:l.x+'px',top:l.y+'px',width:l.width+'px',height:l.height+'px',transform:`rotate(${l.rotation}deg)`});handle.onpointerdown=e=>dragSceneLayer(e,l,handle);handle.onfocus=()=>{if(selectedLayerId!==l.id){selectedLayerId=l.id;renderLayerList();renderSceneProperties();$('scene-handles').querySelectorAll('.scene-handle').forEach(n=>n.classList.toggle('selected',n.dataset.layer===l.id));}};handle.onkeydown=e=>{if(e.key==='Enter'){selectedLayerId=l.id;renderScene();}};$('scene-handles').append(handle);}
}
function sizeScene(){const p=projectNow(),viewport=$('scene-viewport');if(!p||!viewport?.clientWidth)return;const scale=sceneZoom==='fit'?Math.min((viewport.clientWidth-52)/p.page.width,(viewport.clientHeight-44)/p.page.height,1):Number(sceneZoom);const stage=$('scene-stage');stage.style.width=p.page.width*scale+'px';stage.style.height=p.page.height*scale+'px';for(const id of ['scene-canvas','scene-handles'])Object.assign($(id).style,{width:p.page.width+'px',height:p.page.height+'px',transform:`scale(${scale})`});}
function dragSceneLayer(event,l,handle){
  if(event.button!==0||scenePan)return;event.preventDefault();selectedLayerId=l.id;renderLayerList();renderSceneProperties();$('scene-handles').querySelectorAll('.scene-handle').forEach(n=>n.classList.toggle('selected',n===handle));if(l.locked)return;
  const p=projectNow(),before=structuredClone(p),scale=$('scene-canvas').getBoundingClientRect().width/p.page.width,start={x:event.clientX,y:event.clientY,left:l.x,top:l.y};handle.setPointerCapture(event.pointerId);
  handle.onpointermove=move=>{l.x=Math.max(-6000,Math.min(6000,start.left+(move.clientX-start.x)/scale));l.y=Math.max(-6000,Math.min(6000,start.top+(move.clientY-start.y)/scale));handle.style.left=l.x+'px';handle.style.top=l.y+'px';$('scene-canvas').innerHTML=SathScene.renderSVG(p,imageURL);};
  const done=()=>{handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;if(l.x!==start.left||l.y!==start.top){rememberScene(before);p.updatedAt=new Date().toISOString();changed();}renderSceneProperties();};handle.onpointerup=done;handle.onpointercancel=done;
}
function renderLayerList(){
  const p=projectNow();$('scene-layer-list').replaceChildren();$('layer-count').textContent=p.layers.length;
  for(const l of [...p.layers].reverse()){
    const row=el('div','layer-row'+(l.id===selectedLayerId?' selected':''));const check=el('input');check.type='checkbox';check.checked=l.visible;check.setAttribute('aria-label','Incluir '+l.name);check.onchange=()=>sceneEdit(()=>l.visible=check.checked);
    const select=el('button','layer-name',(l.type==='image'?'▧ ':'T ')+l.name);select.title=l.name;select.onclick=()=>{selectedLayerId=l.id;renderScene();};const lock=el('button','layer-lock',l.locked?'🔒':'○');lock.setAttribute('aria-label',(l.locked?'Desbloquear ':'Bloquear ')+l.name);lock.onclick=()=>sceneEdit(()=>l.locked=!l.locked);row.append(check,select,lock);$('scene-layer-list').append(row);
  }
  for(const [id,group]of[['scene-background','background'],['scene-fields','fields']]){const layers=p.layers.filter(l=>l.group===group);$(id).disabled=!layers.length;$(id).checked=layers.length>0&&layers.every(l=>l.visible);$(id).indeterminate=layers.some(l=>l.visible)&&!layers.every(l=>l.visible);}
  const l=layerNow(),index=p.layers.indexOf(l);$('layer-up').disabled=!l||l.locked||index===p.layers.length-1;$('layer-down').disabled=!l||l.locked||index===0;$('layer-delete').disabled=!l||l.locked;
}
function moveLayer(direction){const p=projectNow(),l=layerNow();if(!p||!l||l.locked)return;const index=p.layers.indexOf(l),next=index+direction;if(next<0||next>=p.layers.length)return;sceneEdit(()=>[p.layers[index],p.layers[next]]=[p.layers[next],p.layers[index]]);}
async function removeLayer(){const p=projectNow(),l=layerNow();if(!p||!l||l.locked)return;if(!await confirmDelete('¿Eliminar esta capa?',l.name+' se quitará del proyecto. El archivo original se conserva y puedes deshacer esta acción.'))return;sceneEdit(()=>{p.layers=p.layers.filter(x=>x.id!==l.id);selectedLayerId=null;});}
function renderSceneProperties(){
  const form=$('scene-properties');form.replaceChildren();form.onsubmit=e=>e.preventDefault();const l=layerNow();if(!l){form.append(el('p','help','Selecciona una capa en la hoja o en la lista para editarla.'));return;}
  if(l.locked)form.append(el('p','help wide','Esta capa está bloqueada. Desbloquéala en la lista para editarla.'));
  function property(key,label,type,{min,max,step=1,options,wide=false}={}){
    const container=el('label',wide?'wide':'',label),input=el(type==='select'?'select':type==='textarea'?'textarea':'input');input.id='layer-'+key;if(type!=='select'&&type!=='textarea')input.type=type;if(type==='textarea'){input.rows=4;input.maxLength=10000;}if(type==='text'){input.maxLength=160;input.required=true;}
    if(type==='number'||type==='range'){input.required=true;input.min=min;input.max=max;input.step=step;}if(options)for(const[value,name]of options){const o=el('option','',name);o.value=value;input.append(o);}
    input.value=typeof l[key]==='number'?Number(l[key].toFixed(2)):l[key];input.disabled=l.locked;
    input.onchange=()=>{if(!input.checkValidity()){input.reportValidity();input.value=l[key];return;}sceneEdit(()=>l[key]=['number','range'].includes(type)?Number(input.value):input.value);};container.append(input);form.append(container);
  }
  property('name','Nombre de capa','text',{wide:true});
  for(const[key,label,min,max]of[['x','X (px)',-6000,6000],['y','Y (px)',-6000,6000],['width','Ancho (px)',1,6000],['height','Alto (px)',1,6000]])property(key,label,'number',{min,max,step:.1});
  property('rotation','Giro / enderezado (°)','number',{min:-180,max:180,step:.1,wide:true});
  const rotate=el('div','rotation-tools wide');for(const[delta,name]of[[-90,'↶ 90°'],[90,'↷ 90°']]){const b=el('button','',name);b.type='button';b.disabled=l.locked;b.onclick=()=>sceneEdit(()=>l.rotation=((l.rotation+delta+540)%360)-180);rotate.append(b);}form.append(rotate);
  property('opacity','Opacidad (0 a 1)','number',{min:0,max:1,step:.05,wide:true});
  if(l.type==='text'){
    property('text','Contenido','textarea',{wide:true});property('fontFamily','Fuente','select',{wide:true,options:['Arial','Verdana','Consolas','Georgia','Arial Black','Helvetica'].map(v=>[v,v])});property('fontSize','Tamaño','number',{min:6,max:200});property('fontWeight','Grosor','select',{options:[['400','Normal'],['700','Negrita'],['900','Muy gruesa']]});property('color','Color','color');property('align','Alineación','select',{options:[['left','Izquierda'],['center','Centro'],['right','Derecha']]});property('letterSpacing','Espaciado','number',{min:0,max:20,step:.1,wide:true});
  }else{
    property('brightness','Brillo (%)','number',{min:0,max:200});property('contrast','Contraste (%)','number',{min:0,max:200});property('grayscale','Escala de grises (%)','number',{min:0,max:100,wide:true});
    const crop=el('button','wide','Recortar imagen…');crop.type='button';crop.id='layer-crop';crop.disabled=l.locked;crop.onclick=openCropDialog;form.append(crop);
    const reset=el('button','wide','Restablecer ajustes de imagen');reset.type='button';reset.id='layer-reset';reset.disabled=l.locked;reset.onclick=()=>sceneEdit(()=>{Object.assign(l,{rotation:0,opacity:1,brightness:100,contrast:100,grayscale:0,crop:{x:0,y:0,width:1,height:1}});l.height=Math.min(6000,l.width*l.originalHeight/l.originalWidth);});form.append(reset);
  }
}
function openCropDialog(){
  const l=layerNow();if(!l||l.type!=='image'||l.locked)return;
  const dialog=el('dialog','wide-dialog');dialog.id='crop-dialog';dialog.innerHTML='<div class="eyebrow">RECORTE NO DESTRUCTIVO</div><h2>Elige el área que quieres conservar</h2><p>Arrastra sobre la imagen. El archivo original no se modifica.</p><div class="crop-area"><div id="crop-wrap"><img id="crop-image" alt="Imagen original para recortar"><div id="crop-rectangle"></div></div></div><div id="crop-measures" class="help"></div><div class="dialog-actions"><button id="crop-full">Imagen completa</button><button id="crop-cancel">Cancelar</button><button id="crop-apply" class="primary">Aplicar recorte</button></div>';document.body.append(dialog);let crop=structuredClone(l.crop);
  const draw=()=>{Object.assign($('crop-rectangle').style,{left:crop.x*100+'%',top:crop.y*100+'%',width:crop.width*100+'%',height:crop.height*100+'%'});$('crop-measures').textContent=`Conservar ${(crop.width*100).toFixed(1)} % del ancho y ${(crop.height*100).toFixed(1)} % del alto`;};$('crop-image').src=imageURL(l.image);$('crop-image').onload=draw;
  const wrap=$('crop-wrap');wrap.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const box=wrap.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),y=Math.max(0,Math.min(1,(e.clientY-box.top)/box.height));wrap.setPointerCapture(e.pointerId);wrap.onpointermove=move=>{const nextX=Math.max(0,Math.min(1,(move.clientX-box.left)/box.width)),nextY=Math.max(0,Math.min(1,(move.clientY-box.top)/box.height));crop={x:Math.min(x,nextX),y:Math.min(y,nextY),width:Math.abs(nextX-x),height:Math.abs(nextY-y)};draw();};wrap.onpointerup=wrap.onpointercancel=()=>{wrap.onpointermove=null;};};
  const close=()=>{dialog.close();dialog.remove();};$('crop-cancel').onclick=close;dialog.oncancel=()=>setTimeout(()=>dialog.remove());$('crop-full').onclick=()=>{crop={x:0,y:0,width:1,height:1};draw();};$('crop-apply').onclick=()=>{if(crop.width<.01||crop.height<.01){toast('Selecciona un área de al menos el 1 % de la imagen.',true);return;}sceneEdit(()=>{l.crop=crop;l.height=Math.max(1,Math.min(6000,l.width*l.originalHeight*crop.height/(l.originalWidth*crop.width)));});close();};dialog.showModal();draw();
}
function openSceneTemplateDialog(){
  const dialog=el('dialog');dialog.id='scene-source-dialog';dialog.innerHTML='<div class="eyebrow">CARGAR EN EL EDITOR A4</div><h2>Plantilla o documento</h2><p>Se creará un proyecto independiente con el fondo y sus campos como capas. El documento original se conserva.</p><label>Origen<select id="scene-source"></select></label><div class="dialog-actions"><button id="scene-source-cancel">Cancelar</button><button id="scene-source-load" class="primary">Cargar en Escaneos Pro</button></div>';document.body.append(dialog);
  const select=$('scene-source');for(const t of state.templates){const o=el('option','',`Plantilla · ${t.name}`);o.value='t:'+t.id;select.append(o);}for(const d of state.documents){const o=el('option','',`Documento · ${d.title}`);o.value='d:'+d.id;select.append(o);}const close=()=>{dialog.close();dialog.remove();};$('scene-source-cancel').onclick=close;dialog.oncancel=()=>setTimeout(()=>dialog.remove());$('scene-source-load').onclick=()=>{const value=select.value,doc=value.startsWith('d:')?state.documents.find(d=>d.id===value.slice(2)):null,t=state.templates.find(t=>t.id===(doc?doc.templateId:value.slice(2)));if(t)newSceneProject(doc?doc.title:t.name,SathScene.templateLayers(t,doc?.values||{},uid));close();};dialog.showModal();
}
function openBatchDialog(){
  if(!scanSelected.size)return;const dialog=el('dialog','wide-dialog');dialog.id='batch-dialog';dialog.innerHTML='<div class="eyebrow">UNA IMAGEN POR PÁGINA</div><h2>Preparar lote A4</h2><p>Ajusta el orden. Cada imagen se ajusta a una página sin deformarse.</p><label>Orientación<select id="batch-orientation"><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label><div id="batch-order" class="batch-order"></div><div class="dialog-actions"><button id="batch-cancel">Cancelar</button><button id="batch-print">Imprimir lote</button><button id="batch-pdf" class="primary">Guardar PDF del lote</button></div>';document.body.append(dialog);const rows=[...scanSelected.values()];
  const draw=()=>{$('batch-order').replaceChildren();rows.forEach((row,index)=>{const line=el('div','batch-row');line.append(el('span','',`${index+1}. ${row.name}`));for(const[delta,label]of[[-1,'↑'],[1,'↓']]){const b=el('button','',label);b.disabled=index+delta<0||index+delta>=rows.length;b.setAttribute('aria-label',(delta<0?'Subir ':'Bajar ')+row.name);b.onclick=()=>{[rows[index],rows[index+delta]]=[rows[index+delta],rows[index]];draw();};line.append(b);}$('batch-order').append(line);});};
  const close=()=>{dialog.close();dialog.remove();};$('batch-cancel').onclick=close;dialog.oncancel=()=>setTimeout(()=>dialog.remove());for(const[id,kind]of[['batch-print','print'],['batch-pdf','pdf']])$(id).onclick=()=>action(async()=>{const tokens=rows.map(r=>r.token),landscape=$('batch-orientation').value==='landscape';$('batch-print').disabled=$('batch-pdf').disabled=true;try{const result=await api.batchOutput({tokens,kind,landscape});if(result){close();toast(kind==='pdf'?'PDF de varias páginas guardado.':'Lote enviado a impresión.');}}finally{if($('batch-print'))$('batch-print').disabled=$('batch-pdf').disabled=false;}});draw();dialog.showModal();
}
function resetScansAfterRestore(){selectedProjectId=state.projects[0]?.id||null;selectedLayerId=null;sceneHistory={id:null,undo:[],redo:[]};scanSelected.clear();lastGallery='';renderScene();action(async()=>receiveScans(await api.scanList()));}
