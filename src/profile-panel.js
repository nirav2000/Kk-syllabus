import { profiles } from './profiles.js';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountProfilePanel(element, onChange, onClear) {
  const active=profiles.info();
  element.innerHTML=`<h3>Learning profiles</h3><p class="small">Existing testing is preserved separately. Explorer starts with clean progress. Choose a nickname when adding another learner.</p><label>Use profile<select id="profile-select">${profiles.list().filter(p=>!p.archived).map(p=>`<option value="${p.id}" ${p.id===active.id?'selected':''}>${escape(p.label)} — ${p.kind==='test'?'TEST':'learner'}</option>`).join('')}</select></label><form id="new-profile" class="cloud-form"><label>Nickname<input name="nickname" required maxlength="50" autocomplete="off"></label><label>Profile type<select name="kind"><option value="test">Test sandbox</option><option value="learner">Learner</option></select></label><button>Add profile</button></form><div class="garden-controls"><button id="restart-lesson">Restart garden lesson</button>${active.kind==='test'?'<button id="reset-test">Reset test profile</button>':''}</div><p class="small">Restarting the lesson keeps previous answers and hints. Resetting a test archives its history and opens a fresh sandbox. Learner histories cannot be reset here.</p><details><summary>Archived test profiles</summary>${profiles.list().filter(p=>p.archived).map(p=>`<p class="small">${escape(p.label)} — history preserved</p>`).join('')||'<p class="small">None yet.</p>'}</details><p id="profile-error" role="status"></p>`;
  const run=fn=>{try{fn();onChange();}catch(e){element.querySelector('#profile-error').textContent=e.message;}};
  element.querySelector('#profile-select').onchange=e=>run(()=>profiles.select(e.target.value));
  element.querySelector('#new-profile').onsubmit=e=>{e.preventDefault();run(()=>profiles.create(e.target.elements.nickname.value,e.target.elements.kind.value));};
  element.querySelector('#restart-lesson').onclick=()=>{if(confirm('Restart the garden lesson? Previous learning evidence will be kept.'))run(()=>{const store=profiles.store(),data=store.read();store.write({...data,garden:{...data.garden,stage:0,width:6,revealed:false,updatedAt:new Date().toISOString()}});});};
  const reset=element.querySelector('#reset-test');
  if(reset)reset.onclick=()=>{if(confirm('Archive this test history and open a fresh test profile? Learner progress will not change.'))run(()=>profiles.resetTest());};
  const clear=document.createElement('button');clear.textContent='Clear this device';element.append(clear);
  clear.onclick=()=>{if(confirm('Remove all local profiles and PIN from this device? Unsynced progress will be lost. Cloud histories are kept.'))onClear();};
}
export function renderProfileBadge(root) {
  let badge=document.querySelector('#profile-badge');
  if(!badge){badge=document.createElement('div');badge.id='profile-badge';root.before(badge);}
  const p=profiles.info();badge.className=p.kind==='test'?'profile-badge testing':'profile-badge';
  badge.textContent=p.kind==='test'?'TEST SANDBOX · '+p.label+' · excluded from learner reports':p.label;
}
