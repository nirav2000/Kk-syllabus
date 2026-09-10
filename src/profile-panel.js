import { profiles } from './profiles.js';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountProfilePanel(element, onChange, onClear) {
  const active=profiles.info();
  element.innerHTML=`<h3>Learning profiles</h3><div class="active-profile-card"><span class="eyebrow">Currently using</span><h4>${escape(active.label)}</h4><p>${active.kind==='test'?'Test sandbox — these answers are kept out of learner reports.':'Learner profile — these answers count towards this learner’s progress.'}</p></div><label>Switch to an existing profile<select id="profile-select">${profiles.list().filter(p=>!p.archived).map(p=>`<option value="${p.id}" ${p.id===active.id?'selected':''}>${escape(p.label)} — ${p.kind==='test'?'TEST SANDBOX':'LEARNER'}</option>`).join('')}</select></label><details><summary>Add a new profile</summary><p class="small">The fields below create a separate profile. They do not change the type of the profile currently selected above.</p><form id="new-profile" class="cloud-form"><label>New profile nickname<input name="nickname" required maxlength="50" autocomplete="off"></label><label>Type for the new profile<select name="kind"><option value="learner">Learner — save genuine learning progress</option><option value="test">Test sandbox — experiment without affecting learners</option></select></label><button>Create and switch to new profile</button></form></details><div class="garden-controls"><button id="restart-lesson">Restart garden lesson</button>${active.kind==='test'?'<button id="reset-test">Reset this test sandbox</button>':''}</div><p class="small">Restarting the lesson keeps previous answers and hints. Resetting a test archives its history and opens a fresh sandbox. Learner histories cannot be reset here.</p><details><summary>Archived test profiles</summary>${profiles.list().filter(p=>p.archived).map(p=>`<p class="small">${escape(p.label)} — history preserved</p>`).join('')||'<p class="small">None yet.</p>'}</details><p id="profile-error" role="status"></p>`;
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
  badge.innerHTML=`<span class="profile-avatar" aria-hidden="true">${escape(p.label.slice(0,1).toUpperCase())}</span><div><strong>${escape(p.label)}</strong><span>${p.kind==='test'?'TEST SANDBOX · practice data only':'LEARNER · progress is being saved'}</span></div><button type="button" aria-label="Change profile in grown-up view">Switch profile</button>`;
  badge.querySelector('button').onclick=()=>window.dispatchEvent(new CustomEvent('curious-open-profiles'));
}
