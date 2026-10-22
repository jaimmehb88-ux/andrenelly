const { contextBridge, ipcRenderer } = require('electron');
const call = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel,...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('sath', {
  load: () => call('load'), save: state => call('save',state),
  importAsset:()=>call('asset-import'), scanFolder:()=>call('scan-folder'), scanList:(all=false)=>call('scan-list',all), scanImport:token=>call('scan-import',token), sceneOutput:options=>call('scene-output',options), batchOutput:options=>call('batch-output',options), onScans:callback=>ipcRenderer.on('scan-change',(_event,snapshot)=>callback(snapshot)),
  importImage: () => call('import-image'), backup: () => call('backup'), restore: () => call('restore'),
  openFolder: () => call('open-folder'), output: options => call('output',options),
  close: () => call('close'), onClose: callback => ipcRenderer.on('request-close',callback)
});
