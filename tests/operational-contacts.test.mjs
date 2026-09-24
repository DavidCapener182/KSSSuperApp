import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
const ids={office:'10000000-0000-4000-8000-000000000002'};
async function signed(name){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(c,{email:creds[name][0],password:creds[name][1]});assert.ifError(error);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;}
const stamp=()=>Date.now().toString(36);
const inHours=(hours)=>new Date(Date.now()+hours*3600000).toISOString();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const manual=(kind,id,manager)=>({context_kind:kind,context_id:id,purpose:'KSS_ESCALATION',source_type:'MANUAL_OPERATIONAL',
 source_id:null,manual_origin:'Synthetic Dev operational desk verification',accountable_manager_id:manager,
 display_name:'Synthetic Duty Desk',role_organisation:'KSS Synthetic Operations',phone:'+441234567890',email:null,
 priority:1,effective_from:inHours(-2),effective_until:inHours(48),london_start:null,london_end:null,
 reviewed_on:today(),reason:'Synthetic TASK-22B publication proof'});

test('TASK-22B exact publication, immutable correction, source withholding and denied audiences',{timeout:180000},async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg')&&key&&Object.values(creds).every(x=>x[0]&&x[1]));
 const [admin,office,ops,staff]=await Promise.all(['admin','office','operations','staff'].map(signed));
 let grant=null,site=null,route=null,crmRoute=null,raceRoute=null,personRoute=null,personRole=null;
 try {
  const org=await rpc(office,'crm_create_organisation',{p_name:`22B Synthetic Organisation ${stamp()}`});
  const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic operational route proof',p_type:'DIRECT_ENQUIRY',p_owner:ids.office});
  await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
  const created=await office.from('sites').insert({site_reference:`DEV-22B-${stamp().toUpperCase()}`,name:'22B Synthetic Site',address_line1:'1 Example Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Reception',created_by_person_id:ids.office,site_type:'OFFICE'}).select('id').single();
  assert.ifError(created.error);site=created.data.id;
  assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site)).error);
  await rpc(office,'operational_link_site',{p_site:site,p_organisation:org});
  const contact=await rpc(office,'crm_create_contact',{p_organisation:org,p_first:'Synthetic',p_last:'Client Contact',p_phone:'+441234567891',p_email:'synthetic-22b@example.test'});
  const draft=manual('SITE',site,ids.office);
  assert.ok((await office.rpc('contact_preview_22b',{p:draft})).error,'Office role alone cannot preview publication');
  assert.ok((await office.rpc('contact_publish_22b',{p:draft})).error,'Office role alone cannot publish');
  assert.ok((await ops.rpc('contact_grant_22b',{k:'SITE',target:site,person:ids.office,starts:inHours(-1),ends:inHours(24),reason:'Forbidden'})).error);
  grant=await rpc(admin,'contact_grant_22b',{k:'SITE',target:site,person:ids.office,starts:inHours(-1),ends:inHours(24),reason:'Synthetic exact Site manager proof'});
  const preview=await rpc(office,'contact_preview_22b',{p:draft});
  assert.equal(preview.display_name,'Synthetic Duty Desk');assert.equal(preview.context_id,site);
  route=await rpc(office,'contact_publish_22b',{p:{...draft,preview_marker:preview.preview_marker}});
  assert.ok(route);
  assert.deepEqual((await staff.from('crm_contacts').select('id,business_phone,business_email')).data,[]);
  assert.deepEqual((await ops.from('crm_contacts').select('id,business_phone,business_email')).data,[]);
  assert.deepEqual((await ops.from('person_profiles').select('person_id,mobile,contact_email')).data,[],'Operations cannot read private People methods');
  assert.ok((await staff.rpc('contact_current_22b',{k:'SITE',target:site,allocation:null})).error,'unallocated Staff denied');
  assert.ok((await staff.rpc('contact_history_22b',{route,reason:'Synthetic forbidden history'})).error);
  assert.ok((await ops.rpc('contact_history_22b',{route,reason:'Synthetic forbidden history'})).error);
  assert.ok((await ops.rpc('contact_publish_22b',{p:{...draft,preview_marker:preview.preview_marker}})).error,'Operations cannot publish');
  assert.ok((await staff.from('operational_contact_versions_22b').select('id')).error,'direct values denied');
  assert.ok((await ops.from('operational_contact_routes_22b').select('id')).error,'direct route table denied');
  let current=await rpc(ops,'contact_current_22b',{k:'SITE',target:site,allocation:null});
  assert.equal(current.routes.length,1);assert.equal(current.routes[0].phone,'+441234567890');
  assert.ok(!JSON.stringify(current).includes('manual_origin'),'projection allowlist');
  assert.ok((await office.rpc('contact_publish_22b',{p:{...draft,route_id:route,expected_revision:1,action:'CORRECTED',phone:'+441234567892',preview_marker:preview.preview_marker}})).error,'stale preview denied');
  const correction={...draft,route_id:route,expected_revision:1,action:'CORRECTED',phone:'+441234567892',reason:'Synthetic reviewed correction'};
  const correctedPreview=await rpc(office,'contact_preview_22b',{p:correction});
  await rpc(office,'contact_publish_22b',{p:{...correction,preview_marker:correctedPreview.preview_marker}});
  const history=await rpc(office,'contact_history_22b',{route,reason:'Synthetic correction lineage review'});
  assert.equal(history.versions.length,2);assert.equal(history.versions[0].phone,'+441234567890');assert.equal(history.versions[1].phone,'+441234567892');
  assert.equal(history.events[1].old_version_id,history.versions[0].id);
  const reviewed={...correction,expected_revision:2,action:'REVIEWED',reason:'Synthetic renewed source review'};
  const reviewedPreview=await rpc(office,'contact_preview_22b',{p:reviewed});
  await rpc(office,'contact_publish_22b',{p:{...reviewed,preview_marker:reviewedPreview.preview_marker}});
  const falseReorder={...reviewed,expected_revision:3,action:'REORDERED',priority:2,phone:'+441234567893',reason:'Synthetic invalid reorder'};
  const falsePreview=await rpc(office,'contact_preview_22b',{p:falseReorder});
  assert.ok((await office.rpc('contact_publish_22b',{p:{...falseReorder,preview_marker:falsePreview.preview_marker}})).error,'reorder cannot conceal a phone correction');
  const reorder={...reviewed,expected_revision:3,action:'REORDERED',priority:2,reason:'Synthetic backup ordering review'};
  const reorderPreview=await rpc(office,'contact_preview_22b',{p:reorder});
  await rpc(office,'contact_publish_22b',{p:{...reorder,preview_marker:reorderPreview.preview_marker}});
  const typedHistory=await rpc(office,'contact_history_22b',{route,reason:'Synthetic typed history review'});
  assert.deepEqual(typedHistory.events.map(e=>e.action),['PUBLISHED','CORRECTED','REVIEWED','REORDERED']);
  assert.equal(typedHistory.versions.length,4);
  current=await rpc(ops,'contact_current_22b',{k:'SITE',target:site,allocation:null});assert.equal(current.routes[0].phone,'+441234567892');
  const crm={...draft,purpose:'CLIENT_OPERATIONAL',source_type:'CRM_CONTACT',source_id:contact,
   manual_origin:null,accountable_manager_id:null,display_name:null,role_organisation:null,phone:null,email:null,
   use_phone:true,use_email:true,priority:1,reason:'Synthetic exact CRM snapshot'};
  const crmPreview=await rpc(office,'contact_preview_22b',{p:crm});
  crmRoute=await rpc(office,'contact_publish_22b',{p:{...crm,preview_marker:crmPreview.preview_marker,published_by:'10000000-0000-4000-8000-000000000001'}});
  const crmHistory=await rpc(office,'contact_history_22b',{route:crmRoute,reason:'Synthetic actor provenance check'});
  assert.equal(crmHistory.versions[0].published_by,ids.office,'database actor overrides forged client field');
  const otherOrg=await rpc(office,'crm_create_organisation',{p_name:`22B Other Synthetic Organisation ${stamp()}`});
  const otherContact=await rpc(office,'crm_create_contact',{p_organisation:otherOrg,p_first:'Other',p_last:'Context',p_email:'other-22b@example.test'});
  assert.ok((await office.rpc('contact_preview_22b',{p:{...crm,source_id:otherContact}})).error,'CRM source must match exact context Organisation');
  assert.ok((await ops.rpc('contact_current_22b',{k:'SITE',target:'ffffffff-ffff-4fff-8fff-ffffffffffff',allocation:null})).error,'guessed context ID denied');
  const same={...crm,source_id:contact};
  assert.ok((await office.rpc('contact_publish_22b',{p:{...same,preview_marker:crmPreview.preview_marker}})).error,'equal priority overlap denied');
  const raceA={...draft,purpose:'HEALTH_SAFETY',display_name:'Synthetic Safety Desk A',reason:'Concurrent publication A'};
  const raceB={...draft,purpose:'HEALTH_SAFETY',display_name:'Synthetic Safety Desk B',reason:'Concurrent publication B'};
  const [previewA,previewB]=await Promise.all([rpc(office,'contact_preview_22b',{p:raceA}),rpc(office,'contact_preview_22b',{p:raceB})]);
  const raced=await Promise.all([office.rpc('contact_publish_22b',{p:{...raceA,preview_marker:previewA.preview_marker}}),
   office.rpc('contact_publish_22b',{p:{...raceB,preview_marker:previewB.preview_marker}})]);
  assert.equal(raced.filter(x=>!x.error).length,1,'one concurrent equal-priority publication wins');
  assert.equal(raced.filter(x=>x.error).length,1,'other concurrent publication is safely rejected');
  raceRoute=raced.find(x=>!x.error).data;
  const before=await rpc(ops,'contact_current_22b',{k:'SITE',target:site,allocation:null});
  assert.equal(before.routes.find(r=>r.id===crmRoute).state,'CURRENT');
  await rpc(office,'crm_update_contact',{p_id:contact,p_first:'Synthetic',p_last:'Client Contact',p_title:'Changed title',p_email:'synthetic-22b@example.test',p_phone:'+441234567891',p_active:true,p_primary:false});
  const after=await rpc(ops,'contact_current_22b',{k:'SITE',target:site,allocation:null});
  const withheld=after.routes.find(r=>r.id===crmRoute);assert.equal(withheld.state,'REVIEW_REQUIRED');assert.equal(withheld.phone,null);assert.equal(withheld.email,null);
  await rpc(office,'crm_update_contact',{p_id:contact,p_first:'Synthetic',p_last:'Client Contact',p_title:'Changed title',p_email:'synthetic-22b@example.test',p_phone:'+441234567891',p_active:false,p_primary:false});
  const unavailable=await rpc(ops,'contact_current_22b',{k:'SITE',target:site,allocation:null});
  assert.equal(unavailable.routes.find(r=>r.id===crmRoute).state,'SOURCE_UNAVAILABLE');
  assert.equal(unavailable.routes.find(r=>r.id===crmRoute).phone,null);
  const sourcePerson=await admin.from('people').select('id').eq('display_name','TASK-22B Synthetic Operational Person').single();assert.ifError(sourcePerson.error);
  const sourcePersonId=sourcePerson.data.id;
  const roleRow=await admin.from('role_assignments').select('id').eq('person_id',sourcePersonId).eq('role_code','OPERATIONS').single();assert.ifError(roleRow.error);personRole=roleRow.data.id;
  const personDraft={...draft,purpose:'KSS_DUTY_MANAGER',source_type:'KSS_PERSON',source_id:sourcePersonId,
   manual_origin:null,accountable_manager_id:null,display_name:null,role_organisation:'KSS Synthetic Duty',phone:null,email:null,
   use_phone:true,use_email:true,reason:'Synthetic exact Person snapshot'};
  const personPreview=await rpc(office,'contact_preview_22b',{p:personDraft});
  personRoute=await rpc(office,'contact_publish_22b',{p:{...personDraft,preview_marker:personPreview.preview_marker}});
  const personCurrent=await rpc(ops,'contact_current_22b',{k:'SITE',target:site,allocation:null});
  assert.equal(personCurrent.routes.find(r=>r.id===personRoute).state,'CURRENT');
  assert.ifError((await admin.from('role_assignments').update({revoked_at:new Date().toISOString()}).eq('id',personRole)).error);
  const personWithheld=await rpc(ops,'contact_current_22b',{k:'SITE',target:site,allocation:null});
  assert.equal(personWithheld.routes.find(r=>r.id===personRoute).state,'SOURCE_UNAVAILABLE');
  assert.equal(personWithheld.routes.find(r=>r.id===personRoute).phone,null);
  assert.ifError((await admin.from('role_assignments').update({revoked_at:null}).eq('id',personRole)).error);personRole=null;
  await rpc(admin,'contact_revoke_grant_22b',{p_grant:grant,reason:'Synthetic immediate revocation proof'});grant=null;
  assert.ok((await office.rpc('contact_manage_22b',{k:'SITE',target:site})).error,'grant revocation immediate');
  assert.ok((await office.rpc('contact_history_22b',{route,reason:'Denied after grant revocation'})).error);
  const published=await rpc(admin,'contact_manage_22b',{k:'SITE',target:site});
  const publishedRoute=published.routes.find(r=>r.id===route);
  await rpc(admin,'contact_revoke_22b',{route,expected:publishedRoute.revision,reason:'Synthetic revoked management projection proof'});
  const revoked=await rpc(admin,'contact_manage_22b',{k:'SITE',target:site});
  const revokedRoute=revoked.routes.find(r=>r.id===route);
  assert.equal(revokedRoute.phone,null,'revoked route value withheld from ordinary management list');
  assert.equal(revokedRoute.email,null,'revoked route email withheld from ordinary management list');
  const restrictedHistory=await rpc(admin,'contact_history_22b',{route,reason:'Synthetic revoked version oversight proof'});
  assert.ok(restrictedHistory.versions.some(v=>v.phone==='+441234567890'),'original version remains available through audited oversight');
 } finally {
  if(personRole)await admin.from('role_assignments').update({revoked_at:null}).eq('id',personRole);
  if(route){const m=await admin.rpc('contact_manage_22b',{k:'SITE',target:site});const r=m.data?.routes?.find(x=>x.id===route);if(r?.state==='PUBLISHED')await admin.rpc('contact_revoke_22b',{route,expected:r.revision,reason:'Synthetic TASK-22B cleanup'});}
  if(crmRoute){const m=await admin.rpc('contact_manage_22b',{k:'SITE',target:site});const r=m.data?.routes?.find(x=>x.id===crmRoute);if(r?.state==='PUBLISHED')await admin.rpc('contact_revoke_22b',{route:crmRoute,expected:r.revision,reason:'Synthetic TASK-22B cleanup'});}
  if(raceRoute){const m=await admin.rpc('contact_manage_22b',{k:'SITE',target:site});const r=m.data?.routes?.find(x=>x.id===raceRoute);if(r?.state==='PUBLISHED')await admin.rpc('contact_revoke_22b',{route:raceRoute,expected:r.revision,reason:'Synthetic TASK-22B cleanup'});}
  if(personRoute){const m=await admin.rpc('contact_manage_22b',{k:'SITE',target:site});const r=m.data?.routes?.find(x=>x.id===personRoute);if(r?.state==='PUBLISHED')await admin.rpc('contact_revoke_22b',{route:personRoute,expected:r.revision,reason:'Synthetic TASK-22B cleanup'});}
  if(grant)await admin.rpc('contact_revoke_grant_22b',{p_grant:grant,reason:'Synthetic TASK-22B cleanup'});
 }
});
