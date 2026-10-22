'use strict';
let accessState={developer:false,pro:false};
const toolsAllowed=()=>accessState.developer||accessState.pro;
function refreshAccess() {
  document.querySelector('[data-view="scans"]').hidden=!accessState.pro;
  $('new-template').hidden=!accessState.pro;
  $('duplicate-template').hidden=!toolsAllowed();
  $('document-to-scans').hidden=!toolsAllowed();
  $('restore').disabled=!toolsAllowed();
  $('restore').title=toolsAllowed()?'':'Entra al modo desarrollador para restaurar plantillas y proyectos.';
  $('access-status').textContent=accessState.developer?'Desarrollador · sesión activa':accessState.pro?'Modo Pro activo':'Modo estándar';
  $('pro-status').textContent=accessState.pro?'Pro activo: las herramientas están disponibles para todos.':'Pro desactivado: herramientas disponibles en esta sesión de desarrollador.';
  $('toggle-pro').textContent=accessState.pro?'Desactivar modo Pro':'Activar modo Pro';
  if(!toolsAllowed()&&view==='scans')showView('documents');
}
function initAccessUI() {
  const welcome=$('welcome'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const dismiss=()=>{if(reduce.matches){welcome.hidden=true;return;}welcome.classList.add('welcome-exit');setTimeout(()=>welcome.hidden=true,280);};
  $('skip-welcome').onclick=dismiss;
  if(reduce.matches)dismiss();else setTimeout(dismiss,2800);
  reduce.addEventListener('change',e=>{if(e.matches)dismiss();});
  $('developer-mode').onclick=()=>{
    if(accessState.developer){refreshAccess();$('developer-panel').showModal();}
    else{$('developer-password').value='';$('developer-error').textContent='';$('developer-login').showModal();$('developer-password').focus();}
  };
  $('developer-cancel').onclick=()=>$('developer-login').close();
  $('developer-login-form').onsubmit=async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    try{await flush();accessState=await api.login($('developer-password').value);$('developer-password').value='';$('developer-login').close();refreshAccess();$('developer-panel').showModal();action(async()=>receiveScans(await api.scanList()));}
    catch(error){$('developer-error').textContent=error.message;}
    finally{button.disabled=false;}
  };
  $('developer-close').onclick=()=>$('developer-panel').close();
  $('developer-logout').onclick=()=>action(async()=>{await flush();accessState=await api.logout();$('developer-panel').close();$('new-password').value=$('repeat-password').value='';refreshAccess();});
  $('toggle-pro').onclick=()=>action(async()=>{await flush();accessState=await api.setPro(!accessState.pro);refreshAccess();});
  $('dev-scans').onclick=()=>{$('developer-panel').close();showView('scans');};
  $('dev-template').onclick=()=>{$('developer-panel').close();showView('templates');$('new-template').onclick();};
  $('password-form').onsubmit=event=>{
    event.preventDefault();action(async()=>{
      if($('new-password').value!==$('repeat-password').value){$('password-message').textContent='Las contraseñas no coinciden.';return;}
      await api.changePassword($('new-password').value);$('new-password').value=$('repeat-password').value='';$('password-message').textContent='Contraseña actualizada.';
    });
  };
  refreshAccess();
}
