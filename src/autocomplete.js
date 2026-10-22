'use strict';
function initAutocomplete() {
  const panel=document.createElement('div');panel.className='form-completion-tools';
  panel.innerHTML='<button type="button" id="configure-completion">⚙ Autocompletado</button><button type="button" id="lookup-person">Buscar por DNI</button><small>Tab: siguiente campo · Mayús + Tab: anterior</small>';
  $('fields-form').before(panel);
  const dialog=el('dialog');dialog.id='completion-dialog';dialog.innerHTML=`<div class="eyebrow">RELLENAR CON MENOS ESFUERZO</div><h2>Autocompletado</h2><p>Las sugerencias manuales se guardan por campo. El historial solo se consulta si lo habilitas.</p><label class="check-row"><input type="checkbox" id="completion-enabled"> Activar autocompletado</label><label class="check-row"><input type="checkbox" id="completion-history"> Usar documentos anteriores como sugerencias y para buscar por DNI</label><label>Campo<select id="completion-field"></select></label><label class="check-row"><input type="checkbox" id="completion-field-enabled"> Habilitar este campo</label><label>Sugerencias manuales<textarea id="completion-values" rows="7" placeholder="Una sugerencia por línea · máximo 100"></textarea></label><p class="help">Para crear, editar o eliminar una sugerencia, modifica su línea. Las preferencias se aplican al guardar.</p><div class="dialog-actions"><button id="completion-cancel">Cancelar</button><button id="completion-save" class="primary">Guardar configuración</button></div>`;document.body.append(dialog);
  $('configure-completion').onclick=openCompletionDialog;
  $('lookup-person').onclick=()=>action(lookupPerson);
}
function decorateForm() {
  if(!$('configure-completion'))return;
  const doc=currentDocument();if(!doc)return;const template=state.templates.find(t=>t.id===doc.templateId);
  for(const field of template.fields.filter(f=>!f.special.startsWith('copy_'))){
    const input=$('input-'+field.id);if(!input)continue;
    input.autocomplete='off';input.removeAttribute('list');input.parentElement.querySelectorAll('datalist').forEach(n=>n.remove());
    const list=el('datalist');list.id='suggestions-'+field.id;
    for(const value of SathCompletion.suggestions(state,template,field,doc.id)){const option=el('option');option.value=value;list.append(option);}
    if(list.children.length){input.setAttribute('list',list.id);input.parentElement.append(list);}
    const tools=el('span','field-inline-actions');const add=el('button','subtle','＋ Guardar sugerencia');add.type='button';add.title='Añadir el valor actual a las sugerencias manuales de este campo';add.onclick=()=>{
      const value=input.value.trim();if(!value){input.focus();return;}const key=template.id+':'+field.id;const config=state.settings.autocomplete.fields[key]||{enabled:true,suggestions:[]};
      if(config.suggestions.length>=100){toast('Máximo 100 sugerencias por campo.',true);return;}if(!config.suggestions.includes(value))config.suggestions.push(value);state.settings.autocomplete.fields[key]=config;changed();toast('Sugerencia guardada para este campo.');decorateForm();
    };tools.append(add);input.parentElement.querySelector('.field-inline-actions')?.remove();input.parentElement.append(tools);
    input.oninvalid=()=>input.setCustomValidity(field.special==='dni'?'Escribe exactamente 8 dígitos para el DNI.':field.special==='email_list'?'Escribe un correo válido, por ejemplo nombre@dominio.com.':'Revisa este campo.');
    input.onkeydown=event=>{if(event.key==='Enter'&&!input.list?.options.length){event.preventDefault();const inputs=[...$('fields-form').querySelectorAll('input')];inputs[inputs.indexOf(input)+1]?.focus();}};
  }
  const form=$('fields-form');
  if(form.querySelector(':scope > label.field-label')) {
    const groups=new Map([['Datos del trámite',[]],['Datos de la persona',[]],['Fecha del documento',[]]]);
    for(const f of template.fields){const input=$('input-'+f.id);if(!input)continue;const group=SathCompletion.personKey(f)?'Datos de la persona':/^FECHA.*(D[IÍ]A|MES)/i.test(f.label)?'Fecha del documento':'Datos del trámite';groups.get(group).push(input.parentElement);}
    form.replaceChildren();for(const [name,labels]of groups)if(labels.length){const fieldset=el('fieldset','form-fieldset');fieldset.append(el('legend','',name),...labels);form.append(fieldset);}
  }
  $('lookup-person').disabled=!state.settings.autocomplete.enabled||!state.settings.autocomplete.history||!template.fields.some(f=>f.special==='dni');
  $('lookup-person').title=state.settings.autocomplete.history?'Recuperar datos personales de un documento anterior':'Habilita el historial en Autocompletado para usar esta función';
}
function openCompletionDialog() {
  const doc=currentDocument();if(!doc)return;const t=state.templates.find(t=>t.id===doc.templateId),draft=structuredClone(state.settings.autocomplete);
  $('completion-enabled').checked=draft.enabled;$('completion-history').checked=draft.history;const select=$('completion-field');select.replaceChildren();
  for(const f of t.fields.filter(f=>!f.special.startsWith('copy_'))){const o=el('option','',f.label);o.value=f.id;select.append(o);}
  let currentKey;
  function saveField(){if(!currentKey)return;const lines=[...new Set($('completion-values').value.split('\n').map(s=>s.trim()).filter(Boolean))];if(lines.length>100||lines.some(s=>s.length>4000))throw new Error('Máximo 100 sugerencias de hasta 4000 caracteres.');draft.fields[currentKey]={enabled:$('completion-field-enabled').checked,suggestions:lines};}
  function loadField(){currentKey=t.id+':'+select.value;const c=draft.fields[currentKey]||{enabled:true,suggestions:[]};$('completion-field-enabled').checked=c.enabled;$('completion-values').value=c.suggestions.join('\n');}
  select.onchange=()=>{try{saveField();loadField();}catch(error){toast(error.message,true);select.value=currentKey.slice(t.id.length+1);}};loadField();
  $('completion-cancel').onclick=()=>$('completion-dialog').close();$('completion-save').onclick=()=>action(async()=>{saveField();draft.enabled=$('completion-enabled').checked;draft.history=$('completion-history').checked;state.settings.autocomplete=draft;changed();await flush();decorateForm();$('completion-dialog').close();toast('Configuración de autocompletado guardada.');});$('completion-dialog').showModal();
}
async function lookupPerson(){
  const doc=currentDocument(),template=state.templates.find(t=>t.id===doc.templateId),field=template.fields.find(f=>f.special==='dni'),dni=doc.values[field?.id]||'';
  if(!/^\d{8}$/.test(dni)){toast('Escribe un DNI de 8 dígitos antes de buscar.',true);if(field)$('input-'+field.id)?.focus();return;}
  const matches=SathCompletion.candidates(state,doc,dni);if(!matches.length){toast('No hay documentos anteriores con este DNI.');return;}
  const dialog=el('dialog');dialog.id='person-dialog';dialog.innerHTML='<div class="eyebrow">CONFIRMAR DATOS PERSONALES</div><h2>Revisar antes de reemplazar</h2><p>Solo se recuperan nombre, DNI, contacto y dirección. Las fechas y datos del trámite no se cambian.</p><label>Documento de origen<select id="person-source"></select></label><div id="person-changes" class="person-changes"></div><div class="dialog-actions"><button id="person-cancel">Cancelar</button><button class="primary" id="person-apply">Usar estos datos</button></div>';document.body.append(dialog);
  for(const source of matches){const option=el('option','',source.title+' · '+new Date(source.updatedAt).toLocaleDateString('es-PE'));option.value=source.id;$('person-source').append(option);}
  let values={};const refresh=()=>{const source=matches.find(d=>d.id===$('person-source').value);values=SathCompletion.personValues(state,template,source);$('person-changes').replaceChildren();for(const [id,value] of Object.entries(values)){const row=el('div');row.append(el('strong','',template.fields.find(f=>f.id===id).label),el('span','',`${doc.values[id]||'Vacío'} → ${value}`));$('person-changes').append(row);}};
  const close=()=>{dialog.close();dialog.remove();};$('person-source').onchange=refresh;refresh();$('person-cancel').onclick=close;dialog.oncancel=()=>setTimeout(()=>dialog.remove());$('person-apply').onclick=()=>{Object.assign(doc.values,values);doc.updatedAt=new Date().toISOString();changed();close();renderDocuments();toast('Datos personales recuperados.');};dialog.showModal();
}
