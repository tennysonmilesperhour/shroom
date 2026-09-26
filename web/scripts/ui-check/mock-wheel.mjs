// WHEEL_FIXTURE is a JSON export of strain rows; optional proposed patch overlays it.
import fs from 'node:fs';
import fixture from './fixtures.mjs';
if (!process.env.WHEEL_FIXTURE) throw new Error('Set WHEEL_FIXTURE to the audited strain JSON export');
const rows=JSON.parse(fs.readFileSync(process.env.WHEEL_FIXTURE,'utf8'));
const proposed=process.env.WHEEL_PROPOSED_PATCH ? JSON.parse(fs.readFileSync(process.env.WHEEL_PROPOSED_PATCH,'utf8')) : [];
fixture.strains=rows.map(row=>{
 const r={...fixture.strains[0],...row,...proposed.find(p=>p.id===row.id)?.after};
 for(const key of ['alkaloid_total_pct','alkaloid_total_low_pct','alkaloid_total_high_pct']) if(r[key]!=null)r[key]=Number(r[key]);
 return r;
});
await import('./mock-supabase.mjs');
