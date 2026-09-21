import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sugar='696c4539ef1c68d790d9c6a0', conrad='6aac0d32b262b9e75ba4515d';
async function run(name, venue, {missing=false, mismatch=false, fail=false}={}) {
 let handler; const calls=[]; const writes=[];
 const env={HIGHLEVEL_API_KEY:'sugar-key',HIGHLEVEL_LOCATION_ID:'sugar-location',HIGHLEVEL_TOUR_CALENDAR_ID:'sugar-calendar',...(!missing?{CONRAD_HIGHLEVEL_API_KEY:'conrad-key',CONRAD_HIGHLEVEL_LOCATION_ID:'conrad-location',CONRAD_HIGHLEVEL_TOUR_CALENDAR_ID:'conrad-calendar'}:{})};
 const entities={Venue:{get:async()=>({id:venue,name:venue===conrad?'Conrad':'Sugar',head_planner_name:'Jeff',timezone:'America/Chicago',domain:'example.com'})},ChatSession:{get:async()=>({venue_id:mismatch?sugar:venue}),update:async(...x)=>writes.push(x)},HandoffRequest:{create:async x=>{writes.push(x);return {id:'handoff'}}},ContactSubmission:{create:async x=>({id:'fallback'})}};
 const context={Response,Date,Intl,console:{log(){},warn(){},error(){}},createClientFromRequest:()=>({asServiceRole:{entities},entities}),Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},fetch:async(url,opts)=>{calls.push({url,...opts});if(fail)return Response.json({error:'failure'},{status:400});if(url.includes('free-slots'))return Response.json({'2026-09-25':{slots:['2026-09-25T15:00:00Z']}});if(url.includes('contacts/upsert'))return Response.json({contact:{id:'contact'}});return Response.json({id:'id',messageId:'message'});}};
 vm.runInNewContext(fs.readFileSync(`base44/functions/${name}/entry.ts`,'utf8').replace(/^import .*\n/gm,''),context);
 const body={venueId:venue,venue_id:venue,chatSessionId:'session',leadName:'Test Person',leadPhone:'5555555555',topicSummary:'test',originalQuestion:'test',name:'Test Person',email:'test@example.invalid',phone:'5555555555',tour_date:'2026-09-25',tour_time:'10:00 AM',startDate:'2026-09-25',endDate:'2026-09-25'};
 const response=await handler({json:async()=>body});return {response,payload:await response.json(),calls,writes};
}
for(const fn of ['getHighLevelAvailability','createHighLevelAppointment','createHighLevelLeadAndNotify','createHighLevelContact']){
 for(const venue of [sugar,conrad]){
  const r=await run(fn,venue);assert.equal(r.response.status,200,fn);assert.ok(r.calls.length);
  const prefix=venue===conrad?'conrad':'sugar';for(const c of r.calls)assert.equal(c.headers.Authorization,`Bearer ${prefix}-key`);
  for(const c of r.calls.filter(c=>c.body)){const b=JSON.parse(c.body);if(b.locationId)assert.equal(b.locationId,`${prefix}-location`);if(b.calendarId)assert.equal(b.calendarId,`${prefix}-calendar`);}
  if(fn==='getHighLevelAvailability'){assert.match(r.calls[0].url,new RegExp(`${prefix}-calendar`));assert.equal(r.payload.slots[0].times[0],'10:00 AM');}
  if(fn==='createHighLevelAppointment'){const b=JSON.parse(r.calls.at(-1).body);assert.match(b.startTime,/-05:00$/);assert.equal(b.endTime,undefined);assert.equal(b.ignoreFreeSlotValidation,false);}
 }
 for(const opts of [{missing:true},{}]){const r=await run(fn,opts.missing?conrad:'unknown',opts);assert.equal(r.calls.length,0,`${fn} must not fall back`);}
}
const mismatch=await run('createHighLevelLeadAndNotify',conrad,{mismatch:true});assert.equal(mismatch.response.status,400);assert.equal(mismatch.calls.length,0);
const failed=await run('createHighLevelAppointment',conrad,{fail:true});assert.notEqual(failed.response.status,200);assert.ok(!failed.payload.success);
console.log('PASS: venue routing, missing credentials, cross-venue handoff rejection, Central time, booking failures; all external calls mocked.');
