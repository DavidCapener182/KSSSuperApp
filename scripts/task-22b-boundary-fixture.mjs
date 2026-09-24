// Synthetic Dev proof fixture. Usage: node --env-file=.env.local --env-file=.env.test.local scripts/task-22b-boundary-fixture.mjs setup|cleanup
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from '../tests/helpers/auth-session.mjs';

const file='/tmp/kss-task-22b-boundary-fixture.json';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url?.includes('dnfhkmmnlbiabqypclqg')&&key,'Synthetic Dev only');
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 ops:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const people={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await signInWithTestSession(c,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;}
const londonDay=(date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const plusHours=(date,h)=>new Date(date.getTime()+h*3600000);
const iso=(date)=>date.toISOString();
const stamp=()=>Date.now().toString(36).toUpperCase();
async function publish(c,k,id,manager,phone){const p={context_kind:k,context_id:id,purpose:'KSS_ESCALATION',source_type:'MANUAL_OPERATIONAL',source_id:null,
 manual_origin:'Synthetic TASK-22B boundary fixture',accountable_manager_id:manager,display_name:`Synthetic ${k} Desk`,
 role_organisation:'KSS Synthetic Operations',phone,email:null,priority:1,effective_from:iso(plusHours(new Date(),-1)),
 effective_until:iso(plusHours(new Date(),100)),london_start:null,london_end:null,reviewed_on:londonDay(new Date()),
 reason:'Synthetic exact-context access proof'};
 const preview=await rpc(c,'contact_preview_22b',{p});return rpc(c,'contact_publish_22b',{p:{...p,preview_marker:preview.preview_marker}});}

const mode=process.argv[2];
if(mode==='setup'){
 const [admin,office,ops,staffA,staffB]=await Promise.all(['admin','office','ops','staffA','staffB'].map(signed));
 const fixture={};
 try{
  const org=await rpc(office,'crm_create_organisation',{p_name:`22B Synthetic Boundary ${stamp()}`});
  const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic exact contacts proof',p_type:'DIRECT_ENQUIRY',p_owner:people.office});
  await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
  const siteRow=await office.from('sites').insert({site_reference:`DEV-22B-${stamp()}`,name:'22B Synthetic Boundary Site',address_line1:'1 Example Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Reception',created_by_person_id:people.office,site_type:'OFFICE'}).select('id').single();assert.ifError(siteRow.error);
  fixture.site=siteRow.data.id;assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',fixture.site)).error);
  await rpc(office,'operational_link_site',{p_site:fixture.site,p_organisation:org});
  fixture.service=await rpc(office,'site_service_create',{p_site:fixture.site,p_name:'Synthetic Boundary Service',p_type:'STATIC_GUARDING',p_effective_from:londonDay(new Date()),p_owner:people.office});
  await rpc(office,'site_service_transition',{p_service:fixture.service,p_state:'ACTIVE',p_effective_on:londonDay(new Date()),p_expected_revision:1,p_reason:'Synthetic boundary proof'});
  const roles=await rpc(office,'staffing_role_choices',{});const role=roles.find(r=>r.code==='STEWARD');assert.ok(role);
  const report=plusHours(new Date(),30),start=plusHours(report,.25),end=plusHours(start,4);
  fixture.report=iso(report);fixture.end=iso(end);
  fixture.demand=await rpc(office,'site_shift_extra',{p_service:fixture.service,p_service_date:londonDay(report),p_role:role.id,p_quantity:1,
   p_report_at:iso(report),p_shift_starts_at:iso(start),p_shift_ends_at:iso(end),p_area:'Reception',p_reporting:'Reception',p_reason:'Synthetic boundary duty'});
  const candidates=await rpc(ops,'site_shift_candidates',{p_service:fixture.service,p_demand:fixture.demand,p_search:'',p_offset:0,p_limit:20});
  const sitePerson=candidates.items.find(x=>[people.staffA,people.staffB].includes(x.id)&&x.check.result!=='BLOCKED');assert.ok(sitePerson,'Synthetic candidate for Site shift');
  fixture.sitePerson=sitePerson.id;fixture.siteAuth=(await (sitePerson.id===people.staffA?staffA:staffB).auth.getUser()).data.user.id;
  fixture.siteAllocation=await rpc(ops,'site_shift_allocate',{p_service:fixture.service,p_demand:fixture.demand,p_person:sitePerson.id,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic contact boundary review'});
  await rpc(sitePerson.id===people.staffA?staffA:staffB,'site_shift_respond',{p_allocation:fixture.siteAllocation,p_expected_revision:1,p_response:'ACCEPTED'});
  const eventReport=plusHours(new Date(),55),eventStart=plusHours(eventReport,.25),eventEnd=plusHours(eventStart,4);
  fixture.eventReport=iso(eventReport);fixture.eventEnd=iso(eventEnd);
  fixture.event=await rpc(office,'operational_create_event',{p_site:fixture.site,p_organisation:org,p_name:'22B Synthetic Boundary Event',p_type:'CORPORATE_EVENT',p_starts:iso(eventReport),p_ends:iso(plusHours(eventEnd,1)),p_owner:people.office});
  fixture.requirement=await rpc(office,'staffing_create_confirmed',{p_event:fixture.event,p_role:role.id,p_quantity:1,p_report:iso(eventReport),p_start:iso(eventStart),p_end:iso(eventEnd),p_area:'Reception',p_instructions:'Synthetic only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
  const eventCandidates=await rpc(ops,'deployment_candidates',{p_event:fixture.event,p_requirement:fixture.requirement,p_search:'',p_offset:0,p_limit:20});
  const eventPerson=eventCandidates.items.find(x=>[people.staffA,people.staffB].includes(x.id)&&x.check.result!=='BLOCKED');assert.ok(eventPerson,'Synthetic candidate for Event');
  fixture.eventPerson=eventPerson.id;fixture.eventAuth=(await (eventPerson.id===people.staffA?staffA:staffB).auth.getUser()).data.user.id;
  fixture.eventAllocation=await rpc(ops,'deployment_allocate',{p_event:fixture.event,p_requirement:fixture.requirement,p_person:eventPerson.id,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic contact boundary review'});
  await rpc(eventPerson.id===people.staffA?staffA:staffB,'deployment_respond',{p_allocation:fixture.eventAllocation,p_expected_revision:1,p_response:'ACCEPTED'});
  fixture.grants=[];fixture.routes=[];
  for(const [k,id,phone] of [['SITE',fixture.site,'+441234567800'],['SITE_SERVICE',fixture.service,'+441234567801'],['EVENT',fixture.event,'+441234567802']]){
   fixture.grants.push(await rpc(admin,'contact_grant_22b',{k,target:id,person:people.office,starts:iso(plusHours(new Date(),-1)),ends:iso(plusHours(new Date(),80)),reason:'Synthetic exact-context boundary grant'}));
   fixture.routes.push(await publish(office,k,id,people.office,phone));
  }
  await writeFile(file,JSON.stringify(fixture),{mode:0o600});
  console.log(JSON.stringify({fixture:file,siteAllocation:fixture.siteAllocation,eventAllocation:fixture.eventAllocation,site:fixture.site,service:fixture.service,event:fixture.event,siteAuth:fixture.siteAuth,eventAuth:fixture.eventAuth,report:fixture.report,end:fixture.end,eventReport:fixture.eventReport,eventEnd:fixture.eventEnd}));
 }catch(error){await writeFile(file,JSON.stringify(fixture),{mode:0o600});throw error;}
}else if(mode==='current'){
 const fixture=JSON.parse(await readFile(file,'utf8'));
 const [office,ops,staffA,staffB]=await Promise.all(['office','ops','staffA','staffB'].map(signed));
 const role=(await rpc(office,'staffing_role_choices',{})).find(r=>r.code==='STEWARD');assert.ok(role);
 const report=plusHours(new Date(),1),start=plusHours(report,.25),end=plusHours(start,3);
 fixture.currentDemand=await rpc(office,'site_shift_extra',{p_service:fixture.service,p_service_date:londonDay(report),p_role:role.id,p_quantity:1,
  p_report_at:iso(report),p_shift_starts_at:iso(start),p_shift_ends_at:iso(end),p_area:'Reception',p_reporting:'Reception',p_reason:'Synthetic live-window duty'});
 const candidates=await rpc(ops,'site_shift_candidates',{p_service:fixture.service,p_demand:fixture.currentDemand,p_search:'',p_offset:0,p_limit:20});
 const person=candidates.items.find(x=>[people.staffA,people.staffB].includes(x.id)&&x.check.result!=='BLOCKED');assert.ok(person,'Synthetic current candidate');
 const staff=person.id===people.staffA?staffA:staffB;
 fixture.currentAllocation=await rpc(ops,'site_shift_allocate',{p_service:fixture.service,p_demand:fixture.currentDemand,p_person:person.id,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic current-window review'});
 await rpc(staff,'site_shift_respond',{p_allocation:fixture.currentAllocation,p_expected_revision:1,p_response:'ACCEPTED'});
 const current=await rpc(staff,'contact_for_allocation_22b',{source:'SITE_SHIFT',allocation:fixture.currentAllocation});
 assert.equal(current.contexts.length,2);assert.deepEqual(current.contexts.map(x=>x.context_kind),['SITE','SITE_SERVICE']);
 assert.ok(current.contexts.every(x=>x.routes.length===1&&x.routes[0].state==='CURRENT'));
 assert.ok((await staff.rpc('contact_current_22b',{k:'EVENT',target:fixture.event,allocation:fixture.currentAllocation})).error,'no Event inheritance');
 assert.ok((await staffB.from('crm_contacts').select('id,business_email,business_phone')).data.length===0);
 await writeFile(file,JSON.stringify(fixture),{mode:0o600});
 await rpc(ops,'site_shift_cancel_allocation',{p_service:fixture.service,p_demand:fixture.currentDemand,p_allocation:fixture.currentAllocation,p_expected_revision:2,p_reason:'Synthetic immediate contact revocation'});
 fixture.currentCancelled=true;await writeFile(file,JSON.stringify(fixture),{mode:0o600});
 assert.ok((await staff.rpc('contact_for_allocation_22b',{source:'SITE_SHIFT',allocation:fixture.currentAllocation})).error,'cancellation revokes access immediately');
 console.log('Accepted Site Shift showed exact Site and Service contacts; cancellation denied the same allocation immediately.');
}else if(mode==='browser'){
 const fixture=JSON.parse(await readFile(file,'utf8'));
 const [admin,office,ops,staffA,staffB]=await Promise.all(['admin','office','ops','staffA','staffB'].map(signed));
 fixture.browserGrants=[];fixture.browserRoutes=[];
 for(const [k,id,phone] of [['SITE',fixture.site,'+441234567810'],['SITE_SERVICE',fixture.service,'+441234567811'],['EVENT',fixture.event,'+441234567812']]){
  fixture.browserGrants.push(await rpc(admin,'contact_grant_22b',{k,target:id,person:people.office,starts:iso(plusHours(new Date(),-1)),ends:iso(plusHours(new Date(),8)),reason:'Synthetic browser review grant'}));
  fixture.browserRoutes.push(await publish(office,k,id,people.office,phone));
 }
 const role=(await rpc(office,'staffing_role_choices',{})).find(r=>r.code==='STEWARD');assert.ok(role);
 const report=plusHours(new Date(),1),start=plusHours(report,.25),end=plusHours(start,3);
 fixture.browserDemand=await rpc(office,'site_shift_extra',{p_service:fixture.service,p_service_date:londonDay(report),p_role:role.id,p_quantity:1,
  p_report_at:iso(report),p_shift_starts_at:iso(start),p_shift_ends_at:iso(end),p_area:'Reception',p_reporting:'Reception',p_reason:'Synthetic authenticated browser duty'});
 const candidates=await rpc(ops,'site_shift_candidates',{p_service:fixture.service,p_demand:fixture.browserDemand,p_search:'',p_offset:0,p_limit:20});
 const person=candidates.items.find(x=>[people.staffA,people.staffB].includes(x.id)&&x.check.result!=='BLOCKED');assert.ok(person,'Synthetic browser candidate');
 fixture.browserPerson=person.id;const staff=person.id===people.staffA?staffA:staffB;
 fixture.browserAllocation=await rpc(ops,'site_shift_allocate',{p_service:fixture.service,p_demand:fixture.browserDemand,p_person:person.id,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic authenticated browser review'});
 await rpc(staff,'site_shift_respond',{p_allocation:fixture.browserAllocation,p_expected_revision:1,p_response:'ACCEPTED'});
 await writeFile(file,JSON.stringify(fixture),{mode:0o600});
 console.log(JSON.stringify({site:fixture.site,service:fixture.service,event:fixture.event,browserAllocation:fixture.browserAllocation,browserPerson:fixture.browserPerson}));
}else if(mode==='mailto'){
 const fixture=JSON.parse(await readFile(file,'utf8'));const office=await signed('office');
 const p={context_kind:'SITE',context_id:fixture.site,purpose:'KSS_ESCALATION',source_type:'MANUAL_OPERATIONAL',source_id:null,
  manual_origin:'Synthetic TASK-22B email action fixture',accountable_manager_id:people.office,
  display_name:'Synthetic Email Backup',role_organisation:'KSS Synthetic Operations',phone:null,email:'task-22b-backup@example.test',
  priority:2,effective_from:iso(plusHours(new Date(),-1)),effective_until:iso(plusHours(new Date(),8)),london_start:null,london_end:null,
  reviewed_on:londonDay(new Date()),reason:'Synthetic approved email action proof'};
 const preview=await rpc(office,'contact_preview_22b',{p});fixture.browserRoutes.push(await rpc(office,'contact_publish_22b',{p:{...p,preview_marker:preview.preview_marker}}));
 await writeFile(file,JSON.stringify(fixture),{mode:0o600});console.log('Synthetic approved email backup published for exact Site.');
}else if(mode==='event-check'){
 const fixture=JSON.parse(await readFile(file,'utf8'));
 const [admin,office,ops,staffA,staffB]=await Promise.all(['admin','office','ops','staffA','staffB'].map(signed));
 const detail=await rpc(office,'operational_site_detail',{p_site:fixture.site});assert.ok(detail.organisation_id);
 const role=(await rpc(office,'staffing_role_choices',{})).find(r=>r.code==='STEWARD');assert.ok(role);
 const report=plusHours(new Date(),1.25),start=plusHours(report,.25),end=plusHours(start,3);
 let grant=null,route=null,event=null,allocation=null,cancelled=false;
 try{
  event=await rpc(office,'operational_create_event',{p_site:fixture.site,p_organisation:detail.organisation_id,p_name:'22B Synthetic Expiry Event',p_type:'CORPORATE_EVENT',p_starts:iso(report),p_ends:iso(plusHours(end,1)),p_owner:people.office});
  const requirement=await rpc(office,'staffing_create_confirmed',{p_event:event,p_role:role.id,p_quantity:1,p_report:iso(report),p_start:iso(start),p_end:iso(end),p_area:'Reception',p_instructions:'Synthetic only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
  const candidates=await rpc(ops,'deployment_candidates',{p_event:event,p_requirement:requirement,p_search:'',p_offset:0,p_limit:20});
  const person=candidates.items.find(x=>[people.staffA,people.staffB].includes(x.id)&&x.check.result!=='BLOCKED');assert.ok(person,'Synthetic Event candidate');
  const staff=person.id===people.staffA?staffA:staffB;
  allocation=await rpc(ops,'deployment_allocate',{p_event:event,p_requirement:requirement,p_person:person.id,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic Event contact review'});
  await rpc(staff,'deployment_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'});
  grant=await rpc(admin,'contact_grant_22b',{k:'EVENT',target:event,person:people.office,starts:iso(plusHours(new Date(),-1)),ends:iso(plusHours(new Date(),2)),reason:'Synthetic Event expiry manager grant'});
  const p={context_kind:'EVENT',context_id:event,purpose:'KSS_ESCALATION',source_type:'MANUAL_OPERATIONAL',source_id:null,
   manual_origin:'Synthetic Event expiry proof',accountable_manager_id:people.office,display_name:'Synthetic Event Desk',
   role_organisation:'KSS Synthetic Operations',phone:'+441234567820',email:null,priority:1,
   effective_from:iso(plusHours(new Date(),-1)),effective_until:iso(new Date(Date.now()+9000)),london_start:null,london_end:null,
   reviewed_on:londonDay(new Date()),reason:'Synthetic short Event expiry proof'};
  const preview=await rpc(office,'contact_preview_22b',{p});route=await rpc(office,'contact_publish_22b',{p:{...p,preview_marker:preview.preview_marker}});
  const before=await rpc(staff,'contact_for_allocation_22b',{source:'EVENT',allocation});assert.equal(before.contexts.length,1);assert.equal(before.contexts[0].routes[0].state,'CURRENT');
  await new Promise(resolve=>setTimeout(resolve,10000));
  const expired=await rpc(staff,'contact_for_allocation_22b',{source:'EVENT',allocation});assert.equal(expired.contexts[0].routes[0].state,'EXPIRED');assert.equal(expired.contexts[0].routes[0].phone,null);
  await rpc(office,'contact_mark_expired_22b',{route,reason:'Synthetic expiry history review'});
  const history=await rpc(office,'contact_history_22b',{route,reason:'Synthetic immutable expiry read'});assert.ok(history.events.some(e=>e.action==='EXPIRED'&&e.old_version_id===history.versions[0].id));
  await rpc(office,'operational_change_event',{p_event:event,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Synthetic Event cancellation proof'});
  cancelled=true;
  assert.ok((await staff.rpc('contact_for_allocation_22b',{source:'EVENT',allocation})).error,'Event cancellation immediately denies current route');
  console.log('Accepted Event route: current, expired/withheld with typed history, then Event cancellation denied access.');
 }finally{
  if(route)await admin.rpc('contact_revoke_22b',{route,expected:1,reason:'Synthetic Event route cleanup'});
  if(grant)await admin.rpc('contact_revoke_grant_22b',{p_grant:grant,reason:'Synthetic Event grant cleanup'});
  if(event&&!cancelled)await office.rpc('operational_change_event',{p_event:event,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Synthetic Event fixture cleanup'});
 }
}else if(mode==='service-end-check'){
 const fixture=JSON.parse(await readFile(file,'utf8'));
 const [admin,office,ops]=await Promise.all(['admin','office','ops'].map(signed));
 let grant=null,route=null;
 try{
  grant=await rpc(admin,'contact_grant_22b',{k:'SITE_SERVICE',target:fixture.service,person:people.office,
   starts:iso(plusHours(new Date(),-1)),ends:iso(plusHours(new Date(),2)),reason:'Synthetic Service end contact grant'});
  route=await publish(office,'SITE_SERVICE',fixture.service,people.office,'+441234567830');
  const before=await rpc(ops,'contact_current_22b',{k:'SITE_SERVICE',target:fixture.service,allocation:null});
  assert.ok(before.routes.some(x=>x.id===route&&x.state==='CURRENT'));
  await rpc(office,'site_service_transition',{p_service:fixture.service,p_state:'ENDED',p_effective_on:londonDay(plusHours(new Date(),24)),p_expected_revision:2,p_reason:'Synthetic Service end access proof'});
  assert.ok((await ops.rpc('contact_current_22b',{k:'SITE_SERVICE',target:fixture.service,allocation:null})).error,'ended Service hides current routes');
  const history=await rpc(office,'contact_history_22b',{route,reason:'Synthetic ended Service oversight'});assert.equal(history.versions.length,1);
  console.log('Ended Site Service denied current route while exact immutable history remained restricted and readable.');
 }finally{
  if(route)await admin.rpc('contact_revoke_22b',{route,expected:1,reason:'Synthetic Service end route cleanup'});
  if(grant)await admin.rpc('contact_revoke_grant_22b',{p_grant:grant,reason:'Synthetic Service end grant cleanup'});
 }
}else if(mode==='cleanup'){
 const fixture=JSON.parse(await readFile(file,'utf8'));
 const [admin,ops]=await Promise.all(['admin','ops'].map(signed));
 if(!fixture.cleaned){
  if(fixture.siteAllocation)await rpc(ops,'site_shift_cancel_allocation',{p_service:fixture.service,p_demand:fixture.demand,p_allocation:fixture.siteAllocation,p_expected_revision:2,p_reason:'Synthetic TASK-22B boundary cleanup'});
  if(fixture.currentAllocation&&!fixture.currentCancelled)await rpc(ops,'site_shift_cancel_allocation',{p_service:fixture.service,p_demand:fixture.currentDemand,p_allocation:fixture.currentAllocation,p_expected_revision:2,p_reason:'Synthetic TASK-22B boundary cleanup'});
  if(fixture.eventAllocation)await rpc(ops,'deployment_cancel',{p_event:fixture.event,p_requirement:fixture.requirement,p_allocation:fixture.eventAllocation,p_expected_revision:2,p_reason:'Synthetic TASK-22B boundary cleanup'});
  for(const route of fixture.routes??[])await rpc(admin,'contact_revoke_22b',{route,expected:1,reason:'Synthetic TASK-22B boundary cleanup'});
  for(const grant of fixture.grants??[])await rpc(admin,'contact_revoke_grant_22b',{p_grant:grant,reason:'Synthetic TASK-22B boundary cleanup'});
 }
 if(fixture.browserAllocation)await rpc(ops,'site_shift_cancel_allocation',{p_service:fixture.service,p_demand:fixture.browserDemand,p_allocation:fixture.browserAllocation,p_expected_revision:2,p_reason:'Synthetic TASK-22B browser cleanup'});
 for(const route of fixture.browserRoutes??[])await rpc(admin,'contact_revoke_22b',{route,expected:1,reason:'Synthetic TASK-22B browser cleanup'});
 for(const grant of fixture.browserGrants??[])await rpc(admin,'contact_revoke_grant_22b',{p_grant:grant,reason:'Synthetic TASK-22B browser cleanup'});
 fixture.cleaned=true;fixture.browserAllocation=null;fixture.browserRoutes=[];fixture.browserGrants=[];await writeFile(file,JSON.stringify(fixture),{mode:0o600});
 console.log('Synthetic TASK-22B allocations, routes and grants revoked.');
}else throw new Error('Use setup or cleanup');
