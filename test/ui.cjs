// Integration tests exercise the actual Electron main process, preload, filesystem and PDF output.
const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'.test-output');
const data=path.join(output,'datos');
async function launch(){return electron.launch({args:[root],env:{...process.env,SATH_DATA_DIR:data},timeout:30000});}
(async()=>{
  await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
  let app=await launch();let page=await app.firstWindow();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.getByRole('button',{name:'Crear mi primer documento'}).click();
    await page.locator('#new-title').fill('Solicitud de prueba');
    await page.getByRole('button',{name:'Crear documento',exact:true}).click();
    await page.locator('#fields-form input').first().fill('AB123');
    const dni=page.locator('#fields-form input[inputmode="numeric"]');await dni.fill('12345678');
    await page.locator('#input-p_2').fill('21/10/2026');
    await page.locator('#input-p_custom_5').fill('María Pérez');
    await page.getByRole('button',{name:'Documentos',exact:false}).first().click();
    assert.equal(await page.locator('#document-paper .overlay[data-field="p_custom_7"]').textContent(),'AB123');
    await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('Todos los cambios'));
    await page.screenshot({path:path.join(output,'documentos.png'),fullPage:true});
    const imageOkay=await page.locator('#document-paper img').evaluate(i=>i.complete&&i.naturalWidth>0);assert.ok(imageOkay);
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},path.join(output,'solicitud.pdf'));
    console.log('PDF: iniciar');await page.getByRole('button',{name:'Guardar PDF',exact:false}).click();
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('PDF guardado'));
    assert.equal((await fs.readFile(path.join(output,'solicitud.pdf'))).subarray(0,5).toString(),'%PDF-');
    console.log('PDF: correcto');await page.locator('#with-background').uncheck();assert.equal(await page.locator('#document-paper img').count(),0);
    await page.getByRole('button',{name:'Duplicar',exact:true}).click();assert.equal(await page.locator('.document-item').count(),2);
    await page.locator('#delete-document').click();await page.locator('#accept-confirm').click();assert.equal(await page.locator('.document-item').count(),1);
    console.log('Plantillas: iniciar');await page.locator('[data-view="templates"]').click();await page.locator('.template-card').first().getByRole('button',{name:'Editar',exact:true}).click();
    await page.getByRole('button',{name:'Añadir campo',exact:false}).click();await page.locator('#prop-label').fill('Observaciones');await page.locator('#prop-label').press('Tab');
    const overlay=page.locator('#template-paper .overlay.selected');await overlay.scrollIntoViewIfNeeded();const bounds=await overlay.boundingBox();
    await page.mouse.move(bounds.x+10,bounds.y+5);await page.mouse.down();await page.mouse.move(bounds.x+30,bounds.y+25,{steps:5});await page.mouse.up();
    assert.ok(Number(await page.locator('#prop-left').inputValue())>15);
    await page.screenshot({path:path.join(output,'plantillas.png'),fullPage:true});
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},path.join(root,'assets','plantilla-2.jpg'));
    await page.getByRole('button',{name:'Cambiar imagen',exact:true}).click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Imagen guardada'));
    assert.ok((await fs.readdir(path.join(data,'imagenes'))).length>2);
    console.log('Respaldo: iniciar');await page.locator('[data-view="settings"]').click();
    await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},output);
    await page.getByRole('button',{name:'Crear respaldo completo'}).click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Respaldo completo'));
    const backup=(await fs.readdir(output)).find(n=>n.startsWith('SATH-respaldo-'));assert.ok(backup);
    await page.locator('[data-view="documents"]').click();await page.locator('#document-title').fill('Título cambiado');await page.locator('#document-title').press('Tab');
    await page.locator('[data-view="settings"]').click();
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showMessageBox=async()=>({response:1});},path.join(output,backup,'documentos.json'));
    await page.getByRole('button',{name:'Restaurar respaldo…',exact:true}).click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Respaldo restaurado'));
    await page.locator('[data-view="documents"]').click();assert.equal(await page.locator('#document-title').inputValue(),'Solicitud de prueba');
    await page.screenshot({path:path.join(output,'final.png'),fullPage:true});
    // The normal close path flushes pending changes before the process exits.
    await page.locator('#document-title').fill('Conservado al cerrar');await page.locator('#document-title').press('Tab');
    const exited = new Promise(resolve => app.process().once('exit',resolve)); await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close()); await exited;
    app=await launch();page=await app.firstWindow();await page.locator('#document-title').waitFor();assert.equal(await page.locator('#document-title').inputValue(),'Conservado al cerrar');
    assert.deepEqual(errors,[]);console.log('PASS: documentos, campos vinculados, imágenes locales, PDF, duplicación, borrado, calibración, respaldo, restauración y persistencia al reiniciar.');
  }catch(error){console.error('Fallo de integración:',error);await page.screenshot({path:path.join(output,'error.png'),fullPage:true}).catch(()=>{});throw error;}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
