"""Rebuild credential-free synthetic Reports/Assets fixtures; pass --run-browser to execute.
No hosted endpoints or real identities are configured. Browser requests reject external
origins; source-destination clients and auth/database/API boundaries remain synthetic.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, tempfile
candidate=Path(__file__).resolve().parent.parent
evidence=candidate/'docs/delivery/evidence/ui-milestone-10-20261018'
(candidate/'output').mkdir(exist_ok=True)
out=Path(tempfile.mkdtemp(prefix='kss-ui-milestone10-replay-'))
for source in (evidence/'browser-fixtures').glob('*.txt'):
    name=source.name[:-4]; text=source.read_text()
    if name=='prepare.py':
        lines=text.splitlines()
        lines=[f"ROOT=Path({str(candidate.parent)!r});OUT=Path({str(out)!r});CURRENT=Path({str(candidate)!r});SHARED=CURRENT" if line.startswith('ROOT=') else f"BASE_REPORT=Path({str(evidence/'browser-baseline-source')!r});BASE_ASSET=BASE_REPORT" if line.startswith('BASE_REPORT=') else line for line in lines]
        text='\n'.join(lines)+'\n'
        text=text.replace("p=(base if stage=='before' else CURRENT)/f", "p=Path(str(base/f)+'.txt') if stage=='before' else CURRENT/f")
    if name=='reports-browser.spec.mjs':
        text=text.replace("const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../kss-ui-milestone-9');", "const root = process.env.KSS_CANDIDATE_ROOT;")
    if name=='me-boundary.mjs':
        text=text.replace("new URL('../../kss-ui-milestone-9/package.json',import.meta.url)", "process.env.KSS_CANDIDATE_ROOT+'/package.json'")
        text=text.replace("new URL('../../kss-ui-milestone-9/src/lib/auth/capabilities.ts',import.meta.url)", "process.env.KSS_CANDIDATE_ROOT+'/src/lib/auth/capabilities.ts'")
    text=text.replace("['PATH','HOME','TMPDIR','LANG']","['PATH','HOME','TMPDIR','LANG','KSS_CANDIDATE_ROOT']")
    text=text.replace("join(out,'../../ui-milestone-evidence/my-equipment-fixture-data.json')", "join(out,'synthetic-equipment-data.json')")
    text=text.replace("new URL('../../ui-milestone-evidence/my-equipment-fixture-data.json',import.meta.url)", "new URL('./synthetic-equipment-data.json',import.meta.url)")
    (out/name).write_text(text)
shutil.copyfile(evidence/'browser-fixtures/synthetic-equipment-data.json',out/'synthetic-equipment-data.json')
subprocess.run(['python3',str(out/'prepare.py')],cwd=candidate,check=True)
m=next(row for row in json.loads((out/'runtime-manifests.json').read_text())if row['stage']=='after')
runtime=Path(m['runtime']);file='src/app/(enterprise)/my-equipment/page.tsx';body=(candidate/file).read_bytes();p=runtime/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body)
m['files'].append({'file':file,'sha256':hashlib.sha256(body).hexdigest(),'origin':str(candidate/file)})
file='src/app/(enterprise)/fixture-custody-register/page.tsx';p=runtime/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('import{AssetsWorkspace}from"@/components/assets-workspace";export default function Fixture(){return <main className="enterprise-main"><h1>Synthetic register Sheet CSS check</h1><p>Fixture-only read-only register presentation; no register authority acceptance.</p><AssetsWorkspace mode="register" office={false} operations={false} superAdmin={false}/></main>}')
(out/'repair-runtime-manifests.json').write_text(json.dumps([m],indent=2)+'\n')
old=json.loads(json.dumps(m));oldruntime=Path(tempfile.mkdtemp(prefix='kss-assets-original-red-'));shutil.copytree(runtime,oldruntime,dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules','.next'));(oldruntime/'node_modules').symlink_to(candidate/'node_modules',target_is_directory=True)
file='src/components/assets-workspace.module.css';body=subprocess.check_output(['git','show','e3a5e8826e74d1341ae466c0d9834afcac357c82:'+file],cwd=candidate);(oldruntime/file).write_bytes(body)
for row in old['files']:
    if row['file']==file:row['sha256']=hashlib.sha256(body).hexdigest();row['origin']='Exact published base e3a5e882 CSS'
old['runtime']=str(oldruntime);old['port']=3233;(out/'original-css-runtime-manifests.json').write_text(json.dumps([old],indent=2)+'\n')
def freeze_source(label):
    rows=[]
    for manifest in ['runtime-manifests.json','repair-runtime-manifests.json','original-css-runtime-manifests.json']:
        for item in json.loads((out/manifest).read_text()):
            for row in item['files']:
                body=(Path(item['runtime'])/row['file']).read_bytes();assert hashlib.sha256(body).hexdigest()==row['sha256'],row['file']
                p=out/('source-'+label)/manifest/item['stage']/(row['file']+'.txt');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body);rows.append({'manifest':manifest,'stage':item['stage'],**row})
    (out/('source-'+label+'.json')).write_text(json.dumps(rows,indent=2)+'\n')
freeze_source('before')
print('Prepared source-pinned fixtures:',out,flush=True)
parser=argparse.ArgumentParser();parser.add_argument('--run-browser',action='store_true');args=parser.parse_args()
if args.run_browser:
    env={key:os.environ[key]for key in ['PATH','HOME','TMPDIR','LANG']if key in os.environ};env['KSS_CANDIDATE_ROOT']=str(candidate)
    result=subprocess.run(['python3',str(out/'run-authority-matched.py')],cwd=candidate,env=env)
    freeze_source('after');raise SystemExit(result.returncode)
