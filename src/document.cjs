const { pathToFileURL } = require('node:url');
const path = require('node:path');
function escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function valueFor(field, template, values) {
  const source = field.special === 'copy_papeleta' ? 'papeleta_src' : field.special === 'copy_fecha' ? 'fecha_src' : null;
  const value = values[source ? template.fields.find(f => f.special === source)?.id : field.id] || '';
  if (field.textTransform === 'uppercase') return value.toUpperCase();
  if (field.textTransform === 'capitalize') return value.replace(/(^|[\s-])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toUpperCase());
  return value;
}
function printHTML(template, values, images, background) {
  const image = background && template.image ? `<img src="${escape(pathToFileURL(path.join(images,template.image)).href)}" alt="">` : '';
  const fields = template.fields.map(f => `<div style="position:absolute;display:flex;align-items:center;overflow:hidden;white-space:pre;box-sizing:border-box;padding:0 2px;left:${f.left}%;top:${f.top}%;width:${f.width}%;height:${f.height}%;font-family:${escape(f.fontFamily)};font-size:${f.fontSize}px;font-weight:${f.fontWeight};color:${f.color};letter-spacing:${f.letterSpacing}px;justify-content:${{left:'flex-start',center:'center',right:'flex-end'}[f.textAlign]}">${escape(valueFor(f,template,values))}</div>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file:; style-src 'unsafe-inline'"><title>${escape(template.name)}</title><style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}.page{position:relative;width:210mm;height:297mm;overflow:hidden;background:white}.page>img{width:100%;height:100%;position:absolute;inset:0}</style></head><body><div class="page">${image}${fields}</div></body></html>`;
}
module.exports = {printHTML, valueFor};
