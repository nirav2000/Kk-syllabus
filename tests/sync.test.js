import test from 'node:test';
import assert from 'node:assert/strict';
import { blankProfile, record } from '../src/engine.js';
import { objectives } from '../src/content.js';
import { initialGarden, evidence } from '../src/garden-model.js';
import { eventsOf, mergeData, uniqueEvents } from '../src/sync-model.js';
import { createLocalStore, DATA_KEY } from '../src/local-data.js';
import { syncLearning } from '../src/sync-transport.js';

function memory(entries={}){const m=new Map(Object.entries(entries));return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
function sample(id,correct=true){const p=blankProfile();record(p,objectives[0].items[2],objectives[0],correct);p.events[0].id=id;p.events[0].ts='2026-09-09T10:00:00Z';return {profile:p,garden:initialGarden()};}
function server(){const rows=new Map();let meta=null;return {rows,get meta(){return meta},async readEvents(){return structuredClone([...rows.values()]);},async writeEvents(es){for(const e of es)rows.set(e.id,structuredClone(e));},async updateMetadata(fn){meta=fn(meta);return structuredClone(meta);}};}
test('old profile and garden migrate together and PIN is never exported',()=>{
  const a=sample('a');a.garden.attempts=[{stage:'apply',correct:true,supported:false,ts:'2026-09-09T09:00:00Z'}];
  const storage=memory({'curious-profile':JSON.stringify(a.profile),'curious-garden-v1':JSON.stringify(a.garden),'curious-pin':'1234'}),store=createLocalStore(storage);
  store.saveProfile(store.read().profile);
  assert.equal(store.read().profile.events.length,1);assert.equal(store.read().garden.attempts.length,1);
  assert(!storage.getItem(DATA_KEY).includes('1234'));assert.equal(eventsOf(store.read()).length,2);
});
test('same attempt downloaded repeatedly cannot inflate mastery',()=>{
  const a=sample('a');const merged=mergeData(mergeData(a,a),a);
  assert.equal(merged.profile.events.length,1);assert.equal(merged.profile.mastery['M-NPV'].seen,1);
});
test('Firestore object key ordering does not produce false ID conflicts',()=>{
  const [a]=eventsOf(sample('a'));const b={event:{data:a.event.data,type:a.event.type,ts:a.event.ts,id:a.event.id},kind:a.kind,id:a.id};
  assert.equal(uniqueEvents([a,b]).length,1);
  assert.throws(()=>uniqueEvents([a,{...b,event:{...b.event,data:{...b.event.data,correct:false}}}]));
});
test('two devices converge without losing either answer',async()=>{
  const a=createLocalStore(memory()),b=createLocalStore(memory()),cloud=server();a.write(sample('a'));b.write(sample('b',false));
  await syncLearning(a,cloud);await syncLearning(b,cloud);await syncLearning(a,cloud);
  assert.equal(cloud.rows.size,2);assert.equal(a.read().profile.events.length,2);assert.equal(b.read().profile.events.length,2);
  assert.deepEqual(a.read().profile.mastery,b.read().profile.mastery);
});
test('lost response after server write is retry-safe',async()=>{
  const store=createLocalStore(memory()),cloud=server();store.write(sample('a'));const original=cloud.writeEvents;
  cloud.writeEvents=async es=>{await original(es);throw new Error('response lost');};
  await assert.rejects(syncLearning(store,cloud));assert.equal(store.read().profile.events.length,1);
  cloud.writeEvents=original;await syncLearning(store,cloud);
  assert.equal(cloud.rows.size,1);assert.equal(store.read().profile.mastery['M-NPV'].seen,1);
});
test('a denied initial read cannot trigger uploads or clear local data',async()=>{
  const store=createLocalStore(memory()),cloud=server();store.write(sample('a'));cloud.readEvents=async()=>{throw new Error('permission-denied');};
  await assert.rejects(syncLearning(store,cloud));assert.equal(cloud.rows.size,0);assert.equal(store.read().profile.events.length,1);
});
test('new answer during a sync survives and uploads on the next run',async()=>{
  const store=createLocalStore(memory()),cloud=server();store.write(sample('a'));const update=cloud.updateMetadata;
  cloud.updateMetadata=async fn=>{store.saveProfile(sample('b').profile);return update(fn);};
  await syncLearning(store,cloud);assert.equal(store.read().profile.events.length,2);
  cloud.updateMetadata=update;await syncLearning(store,cloud);assert.equal(cloud.rows.size,2);
});
test('garden hint use and revised attempts survive merging',()=>{
  const a=sample('a'),b=sample('b');a.garden.stage=3;a.garden.hints.apply=2;
  a.garden.attempts=[{id:'g1',stage:'apply',correct:false,supported:true,ts:'2026-09-09T08:00:00Z'}];
  b.garden.stage=4;b.garden.attempts=[{id:'g2',stage:'apply',correct:true,supported:false,ts:'2026-09-09T09:00:00Z'}];
  const g=mergeData(a,b).garden;assert.equal(g.stage,4);assert.equal(g.hints.apply,2);assert.equal(g.attempts.length,2);
  assert.equal(evidence(g).applied,'practised with support or revision');
});
test('disconnect during network request prevents applying cloud results',async()=>{
  const store=createLocalStore(memory()),cloud=server();store.write(sample('a'));let active=true;const read=cloud.readEvents;
  cloud.readEvents=async()=>{active=false;return read();};
  assert.equal(await syncLearning(store,cloud,()=>active),false);assert.equal(cloud.rows.size,0);
});
test('quota failure throws instead of reporting a successful local save',()=>{
  const storage=memory();storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>createLocalStore(storage).saveProfile(sample('a').profile));
});
