import { OWNER_UID, firebaseConfig } from './firebase-config.js';
import { profiles, mergeDescriptor, descriptorValid } from './profiles.js';
import { syncLearning } from './sync-transport.js';

const ENABLED = 'curious-cloud-enabled';
let sdkPromise, auth, db, api, generation=0, running=false, again=false, timer;
let state={signedIn:false,busy:false,message:'Saved on this device. Cloud sync is not connected.'};
const listeners=new Set();
const publish=patch=>{state={...state,...patch};for(const fn of listeners)fn(state);};
async function sdk() {
  if(!sdkPromise) sdkPromise=(async()=>{
    const [app,A,F]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
    ]);
    const instance=app.initializeApp(firebaseConfig);
    auth=A.getAuth(instance);db=F.getFirestore(instance);api={...A,...F};
    await auth.authStateReady();
    A.onAuthStateChanged(auth,user=>window.AppsAuth?.setAppIdentity(user,{app:'Kk-syllabus'}));
  })().catch(error=>{sdkPromise=null;throw error;});
  await sdkPromise;
}
function errorMessage(e) {
  const code=e?.code||'';
  if(code.includes('permission-denied'))return 'Cloud access was denied. Check that the Firestore rules are published with your parent UID. Your local work is retained.';
  if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return 'Sign-in details did not match. Check your email and password.';
  if(code.includes('operation-not-allowed'))return 'Enable Email/Password sign-in in Firebase Authentication.';
  if(code.includes('too-many-requests'))return 'Too many sign-in attempts. Please try again later.';
  return 'Cloud sync could not finish. Your local work is retained. Check your connection and try Sync now.';
}
export async function connect(email,password) {
  publish({busy:true,message:'Connecting…'});
  try {
    await sdk();
    await api.setPersistence(auth,api.browserLocalPersistence);
    const result=await api.signInWithEmailAndPassword(auth,email,password);
    if(result.user.uid!==OWNER_UID){await api.signOut(auth);throw new Error('owner-mismatch');}
    localStorage.setItem(ENABLED,'yes');generation++;
    publish({signedIn:true,busy:false,message:'Connected. Synchronising learning…'});
    await syncNow();
  }catch(e){publish({busy:false,message:e.message==='owner-mismatch'?'This account is not the configured parent account. No learning data was uploaded.':errorMessage(e)});}
}
export async function disconnect() {
  generation++;clearTimeout(timer);again=false;
  localStorage.removeItem(ENABLED);
  if(auth)await api.signOut(auth);
  publish({signedIn:false,busy:false,message:'Cloud disconnected. Progress remains on this device and in Firestore.'});
}
export async function syncNow() {
  if(!state.signedIn||auth?.currentUser?.uid!==OWNER_UID)return;
  if(running){again=true;return;}
  const token=generation, profileId=profiles.activeId;
  running=true;publish({busy:true,message:'Saving to Firestore…'});
  try {
    const catalogRef=api.collection(db,'families',OWNER_UID,'learners');
    const catalog=await api.getDocsFromServer(catalogRef);window.FirebaseUsageMonitor?.read(Math.max(1,catalog.size||0),'profile-catalog-query','kk-syllabus','kk-syllabus','(default)');
    if(token!==generation)return;
    profiles.mergeCatalog(catalog.docs.map(d=>({...d.data(),id:d.id})).filter(descriptorValid));
    const catalogById=new Map(catalog.docs.map(d=>[d.id,d.data()]));
    for(const descriptor of profiles.list()) {
      if(token!==generation)return;
      const ref=api.doc(catalogRef,descriptor.id),old=catalogById.get(descriptor.id),next=mergeDescriptor(old&&descriptorValid(old)?old:null,descriptor);
      if(JSON.stringify(old||null)!==JSON.stringify(next))window.FirebaseUsageMonitor?.write(1,'profile-descriptor','kk-syllabus');await api.setDoc(ref,next,{merge:true});
    }
    if(token!==generation)return;
    const ids=[profileId,...profiles.list().filter(p=>p.id!==profileId&&profiles.hasLocal(p.id)).map(p=>p.id)];
    for(const id of ids) {
    if(token!==generation)return;
    const profileStore=profiles.store(id);
    const base=['families',OWNER_UID,'learners',id];
    const eventsRef=api.collection(db,...base,'events'), progressRef=api.doc(db,...base,'progress','state');
    const ok = await syncLearning(profileStore, {
      async readEvents(){ const rows=await api.getDocsFromServer(eventsRef);window.FirebaseUsageMonitor?.read(Math.max(1,rows.size||0),'events-query','kk-syllabus','kk-syllabus','(default)');return rows.docs.map(d=>d.data()); },
      async writeEvents(events){if(events?.length)window.FirebaseUsageMonitor?.write(events.length,'events-batch','kk-syllabus');const batch=api.writeBatch(db);for(const event of events)batch.set(api.doc(eventsRef,event.id),event);await batch.commit();},
      async updateMetadata(merge){return api.runTransaction(db,async tx=>{const old=await tx.get(progressRef);window.FirebaseUsageMonitor?.read(1,'progress-metadata-read','kk-syllabus','kk-syllabus','(default)');const prior=old.exists()?old.data():null,next=merge(prior);if(JSON.stringify(prior||null)!==JSON.stringify(next)){window.FirebaseUsageMonitor?.write(1,'progress-metadata','kk-syllabus');tx.set(progressRef,next);}return next;});}
    },()=>token===generation);
    if(!ok)return;
    }
    publish({busy:false,message:'Synced with Firestore at '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'.'});
  }catch(e){if(token===generation)publish({busy:false,message:errorMessage(e)});}
  finally{running=false;if(again&&state.signedIn){again=false;schedule();}}
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>void syncNow(),1200);}
export async function startCloud() {
  if(localStorage.getItem(ENABLED)!=='yes')return;
  try{await sdk();if(auth.currentUser?.uid!==OWNER_UID){publish({message:'Sign in again to resume cloud sync.'});return;}publish({signedIn:true});await syncNow();}
  catch(e){publish({message:errorMessage(e)});}
}
export async function requestExplanation(itemId,strategy) {
  await sdk();
  if(auth.currentUser?.uid!==OWNER_UID)throw new Error('Parent sign-in required');
  const F=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js');
  const callable=F.httpsCallable(F.getFunctions(auth.app,'europe-west2'),'explain',{timeout:30000});
  return (await callable({itemId,strategy})).data;
}
export function mountCloudPanel(element) {
  element.innerHTML='<h3>Save across devices</h3><p class="small">Each profile has separate cloud history. Sign in with the same parent account on each device, sync, then reopen the grown-up view to find its profiles.</p><p class="small" data-status role="status"></p><form class="cloud-form"><label>Parent email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Sign in & sync</button></form><div data-connected><button data-sync>Sync now</button> <button data-disconnect>Disconnect cloud</button><p class="small">Disconnecting keeps local progress. The parent PIN protects profile switching.</p></div>';
  const form=element.querySelector('form');
  const render=s=>{if(!element.isConnected){listeners.delete(render);return;}element.querySelector('[data-status]').textContent=s.message;form.hidden=s.signedIn;element.querySelector('[data-connected]').hidden=!s.signedIn;form.querySelector('button').disabled=s.busy;element.querySelector('[data-sync]').disabled=s.busy;};
  listeners.add(render);render(state);
  form.onsubmit=async e=>{e.preventDefault();const email=form.elements.email.value,password=form.elements.password.value;form.elements.password.value='';await connect(email,password);};
  element.querySelector('[data-sync]').onclick=()=>void syncNow();
  element.querySelector('[data-disconnect]').onclick=()=>void disconnect();
}
if(typeof window!=='undefined'){
  window.addEventListener('curious-data',e=>{
    if(e.detail.source==='profile'){generation++;publish({busy:false,message:state.signedIn?'Profile changed. Waiting to sync this profile.':'Saved on this device. Cloud sync is not connected.'});if(state.signedIn)schedule();}
    if(e.detail.source==='local'&&state.signedIn)schedule();
  });
  window.addEventListener('online',()=>{if(state.signedIn)schedule();else void startCloud();});
  // Focus/reload alone must not cause a cloud write. Local changes and reconnects schedule sync.
}
