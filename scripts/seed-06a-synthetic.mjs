// Development-only, guarded synthetic demonstration. Uses ordinary authenticated CRM/Site/Event operations.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(url?.includes('dnfhkmmnlbiabqypclqg'),'06A seed is restricted to the dedicated synthetic Dev project');
const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.signInWithPassword({email:process.env.KSS_TEST_OFFICE_EMAIL,password:process.env.KSS_TEST_OFFICE_PASSWORD});
assert.ifError(login.error);
async function rpc(name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
const office='10000000-0000-4000-8000-000000000002';
const operations='10000000-0000-4000-8000-000000000007';
let organisation=(await client.from('crm_organisations').select('id,relationship_status').eq('name','Northshore Events Ltd').maybeSingle()).data;
if(!organisation){const id=await rpc('crm_create_organisation',{p_name:'Northshore Events Ltd'});organisation={id,relationship_status:'PROSPECT'};}
if(organisation.relationship_status!=='CLIENT'){
 const opportunity=await rpc('crm_create_opportunity',{p_organisation:organisation.id,p_title:'Synthetic Northshore 2027 work',p_type:'DIRECT_ENQUIRY',p_owner:office});
 await rpc('crm_transition_opportunity',{p_id:opportunity,p_stage:'WON'});
}
let contact=(await client.from('crm_contacts').select('id').eq('organisation_id',organisation.id).eq('first_name','Alex').eq('last_name','Morgan').maybeSingle()).data;
if(!contact){const id=await rpc('crm_create_contact',{p_organisation:organisation.id,p_first:'Alex',p_last:'Morgan'});contact={id};}
async function site(reference,name,address){
 let row=(await client.from('sites').select('id,status').eq('site_reference',reference).maybeSingle()).data;
 if(!row){const created=await client.from('sites').insert({site_reference:reference,name,address_line1:address,town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Main gate',site_type:'VENUE',created_by_person_id:office}).select('id,status').single();assert.ifError(created.error);row=created.data;}
 if(row.status==='DRAFT'){const changed=await client.from('sites').update({status:'ACTIVE'}).eq('id',row.id);assert.ifError(changed.error);}
 const detail=await rpc('operational_site_detail',{p_site:row.id});
 if(!detail.organisation_id)await rpc('operational_link_site',{p_site:row.id,p_organisation:organisation.id});
 else assert.equal(detail.organisation_id,organisation.id);
 return row.id;
}
const riverside=await site('DEV-06A-RIVERSIDE','Riverside Arena','1 Synthetic Riverside Way');
await site('DEV-06A-SECOND','Northshore Secondary Venue','2 Synthetic Riverside Way');
const existing=await rpc('operational_events_list',{p_organisation:organisation.id,p_search:'Northshore Live 2027'});
let eventId=existing.items.find((item)=>item.name==='Northshore Live 2027')?.id;
if(!eventId){eventId=await rpc('operational_create_event',{p_site:riverside,p_organisation:organisation.id,
 p_name:'Northshore Live 2027',p_type:'FESTIVAL',p_starts:'2027-06-01T09:00:00+01:00',p_ends:'2027-06-04T22:00:00+01:00',
 p_owner:operations,p_contact:contact.id});}
const detail=await rpc('operational_event_detail',{p_event:eventId});
if(detail.status==='PLANNING')await rpc('operational_change_event',{p_event:eventId,p_action:'STATUS',p_status:'CONFIRMED'});
const final=await rpc('operational_event_detail',{p_event:eventId});
assert.equal(final.status,'CONFIRMED');
console.log(JSON.stringify({organisationId:organisation.id,siteId:riverside,eventId,status:final.status,siteCount:(await rpc('operational_sites',{p_organisation:organisation.id})).total}));
