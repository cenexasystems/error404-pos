import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir='tmp/pdfs';await mkdir(dir,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5188,hmr:false}});await server.listen();
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
const page=await browser.newPage();await page.route('**/api/**',r=>r.fulfill({json:{data:[],count:0,versions:{}}}));await page.goto('http://127.0.0.1:5188/admin-login');await page.locator('input[type=password]').waitFor();
for(const kind of ['standard','long','coupon','coupon-long','legacy','legacy-long','advance-legacy']){
 const bytes=await page.evaluate(async kind=>(await import('/scripts/pdf-test-fixtures.ts')).generate(kind),kind);await writeFile(`${dir}/${kind}.pdf`,Buffer.from(bytes));
 const info=execFileSync('pdfinfo',[`${dir}/${kind}.pdf`],{encoding:'utf8'});const count=Number(info.match(/Pages:\s+(\d+)/)[1]);if(['long','legacy-long'].includes(kind))assert(count>1 && count<12,`${kind}: ${count} pages`);else assert.equal(count,1,kind);console.log(kind,count,'pages');
}
for(const tab of ['revenue','today','products','categories','coupons']){
 const event=page.waitForEvent('download');await page.evaluate(async tab=>(await import('/scripts/pdf-test-fixtures.ts')).report(tab),tab);await(await event).saveAs(`${dir}/report-${tab}.pdf`);console.log('report',tab,execFileSync('pdfinfo',[`${dir}/report-${tab}.pdf`],{encoding:'utf8'}).match(/Pages:\s+\d+/)[0]);
}
assert.equal(await page.evaluate(async()=>(await import('/scripts/pdf-test-fixtures.ts')).barcodeDecode()),'ULV10000001');
assert(!(await page.evaluate(async()=>(await import('/scripts/pdf-test-fixtures.ts')).thermal())).includes('<img'));
const html=await page.evaluate(async()=>(await import('/scripts/pdf-test-fixtures.ts')).printable());assert(html.includes('<img'));const print=await browser.newPage();await print.setContent(html);await print.pdf({path:`${dir}/printed-invoice.pdf`,preferCSSPageSize:true,printBackground:true});
console.log('Barcode round-trip decode, thermal logo exclusion, sheet logo and print PDF passed.');
}finally{await browser.close();await server.close()}
