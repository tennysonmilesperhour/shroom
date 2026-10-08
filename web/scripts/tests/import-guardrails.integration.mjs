import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');
const db = new PGlite();
console.log("Initializing local database");
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin return; end; $$;`);
const files = readdirSync(root + '/supabase/migrations').sort();
// Legacy baseline grants refer to views supplied out of order in the old SQL export.
// Establish those baseline views first; the new migration is tested in its normal order.
const view = files.findIndex(f => f.includes('_10_analytics_views'));
files.splice(files.findIndex(f => f.includes('_09_commerce_analytics')), 0, files.splice(view, 1)[0]);
for (const file of files) {
  console.log("Applying", file);
  let sql = readFileSync(root + '/supabase/migrations/' + file, 'utf8');
  sql = sql.replace(/create extension if not exists pgcrypto[^;]*;/gi, '');
  try { await db.exec(sql); } catch (e) { console.error('Migration failed', file, e.message); process.exit(1); }
}
await db.exec(`insert into strains(name,mushroom_type) values('Golden Teacher','psychedelic');
insert into batches(lot_code,strain_id,stage,container_type) select 'QB-GT-260529',id,'harvesting','grain_bag' from strains where name='Golden Teacher';
insert into harvests(batch_id,harvested_on,flush_number,weight_kg,dry_weight_kg,source_ref) select id,'2026-06-20',1,0.067,0.008,'QB-GT-260529-F1' from batches where lot_code='QB-GT-260529';`);
const batch = (await db.query(`select id from batches where lot_code='QB-GT-260529'`)).rows[0].id;
const before = (await db.query('select count(*)::int as n from harvests')).rows[0].n;
await db.exec(`insert into customers(name) values('Archive scope test');
insert into products(name) values('Traceable harvest');
insert into orders(order_number,customer_id,order_date) select 'ARCHIVE-SCOPE',id,'2026-06-21' from customers where name='Archive scope test';
insert into order_lines(order_id,product_id,harvest_id,quantity) select o.id,p.id,h.id,1 from orders o,products p,harvests h where o.order_number='ARCHIVE-SCOPE' and p.name='Traceable harvest' and h.source_ref='QB-GT-260529-F1';`);
const trace = async () => (await db.query(`select o.order_number,h.source_ref,b.lot_code from order_lines l join orders o on o.id=l.order_id join harvests h on h.id=l.harvest_id join batches b on b.id=h.batch_id where o.order_number='ARCHIVE-SCOPE'`)).rows;
const traceBefore = await trace();
assert.equal(traceBefore.length, 1);
await db.query('select archive_batches($1,true)', [[batch]]);
assert.deepEqual(await trace(), traceBefore);
assert.equal((await db.query('select count(*)::int as n from harvests')).rows[0].n, before);
assert.ok((await db.query('select archived_at from batches where id=$1', [batch])).rows[0].archived_at);
await db.query('select archive_batches($1,false)', [[batch]]);
assert.deepEqual(await trace(), traceBefore);
assert.equal((await db.query('select archived_at from batches where id=$1', [batch])).rows[0].archived_at, null);
const plan = { harvests: [{ source_ref: 'QB-GT-260529-F1', _batch_lot_code: 'QB-GT-260529', flush_number: 1, harvested_on: '2026-06-20', weight_kg: 0.002, dry_weight_kg: 0 }] };
await assert.rejects(db.query('select import_workbook($1,$2,$3)', [plan, 'test', '00000000-0000-4000-8000-000000000001']), /lose more than half/);
assert.equal(Number((await db.query('select weight_kg from harvests where source_ref=$1', ['QB-GT-260529-F1'])).rows[0].weight_kg), 0.067);
plan.harvests[0].weight_kg = 0.070; plan.harvests[0].dry_weight_kg = 0.008;
await db.query('select import_workbook($1,$2,$3)', [plan, 'test', '00000000-0000-4000-8000-000000000002']);
assert.equal((await db.query('select count(*)::int as n from harvest_revisions')).rows[0].n, 1);
assert.equal((await db.query('select container_type from batches where id=$1', [batch])).rows[0].container_type, 'grain_bag');
await db.exec(`insert into sheet_sync_queue(entity,entity_id,op) values('batch',1,'update')`);
assert.equal((await db.query('select count(*)::int as n from sheet_sync_queue where synced_at is null')).rows[0].n, 0);
await db.exec(`insert into harvests(batch_id,harvested_on,flush_number,weight_kg,dry_weight_kg,source_ref) select id,'2026-06-21',2,0.002,0,'pick-2' from batches where lot_code='QB-GT-260529'`);
assert.equal((await db.query(`select dry_g from v_dry_ratio where harvest_id=(select id from harvests where source_ref='pick-2')`)).rows[0].dry_g, null);
await db.exec(`update harvests set dry_weight_recorded=true where source_ref='pick-2'`);
assert.equal(Number((await db.query(`select dry_g from v_dry_ratio where harvest_id=(select id from harvests where source_ref='pick-2')`)).rows[0].dry_g), 0);
console.log('Migration integration checks passed. Archive/restore preserves harvests; suspicious weights rejected atomically; revisions recorded; bag type preserved; disabled queue stays empty.');
await db.close();
