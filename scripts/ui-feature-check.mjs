// Local UI regression checks: API responses are mocked; WhatsApp opens are intercepted.
// Run from the project root: node scripts/ui-feature-check.mjs (requires Microsoft Edge).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5182}});await server.listen();
const browser=await chromium.launch({headless:true,channel:'msedge'});
const errors=[];
const coupons=[{id:1,code:'WELCOME10',percentage:10,is_active:true,expiry_date:'2027-12-31',usage_limit:null,usage_count:0,min_order_value:399},{id:2,code:'FESTIVE20',percentage:20,is_active:true,expiry_date:null,usage_limit:null,usage_count:0,min_order_value:0}];
try{
for(const role of ['admin','staff']){
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{const body=r.request().postDataJSON()||{};return r.fulfill({json:r.request().url().endsWith('/auth')?{role,token:'local-ui-test'}:{data:body.table==='coupons'?coupons:[],count:0,versions:{}}});});
 await page.addInitScript(()=>{window.open=(...args)=>{window.__opened=args;return null}});
 await page.goto('http://127.0.0.1:5182/admin-login');
 const password=page.locator('#admin-portal-password');await password.fill('sample-only');assert.equal(await password.getAttribute('type'),'password');
 await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await password.getAttribute('type'),'text');
 await page.getByRole('button',{name:'Hide password',exact:true}).click();assert.equal(await password.getAttribute('type'),'password');
 await page.getByRole('button',{name:'Authenticate',exact:true}).click();await page.getByRole('button',{name:'Billing Panel',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Analytics Dashboard',exact:true}).count(),role==='admin'?1:0);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const form=page.locator('form').filter({hasText:'Change Password'});
 assert.equal(await form.locator('input[type=password]').count(),3);
 for(let i=0;i<3;i++){
  const wrapper=form.locator('span.relative').nth(i);await wrapper.locator('input').fill('sample-secret');
  await wrapper.getByRole('button').click();assert.equal(await wrapper.locator('input').getAttribute('type'),'text');
  await wrapper.getByRole('button').click();assert.equal(await wrapper.locator('input').getAttribute('type'),'password');
 }
 if(role==='admin'){await form.getByRole('tab',{name:'Staff password'}).click();assert.equal(await form.locator('input[type=password]').count(),3)}
 console.log(role,'login, permissions and password toggles passed');
 for(const width of [320,360,375,390,414,430,768,1440]){
  await page.setViewportSize({width,height:800});await page.waitForTimeout(400);
  const nav=page.getByRole('button',{name:'Billing Panel',exact:true});
  assert.equal(await nav.locator('span').filter({hasText:'Billing Panel'}).isVisible(),width>=640);
  for(const section of ['Billing Panel','Advance Orders','Order History','Inventory',...(role==='admin'?['Analytics Dashboard']:[]),'Birthdays','Settings']){
   await page.getByRole('button',{name:section,exact:true}).click();
   await page.waitForTimeout(150);const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));if(dims.scroll>dims.width){console.log('Overflow',role,width,section,dims);await page.screenshot({path:'overflow-check.png'});}assert(dims.scroll<=dims.width);
  }
  if(role==='admin'){
   await page.getByRole('button',{name:'Coupons',exact:true}).click();
   await page.getByRole('button',{name:'Share coupon WELCOME10 on WhatsApp'}).click();
   const modal=page.getByRole('dialog',{name:'Share Coupon'});await modal.waitFor();
   const box=await modal.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);
   assert.equal(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   await modal.getByRole('textbox',{name:'Customer Name (Optional)'}).fill('Rahul');
   assert(await modal.getByText(/Dear Rahul,/).isVisible());
   await modal.getByRole('textbox',{name:'Customer Name (Optional)'}).fill('');
   assert.equal(await modal.getByText(/Dear Rahul,/).count(),0);
   assert.match(await modal.locator('textarea').inputValue(),/WELCOME10/);assert.match(await modal.locator('textarea').inputValue(),/399/);
   await modal.getByRole('button',{name:'Send Coupon'}).click();assert(await modal.getByRole('alert').isVisible());assert.equal(await page.evaluate(()=>window.__opened),undefined);
   await modal.getByRole('textbox',{name:'Customer Mobile Number'}).fill('9876543210');
   const custom='Hello & welcome!\nSpecial ₹ offer 🎟';await modal.locator('textarea').fill(custom);
   await modal.getByRole('button',{name:'Send Coupon'}).click();
   const opened=await page.evaluate(()=>window.__opened);const url=new URL(opened[0]);assert.equal(url.searchParams.get('phone'),'919876543210');assert.equal(url.searchParams.get('text'),custom);
   await page.evaluate(()=>delete window.__opened);
   await modal.getByRole('button',{name:'Close coupon sharing'}).click();
   await page.getByRole('button',{name:'Share coupon FESTIVE20 on WhatsApp'}).click();
   const text=await page.getByRole('dialog').locator('textarea').inputValue();assert.match(text,/FESTIVE20/);assert(!text.includes('WELCOME10'));assert(!text.includes('Valid Until'));assert(!text.includes('Minimum purchase'));assert.match(text,/SPECIAL OFFER/);assert.match(text,/20% OFF/);
   await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  }
  console.log(role,width,'navigation, screen smoke checks and coupon checks passed');
 }
 await page.close();
}
assert.deepEqual(errors,[]);console.log('All checks passed; no runtime errors. API calls mocked; WhatsApp opening intercepted.');
}finally{await browser.close();await server.close()}

