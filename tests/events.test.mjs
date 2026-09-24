import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const identities={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
 admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD]};
const officePerson='10000000-0000-4000-8000-000000000002';
const operationsPerson='10000000-0000-4000-8000-000000000007';
async function signed(role){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(c,{email:identities[role][0],password:identities[role][1]});assert.ifError(error);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);assert.ifError(error);return data;}

test('06A Client Site link and multi-day Event preserve identity, history and Operations scope', {timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(identities).every((v)=>v[0]&&v[1]));
 const [office,officeB,admin,staff,operations]=await Promise.all(Object.keys(identities).map(signed));
 const org=await rpc(office,'crm_create_organisation',{p_name:`Northshore Events Ltd synthetic ${Date.now()}`});
 const other=await rpc(office,'crm_create_organisation',{p_name:`Other synthetic ${Date.now()}`});
 const alex=await rpc(office,'crm_create_contact',{p_organisation:org,p_first:'Alex',p_last:'Morgan'});
 const wrongContact=await rpc(office,'crm_create_contact',{p_organisation:other,p_first:'Other',p_last:'Contact'});
 const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Northshore synthetic Event',p_type:'DIRECT_ENQUIRY',p_owner:officePerson});
 assert.ok((await office.rpc('operational_link_site',{p_site:'30000000-0000-4000-8000-000000000001',p_organisation:org})).error);
 await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
 const ref=`DEV-06A-${Date.now()}`;
 const site=(await office.from('sites').insert({site_reference:ref,name:'Riverside Arena',address_line1:'1 Synthetic Way',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Main gate',created_by_person_id:officePerson,site_type:'VENUE'}).select('id').single());
 assert.ifError(site.error); const siteId=site.data.id;
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',siteId)).error);
 assert.ok((await officeB.rpc('operational_link_site',{p_site:siteId,p_organisation:org})).error);
 assert.ok((await operations.rpc('operational_link_site',{p_site:siteId,p_organisation:org})).error);
 const link=await rpc(office,'operational_link_site',{p_site:siteId,p_organisation:org});
 assert.ok(link); assert.ok((await office.rpc('operational_link_site',{p_site:siteId,p_organisation:org})).error);
 const second=(await office.from('sites').insert({site_reference:`${ref}-B`,name:'Northshore second venue',address_line1:'2 Synthetic Way',town_city:'Exampletown',postcode:'EX1 1AB',reporting_point:'Reception',created_by_person_id:officePerson}).select('id').single());
 assert.ifError(second.error); await rpc(office,'operational_link_site',{p_site:second.data.id,p_organisation:org});
 assert.equal((await office.rpc('operational_sites',{p_organisation:org})).data.total,2);
 assert.equal((await operations.rpc('operational_site_detail',{p_site:siteId})).data.client_name.includes('Northshore'),true);
 assert.ok((await staff.rpc('operational_site_detail',{p_site:siteId})).error);
 assert.ok((await office.from('site_client_links').select('id')).error);
 assert.ok((await office.from('site_client_links').insert({site_id:siteId,organisation_id:other,linked_by_person_id:officePerson})).error);
 const start='2027-06-01T09:00:00+01:00',end='2027-06-04T22:00:00+01:00';
 const create={p_site:siteId,p_organisation:org,p_name:'Northshore Live 2027',p_type:'FESTIVAL',p_starts:start,p_ends:end,p_owner:operationsPerson,p_contact:alex,p_opportunity:won};
 assert.ok((await operations.rpc('operational_create_event',create)).error);
 assert.ok((await office.rpc('operational_create_event',{...create,p_organisation:other})).error);
 assert.ok((await office.rpc('operational_create_event',{...create,p_contact:wrongContact})).error);
 assert.ok((await office.rpc('operational_create_event',{...create,p_ends:start})).error);
 const eventId=await rpc(office,'operational_create_event',create);
 const detail=await rpc(office,'operational_event_detail',{p_event:eventId});
 assert.equal(detail.status,'PLANNING');assert.equal(detail.client_name.includes('Northshore'),true);
 assert.equal(detail.site_name,'Riverside Arena');assert.equal(detail.contact_name,'Alex Morgan');
 assert.equal(detail.source_opportunity_id,won);assert.equal(detail.history.length,1);
 const opsDetail=await rpc(operations,'operational_event_detail',{p_event:eventId});
 assert.equal(opsDetail.source_opportunity_id,undefined);assert.equal(opsDetail.primary_contact_id,undefined);
 assert.equal(opsDetail.contact_name,'Alex Morgan');
 assert.ok((await operations.rpc('operational_change_event',{p_event:eventId,p_action:'STATUS',p_status:'LIVE'})).error);
 await rpc(operations,'operational_change_event',{p_event:eventId,p_action:'STATUS',p_status:'CONFIRMED'});
 assert.ok((await operations.rpc('operational_change_event',{p_event:eventId,p_action:'DATES',p_starts:start,p_ends:'2027-06-05T22:00:00+01:00'})).error);
 await rpc(operations,'operational_change_event',{p_event:eventId,p_action:'DATES',p_starts:start,p_ends:'2027-06-05T22:00:00+01:00',p_reason:'Synthetic festival extended'});
 assert.ok((await operations.rpc('operational_change_event',{p_event:eventId,p_action:'STATUS',p_status:'CANCELLED'})).error);
 await rpc(operations,'operational_change_event',{p_event:eventId,p_action:'STATUS',p_status:'LIVE'});
 await rpc(operations,'operational_change_event',{p_event:eventId,p_action:'STATUS',p_status:'COMPLETED'});
 assert.ok((await operations.rpc('operational_change_event',{p_event:eventId,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Too late'})).error);
 const final=await rpc(office,'operational_event_detail',{p_event:eventId});
 assert.equal(final.status,'COMPLETED');assert.equal(final.history.length,5);
 assert.ok((await office.from('operational_event_events').select('id')).error);
 assert.ok((await office.from('operational_events').update({status:'PLANNING'}).eq('id',eventId)).error);
 assert.ok((await staff.rpc('operational_events_list',{})).error);
 assert.ok((await operations.from('crm_organisations').select('id')).data?.length===0);
 assert.equal((await operations.rpc('operational_events_list',{p_organisation:org})).data.total,1);
 assert.equal((await admin.rpc('operational_events_list',{p_organisation:org})).data.total,1);
});
