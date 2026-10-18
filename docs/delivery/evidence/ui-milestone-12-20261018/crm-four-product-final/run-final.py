from pathlib import Path
import json, os, subprocess, time, urllib.request

root=Path(__file__).resolve().parent
out=root
manifests=json.loads((out/'runtime-manifests.json').read_text())
manifests=[x for x in manifests if not os.environ.get('CRM_STAGE') or x['stage']==os.environ['CRM_STAGE']]
servers=[]; logs=[]
env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR','LANG'] if k in os.environ}
env['NEXT_TELEMETRY_DISABLED']='1'
if os.environ.get('CRM_STAGE'):env['CRM_STAGE']=os.environ['CRM_STAGE']
try:
    for item in manifests:
        log=(out/f"{item['stage']}-server.log").open('w'); logs.append(log)
        server=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',str(item['port'])],cwd=item['runtime'],env=env,stdout=log,stderr=subprocess.STDOUT);servers.append(server)
        for attempt in range(60):
            if server.poll() is not None: raise RuntimeError('CRM preview exited; inspect its saved log')
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{item['port']}/crm",timeout=3);break
            except Exception: time.sleep(1)
        else: raise RuntimeError('CRM preview readiness timed out')
    with (out/'browser.log').open('w') as log:
        result=subprocess.run(['node',str(root/'capture.mjs')],env=env,stdout=log,stderr=subprocess.STDOUT)
    print('CRM_COMMERCIAL_BROWSER_EXIT',result.returncode,flush=True)
    if result.returncode==0:
        with (out/'supplemental/browser.log').open('w') as log:
            result=subprocess.run(['node',str(root/'capture-extra.mjs')],env=env,stdout=log,stderr=subprocess.STDOUT)
        print('CRM_SUPPLEMENTAL_BROWSER_EXIT',result.returncode,flush=True)
    raise SystemExit(result.returncode)
finally:
    for server in servers: server.terminate()
    for log in logs: log.close()
