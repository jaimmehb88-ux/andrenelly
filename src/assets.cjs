const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const {randomUUID} = require('node:crypto');
const {imageType} = require('./store.cjs');
async function inspectImage(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 30*1024*1024 || !stat.size) throw new Error('Selecciona una imagen normal de hasta 30 MB.');
  const bytes = await fs.readFile(file);
  const type = imageType(bytes);
  if (!type) throw new Error('Formato no compatible. Usa JPG, PNG o WEBP.');
  const image = sharp(bytes,{limitInputPixels:50_000_000,failOn:'warning'});
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width*metadata.height > 50_000_000 || (metadata.pages||1)>1) throw new Error('Usa una imagen estática de hasta 50 megapíxeles.');
  // Decode every pixel once; metadata alone can accept truncated/corrupt files.
  await image.stats();
  const rotated = [5,6,7,8].includes(metadata.orientation);
  return {bytes,type,width:rotated?metadata.height:metadata.width,height:rotated?metadata.width:metadata.height,size:stat.size,mtimeMs:stat.mtimeMs};
}
async function importAsset(file, directory) {
  const info=await inspectImage(file), name=randomUUID()+'.'+info.type;
  await fs.writeFile(path.join(directory,name),info.bytes,{flag:'wx'});
  return {name,width:info.width,height:info.height};
}
module.exports={inspectImage,importAsset};
