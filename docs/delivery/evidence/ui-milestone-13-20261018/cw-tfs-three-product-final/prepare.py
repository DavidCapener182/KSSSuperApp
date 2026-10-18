from pathlib import Path
import hashlib,json,re,shutil,subprocess,tempfile,os
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent; SOURCE=ROOT/'kss-followup-integration'; SHARED=ROOT/'kss-ui-milestone-6'; FOUNDATION='cc477fe3f23238b7ecf963d54692ebdd4101bf21'; BASE='9b958f67c874ddbae16be3b4fed450525ee44d1a';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=SHARED,text=True).strip()==FOUNDATION
TEMPLATE=OUT.parent/'crm-commercial/fixture-template'; BOUNDARIES=['src/lib/auth/principal.ts','src/lib/supabase/server.ts','src/lib/supabase/browser.ts','src/app/layout.tsx','src/app/(enterprise)/layout.tsx','src/app/page.tsx']
ROUTES=['src/app/(enterprise)/client-workspaces/layout.tsx','src/app/(enterprise)/client-workspaces/page.tsx','src/app/(enterprise)/client-workspaces/[workspaceId]/page.tsx','src/app/(enterprise)/client-workspaces/[workspaceId]/loss-prevention/page.tsx','src/app/(enterprise)/client-workspaces/[workspaceId]/loss-prevention/[issueId]/page.tsx','src/app/(enterprise)/client-workspaces/manage/page.tsx','src/app/(enterprise)/tfs/page.tsx']
def shared(f):return f=='src/app/globals.css' or f=='src/components/enterprise-shell.tsx' or f.startswith(('src/components/ui/','src/components/ui13/','src/components/ui/workflow')) or f in ['src/lib/auth/capabilities.ts','src/lib/environment-label.ts']
def content(f,stage):
 if shared(f):return(SHARED/f).read_bytes(),'published-shared'
 if stage=='after' and f=='src/components/tfs-workspace.module.css':return(ROOT/'kss-ui-shared'/f).read_bytes(),'approved-isolated-cw-page-containment'
 if stage=='after' and f in ['src/app/(enterprise)/client-workspaces/manage/page.tsx','src/components/workspace-access-admin.module.css']:return(ROOT/'kss-ui-shared'/f).read_bytes(),'approved-isolated-workspace-admin-palette'
 if stage=='after':return(SOURCE/f).read_bytes(),'current-integration'
 return subprocess.check_output(['git','show',BASE+':'+f],cwd=SOURCE),'exact-before9b958f6'
manifest=[]
for stage in ['before','after']:
 runtime=Path(tempfile.mkdtemp(prefix='kss-client-workspaces-'+stage+'-'));(runtime/'node_modules').symlink_to(ROOT/'kss-dependencies/node_modules',target_is_directory=True)
 for name in ['package.json','tsconfig.json','postcss.config.mjs','next.config.ts','next-env.d.ts']:
  if(TEMPLATE/name).exists():shutil.copy2(TEMPLATE/name,runtime/name)
 if(TEMPLATE/'public').exists():shutil.copytree(TEMPLATE/'public',runtime/'public')
 for f in BOUNDARIES:
  t=runtime/f;t.parent.mkdir(parents=True,exist_ok=True)
  if f=='src/app/layout.tsx':t.write_text("import './globals.css';export default function Layout({children}){return <html lang='en'><body><aside style={{padding:8,background:'#fff1d7',color:'#182334'}}>Synthetic Client Workspace browser review · mock identity and records · no live Auth/RPC/RLS · no real writes</aside>{children}</body></html>}")
  elif f=='src/app/page.tsx':t.write_text("export default function Page(){return <h1>Synthetic session required</h1>}")
  elif f=='src/app/(enterprise)/layout.tsx':t.write_text("import {EnterpriseShell} from '@/components/enterprise-shell';import {getPrincipal} from '@/lib/auth/principal';import {navigationFor} from '@/lib/auth/capabilities';export default async function Layout({children}){const p=await getPrincipal();return p?<EnterpriseShell person={{id:p.personId,name:p.displayName}} roles={p.roles} incidentReviewer={p.incidentReviewer} navigation={navigationFor(p)}>{children}</EnterpriseShell>:children;}")
  elif f=='src/lib/auth/principal.ts':t.write_text("import {cookies} from 'next/headers';export async function getPrincipal(){const c=await cookies(),r=c.get('fixtureRole')?.value??'OFFICE_ADMIN';return r==='NONE'?null:{personId:'00000000-0000-4000-8000-000000000001',displayName:'Synthetic Commercial Reviewer',roles:r.split(',').filter(Boolean),incidentReviewer:false}};export const isUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);")
  elif f=='src/lib/supabase/server.ts':t.write_bytes((OUT/('server-boundary-after.ts.txt'if stage=='after'else'server-boundary.ts.txt')).read_bytes())
  else:shutil.copy2(TEMPLATE/f,t)
 (runtime/'src/lib/fixture-data.json').write_bytes((OUT/'fixture-data.json').read_bytes())
 queue=ROUTES+['src/app/globals.css','src/components/enterprise-shell.tsx','src/lib/auth/capabilities.ts'];seen=set();files=[]
 while queue:
  f=queue.pop()
  if f in seen or f in BOUNDARIES:continue
  seen.add(f);b,origin=content(f,stage);t=runtime/f;t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes(b);files.append({'file':f,'sha256':hashlib.sha256(b).hexdigest(),'origin':origin})
  if f.endswith(('.ts','.tsx')):
   for spec in re.findall(r'''(?:from\s+|import\s*)['"]([^'"]+)['"]''',b.decode()):
    if spec.startswith('@/'):stem=Path('src')/spec[2:]
    elif spec.startswith('.'):stem=Path(f).parent/spec
    else:continue
    stem=Path(os.path.normpath(stem))
    for c in [stem,Path(str(stem)+'.ts'),Path(str(stem)+'.tsx'),stem/'index.ts',stem/'index.tsx']:
     if(SOURCE/c).is_file():queue.append(str(c));break
 manifest.append({'stage':stage,'runtime':str(runtime),'port':3190 if stage=='before' else 3191,'foundation':FOUNDATION,'beforeRef':BASE,'integrationHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=SOURCE,text=True).strip(),'files':files,'boundaries':[{'file':f,'sha256':hashlib.sha256((runtime/f).read_bytes()).hexdigest()}for f in BOUNDARIES+['src/lib/fixture-data.json']]})
(OUT/'runtime-manifests.json').write_text(json.dumps(manifest,indent=2)+'\n');print([(m['stage'],len(m['files']),m['runtime']) for m in manifest])
