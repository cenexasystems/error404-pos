import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5187}});await server.listen();
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const order={id:'11111111-1111-4111-8111-111111111111',invoice_no:'00000030',customer_name:'Test Customer',phone:'9876543210',address:'POS Counter',status:'completed',order_mode:'offline',order_type:'pos_sale',total:499,created_at:new Date().toISOString(),items:[],delivery_charge:0,total_gst:0};
 await page.route('**/api/**',r=>{const body=r.request().postDataJSON()||{};return r.fulfill({json:{data:body.table==='orders'?[order]:[],count:1,versions:{}}})});
 await page.addInitScript(()=>sessionStorage.setItem('universal-look-admin-session',JSON.stringify({state:{isLoggedIn:true,role:'admin',token:'fixture'},version:0})));
 await page.goto('http://127.0.0.1:5187/dashboard');
 await page.getByRole('button',{name:'Order History',exact:true}).click();
 await page.getByRole('button',{name:'View details',exact:true}).click();
 assert(await page.getByText('Price Breakdown',{exact:true}).isVisible());
 assert.equal(await page.getByText('POS Counter',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Analytics Dashboard',exact:true}).click();
 const year=page.getByRole('heading',{name:/Revenue Trend This Year/});await year.waitFor();
 const weekly=page.getByRole('heading',{name:/Revenue This Week/});
 const a=await year.locator('..').boundingBox(),b=await weekly.locator('..').boundingBox();
 assert(Math.abs(b.y-a.y-a.height-24)<2,JSON.stringify({a,b}));
 console.log('Populated order details and 24px analytics spacing passed.');
}finally{await browser.close();await server.close()}
