// Safe non-deploying Cloudflare Worker Version repair.
// Copy the already-staged French Worker code and inherit EACH missing encrypted
// secret by explicit, immutable parent version. Never read or log secret values.
import {writeFileSync,appendFileSync} from 'node:fs';

const API='https://api.cloudflare.com/client/v4';
const WORKER='apps-monitor-api';
const mandatory=['APP_MONITOR_DATA','FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON',
  'BIZ_CATALOG_GITHUB_TOKEN','ALLOWED_ORIGIN','FCM_PROJECT_ID'];

export function buildPayload(active,stage,activeId,stagedId){
  if(!Array.isArray(active?.bindings)||!Array.isArray(stage?.bindings))
    throw Error('Expected bindings metadata on both Worker versions');
  const a=new Map(active.bindings.map(b=>[b.name,b]));
  const b=new Map(stage.bindings.map(b=>[b.name,b]));
  if(!a.has('BIZ_CATALOG_GITHUB_TOKEN'))
    throw Error('Active production does not have the expected private Biz binding');
  if(!b.has('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON'))
    throw Error('Staged candidate is missing the new Firebase binding');
  const bizType=a.get('BIZ_CATALOG_GITHUB_TOKEN')?.type;
  if(!['secret_text','plain_text'].includes(bizType) ||
     b.get('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON')?.type!=='secret_text')
    throw Error('Unexpected Biz/Firebase binding types; refusing to copy or expose values');
  for(const name of mandatory){
    if(a.has(name)&&b.has(name)&&a.get(name).type!==b.get(name).type)
      throw Error('Candidate changed binding type of '+name);
  }
  const bindings=[];
  for(const value of b.values()){
    if(value.type==='secret_text'||value.type==='secret_key'){
      bindings.push({name:value.name,type:'inherit',version_id:stagedId});
    }else{
      // Only preserve explicitly verified non-secret metadata.
      if(value.type==='plain_text')
        bindings.push({name:value.name,type:value.type,text:value.text});
      else if(value.type==='r2_bucket')
        bindings.push({name:value.name,type:value.type,bucket_name:value.bucket_name,
          ...(value.jurisdiction?{jurisdiction:value.jurisdiction}:{})});
      else throw Error('Unexpected staged binding type for '+value.name+': '+value.type);
    }
  }
  for(const value of a.values()){
    if(b.has(value.name))continue;
    if(value.name==='BIZ_CATALOG_GITHUB_TOKEN'&&value.type==='plain_text'){
      // The existing Worker stores this token as a plain-text var, not a secret.
      // Preserve by immutable version reference; never read or echo .text.
      bindings.push({name:value.name,type:'inherit',version_id:activeId});
      continue;
    }
    if(value.type!=='secret_text'&&value.type!=='secret_key')
      throw Error('Refusing to drop existing non-secret binding '+value.name);
    bindings.push({name:value.name,type:'inherit',version_id:activeId});
  }
  const names=new Set(bindings.map(x=>x.name));
  if(bindings.length!==names.size)throw Error('Duplicate binding in staged candidate');
  for(const name of mandatory)
    if(!names.has(name))throw Error('Missing mandatory binding: '+name);

  if(typeof stage.main_module!=='string'||!stage.main_module||
     !Array.isArray(stage.modules)||stage.modules.length===0)
    throw Error('Staged code modules are missing');
  const modules=stage.modules.map(m=>{
    if(!m.name||!m.content_type||!m.content_base64)
      throw Error('Module content unavailable for safe version copy');
    return {name:m.name,content_type:m.content_type,content_base64:m.content_base64};
  });
  if(!modules.some(x=>x.name===stage.main_module))
    throw Error('Staged Worker main module is not present');
  const source=Buffer.from(modules.find(x=>x.name===stage.main_module).content_base64,'base64').toString('utf8');
  if(!source.includes('2026.11.23.french-passkey-firebase-v1'))
    throw Error('Staged code does not match the approved French bridge build');
  const payload={
    compatibility_date:stage.compatibility_date,
    main_module:stage.main_module,
    modules,bindings,
    annotations:{
      'workers/message':'Staged French Firebase bridge: Firebase inherited from staged version, Biz inherited from active production',
      'workers/tag':'kk-french-explicit-inherit-'+process.env.GITHUB_SHA?.slice(0,10)
    }
  };
  if(Array.isArray(stage.compatibility_flags)&&stage.compatibility_flags.length)
    payload.compatibility_flags=stage.compatibility_flags;
  return payload;
}

async function main(){
  const token=process.env.CLOUDFLARE_API_TOKEN;
  const account=process.env.CLOUDFLARE_ACCOUNT_ID;
  const activeId=process.env.APP_MONITOR_PREVIOUS;
  const stagedId=process.env.APP_MONITOR_STAGED;
  if(!token||!account||!activeId||!stagedId||
    !/^[a-f0-9-]{36}$/.test(activeId)||!/^[a-f0-9-]{36}$/.test(stagedId))
    throw Error('Cloudflare permissions or pinned version IDs unavailable');
  async function call(path,init={}){
    const response=await fetch(API+'/accounts/'+account+path,{
      ...init,headers:{Authorization:'Bearer '+token,
        ...(init.body?{'Content-Type':'application/json'}:{}),...(init.headers||{})},
      signal:AbortSignal.timeout(25000)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.success===false){
      const codes=(data?.errors||[]).map(e=>Number(e.code)).filter(Number.isFinite);
      // Log status and numeric error codes only. NEVER log API response bodies.
      throw Error('Cloudflare API rejected stage request (HTTP '+response.status+', codes '+codes.join(',')+')');
    }
    return data?.result??data;
  }
  const prefix='/workers/workers/'+encodeURIComponent(WORKER)+'/versions/';
  const [active,staged]=await Promise.all([
    call(prefix+activeId),
    call(prefix+stagedId+'?include=modules')
  ]);
  const payload=buildPayload(active,staged,activeId,stagedId);
  const created=await call('/workers/workers/'+encodeURIComponent(WORKER)+'/versions',{
    method:'POST',body:JSON.stringify(payload)
  });
  const candidate=created?.id;
  if(!/^[a-f0-9-]{36}$/.test(String(candidate||'')))
    throw Error('Cloudflare did not return an immutable staged version ID');
  const checked=await call(prefix+candidate);
  const names=new Set((checked.bindings||[]).map(b=>b.name));
  for(const name of mandatory)
    if(!names.has(name))throw Error('STAGING BLOCKED: repaired version lost binding '+name);
  appendFileSync(process.env.GITHUB_ENV,'APP_MONITOR_REPAIRED='+candidate+'\n');
  console.log('Created UNDEPLOYED repaired version '+candidate.slice(0,8));
  console.log('Critical binding names verified: R2, Firebase, Biz and required public config; no secrets read');
}

if(process.argv[1]&&import.meta.url.endsWith(process.argv[1]))
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
