import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,nodes,text,id,response,tick} from './helpers/ui-commercial-fixture.mjs';
const organisation={id:id(1),name:'Synthetic Organisation',relationship_status:'PROSPECT'};
const handle=async c=>response(c.url.startsWith('/api/people')?{items:[]}:c.url.includes('view=organisation&')?{organisation,contacts:[]}:{items:[organisation]});
test('new lead starts with focused Organisation choice and no premature details or write',async()=>{
 const h=fixture('src/components/crm-new-lead.tsx','CrmNewLead',{currentPersonId:id(2)},handle);await h.ready();
 assert.match(text(h.tree),/1 · Organisation/);assert.doesNotMatch(text(h.tree),/Opportunity title/);
 assert.ok(nodes(h.tree,'button').find(n=>text(n)==='Continue to lead details')?.props.disabled);
 await h.submit();assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});
test('selected Organisation is retained through ordered details and visible final summary',async()=>{
 const h=fixture('src/components/crm-new-lead.tsx','CrmNewLead',{currentPersonId:id(2),initialOrganisationId:organisation.id},handle);await h.ready();h.click('Continue to lead details');
 assert.match(text(h.tree),/2 · Lead details/);assert.match(text(h.tree),/Review before creating/);assert.match(text(h.tree),/Synthetic Organisation/);
 h.change('Opportunity title','Synthetic exact enquiry');h.change('Estimated value (£)','1250');
 assert.match(text(h.tree),/Synthetic exact enquiry/);assert.match(text(h.tree),/£1,250/);
 h.click('Back to Organisation');assert.doesNotMatch(text(h.tree),/Opportunity title/);h.click('Continue to lead details');assert.equal(nodes(h.tree,'input').find(n=>n.props.value==='Synthetic exact enquiry')?.props.value,'Synthetic exact enquiry');
 assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});
const context=org=>({organisation:org,opportunity:null,mobilisationTotal:0,mobilisations:[],sites:[],siteServices:[],events:[],serviceDeliveries:[]});
test('handoff shows source-linked stages with no local completion/write controls',async()=>{
 const h=fixture('src/components/commercial-handoff-client.tsx','CommercialHandoffClient',{organisationId:organisation.id},async()=>response(context({id:organisation.id,name:organisation.name,relationshipStatus:'PROSPECT'})));await h.ready();
 assert.match(text(h.tree),/Synthetic Organisation/);assert.match(text(h.tree),/Organisation relationship context/);assert.equal(nodes(h.tree,'button').length,0);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});
