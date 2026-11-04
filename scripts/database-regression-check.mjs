// Entirely in-memory PostgreSQL. No credentials or production connection.
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const modulePath=process.env.PGLITE_MODULE || pathToFileURL(`${process.env.TEMP}/error404-invoice-test/package/dist/index.js`).href;
const {PGlite}=await import(modulePath);
const db=new PGlite();
try {
  const run=async file=>{
    const sql=(await readFile(file,'utf8')).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi,'');
    try { await db.exec(sql); } catch(e) { console.error(file,e.message); throw e; }
  };
  await run('neon/000_compat.sql');
  for(const f of (await readdir('neon/migrations')).filter(f=>f.endsWith('.sql')&&!f.includes('0036')).sort()) await run(`neon/migrations/${f}`);
  console.log('Schema and remarks migration applied in isolated PostgreSQL.');
  const product=async name=>(await db.query("INSERT INTO products(name,price,stock_quantity) VALUES($1,100,10) RETURNING id",[name])).rows[0].id;
  const pid=await product('Fixture Shirt');
  const variant=async(name,code)=>(await db.query("INSERT INTO product_variants(product_id,variant_name,price,stock,barcode) VALUES($1,$2,100,10,$3) RETURNING id",[pid,name,code])).rows[0].id;
  const small=await variant('Small','KEEP-SMALL');
  const medium=await variant('Medium','DUPLICATE');
  const large=await variant('Large','duplicate');
  await db.query("INSERT INTO barcode_registry(barcode_value,entity_type,product_id,variant_id) VALUES('DUPLICATE','variant',$1,$2)",[pid,medium]);
  await run('neon/migrations/20261104_0036_barcode_integrity.sql');
  const codes=(await db.query('SELECT id,barcode FROM product_variants WHERE product_id=$1',[pid])).rows;
  assert.equal(codes.find(v=>v.id===small).barcode,'KEEP-SMALL');
  assert.equal(codes.find(v=>v.id===medium).barcode,'DUPLICATE');
  assert.notEqual(codes.find(v=>v.id===large).barcode.toUpperCase(),'DUPLICATE');
  assert.equal(new Set(codes.map(v=>v.barcode.toUpperCase())).size,3);
  await assert.rejects(db.query('UPDATE product_variants SET barcode=$1 WHERE id=$2',['KEEP-SMALL',large]),/another item/);
  await assert.rejects(db.query("UPDATE barcode_registry SET variant_id=$1 WHERE barcode_value='KEEP-SMALL'",[large]),/another item/);
  const results=await Promise.all(Array.from({length:8},()=>db.query('SELECT create_barcode_and_receive_stock($1,$2,1) AS result',[pid,small])));
  assert(results.every(r=>r.rows[0].result.barcode_value==='KEEP-SMALL'));
  assert.equal(Number((await db.query('SELECT stock FROM product_variants WHERE id=$1',[small])).rows[0].stock),18);
  const fresh=await variant('XL',null);
  assert((await db.query('SELECT barcode FROM product_variants WHERE id=$1',[fresh])).rows[0].barcode);
  await run('neon/migrations/20261104_0036_barcode_integrity.sql');
  assert.equal((await db.query('SELECT barcode FROM product_variants WHERE id=$1',[small])).rows[0].barcode,'KEEP-SMALL');
  const advanced=(await db.query(`INSERT INTO advance_orders(deposit_id,customer_name,phone,product_name,total_amount,deposit_amount,expected_delivery_date,remarks,reference_number)
    VALUES('DEP-TEST','Customer','9876543210','Shirt',100,50,current_date,' 111222 ','REF-TEST') RETURNING id`)).rows[0].id;
  const completed=(await db.query("SELECT * FROM complete_advance_order_v2($1,'cash',50,NULL,0,0,'Payment note')",[advanced])).rows[0];
  assert.equal((await db.query('SELECT remarks FROM orders WHERE id=$1',[completed.order_id])).rows[0].remarks,' 111222 ');
  assert.equal((await db.query('SELECT remarks FROM advance_orders WHERE id=$1',[advanced])).rows[0].remarks,' 111222 ');
  await db.query("UPDATE orders SET remarks='Edited remarks' WHERE id=$1",[completed.order_id]);
  assert.equal((await db.query('SELECT remarks FROM advance_orders WHERE id=$1',[advanced])).rows[0].remarks,'Edited remarks');
  const sale=(await db.query(`SELECT complete_pos_sale_with_inventory('Customer','9876543210','POS Counter',$1::jsonb,p_remarks=>' 111222 ',p_billing_date=>'2030-01-01') AS result`,[JSON.stringify([{name:'Shirt',product_id:pid,variant_id:small,quantity:1,base_price:100,line_total:100}])])).rows[0].result;
  assert.equal((await db.query('SELECT remarks FROM orders WHERE id=$1',[sale.order_id])).rows[0].remarks,' 111222 ');
  const priced=(await db.query(`SELECT complete_pos_sale_with_inventory('Customer','9876543210','POS Counter',$1::jsonb,p_discount_amount=>10,p_manual_discount_amount=>5,p_total_gst=>4.25,p_gst_enabled=>true,p_shipping=>2,p_delivery_charge=>3) AS result`,[JSON.stringify([{name:'Shirt',product_id:pid,variant_id:small,quantity:1,base_price:100,line_total:100}])])).rows[0].result;
  assert.equal(Number((await db.query('SELECT total FROM orders WHERE id=$1',[priced.order_id])).rows[0].total),94.25);
  const beforeOrder=(await db.query('SELECT id FROM products ORDER BY created_at DESC,id DESC')).rows.map(r=>r.id);
  await db.query('UPDATE products SET price=101,stock_quantity=30,updated_at=now() WHERE id=$1',[pid]);
  assert.deepEqual((await db.query('SELECT id FROM products ORDER BY created_at DESC,id DESC')).rows.map(r=>r.id),beforeOrder);
  console.log('Passed: GST/discount/delivery totals and stable creation ordering after stock/price edits.');
  console.log('Passed: exact POS/advance remarks, final invoice persistence, payment-note separation and edit synchronization.');
  console.log('Passed: duplicate repair, preserved unique codes, ownership protection, variant allocation, rapid restocks, rerun safety.');
} finally { await db.close(); }
