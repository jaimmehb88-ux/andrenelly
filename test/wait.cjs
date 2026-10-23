const {setTimeout:delay}=require('node:timers/promises');
// Poll through CDP evaluation: Chromium 108 applies the app's CSP to the
// eval used internally by Playwright.waitForFunction. Keep production CSP intact.
async function waitFor(page,predicate,timeout=20000){
  const deadline=Date.now()+timeout;
  do {
    if(await page.evaluate(predicate))return;
    await delay(75);
  } while(Date.now()<deadline);
  throw new Error('No se cumplió la condición de interfaz: '+predicate.toString());
}
module.exports={waitFor};
