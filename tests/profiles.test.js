import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfiles,profileKey,mergeDescriptor} from '../src/profiles.js';
import {blankProfile,record} from '../src/engine.js';
import {objectives} from '../src/content.js';
import {initialGarden} from '../src/garden-model.js';
import {mergeData} from '../src/sync-model.js';
import {syncLearning} from '../src/sync-transport.js';
function memory(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size;}};}
function attempted(){const p=blankProfile();record(p,objectives[0].items[0],objectives[0],true);return{version:1,profile:p,garden:initialGarden()};}
test('legacy local testing is preserved and new learner is empty',()=>{
 const old=attempted(),storage=memory({'curious-data-v2':JSON.stringify(old),'curious-pin':'9876'}),profiles=createProfiles(storage);
 assert.equal(profiles.info().kind,'test');assert.equal(profiles.store().read().profile.events.length,1);
 profiles.select('learner-clean-v1');assert.equal(profiles.store().read().profile.events.length,0);
 assert.equal(storage.getItem('curious-pin'),'9876');assert.equal(storage.getItem('curious-data-v2'),JSON.stringify(old));
});
test('migration runs once and does not overwrite later learner progress',()=>{
 const storage=memory(),a=createProfiles(storage);a.select('learner-clean-v1');a.store().write(attempted());
 const b=createProfiles(storage);assert.equal(b.activeId,'learner-clean-v1');assert.equal(b.store().read().profile.events.length,1);
});
test('profile creation and reset cannot mutate learner or archived histories',()=>{
 const p=createProfiles(memory());p.select('learner-clean-v1');p.store().write(attempted());assert.throws(()=>p.resetTest());
 p.select('primary');p.store().write(attempted());const old=p.store().read();const fresh=p.resetTest();
 assert.notEqual(fresh.id,'primary');assert.equal(p.store().read().profile.events.length,0);
 assert.deepEqual(p.store('primary').read(),old);assert(p.info('primary').archived);
 assert.equal(p.store('learner-clean-v1').read().profile.events.length,1);
});
test('bound store never follows active profile changes during sync',async()=>{
 const p=createProfiles(memory());p.store().write(attempted());const bound=p.store(),rows=[];let meta;
 const cloud={async readEvents(){p.select('learner-clean-v1');return rows;},async writeEvents(es){rows.push(...es);},async updateMetadata(fn){meta=fn(meta);return meta;}};
 await syncLearning(bound,cloud);
 assert.equal(rows.length,1);assert.equal(p.store('primary').read().profile.events.length,1);assert.equal(p.store().read().profile.events.length,0);
});
test('remote catalogue discovers additional profiles without importing their history',()=>{
 const a=createProfiles(memory()),b=createProfiles(memory());const added=a.create('Another explorer','learner');a.store().write(attempted());
 b.mergeCatalog(a.list());assert(b.list().some(p=>p.id===added.id));assert.equal(b.activeId,'primary');
 b.select(added.id);assert.equal(b.store().read().profile.events.length,0);
});
test('stale catalogue cannot unarchive a test or change profile type',()=>{
 const p={id:'primary',label:'Test',kind:'test',archived:true};assert(mergeDescriptor(p,{...p,archived:false}).archived);
 assert.throws(()=>mergeDescriptor(p,{...p,kind:'learner'}));
});
test('restarting lesson changes its position while retaining all evidence after merge',()=>{
 const old=attempted();old.garden={...old.garden,stage:5,completed:true,updatedAt:'2026-09-09T10:00:00Z',hints:{apply:2},attempts:[{id:'a',stage:'apply',correct:true,supported:true,ts:'2026-09-09T09:00:00Z'}]};
 const restarted={...old,garden:{...old.garden,stage:0,updatedAt:'2026-09-09T11:00:00Z'}};
 const merged=mergeData(old,restarted);assert.equal(merged.garden.stage,0);assert.equal(merged.garden.attempts.length,1);assert.equal(merged.garden.hints.apply,2);
});
test('different tabs retain their selected profile when another tab switches',()=>{
 const storage=memory(),a=createProfiles(storage),b=createProfiles(storage);a.select('learner-clean-v1');
 assert.equal(b.activeId,'primary');b.store().write(attempted());assert.equal(a.store().read().profile.events.length,0);
});
test('clear device removes owned profiles and migration backups but preserves unrelated storage',()=>{
 const storage=memory({'other-app':'keep','curious-pin':'1234'}),p=createProfiles(storage);p.create('Test','test');p.clearDevice();
 assert.equal(storage.getItem('other-app'),'keep');assert.equal(storage.getItem('curious-pin'),null);assert.equal(storage.getItem(profileKey('primary')),null);
 const fresh=createProfiles(storage);assert.equal(fresh.list().length,2);assert.equal(fresh.store().read().profile.events.length,0);
});
