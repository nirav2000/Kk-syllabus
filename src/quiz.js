import { byItem } from './content.js';
import { buildSession,record } from './engine.js';
import { shuffle,createClock,escapeHTML as h } from './attempts.js';
import { profiles } from './profiles.js';

export function openQuiz(root,onExit) {
  const store=profiles.store();let p=store.read().profile;
  p.sessionsStarted++;let session=buildSession(p,!p.placed),index=0,clock,answered=0,help=false;
  const retries=new Set();let disposed=false,parentPaused=false;
  const pause=()=>{parentPaused=true;clock?.pause();},resume=()=>{parentPaused=false;if(!document.hidden)clock?.resume();};
  const visibility=()=>{if(document.hidden)clock?.pause();else if(!parentPaused)clock?.resume();};document.addEventListener('visibilitychange',visibility);
  function dispose(){disposed=true;document.removeEventListener('visibilitychange',visibility);pause();}
  function save(){try{p=store.saveProfile(p);}catch{root.querySelector('[data-save]').textContent='Your browser could not save. Keep this page open and check device storage.';}}
  function draw(){
    const item=session.items[index],o=byItem(item.id),choices=shuffle(item.choices);help=retries.has(item.id);clock=createClock();if(document.hidden)pause();
    root.innerHTML=`<section class="card"><div class="session-head"><span class="eyebrow">A small exploration</span><button data-finish>Finish</button></div><h2>${h(o.title)}</h2><p class="prompt">${h(item.stem)}</p><div class="choices">${choices.map((c,i)=>`<button class="choice" data-choice="${i}">${h(c)}</button>`).join('')}</div><button data-help>Show me how to think about it</button><div data-explanation></div><div data-feedback aria-live="polite"></div><p data-save role="status"></p></section>`;
    root.querySelector('[data-finish]').onclick=close;
    root.querySelector('[data-help]').onclick=()=>{help=true;root.querySelector('[data-explanation]').innerHTML=`<p>${h(o.lesson?.body||item.hint)}</p>${o.lesson?`<p>${h(o.lesson.example)}</p><ol>${o.lesson.steps.map(s=>`<li>${h(s)}</li>`).join('')}</ol>`:''}<p>${h(item.hint)}</p><p class="small">Still puzzling? A grown-up can open the explanation helper in the parent view.</p>`;};
    root.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{
      if(disposed||b.disabled)return;const timing=clock.read();clock.pause();const response=choices[+b.dataset.choice],correct=response===item.answer;
      const feedback=correct?'That fits. Think about why the other choices do not.':`${item.hint} The answer is ${item.answer}. We can return to this idea later.`;
      root.querySelectorAll('[data-choice]').forEach(x=>x.disabled=true);root.querySelector('[data-help]').disabled=true;
      record(p,item,o,correct,{...timing,response,expected:item.answer,stem:item.stem,choices,sessionId:session.id,position:index,supported:help,feedback});answered++;save();
      if(!correct&&!retries.has(item.id)){retries.add(item.id);session.items.push(item);}
      root.querySelector('[data-feedback]').innerHTML=`<p class="feedback">${h(feedback)}</p><button data-next class="primary">${index+1<session.items.length?'Continue exploring':'Finish this path'}</button>`;
      root.querySelector('[data-next]').onclick=()=>{if(++index<session.items.length)draw();else close();};
    });
  }
  function close(){dispose();if(answered)p.placed=true;save();root.innerHTML='<section class="card"><h2>A good place to pause</h2><p>A good moment to let those ideas settle.</p><button data-home>All done</button></section>';root.querySelector('[data-home]').onclick=onExit;}
  draw();save();return {pause,resume,dispose,markSupported:()=>{help=true;}};
}
