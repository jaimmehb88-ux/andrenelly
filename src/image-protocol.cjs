const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

// Electron 22 (Windows 7) predates protocol.handle and net.fetch.
function registerImageProtocol({protocol, net}, scheme, resolve) {
  const mime = file => ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[path.extname(file).toLowerCase()] || 'application/octet-stream');
  if (typeof protocol.handle === 'function') {
    protocol.handle(scheme, async request => {
      try {
        const result = await resolve(request);
        if (result.path) return net.fetch(pathToFileURL(result.path).href);
        return new Response(result.data, {headers:{'Content-Type':result.mimeType}});
      } catch (error) { return new Response('Imagen no disponible', {status:error.statusCode || 404}); }
    });
  } else {
    protocol.registerBufferProtocol(scheme, (request, callback) => {
      Promise.resolve().then(() => resolve(request)).then(async result => {
        const data = result.path ? await fs.readFile(result.path) : result.data;
        callback({data, mimeType:result.mimeType || mime(result.path), statusCode:200});
      }).catch(error => callback({data:Buffer.from('Imagen no disponible'), mimeType:'text/plain', statusCode:error.statusCode || 404}));
    });
  }
}
module.exports = {registerImageProtocol};
