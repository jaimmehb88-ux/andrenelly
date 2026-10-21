const { contextBridge, ipcRenderer } = require('electron');
const call = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel,...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('sath', {
  load: () => call('load'), save: state => call('save',state),
  importImage: () => call('import-image'), backup: () => call('backup'), restore: () => call('restore'),
  openFolder: () => call('open-folder'), output: options => call('output',options),
  close: () => call('close'), onClose: callback => ipcRenderer.on('request-close',callback)
});
