/* Shared composition for the editor, PDF, printing and raster exports. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SathScene = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const A4 = { width: 794, height: 1123 };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const imageNames = /^(?:plantilla-[12]|[a-f0-9-]{36})\.(?:jpg|png|webp)$/;
  const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  function check(value, message) { if (!value) throw new Error(message); }
  function validateProject(p) {
    check(p && identifier(p.id) && typeof p.title === 'string' && p.title.trim() && p.title.length <= 160, 'Proyecto sin nombre o identificador válido.');
    check(typeof p.updatedAt === 'string' && Number.isFinite(Date.parse(p.updatedAt)), 'Fecha de proyecto no válida.');
    check(p.page && ((p.page.width === 794 && p.page.height === 1123) || (p.page.width === 1123 && p.page.height === 794)), 'El proyecto debe usar una página A4.');
    check(Array.isArray(p.layers) && p.layers.length <= 250, 'Máximo 250 capas por proyecto.');
    const ids = new Set();
    for (const l of p.layers) {
      check(l && identifier(l.id) && !ids.has(l.id), 'Identificador de capa no válido o duplicado.'); ids.add(l.id);
      check(['image','text'].includes(l.type) && ['background','fields','image','text'].includes(l.group), 'Tipo de capa no válido.');
      check(typeof l.name === 'string' && l.name.trim() && l.name.length <= 160 && typeof l.visible === 'boolean' && typeof l.locked === 'boolean', 'Propiedades de capa no válidas.');
      check(number(l.x,-6000,6000) && number(l.y,-6000,6000) && number(l.width,1,6000) && number(l.height,1,6000) && number(l.rotation,-180,180) && number(l.opacity,0,1), 'Medidas de capa no válidas.');
      if (l.type === 'image') {
        check(typeof l.image === 'string' && imageNames.test(l.image), 'Archivo de imagen no permitido.');
        check(number(l.originalWidth,1,50000) && number(l.originalHeight,1,50000) && l.originalWidth*l.originalHeight<=50_000_000, 'Dimensiones originales no válidas.');
        check(l.crop && number(l.crop.x,0,1) && number(l.crop.y,0,1) && number(l.crop.width,.001,1) && number(l.crop.height,.001,1) && l.crop.x+l.crop.width <= 1.00001 && l.crop.y+l.crop.height <= 1.00001, 'Recorte fuera de la imagen.');
        check(number(l.brightness,0,200) && number(l.contrast,0,200) && number(l.grayscale,0,100), 'Ajustes de imagen no válidos.');
      } else {
        check(typeof l.text === 'string' && l.text.length <= 10000 && number(l.fontSize,6,200) && ['Arial','Verdana','Consolas','Georgia','Arial Black','Helvetica'].includes(l.fontFamily) && ['400','700','900'].includes(l.fontWeight) && ['left','center','right'].includes(l.align) && /^#[a-f0-9]{6}$/i.test(l.color) && number(l.letterSpacing,0,20), 'Formato de texto no válido.');
      }
    }
    const visible=new Map();for(const l of p.layers)if(l.type==='image'&&l.visible)visible.set(l.image,l.originalWidth*l.originalHeight);
    check([...visible.values()].reduce((a,b)=>a+b,0)<=150_000_000,'Hay demasiadas imágenes grandes visibles. Oculta algunas capas o reduce el tamaño de los archivos de origen.');
    return p;
  }
  function baseLayer(id, name, group, x, y, width, height) {
    return { id, name, group, x, y, width, height, rotation:0, opacity:1, visible:true, locked:false };
  }
  function imageLayer(id, image, name, dimensions, page = A4, group = 'image') {
    const ratio = Math.min((page.width-48)/dimensions.width,(page.height-48)/dimensions.height);
    const width = dimensions.width*ratio, height = dimensions.height*ratio;
    return { ...baseLayer(id,name,group,(page.width-width)/2,(page.height-height)/2,width,height), type:'image', image, originalWidth:dimensions.width, originalHeight:dimensions.height, crop:{x:0,y:0,width:1,height:1}, brightness:100, contrast:100, grayscale:0 };
  }
  function textLayer(id, text = 'Escribe aquí') {
    return { ...baseLayer(id,'Texto','text',70,100,400,80), type:'text', text, fontSize:24, fontFamily:'Arial', fontWeight:'400', align:'left', color:'#172b4d', letterSpacing:0 };
  }
  function fieldValue(f,t,values) {
    const source = f.special === 'copy_papeleta' ? 'papeleta_src' : f.special === 'copy_fecha' ? 'fecha_src' : null;
    let value = values[source ? t.fields.find(field => field.special === source)?.id : f.id] || '';
    if (f.textTransform === 'uppercase') value = value.toUpperCase();
    if (f.textTransform === 'capitalize') value = value.replace(/(^|[\s-])(\p{L})/gu,(_,a,b)=>a+b.toUpperCase());
    return value;
  }
  function templateLayers(t, values, uuid) {
    const layers = [];
    if (t.image) { const bg = imageLayer(uuid(),t.image,'Fondo · '+t.name,A4,A4,'background'); Object.assign(bg,{x:0,y:0,width:A4.width,height:A4.height,locked:true}); layers.push(bg); }
    for (const f of t.fields) {
      const l = textLayer(uuid(),fieldValue(f,t,values));
      Object.assign(l,{name:f.label,group:'fields',x:f.left/100*A4.width,y:f.top/100*A4.height,width:f.width/100*A4.width,height:f.height/100*A4.height,fontSize:f.fontSize,fontFamily:f.fontFamily.includes('Arial Black')?'Arial Black':f.fontFamily.includes('Verdana')?'Verdana':f.fontFamily.includes('Consolas')?'Consolas':f.fontFamily.includes('Helvetica')?'Helvetica':'Arial',fontWeight:['700','900'].includes(String(f.fontWeight))?String(f.fontWeight):'400',align:f.textAlign,color:f.color,letterSpacing:f.letterSpacing});
      layers.push(l);
    }
    return layers;
  }
  function renderSVG(p, imageURL) {
    validateProject(p);
    const layers = p.layers.filter(l => l.visible).map(l => {
      const transform = `translate(${l.x+l.width/2} ${l.y+l.height/2}) rotate(${l.rotation})`;
      if (l.type === 'image') {
        const c=l.crop;
        return `<g transform="${transform}" opacity="${l.opacity}"><svg x="${-l.width/2}" y="${-l.height/2}" width="${l.width}" height="${l.height}" viewBox="${c.x} ${c.y} ${c.width} ${c.height}" preserveAspectRatio="none" overflow="hidden"><image href="${escape(imageURL(l.image))}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" style="filter:brightness(${l.brightness}%) contrast(${l.contrast}%) grayscale(${l.grayscale}%)"/></svg></g>`;
      }
      const x = l.align==='center'?0:l.align==='right'?l.width/2-2:-l.width/2+2;
      const lines=l.text.split('\n'); const first = lines.length===1 ? l.fontSize*.35 : -l.height/2+l.fontSize;
      const clip='clip-'+l.id;
      return `<g transform="${transform}" opacity="${l.opacity}"><defs><clipPath id="${clip}"><rect x="${-l.width/2}" y="${-l.height/2}" width="${l.width}" height="${l.height}"/></clipPath></defs><text clip-path="url(#${clip})" x="${x}" y="${first}" font-family="${escape(l.fontFamily)}" font-size="${l.fontSize}" font-weight="${l.fontWeight}" fill="${l.color}" letter-spacing="${l.letterSpacing}" text-anchor="${{left:'start',center:'middle',right:'end'}[l.align]}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?l.fontSize*1.2:0}">${escape(line)||' '}</tspan>`).join('')}</text></g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.page.width}" height="${p.page.height}" viewBox="0 0 ${p.page.width} ${p.page.height}" style="display:block;background:white">${layers}</svg>`;
  }
  function pagesHTML(projects, imageURL) {
    check(projects.length>0 && projects.length<=100,'Selecciona entre 1 y 100 páginas.');
    const wide=projects[0].page.width>projects[0].page.height;
    check(projects.every(p=>(p.page.width>p.page.height)===wide),'Las páginas del lote deben tener la misma orientación.');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file:; style-src 'unsafe-inline'"><style>@page{size:A4 ${wide?'landscape':'portrait'};margin:0}body{margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:${wide?297:210}mm;height:calc(${wide?210:297}mm - 0.1mm);break-after:page;break-inside:avoid;overflow:hidden;background:white}.page:last-child{break-after:auto}.page>svg{display:block;width:100%;height:100%}</style></head><body>${projects.map(p=>`<div class="page">${renderSVG(p,imageURL)}</div>`).join('')}</body></html>`;
  }
  // Deltas use page coordinates; rotate back to the image axes. The opposite
  // corner/edge stays fixed even though CSS rotates around the changing center.
  function resizeLayer(start, direction, dx, dy, keepRatio=true) {
    const sx=direction.includes('e')?1:direction.includes('w')?-1:0;
    const sy=direction.includes('s')?1:direction.includes('n')?-1:0;
    const angle=start.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    const localX=c*dx+s*dy,localY=-s*dx+c*dy;
    let width=start.width,height=start.height;
    if(sx&&sy&&keepRatio) {
      let factor=1+(sx*localX*width+sy*localY*height)/(width*width+height*height);
      factor=Math.max(1/Math.min(width,height),Math.min(6000/Math.max(width,height),factor));
      width*=factor;height*=factor;
    } else {
      if(sx)width=Math.max(1,Math.min(6000,width+sx*localX));
      if(sy)height=Math.max(1,Math.min(6000,height+sy*localY));
    }
    const shiftX=sx*(width-start.width)/2,shiftY=sy*(height-start.height)/2;
    const x=start.x+start.width/2+c*shiftX-s*shiftY-width/2;
    const y=start.y+start.height/2+s*shiftX+c*shiftY-height/2;
    if(Math.abs(x)>6000||Math.abs(y)>6000)return {x:start.x,y:start.y,width:start.width,height:start.height};
    return {x,y,width,height};
  }
  return { A4, escape, validateProject, imageLayer, textLayer, templateLayers, renderSVG, pagesHTML, fieldValue, resizeLayer };
});
