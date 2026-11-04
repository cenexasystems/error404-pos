import {createServer} from 'vite';
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({cacheDir:'node_modules/.vite-coupon-public',server:{host:'127.0.0.1',port:5197,hmr:false}});await server.listen();const browser=await chromium.launch({channel:'msedge',headless:true});
const coupon={code:'DIWALI12',percentage:20,min_order_value:399,expiry_date:'2099-12-04',available:true};
try {const page=await browser.newPage();await page.route('**/api/**',r=>r.fulfill({json:{data:r.request().url().includes('/api/coupon?')?coupon:[],count:0,versions:{}}}));
for(const width of [320,390,1440]){await page.setViewportSize({width,height:850});await page.goto('http://127.0.0.1:5197/coupon/DIWALI12?p=99&n=Hema');await page.getByText('20% OFF',{exact:true}).waitFor();assert.equal(await page.getByText('99% OFF',{exact:true}).count(),0);assert(await page.getByText('A gift for Hema').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();const download=await downloadEvent;const path=`tmp/pdfs/coupon-final-${width}.pdf`;await download.saveAs(path);const info=execFileSync('pdfinfo',[path],{encoding:'utf8'});assert.match(info,/Pages:\s+1/);console.log(width,info.match(/Page size:.*/)[0]);if(width===390){await page.screenshot({path:'tmp/coupon-public-final.png'});execFileSync('pdftoppm',['-scale-to','1000','-png','-singlefile',path,'tmp/pdfs/coupon-final']);}}
// Stress a long name/code: PDF must still be one complete page.
const bytes=await page.evaluate(async()=>{const {couponPdf}=await import('/src/lib/couponPdf.tsx');const file=await couponPdf({code:'LONG-COUPON-CODE-ABCDEFGHIJKLMNOPQRSTUVWXYZ',percentage:100,min_order_value:1234567,expiry_date:'2099-12-04'},{customerName:'Customer With A Very Long Personal Name'});return Array.from(new Uint8Array(await file.arrayBuffer()))});await writeFile('tmp/pdfs/coupon-final-long.pdf',Buffer.from(bytes));assert.match(execFileSync('pdfinfo',['tmp/pdfs/coupon-final-long.pdf'],{encoding:'utf8'}),/Pages:\s+1/);
coupon.available=false;await page.reload();await page.getByText('This coupon is no longer available').waitFor();assert.equal(await page.getByRole('button',{name:'Download PDF'}).count(),0);
console.log('Public page, tampered offer ignored, personalization, download, long content and unavailable state passed.');
}finally{await browser.close();await server.close()}
