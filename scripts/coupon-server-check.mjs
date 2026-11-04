// Isolated server regression: database calls are replaced, never sent to Neon.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {getPool} from '../server/db.ts';
import {route} from '../server/router.ts';
process.env.DATABASE_URL='postgres://test:test@127.0.0.1:1/test';
const pool=getPool();
const rows={code:'DIWALI12',percentage:20,min_order_value:399,expiry_date:'2099-12-04',is_active:true,usage_limit:30,usage_count:0};
pool.query=async(sql,params)=>{assert.match(sql,/SELECT code, percentage/);assert.deepEqual(params,['DIWALI12']);return {rows:[rows]}};
const server=createServer((req,res)=>void route(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
try{
let response=await fetch(`${base}/api/coupon?code=diwali12&p=99`);let json=await response.json();assert.equal(json.data.percentage,20);assert.equal(json.data.available,true);assert.equal(json.data.usage_count,undefined);
response=await fetch(`${base}/api/coupon-page?code=DIWALI12`);let html=await response.text();assert.equal(response.status,200);assert(html.includes('Your Coupon from ERROR 404'));assert(html.includes('property="og:image" content="https://error404-pos.vercel.app/error404-icon-512.png"'));assert.equal((html.match(/property="og:title"/g)||[]).length,1);assert(html.includes('type="module"'));
rows.is_active=false;json=await(await fetch(`${base}/api/coupon?code=DIWALI12`)).json();assert.equal(json.data.available,false);
rows.is_active=true;rows.usage_count=30;json=await(await fetch(`${base}/api/coupon?code=DIWALI12`)).json();assert.equal(json.data.available,false);
rows.usage_count=0;rows.expiry_date='2000-01-01';json=await(await fetch(`${base}/api/coupon?code=DIWALI12`)).json();assert.equal(json.data.available,false);
response=await fetch(`${base}/api/coupon`);assert.equal(response.status,404);
console.log('Public coupon, saved values, expiry/usage/active status, metadata and missing-code checks passed. No database connection used.');
}finally{server.close();await pool.end()}
