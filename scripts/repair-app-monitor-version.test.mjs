import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPayload} from './repair-app-monitor-version.mjs';
const activeId='0bb46ca0-65bc-4b45-b8e8-1ab55f31352d';
const stagedId='a80d0195-93d6-48f4-9145-c2def4f7a86f';
const source=Buffer.from("const BUILD='2026.11.23.french-passkey-firebase-v1'; export default {fetch(){return new Response('OK')}}").toString('base64');
const active={bindings:[
  {name:'APP_MONITOR_DATA',type:'r2_bucket',bucket_name:'apps-monitor-data'},
  {name:'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON',type:'secret_text'},
  {name:'BIZ_CATALOG_GITHUB_TOKEN',type:'secret_text'},
  {name:'ALLOWED_ORIGIN',type:'plain_text',text:'https://nirav2000.github.io'},
  {name:'FCM_PROJECT_ID',type:'plain_text',text:'kk-syllabus'}]};
const stage={...active,main_module:'worker.js',compatibility_date:'2026-09-24',
  modules:[{name:'worker.js',content_type:'application/javascript+module',content_base64:source}],
  bindings:active.bindings.filter(x=>x.name!=='BIZ_CATALOG_GITHUB_TOKEN')};
test('preserves Biz from specifically pinned ACTIVE production and Firebase from staged candidate',()=>{
  const p=buildPayload(active,stage,activeId,stagedId);
  assert.equal(p.bindings.length,5);
  assert.deepEqual(p.bindings.find(b=>b.name==='BIZ_CATALOG_GITHUB_TOKEN'),{
    name:'BIZ_CATALOG_GITHUB_TOKEN',type:'inherit',version_id:activeId});
  assert.deepEqual(p.bindings.find(b=>b.name==='FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON'),{
    name:'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON',type:'inherit',version_id:stagedId});
  assert.equal(p.bindings.find(b=>b.name==='APP_MONITOR_DATA').bucket_name,'apps-monitor-data');
  assert.equal(p.bindings.find(b=>b.name==='ALLOWED_ORIGIN').text,'https://nirav2000.github.io');
  assert.deepEqual(p.modules,[stage.modules[0]]);
  assert.equal(p.main_module,'worker.js');
  assert.equal(JSON.stringify(p).includes('PRIVATE KEY'),false);
});
test('never assumes latest version contains Biz or secrets; requires immutable version IDs',()=>{
  const payload=buildPayload(active,stage,activeId,stagedId);
  assert.deepEqual(payload.bindings.filter(b=>b.type==='inherit').map(b=>b.version_id).sort(),[activeId,stagedId].sort());
});
test('fails closed on missing Firebase, Biz, R2, or unknown replacement bindings',()=>{
  const wrong={...stage,bindings:stage.bindings.filter(b=>b.name!=='FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON')};
  assert.throws(()=>buildPayload(active,wrong,activeId,stagedId),/Firebase/);
  assert.throws(()=>buildPayload({...active,bindings:active.bindings.filter(x=>x.name!=='BIZ_CATALOG_GITHUB_TOKEN')},stage,activeId,stagedId),/Biz/);
  assert.throws(()=>buildPayload(active,{...stage,bindings:stage.bindings.filter(x=>x.name!=='APP_MONITOR_DATA')},activeId,stagedId),/non-secret binding/);
  assert.throws(()=>buildPayload(active,{...stage,bindings:stage.bindings.map(x=>x.name==='ALLOWED_ORIGIN'?{...x,type:'secret_text'}:x)},activeId,stagedId),/ALLOWED_ORIGIN/);
  assert.throws(()=>buildPayload(active,{...stage,main_module:'wrong.js'},activeId,stagedId),/main module/);
});