test('handoff scope change and wrong Organisation response cannot display previous authorised facts',async()=>{
 const props={organisationId:organisation.id};const h=fixture('src/components/commercial-handoff-client.tsx','CommercialHandoffClient',props,async()=>response(context({id:organisation.id,name:organisation.name,relationshipStatus:'PROSPECT'})));await h.ready();assert.match(text(h.tree),/Synthetic Organisation/);
 props.organisationId=id(9);h.render();await tick();h.render();assert.doesNotMatch(text(h.tree),/Synthetic Organisation/);assert.match(text(h.tree),/unavailable|changed|different/i);
});
for(const view of ['overview','organisations','contacts','opportunities','pipeline'])test(`CRM ${view} retains its exact route/source and current view navigation`,async()=>{
 const row={id:id(4),organisation_id:organisation.id,name:organisation.name,title:'Synthetic Opportunity',first_name:'Synthetic',last_name:'Contact',crm_organisations:{name:organisation.name},relationship_status:'PROSPECT',stage:'NEW_LEAD'};
 const h=fixture('src/components/crm-client.tsx','CrmClient',{view,currentPersonId:id(2)},async c=>response(c.url.startsWith('/api/people')?{items:[]}:{items:[row],total:1,operational:{dueToday:2}}));await h.ready();
 const current=nodes(h.tree,'a').find(n=>n.props['aria-current']==='page');assert.equal(current?.props.href,view==='overview'?'/crm':`/crm?view=${view}`);
 assert.ok(nodes(h.tree,'a').some(n=>n.props.href==='/crm/new-lead'));
 assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 if(view==='pipeline'){assert.equal(nodes(h.tree,'pipeline').length,1);assert.equal(h.calls.some(c=>c.url.startsWith('/api/crm?')),false);}
 else assert.ok(h.calls.some(c=>c.url.includes(`view=${view}`)));
});
test('Opportunity primary work precedes supporting facts and From/To review keeps exact source',async()=>{
 const opportunity={id:id(4),organisation_id:organisation.id,title:'Synthetic Opportunity',stage:'NEGOTIATION',opportunity_type:'DIRECT_ENQUIRY',owner_person_id:id(2)};
 const h=fixture('src/components/crm-client.tsx','CrmClient',{view:'opportunity',id:opportunity.id,currentPersonId:id(2)},async c=>response(c.url.startsWith('/api/people')?{items:[]}:{opportunity,organisation}));await h.ready();
 assert.equal(nodes(h.tree,'record-work')[0].props.id,opportunity.id);assert.equal(nodes(h.tree,'record-work')[0].props.organisationId,organisation.id);
 const rootChildren=nodes(h.tree,'div').find(n=>n.props.className==='crm-opportunity-record').props.children;const workIndex=rootChildren.findIndex(n=>n?.props?.id==='opportunity-work');const factsIndex=rootChildren.findIndex(n=>n?.props?.className?.includes('opportunityFacts'));assert.ok(workIndex<factsIndex);
 h.change('Move to stage','DORMANT');assert.match(text(h.tree),/Review stage:\s+Negotiation\s+→\s+Dormant/);assert.equal(nodes(h.tree,'button').find(n=>text(n)==='Record stage change').props.disabled,true);
 assert.ok(nodes(h.tree,'details').some(n=>n.props.id==='opportunity-stage'));
});
test('Organisation retains exact contacts/source links and history is secondary',async()=>{
 const h=fixture('src/components/crm-client.tsx','CrmClient',{view:'organisation',id:organisation.id,currentPersonId:id(2)},async c=>response(c.url.startsWith('/api/people')?{items:[]}:{organisation,contacts:[],opportunities:[],history:[]}));await h.ready();
 assert.equal(nodes(h.tree,'source-links')[0].props.organisationId,organisation.id);assert.equal(nodes(h.tree,'record-work')[0].props.id,organisation.id);assert.ok(nodes(h.tree,'details').some(n=>n.props.id==='organisation-history'));assert.ok(nodes(h.tree,'a').some(n=>n.props.href===`/crm/new-lead?organisation=${organisation.id}`));
});
test('new lead commits exact reviewed Organisation/details then requires exact NEW_LEAD readback',async()=>{
 const posts=[],opportunityId=id(7);const h=fixture('src/components/crm-new-lead.tsx','CrmNewLead',{currentPersonId:id(2),initialOrganisationId:organisation.id},async c=>{
 if(c.method==='POST'){posts.push(c.body);return response({id:opportunityId});}if(c.url.includes('view=opportunity&'))return response({opportunity:{id:opportunityId,stage:'NEW_LEAD'}});return handle(c);
 });await h.ready();h.click('Continue to lead details');h.change('Opportunity title','Synthetic exact enquiry');h.change('Estimated value (£)','1250');h.change('Expected decision date','2026-10-25');await h.submit();
 assert.deepEqual(posts,[{action:'createOpportunity',organisationId:organisation.id,title:'Synthetic exact enquiry',type:'DIRECT_ENQUIRY',ownerId:id(2),contactId:null,valuePence:125000,decisionDate:'2026-10-25',summary:null}]);assert.equal(h.calls.find(c=>c.navigation)?.navigation,`/crm/opportunities/${opportunityId}`);
});
test('failed saved-lead readback retains recovery without reposting create',async()=>{
 let posts=0,reads=0;const opportunityId=id(7);const h=fixture('src/components/crm-new-lead.tsx','CrmNewLead',{currentPersonId:id(2),initialOrganisationId:organisation.id},async c=>{
 if(c.method==='POST'){posts++;return response({id:opportunityId});}if(c.url.includes('view=opportunity&'))return ++reads===1?response({},false):response({opportunity:{id:opportunityId,stage:'NEW_LEAD'}});return handle(c);
 });await h.ready();h.click('Continue to lead details');h.change('Opportunity title','Synthetic enquiry');await h.submit();assert.equal(posts,1);assert.equal(h.calls.some(c=>c.navigation),false);assert.match(text(h.tree),/Check saved lead/);await h.submit();assert.equal(posts,1);assert.equal(reads,2);assert.ok(h.calls.some(c=>c.navigation));
});
test('denied create retains reviewed details and never navigates or silently writes again',async()=>{
 let posts=0;const h=fixture('src/components/crm-new-lead.tsx','CrmNewLead',{currentPersonId:id(2),initialOrganisationId:organisation.id},async c=>{if(c.method==='POST'){posts++;return response({error:'Synthetic denial'},false);}return handle(c);});await h.ready();h.click('Continue to lead details');h.change('Opportunity title','Synthetic retained draft');await h.submit();assert.equal(posts,1);assert.match(text(h.tree),/Synthetic denial/);assert.equal(h.calls.some(c=>c.navigation),false);assert.equal(nodes(h.tree,'input').find(n=>n.props.value==='Synthetic retained draft')?.props.value,'Synthetic retained draft');
});
test('while a lead write is pending all review fields and back action are locked',async()=>{
 let release,posts=0;const h=fixture('src/components/crm-new-lead.tsx','CrmNewLead',{currentPersonId:id(2),initialOrganisationId:organisation.id},async c=>{if(c.method==='POST'){posts++;return new Promise(resolve=>{release=()=>resolve(response({error:'Synthetic denial'},false));});}return handle(c);});await h.ready();h.click('Continue to lead details');h.change('Opportunity title','Synthetic pending enquiry');await h.submit();assert.equal(nodes(h.tree,'fieldset')[0].props.disabled,true);assert.equal(nodes(h.tree,'button').find(n=>text(n)==='Back to Organisation').props.disabled,true);await h.submit();assert.equal(posts,1);release();await tick();h.render();assert.equal(nodes(h.tree,'fieldset')[0].props.disabled,false);
});
