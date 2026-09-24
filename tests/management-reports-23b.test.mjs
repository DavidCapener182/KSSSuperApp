import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
const plus=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return client;}
async function report(client,start,end,extra={}){const {data,error}=await client.rpc('management_report_23b',{
 p_start:start,p_end:end,p_mode:'CURRENT',p_client:null,p_site:null,p_service:null,p_event:null,
 p_source:null,p_offset:0,p_limit:30,...extra});assert.ifError(error);return data;}

test('23B guarded current reporting reconciles to typed source lines',{timeout:180000},async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg'),'synthetic Dev only');
 assert.ok(key&&Object.values(credentials).every(pair=>pair.every(Boolean)));
 const [admin,office,operations,staff]=await Promise.all(['admin','office','operations','staff'].map(signed));
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
 const start=plus(today,-27),end=plus(today,1);
 const [all,eventOnly,staticOnly,officeView]=await Promise.all([
  report(admin,start,end),report(admin,start,end,{p_source:'EVENT'}),
  report(admin,start,end,{p_source:'SITE_SHIFT'}),report(office,start,end)]);
 assert.equal(all.mode,'CURRENT');assert.ok(Date.parse(all.data_as_of));
 assert.equal(all.total_lines,eventOnly.total_lines+staticOnly.total_lines);
 for(const name of ['required','allocated','accepted','remaining','unavailable_conflicts','removed_coverage_conflicts'])
  assert.equal(all.totals[name],eventOnly.totals[name]+staticOnly.totals[name],name);
 const gathered=[];
 for(let offset=0;offset<all.total_lines;offset+=30){const page=offset===0?all:await report(admin,start,end,{p_offset:offset});
  assert.equal(page.total_lines,all.total_lines);gathered.push(...page.lines);}
 assert.equal(gathered.length,all.total_lines);
 assert.equal(new Set(gathered.map(line=>`${line.source}:${line.source_id}`)).size,gathered.length);
 for(const name of ['required','allocated','accepted','remaining'])
  assert.equal(all.totals[name],gathered.reduce((sum,line)=>sum+line[name],0),name);
 assert.ok(gathered.every(line=>line.remaining===Math.max(line.required-line.allocated,0)));
 assert.ok(gathered.every(line=>line.source==='EVENT'||line.source==='SITE_SHIFT'));
 assert.ok(gathered.every(line=>line.source_id&&line.parent_id&&line.service_date&&line.definition_version===1));
 assert.ok(officeView.lines.every(line=>officeView.filters.sites.some(site=>site.id===line.site_id)));
 assert.ok(!/person_name|person_id|phone|email|incident|credential|contact|finance|invoice|payroll/i.test(JSON.stringify(all)));
 assert.ok((await operations.rpc('management_report_23b',{p_start:start,p_end:end})).error);
 assert.ok((await staff.rpc('management_report_23b',{p_start:start,p_end:end})).error);
 assert.ok((await admin.from('reporting_measure_definitions_23b').select('measure_code')).error);
 assert.ok((await admin.from('reporting_measure_definitions_23b').insert({measure_code:'BAD'})).error);
 assert.ok((await office.from('event_staffing_requirements').select('id')).error);
 assert.ok((await office.from('site_shift_demands').select('id')).error);
 const anonymous=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.ok((await anonymous.rpc('management_report_23b',{p_start:start,p_end:end})).error);
 const historical=await report(admin,start,end,{p_mode:'HISTORICAL'});
 assert.equal(historical.status,'Historical snapshot unavailable');assert.equal(historical.totals,undefined);
 assert.equal(all.definitions.REQUIRED,1);
 assert.ok((await admin.rpc('management_report_23b',{p_start:start,p_end:plus(start,91)})).error);
 if(all.lines.length){const line=all.lines[0];
  const filtered=await report(admin,start,end,{p_site:line.site_id});
  assert.ok(filtered.lines.every(row=>row.site_id===line.site_id));
  const hidden='00000000-0000-4000-8000-000000000000';
  assert.ok((await admin.rpc('management_report_23b',{p_start:start,p_end:end,p_site:hidden})).error);
  if(line.source==='SITE_SHIFT') assert.ok((await staff.rpc('site_service_detail',{p_site:line.site_id,p_service:line.parent_id,p_from:line.service_date,p_until:plus(line.service_date,1)})).error,'destination source reauthorises Staff');
 }
 const adminSites=await admin.from('sites').select('id,created_by_person_id').neq('created_by_person_id','10000000-0000-4000-8000-000000000002').limit(1);
 assert.ifError(adminSites.error);
 if(adminSites.data.length){const hidden=adminSites.data[0].id;
  assert.ok((await office.rpc('management_report_23b',{p_start:start,p_end:end,p_site:hidden})).error,'Office cannot filter a hidden Site');
  assert.ok(!officeView.filters.sites.some(site=>site.id===hidden),'hidden Site omitted from options');}
});

