// Isolated PostgreSQL/WASM regression test; never connects to the live database.
// Set PGLITE_MODULE to an installed @electric-sql/pglite module URL.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE orders(invoice_no text UNIQUE, created_at timestamptz);
    CREATE TABLE advance_orders(invoice_number text);
    CREATE SEQUENCE invoice_sequence;
    INSERT INTO orders VALUES ('00000029', '2030-01-01'), ('00000025', '2020-01-01');
    INSERT INTO advance_orders VALUES ('00000030');`);
  const migration = await readFile('neon/migrations/20261103_0034_monotonic_invoice_sequence.sql', 'utf8');
  await db.exec(migration);
  const next = async () => (await db.query('SELECT get_next_invoice_no() AS n')).rows[0].n;
  assert.equal(await next(), '00000031');
  const numbers = await Promise.all(Array.from({length:30}, next));
  assert.deepEqual(numbers, Array.from({length:30}, (_,i)=>String(i+32).padStart(8,'0')));
  await db.exec("INSERT INTO orders VALUES ('INV00000100', '1990-01-01')");
  assert.equal(await next(), '00000101');
  await db.exec("INSERT INTO orders VALUES ('UL-20260101-000200', now())");
  assert.equal(await next(), '00000201');
  await db.exec(migration); // Reapplying must not reset or renumber anything.
  assert.equal(await next(), '00000202');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM orders WHERE invoice_no IN ('00000029','00000025','INV00000100','UL-20260101-000200')")).rows[0].n,4);
  await db.exec("SELECT setval('invoice_sequence',99999999)");
  assert.equal(await next(), '100000000');
  console.log('Passed: high-water repair, rapid allocations, date independence, historic IDs, migration rerun, and >8-digit numbers.');
  console.log('PGlite serializes queries; separate live-session lock contention requires a staging PostgreSQL test.');
} finally { await db.close(); }
