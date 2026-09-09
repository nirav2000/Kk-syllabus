import { createLocalStore } from './data-store.js';
import { blankProfile } from './engine.js';
import { initialGarden } from './garden-model.js';
export const REGISTRY_KEY = 'curious-profiles-v1';
export const profileKey = id => 'curious-profile-data:' + id;
export function descriptorValid(p) {
  return p && typeof p.id==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(p.id) && ['test','learner'].includes(p.kind) && typeof p.label==='string' && p.label.length>0 && p.label.length<=50;
}
export function mergeDescriptor(a,b) {
  if(!descriptorValid(b)) throw new Error('Invalid profile');
  if(!a) return {...b,archived:!!b.archived};
  if(a.id!==b.id || a.kind!==b.kind) throw new Error('Profile identity conflict');
  return {...a,archived:!!(a.archived||b.archived)};
}
const empty = p => ({version:1,profile:{...blankProfile(p.label),id:p.id},garden:initialGarden()});
export function createProfiles(storage, notify=()=>{}) {
  if(!storage.getItem(REGISTRY_KEY)) {
    const legacy=createLocalStore(storage).read();
    const test={id:'primary',kind:'test',label:'Testing (existing history)',archived:false};
    const learner={id:'learner-clean-v1',kind:'learner',label:'Explorer',archived:false};
    // Keep original keys intact. Publish the registry only after both copies save.
    storage.setItem(profileKey(test.id),JSON.stringify(legacy.profile?legacy:{...legacy,profile:empty(test).profile}));
    storage.setItem(profileKey(learner.id),JSON.stringify(empty(learner)));
    storage.setItem(REGISTRY_KEY,JSON.stringify({version:1,activeId:test.id,profiles:[test,learner]}));
  }
  const registry=()=>JSON.parse(storage.getItem(REGISTRY_KEY));
  let activeId=registry().activeId;
  function list(){return registry().profiles;}
  function info(id=activeId){const p=list().find(p=>p.id===id);if(!p)throw new Error('Unknown profile');return p;}
  function store(id=activeId) {
    info(id);
    // Capture identity in this store. In-flight requests cannot follow a switch.
    return createLocalStore(storage,source=>notify(source,id),profileKey(id),()=>empty(info(id)));
  }
  function select(id) {
    const p=info(id);if(p.archived)throw new Error('This profile is archived');
    const r=registry();r.activeId=id;storage.setItem(REGISTRY_KEY,JSON.stringify(r));activeId=id;notify('profile',id);
  }
  function create(label,kind='test') {
    label=label.trim();if(!label||label.length>50||!['test','learner'].includes(kind))throw new Error('Choose a nickname and profile type.');
    const p={id:kind+'-'+crypto.randomUUID(),kind,label,archived:false};
    storage.setItem(profileKey(p.id),JSON.stringify(empty(p)));
    const r=registry();r.profiles.push(p);storage.setItem(REGISTRY_KEY,JSON.stringify(r));select(p.id);return p;
  }
  function resetTest() {
    const p=info();if(p.kind!=='test')throw new Error('Only test profiles can be reset.');
    const fresh=create(p.label==='Testing (existing history)'?'Test sandbox':p.label,'test');
    const r=registry();r.profiles.find(x=>x.id===p.id).archived=true;storage.setItem(REGISTRY_KEY,JSON.stringify(r));notify('profile',fresh.id);return fresh;
  }
  function mergeCatalog(incoming) {
    const r=registry();
    for(const p of incoming){if(!descriptorValid(p))continue;const index=r.profiles.findIndex(x=>x.id===p.id);const merged=mergeDescriptor(index<0?null:r.profiles[index],p);if(index<0)r.profiles.push(merged);else r.profiles[index]=merged;}
    storage.setItem(REGISTRY_KEY,JSON.stringify(r));
  }
  function clearDevice() {
    const keys=[];
    for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('curious-profile-data:'))keys.push(key);}
    for(const key of [...keys,REGISTRY_KEY,'curious-data-v2','curious-profile','curious-garden-v1','curious-pin'])storage.removeItem(key);
  }
  return {list,info,store,select,create,resetTest,mergeCatalog,clearDevice,hasLocal:id=>!!storage.getItem(profileKey(id)),get activeId(){return activeId;}};
}
export const profiles = typeof localStorage==='undefined'?null:createProfiles(localStorage,(source,profileId)=>window.dispatchEvent(new CustomEvent('curious-data',{detail:{source,profileId}})));
