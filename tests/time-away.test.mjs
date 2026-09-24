import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ids={staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004',managerA:'10000000-0000-4000-8000-000000000007'};
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD],
 staffZero:[process.env.KSS_TEST_STAFF_ZERO_EMAIL,process.env.KSS_TEST_STAFF_ZERO_PASSWORD]};
const keyFor=()=>crypto.randomUUID();
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args={}){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
const adminAction=(client,action,args={})=>rpc(client,'time_away_admin_action',{p_action:action,p_reason:'Synthetic TASK-17B authority proof',...args});

test('17B bounded Time Away team, request, decision, date and source proof', {timeout:180000}, async()=>{
 assert.equal(new URL(url).hostname.split('.')[0],'dnfhkmmnlbiabqypclqg','literal Dev project only');
 assert.ok(Object.values(credentials).every(([email,password])=>email&&password));
 const [admin,office,manager,staffA,staffB,staffZero]=await Promise.all(Object.keys(credentials).map(signed));
 let config=await rpc(admin,'time_away_admin_read');
 async function team(name){let existing=config.teams.find(item=>item.name===name);
  if(!existing){const id=await adminAction(admin,'CREATE_TEAM',{p_name:name});config=await rpc(admin,'time_away_admin_read');existing=config.teams.find(item=>item.id===id);}return existing;}
 const teamA=await team('Synthetic Operations Team A'),teamB=await team('Synthetic Operations Team B');
 assert.ok(teamA.active&&teamB.active);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 async function member(teamId,person){config=await rpc(admin,'time_away_admin_read');
  let current=config.memberships.find(item=>item.teamId===teamId&&item.personId===person&&!item.revokedAt);
  if(!current){await adminAction(admin,'ADD_MEMBER',{p_team:teamId,p_person:person,p_start:today});config=await rpc(admin,'time_away_admin_read');current=config.memberships.find(item=>item.teamId===teamId&&item.personId===person&&!item.revokedAt);}return current;}
 const memberA=await member(teamA.id,ids.staffA),memberB=await member(teamB.id,ids.staffB);
 assert.ok(memberA&&memberB);
 const oneYear=new Date(Date.now()+350*86400000).toISOString();
 let grant=config.grants.find(item=>item.teamId===teamA.id&&item.personId===ids.managerA&&!item.revokedAt&&new Date(item.effectiveUntil)>new Date());
 if(!grant){await adminAction(admin,'GRANT_APPROVER',{p_team:teamA.id,p_person:ids.managerA,p_until:oneYear,
  p_actions:['VIEW_REQUESTS','DECIDE_REQUEST','DECIDE_CANCELLATION','VIEW_CALENDAR','VIEW_COVERAGE']});
  config=await rpc(admin,'time_away_admin_read');grant=config.grants.find(item=>item.teamId===teamA.id&&item.personId===ids.managerA&&!item.revokedAt);}
 assert.ok(grant);
 const authorityA=await rpc(staffA,'time_away_authority');
 assert.ok(authorityA.myTeams.some(item=>item.id===teamA.id));
 assert.ok(!(await rpc(staffB,'time_away_authority')).myTeams.some(item=>item.id===teamA.id));
 assert.ok((await staffA.from('time_away_requests').select('id')).error,'raw request table denied');
 assert.ok((await manager.from('time_away_team_memberships').select('id')).error,'raw membership table denied');
 const noTeamDraft=await rpc(staffZero,'time_away_save_draft',{p_request:null,p_category:'OTHER_TIME_AWAY',
  p_segments:[{kind:'WHOLE_DAY',date:'2026-12-15'}],p_expected_revision:0,p_key:keyFor()});
 assert.ok((await staffZero.rpc('time_away_submit',{p_request:noTeamDraft,p_team:null,p_expected_revision:1,
  p_key:keyFor()})).error,'Staff without a team can save but cannot submit');
 const whole=[{kind:'WHOLE_DAY',date:'2026-11-09'}];
 const draft=await rpc(staffA,'time_away_save_draft',{p_request:null,p_category:'ANNUAL_LEAVE',p_segments:whole,
  p_expected_revision:0,p_key:keyFor()});
 const draftDetail=await rpc(staffA,'time_away_detail',{p_request:draft});
 assert.equal(draftDetail.state,'DRAFT');assert.equal(draftDetail.teamId,null);
 assert.ok((await office.rpc('time_away_transition',{p_request:draft,p_action:'APPROVED',p_expected_revision:1,
  p_key:keyFor(),p_reason:'APPROVED_AS_REQUESTED'})).error);
 const submitKey=keyFor();
 await rpc(staffA,'time_away_submit',{p_request:draft,p_team:teamA.id,p_expected_revision:1,p_key:submitKey});
 await rpc(staffA,'time_away_submit',{p_request:draft,p_team:teamA.id,p_expected_revision:1,p_key:submitKey});
 assert.equal((await rpc(staffA,'time_away_detail',{p_request:draft})).teamId,teamA.id);
 const other=await rpc(staffB,'time_away_save_draft',{p_request:null,p_category:'UNPAID_LEAVE',
  p_segments:[{kind:'WHOLE_DAY',date:'2026-11-10'}],p_expected_revision:0,p_key:keyFor()});
 await rpc(staffB,'time_away_submit',{p_request:other,p_team:teamB.id,p_expected_revision:1,p_key:keyFor()});
 const queueA=await rpc(manager,'time_away_list',{p_team:teamA.id});
 assert.ok(queueA.items.some(item=>item.id===draft));assert.ok(!queueA.items.some(item=>item.id===other));
 assert.ok((await manager.rpc('time_away_list',{p_team:teamB.id})).error);
 assert.ok((await manager.rpc('time_away_detail',{p_request:other})).error);
 assert.ok((await manager.rpc('time_away_conflicts',{p_request:other})).error);
 assert.ok((await office.rpc('time_away_transition',{p_request:draft,p_action:'APPROVED',p_expected_revision:2,
  p_key:keyFor(),p_reason:'APPROVED_AS_REQUESTED'})).error,'Office role alone cannot approve');
 assert.ok((await admin.rpc('time_away_transition',{p_request:draft,p_action:'APPROVED',p_expected_revision:2,
  p_key:keyFor(),p_reason:'APPROVED_AS_REQUESTED'})).error,'Super role alone cannot approve');
 const selfGrant=await adminAction(admin,'GRANT_APPROVER',{p_team:teamA.id,p_person:ids.staffA,p_until:oneYear,
  p_actions:['DECIDE_REQUEST']});
 assert.ok((await staffA.rpc('time_away_transition',{p_request:draft,p_action:'APPROVED',p_expected_revision:2,
  p_key:keyFor(),p_reason:'APPROVED_AS_REQUESTED'})).error,'self approval denied even with an exact approver grant');
 await adminAction(admin,'REVOKE_APPROVER',{p_id:selfGrant});
 const beforeConflict=await rpc(manager,'time_away_conflicts',{p_request:draft});
 assert.ok(beforeConflict.allocations.some(item=>item.source==='SITE_SHIFT'&&item.allocationResponse==='ACCEPTED'));
 assert.equal(beforeConflict.allocationChanged,false);
 const decisionKey=keyFor();
 assert.equal(await rpc(manager,'time_away_transition',{p_request:draft,p_action:'APPROVED',p_expected_revision:2,
  p_key:decisionKey,p_reason:'APPROVED_AS_REQUESTED'}),3);
 assert.equal(await rpc(manager,'time_away_transition',{p_request:draft,p_action:'APPROVED',p_expected_revision:2,
  p_key:decisionKey,p_reason:'APPROVED_AS_REQUESTED'}),3,'idempotent retry');
 const approved=await rpc(staffA,'time_away_detail',{p_request:draft});
 assert.equal(approved.state,'APPROVED');assert.equal(approved.decisions[0].reasonCode,'APPROVED_AS_REQUESTED');
 assert.equal(approved.teamId,teamA.id);
 assert.equal((await rpc(manager,'time_away_conflicts',{p_request:draft})).allocations.length,beforeConflict.allocations.length,
  'leave approval does not change allocations');
 await rpc(staffA,'time_away_transition',{p_request:draft,p_action:'CANCELLATION_REQUESTED',p_expected_revision:3,p_key:keyFor()});
 assert.equal((await rpc(staffA,'time_away_detail',{p_request:draft})).state,'CANCELLATION_REQUESTED');
 await rpc(manager,'time_away_transition',{p_request:draft,p_action:'CANCELLATION_REJECTED',p_expected_revision:4,
  p_key:keyFor(),p_reason:'CANCELLATION_NOT_SUPPORTED'});
 assert.equal((await rpc(staffA,'time_away_detail',{p_request:draft})).state,'APPROVED');
 const submitted=await rpc(staffA,'time_away_save_draft',{p_request:null,p_category:'OTHER_TIME_AWAY',
  p_segments:[{kind:'WHOLE_DAY',date:'2027-02-10'}],p_expected_revision:0,p_key:keyFor()});
 await rpc(staffA,'time_away_submit',{p_request:submitted,p_team:teamA.id,p_expected_revision:1,p_key:keyFor()});
 const eventConflict=await rpc(manager,'time_away_conflicts',{p_request:submitted});
 assert.ok(eventConflict.allocations.some(item=>item.source==='EVENT'&&item.allocationResponse==='ACCEPTED'));
 const race=await Promise.all([manager.rpc('time_away_transition',{p_request:submitted,p_action:'APPROVED',
  p_expected_revision:2,p_key:keyFor(),p_reason:'APPROVED_AS_REQUESTED'}),
  manager.rpc('time_away_transition',{p_request:submitted,p_action:'DECLINED',
   p_expected_revision:2,p_key:keyFor(),p_reason:'STAFFING_CONFLICT'})]);
 assert.equal(race.filter(item=>!item.error).length,1,'only one concurrent decision commits');
 assert.equal(race.filter(item=>item.error).length,1);
 assert.ok((await staffA.rpc('time_away_save_draft',{p_request:null,p_category:'ANNUAL_LEAVE',
  p_segments:[{kind:'PARTIAL_DAY',date:'2026-10-25',startsLocal:'01:30',endsLocal:'02:30'}],
  p_expected_revision:0,p_key:keyFor()})).error,'autumn ambiguous clock time denied');
 assert.ok((await staffA.rpc('time_away_save_draft',{p_request:null,p_category:'ANNUAL_LEAVE',
  p_segments:[{kind:'PARTIAL_DAY',date:'2027-03-28',startsLocal:'01:30',endsLocal:'02:30'}],
  p_expected_revision:0,p_key:keyFor()})).error,'spring nonexistent clock time denied');
 const partial=await rpc(staffA,'time_away_save_draft',{p_request:null,p_category:'ANNUAL_LEAVE',
  p_segments:[{kind:'PARTIAL_DAY',date:'2026-10-25',startsLocal:'09:00',endsLocal:'12:00'}],
  p_expected_revision:0,p_key:keyFor()});
 assert.equal((await rpc(staffA,'time_away_detail',{p_request:partial})).segments[0].kind,'PARTIAL_DAY');
 await rpc(staffA,'time_away_submit',{p_request:partial,p_team:teamA.id,p_expected_revision:1,p_key:keyFor()});
 const calendarPartial=await rpc(manager,'time_away_calendar',{p_team:teamA.id,p_from:'2026-10-01',p_to:'2026-10-31'});
 assert.equal(calendarPartial.items.find(item=>item.id===partial).segments[0].startsLocal,'09:00:00');
 const extra=await member(teamB.id,ids.staffA);
 const multi=await rpc(staffA,'time_away_save_draft',{p_request:null,p_category:'OTHER_TIME_AWAY',
  p_segments:[{kind:'WHOLE_DAY',date:'2026-12-01'}],p_expected_revision:0,p_key:keyFor()});
 assert.ok((await staffA.rpc('time_away_submit',{p_request:multi,p_team:null,p_expected_revision:1,
  p_key:keyFor()})).error,'multiple active teams require an exact choice');
 await rpc(staffA,'time_away_submit',{p_request:multi,p_team:teamB.id,p_expected_revision:1,p_key:keyFor()});
 assert.equal((await rpc(staffA,'time_away_detail',{p_request:multi})).teamId,teamB.id);
 await adminAction(admin,'REVOKE_MEMBER',{p_id:memberA.id});
 assert.equal((await rpc(staffA,'time_away_detail',{p_request:draft})).teamId,teamA.id,'historical team is fixed');
 assert.ok((await manager.rpc('time_away_detail',{p_request:draft})).data);
 await member(teamA.id,ids.staffA);
 await adminAction(admin,'REVOKE_MEMBER',{p_id:extra.id});
 const temp=await adminAction(admin,'GRANT_APPROVER',{p_team:teamB.id,p_person:ids.managerA,p_until:oneYear,
  p_actions:['VIEW_REQUESTS']});
 assert.ok((await rpc(manager,'time_away_list',{p_team:teamB.id})).items.some(item=>item.id===other));
 await adminAction(admin,'REVOKE_APPROVER',{p_id:temp});
 assert.ok((await manager.rpc('time_away_list',{p_team:teamB.id})).error,'revocation removes access immediately');
 const calendarOnly=await adminAction(admin,'GRANT_APPROVER',{p_team:teamB.id,p_person:ids.managerA,
  p_until:oneYear,p_actions:['VIEW_CALENDAR']});
 assert.ok((await rpc(manager,'time_away_calendar',{p_team:teamB.id,p_from:'2026-11-01',p_to:'2026-11-30'})).items
  .some(item=>item.id===other),'calendar-only grant sees scoped calendar fact');
 assert.ok((await manager.rpc('time_away_detail',{p_request:other,p_action:'VIEW_CALENDAR'})).error,
  'calendar-only grant cannot read decision or lifecycle detail');
 await adminAction(admin,'REVOKE_APPROVER',{p_id:calendarOnly});
 const shortGrant=await adminAction(admin,'GRANT_APPROVER',{p_team:teamB.id,p_person:ids.managerA,
  p_until:new Date(Date.now()+1800).toISOString(),p_actions:['VIEW_REQUESTS']});
 assert.ok((await rpc(manager,'time_away_list',{p_team:teamB.id})).items.some(item=>item.id===other));
 await new Promise(resolve=>setTimeout(resolve,2100));
 assert.ok((await manager.rpc('time_away_list',{p_team:teamB.id})).error,'expiry removes access immediately');
 await adminAction(admin,'REVOKE_APPROVER',{p_id:shortGrant});
 const ownA=await rpc(staffA,'time_away_list');
 assert.ok(!ownA.items.some(item=>item.id===other));
 const calendarA=await rpc(manager,'time_away_list',{p_team:teamA.id,p_from:'2026-11-09',p_to:'2026-11-10',p_action:'VIEW_CALENDAR'});
 assert.ok(calendarA.items.some(item=>item.id===draft));assert.ok(!calendarA.items.some(item=>item.id===other));
 console.log(JSON.stringify({teamA:teamA.id,teamB:teamB.id,managerGrant:grant.id,
  staffARequest:draft,staffBRequest:other,eventRequest:submitted,partialDraft:partial,
  siteShiftConflicts:beforeConflict.activeAllocationCount,eventConflicts:eventConflict.activeAllocationCount}));
});
