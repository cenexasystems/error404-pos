import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5183}});await server.listen();
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
for(const role of ['admin','staff']) {
 const page=await browser.newPage();const calls=[];const errors=[];let mode='normal';
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(role=>sessionStorage.setItem('universal-look-admin-session',JSON.stringify({state:{isLoggedIn:true,role,adminId:role,token:'fixture-only'},version:0})),role);
 await page.route('**/api/**',async r=>{
  const body=r.request().postDataJSON()||{};let data=[];
  const filter=body.filters?.find(f=>f.column==='phone'&&f.op==='ilike');
  if(filter){
   calls.push(body);assert.equal(body.action,'select');assert.equal(body.limit,50);
   const phone=filter.value.replaceAll('%','');
   if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,800));
   if(mode==='fail'){await r.fulfill({status:500,json:{message:'Fixture unavailable'}});return}
   if(phone==='9876543210'){
    if(body.table==='customer_birthdays')data=[{id:'birthday',name:'Avish',phone:'+91 9876543210',birth_date:'2000-08-15',created_at:'2025-01-01'}];
    if(body.table==='orders')data=[{customer_name:'Older name',phone:'9876543210',created_at:'2024-01-01'}];
   }
   if(phone==='9876543211'&&body.table==='orders')data=[{customer_name:'Walk-in Customer',phone:'+919876543211',created_at:'2026-03-01'},{customer_name:'Latest Name',phone:'91 9876543211',created_at:'2026-02-01'},...Array.from({length:5},()=>({customer_name:'Older Name',phone:'9876543211',created_at:'2025-01-01'})),{customer_name:'Wrong Person',phone:'9999999999',created_at:'2027-01-01'}];
   if(phone==='9876543213'&&body.table==='advance_orders')data=[{customer_name:'Advance Customer',phone:'9876543213',created_at:'2026-04-01'}];
  }
  await r.fulfill({json:{data,count:data.length,versions:{}}});
 });
 await page.goto('http://127.0.0.1:5183/pos');
 const phone=page.locator('#pos-customer-phone'),name=page.locator('#pos-customer-name'),dob=page.locator('#pos-birth-date');
 await phone.waitFor();
 await page.locator('#pos-reference-number').fill('Keep reference');await page.locator('#pos-remarks').fill('Keep remarks');await page.locator('#pos-billing-date').fill('2026-10-20T10:30');
 await phone.fill('98765');await page.waitForTimeout(500);assert.equal(calls.length,0);
 await phone.fill('9876543210');await page.waitForFunction(()=>document.querySelector('#pos-customer-name')?.value==='Avish');assert.equal(await dob.inputValue(),'2000-08-15');assert.equal(calls.length,3);
 assert.equal(await page.locator('#pos-reference-number').inputValue(),'Keep reference');assert.equal(await page.locator('#pos-remarks').inputValue(),'Keep remarks');assert.equal(await page.locator('#pos-billing-date').inputValue(),'2026-10-20T10:30');
 await name.fill('Corrected Name');await dob.fill('2001-09-16');await phone.fill('+91 9876543210');await page.waitForTimeout(450);assert.equal(calls.length,3);assert.equal(await name.inputValue(),'Corrected Name');assert.equal(await dob.inputValue(),'2001-09-16');
 // Clear manual edits to exercise missing-DOB and unknown-customer behavior independently.
 await name.fill('');await dob.fill('');await phone.fill('9876543211');await page.waitForFunction(()=>document.querySelector('#pos-customer-name')?.value==='Latest Name');assert.equal(await dob.inputValue(),'');
 await phone.fill('9876543212');await page.waitForTimeout(700);assert.equal(await name.inputValue(),'');assert.equal(await dob.inputValue(),'');assert.equal(await page.getByRole('alert').count(),0);
 await phone.fill('9876543213');await page.waitForFunction(()=>document.querySelector('#pos-customer-name')?.value==='Advance Customer');
 // A slow result must not override a new phone or manual edits made during lookup.
 mode='slow';await phone.fill('9876543210');await page.waitForTimeout(400);await phone.fill('9876543212');await page.waitForTimeout(1300);assert.equal(await name.inputValue(),'');assert.equal(await dob.inputValue(),'');
 await phone.fill('9876543210');await page.waitForTimeout(400);await name.fill('Typed While Waiting');await dob.fill('2002-01-02');await page.waitForTimeout(1000);assert.equal(await name.inputValue(),'Typed While Waiting');assert.equal(await dob.inputValue(),'2002-01-02');
 mode='fail';await phone.fill('9876543212');await page.waitForTimeout(700);assert.equal(await name.inputValue(),'Typed While Waiting');assert.equal(await dob.inputValue(),'2002-01-02');assert.deepEqual(errors,[]);
 console.log(role,'passed: complete-number debounce, normalized match, DOB, latest history, missing DOB, unknown customer, manual edits, stale response, failure fallback, unrelated fields unchanged');
 await page.close();
}
} finally {await browser.close();await server.close()}
