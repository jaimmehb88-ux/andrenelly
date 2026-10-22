(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SathCompletion=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  function personKey(field){
    const label=normalize(field.label);
    if(field.special==='dni'||label.includes('DNI'))return 'dni';
    if(label.includes('NOMBRE')||label.includes('APELLIDO'))return 'name';
    if(label.includes('CORREO')||label.includes('EMAIL'))return 'email';
    if(label.includes('DIRECCION')||label.includes('DOMICILIO'))return 'address';
    if(label.includes('TELEFONO')||label.includes('CELULAR')||label.includes('MOVIL'))return label.includes('FIJO')?'phone-fixed':'phone-mobile';
    return null;
  }
  function suggestions(state,template,field,currentId){
    const a=state.settings.autocomplete,config=a.fields[template.id+':'+field.id];
    if(!a.enabled||config?.enabled===false)return [];
    const values=[...(config?.suggestions||[])];
    if(field.special==='mes_list')values.push('Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre');
    if(a.history){
      for(const doc of [...state.documents].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){
        if(doc.id===currentId)continue;
        const source=state.templates.find(t=>t.id===doc.templateId);
        const match=source?.fields.find(f=>source.id===template.id?f.id===field.id:(personKey(field)?personKey(f)===personKey(field):normalize(f.label)===normalize(field.label)));
        const value=match&&doc.values[match.id];if(value?.trim())values.push(value);
      }
    }
    return [...new Set(values)].slice(0,100);
  }
  function candidates(state,document,dni){
    if(!state.settings.autocomplete.enabled||!state.settings.autocomplete.history||!/^\d{8}$/.test(dni))return [];
    return state.documents.filter(d=>d.id!==document.id&&state.templates.find(t=>t.id===d.templateId)?.fields.some(f=>personKey(f)==='dni'&&d.values[f.id]===dni)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  function personValues(state,targetTemplate,sourceDocument){
    const source=state.templates.find(t=>t.id===sourceDocument.templateId),values={};
    for(const f of targetTemplate.fields){const key=personKey(f);if(!key)continue;const match=source?.fields.find(s=>personKey(s)===key);if(match&&sourceDocument.values[match.id]?.trim())values[f.id]=sourceDocument.values[match.id];}
    return values;
  }
  return {normalize,personKey,suggestions,candidates,personValues};
});
