import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let rows=[{id:'first',venue_id:'venue',date:'2026-09-24',google_event_id:'weekend',notes:'Keep my notes',deposit_paid:true},{id:'daily',venue_id:'venue',date:'2026-09-25',google_event_id:'weekend',notes:'Preserve legacy note'},{id:'manual',venue_id:'venue',date:'2026-10-01'}];
const events=[{id:'weekend',start:{date:'2026-09-24'},end:{date:'2026-09-27'}}];
const entities={CalendarSyncEvent:{create:async()=>({})},Venue:{update:async()=>({}),get:async()=>({timezone:'America/Chicago'})},BlockedDate:{filter:async()=>[]},BookedWeddingDate:{filter:async()=>rows,update:async(id,patch)=>Object.assign(rows.find(r=>r.id===id),patch),create:async data=>{const row={id:'new'+rows.length,...data};rows.push(row);return row;}}};
const client={auth:{me:async()=>({role:'venue_owner',venue_id:'venue'})},asServiceRole:{entities,connectors:{getCurrentAppUserConnection:async()=>({accessToken:'test'})}}};
function load(file) {
 let handler;const ctx=vm.createContext({Intl,Date,URLSearchParams,Response,console,createClientFromRequest:()=>client,Deno:{serve:fn=>handler=fn},fetch:async()=>({ok:true,status:200,json:async()=>({items:events})})});
 vm.runInContext(fs.readFileSync(file,'utf8').replace(/^import .*\n/,''),ctx);return {ctx,handler};
}
const {ctx,handler}=load('base44/functions/syncGoogleCalendar/entry.ts');
const dates=e=>JSON.parse(JSON.stringify(ctx.eventDatesInTz(e,'America/Chicago')));
const timed=(s,e)=>({start:{dateTime:s},end:{dateTime:e}});
assert.deepEqual(dates(events[0]),['2026-09-24','2026-09-25','2026-09-26']);
assert.deepEqual(dates(timed('2026-09-24T15:00:00-05:00','2026-09-26T00:00:00-05:00')),['2026-09-24','2026-09-25']);
assert.deepEqual(dates(timed('2026-03-07T12:00:00-06:00','2026-03-09T12:00:00-05:00')),['2026-03-07','2026-03-08','2026-03-09']);
assert.deepEqual(dates(timed('2026-10-31T12:00:00-05:00','2026-11-02T12:00:00-06:00')),['2026-10-31','2026-11-01','2026-11-02']);
const req={json:async()=>({action:'sync_calendar',calendarId:'calendar',venueId:'venue'})};
let result=await (await handler(req)).json();assert.equal(result.recordsUpdated,1);assert.equal(result.recordsMerged,1);assert.equal(result.recordsCreated,0);
assert.equal(rows[0].end_date,'2026-09-26');assert.equal(rows[0].notes,'Keep my notes');assert.equal(rows[0].deposit_paid,true);assert.equal(rows[1].merged_into_id,'first');assert.equal(rows[1].notes,'Preserve legacy note');assert.equal(rows[2].end_date,undefined);
result=await (await handler(req)).json();assert.equal(result.recordsCreated,0);assert.equal(result.recordsUpdated,0);assert.equal(result.recordsMerged,0);
const availability=load('base44/functions/checkDateAvailability/entry.ts').handler;
for(const date of ['2026-09-24','2026-09-25','2026-09-26']) { const answer=await (await availability({json:async()=>({venueId:'venue',date})})).json();assert.equal(answer.isAvailable,false);assert.ok(!JSON.stringify(answer).includes('Keep my notes')); }
let answer=await (await availability({json:async()=>({venueId:'venue',date:'2026-09-27'})})).json();assert.equal(answer.isAvailable,true);
answer=await (await availability({json:async()=>({venueId:'venue',date:'2026-09-26',mode:'monthOpenings',weekdays:[6]})})).json();assert.ok(!answer.monthOpenDates.includes('2026-09-26'));
// A moved Google event updates its range; archived copies cannot leave stale blocked days.
events[0]={id:'weekend',start:{date:'2026-10-08'},end:{date:'2026-10-11'}};
await handler(req);answer=await (await availability({json:async()=>({venueId:'venue',date:'2026-09-25'})})).json();assert.equal(answer.isAvailable,true);
// Distinct overlapping events stay distinct; source identity includes calendar.
events.push({id:'second',start:{date:'2026-10-08'},end:{date:'2026-10-09'}});result=await (await handler(req)).json();assert.equal(result.recordsCreated,1);
const unauthorized=await handler({json:async()=>({action:'sync_calendar',calendarId:'calendar',venueId:'another-venue'})});assert.equal(unauthorized.status,403);
console.log('PASS: date ranges, DST, exclusive ends, legacy consolidation, metadata preservation, idempotent sync, range availability, alternatives, moved events, overlapping events, and venue authorization. All tests use mocked data.');