test('23B Event requirement/acceptance and cancellation reconcile without erasing source history',{timeout:180000},async()=>{
 const [office,staff]=await Promise.all(['office','staff'].map(signed));
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
 const duty=plus(today,70),end=plus(duty,1),stamp=Date.now();
 const action=async(name,args)=>{const {data,error}=await office.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;};
 const org=await action('crm_create_organisation',{p_name:`23B Synthetic Client ${stamp}`});
 const opportunity=await action('crm_create_opportunity',{p_organisation:org,p_title:'Synthetic reporting fixture',p_type:'DIRECT_ENQUIRY',p_owner:'10000000-0000-4000-8000-000000000002'});
 await action('crm_transition_opportunity',{p_id:opportunity,p_stage:'WON'});
 const site=await office.from('sites').insert({site_reference:`DEV-23B-${stamp}`,name:'23B Synthetic Site',address_line1:'1 Example Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Gate',created_by_person_id:'10000000-0000-4000-8000-000000000002',site_type:'VENUE'}).select('id').single();assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await action('operational_link_site',{p_site:site.data.id,p_organisation:org});
 const event=await action('operational_create_event',{p_site:site.data.id,p_organisation:org,p_name:'23B Synthetic Event',p_type:'CORPORATE_EVENT',p_starts:`${duty}T02:00:00Z`,p_ends:`${duty}T05:00:00Z`,p_owner:'10000000-0000-4000-8000-000000000002'});
 try{
  const roles=await action('staffing_role_choices',{}),role=roles.find(item=>item.code==='STEWARD');assert.ok(role);
  const requirement=await action('staffing_create_confirmed',{p_event:event,p_role:role.id,p_quantity:2,p_report:`${duty}T02:00:00Z`,p_start:`${duty}T02:15:00Z`,p_end:`${duty}T04:30:00Z`,p_area:'Reporting gate',p_instructions:'Synthetic only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
  const before=await report(office,duty,end,{p_event:event});assert.equal(before.totals.required,2);assert.equal(before.totals.remaining,2);
  assert.equal(before.lines[0].source,'EVENT');assert.equal(before.lines[0].source_id,requirement);
  const allocation=await action('deployment_allocate',{p_event:event,p_requirement:requirement,p_person:'10000000-0000-4000-8000-000000000003',p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic TASK-23B acceptance proof'});
  const allocated=await report(office,duty,end,{p_event:event});assert.equal(allocated.totals.allocated,1);assert.equal(allocated.totals.accepted,0);assert.equal(allocated.totals.remaining,1);
  const response=await staff.rpc('deployment_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'});assert.ifError(response.error);
  const accepted=await report(office,duty,end,{p_event:event});assert.equal(accepted.totals.allocated,1);assert.equal(accepted.totals.accepted,1);assert.equal(accepted.totals.remaining,1);
 }finally{await action('operational_change_event',{p_event:event,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Synthetic TASK-23B source cancellation proof'});}
 const after=await report(office,duty,end,{p_event:event});assert.equal(after.total_lines,0);assert.equal(after.totals.required,0);
 const detail=await action('operational_event_detail',{p_event:event});assert.ok(detail.history.some(item=>item.kind==='STATUS'&&item.new_status==='CANCELLED'));
});

test('23B static overnight service date survives autumn DST and spring range stays incomplete beyond horizon',{timeout:180000},async()=>{
 const admin=await signed('admin');
 const autumn=await report(admin,'2026-10-25','2026-10-26',{p_source:'SITE_SHIFT'});
 const exact=autumn.lines.find(line=>line.source_id==='567f9d27-f661-4357-89fd-ec213299970c');
 assert.ok(exact,'accepted synthetic 08A overnight demand remains materialised');
 assert.equal(exact.service_date,'2026-10-25');
 const {data:detail,error}=await admin.rpc('site_service_detail',{p_site:exact.site_id,p_service:exact.parent_id,p_from:'2026-10-25',p_until:'2026-10-26'});
 assert.ifError(error);const source=detail.demands.find(item=>item.id===exact.source_id);assert.ok(source);
 assert.equal(source.service_date,exact.service_date);
 assert.equal(new Date(source.shift_ends_at).toLocaleDateString('en-CA',{timeZone:'Europe/London'}),'2026-10-26');
 assert.equal(autumn.totals.required,autumn.breakdowns.reduce((sum,row)=>sum+row.required,0));
 const spring=await report(admin,'2027-03-28','2027-03-29',{p_source:'SITE_SHIFT'});
 assert.equal(spring.period_start,'2027-03-28');assert.equal(spring.period_end,'2027-03-29');
 assert.equal(spring.static_coverage.status,'INCOMPLETE_SOURCE_COVERAGE');
 assert.equal((Date.parse('2026-10-26T00:00:00Z')-Date.parse('2026-10-24T23:00:00Z'))/3600000,25);
 assert.equal((Date.parse('2027-03-28T23:00:00Z')-Date.parse('2027-03-28T00:00:00Z'))/3600000,23);
});
