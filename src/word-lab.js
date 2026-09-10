import { words } from './words-data.js';
import { chooseWords,wordState,meaningChoices,normalizeSpelling } from './word-engine.js';
import { answerEvent,createClock,shuffle,escapeHTML as h } from './attempts.js';
import { profiles } from './profiles.js';

export function openWords(root,onExit,mode='spelling') {
  const store=profiles.store();let p=store.read().profile;
  const items=chooseWords(p.events,mode,Date.now(),p.events.length),sessionId=crypto.randomUUID();
  let index=0,clock,help=false,disposed=false,utterance,canAnswer=mode!=='spelling',parentPaused=false;
  const pause=()=>{parentPaused=true;clock?.pause();speechStop();},resume=()=>{parentPaused=false;if(!document.hidden)clock?.resume();};
  function speechStop(){if('speechSynthesis' in window)window.speechSynthesis.cancel();}
  const visibility=()=>{if(document.hidden){clock?.pause();speechStop();}else if(!parentPaused)clock?.resume();};document.addEventListener('visibilitychange',visibility);
  function dispose(){disposed=true;document.removeEventListener('visibilitychange',visibility);clock?.pause();speechStop();}
  function save(){try{p=store.saveProfile(p);return true;}catch{root.querySelector('[data-save]').textContent='Your browser could not save. Keep this page open and check device storage.';return false;}}
  function draw(){if(!items[index])return close();const word=items[index];help=false;canAnswer=mode!=='spelling';clock=createClock();if(document.hidden)clock.pause();
    const choices=mode==='meaning'?shuffle(meaningChoices(word)):[];
    root.innerHTML=`<section class="card"><div class="session-head"><span class="eyebrow">Word workshop · ${mode==='spelling'?'listen and spell':'meaning in context'}</span><button data-finish>Finish for now</button></div><h2>${mode==='spelling'?'Listen. Picture it. Spell it.':h(word.word)}</h2><p>${mode==='spelling'?'Hear the word and its sentence, then type the word. Take the time you need.':h(word.sentence)}</p>${mode==='spelling'?'<button data-hear class="primary">Hear the word</button> <button data-stop>Stop audio</button><form><label>Your spelling<input name="spelling" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="80" required></label><button data-check disabled>Check my spelling</button></form>':`<p>What does <b>${h(word.word)}</b> mean here?</p><div class="choices">${choices.map((c,i)=>`<button class="choice" data-choice="${i}">${h(c)}</button>`).join('')}</div>`}<button data-help>${mode==='spelling'?'Show the spelling and practise':'Explore the meaning first'}</button><p data-help-text></p><div data-feedback aria-live="polite"></div><p data-save role="status"></p></section>`;
    root.querySelector('[data-finish]').onclick=close;
    root.querySelector('[data-help]').onclick=()=>{help=true;canAnswer=true;root.querySelector('[data-help-text]').textContent=`${word.word} — ${word.meaning}. ${word.sentence} Look for familiar letter groups, then try saying the letters.`;if(mode==='spelling')root.querySelector('[data-check]').disabled=false;};
    if(mode==='spelling'){
      root.querySelector('[data-hear]').onclick=()=>{
        if(!('speechSynthesis' in window)){root.querySelector('[data-help-text]').textContent='Audio is unavailable here. Use Show the spelling to practise with a grown-up.';return;}
        speechStop();utterance=new SpeechSynthesisUtterance(`${word.word}. ${word.sentence} The word is ${word.word}.`);utterance.lang='en-GB';utterance.rate=.85;
        utterance.onstart=()=>{if(disposed||items[index]!==word)return;canAnswer=true;root.querySelector('[data-check]').disabled=false;};
        utterance.onerror=e=>{if(!disposed&&items[index]===word&&!['interrupted','canceled'].includes(e.error))root.querySelector('[data-help-text]').textContent='Audio did not play. Try Hear the word again, or reveal the spelling to practise.';};
        window.speechSynthesis.speak(utterance);
      };
      root.querySelector('[data-stop]').onclick=speechStop;
      root.querySelector('input').onpaste=()=>{help=true;};
      root.querySelector('form').onsubmit=e=>{e.preventDefault();if(canAnswer)submit(root.querySelector('input').value);};
    }else root.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>submit(choices[+b.dataset.choice]));
    let submitted=false;
    function submit(response){if(disposed||submitted)return;submitted=true;speechStop();const timing=clock.read();clock.pause();const expected=mode==='spelling'?word.word:word.meaning,correct=mode==='spelling'?normalizeSpelling(response)===word.word:response===expected;
      const feedback=correct?`${word.word} — ${word.meaning}. You can meet this word again another day.`:`Let’s look closely: ${word.word}. ${word.meaning}. ${word.sentence}`;
      const event=answerEvent({...timing,wordId:word.id,itemId:`${word.id}-${mode}`,topic:mode==='spelling'?'Spelling':'Vocabulary',mode,stem:mode==='spelling'?`Spell ${word.word}`:`What does ${word.word} mean? ${word.sentence}`,response:response.slice(0,200),expected,correct,supported:help,choices,sessionId,position:index,feedback},'word-answer');
      p.events.push(event);save();root.querySelectorAll('form button,[data-choice],[data-help],[data-hear]').forEach(b=>b.disabled=true);
      root.querySelector('[data-feedback]').innerHTML=`<p class="feedback">${h(feedback)}</p><button data-next class="primary">${index+1<items.length?'Meet another word':'Finish for now'}</button>`;
      root.querySelector('[data-next]').onclick=()=>{index++;draw();};
    }
  }
  function close(){dispose();root.innerHTML=`<section class="card"><h2>A good place to pause</h2><p>${items.length?'Words grow familiar through meetings on different days.':'No words need a review in this range right now. Come back another day, or ask a grown-up to widen your word range.'}</p><button data-home>All done</button></section>`;root.querySelector('[data-home]').onclick=onExit;}
  draw();return {pause,resume,dispose,markSupported:()=>{help=true;}};
}

export function mountWordReport(root,profile,onSave) {
  const settings=profile.events.filter(e=>e.type==='word-settings').at(-1)?.data||{minYear:1,maxYear:7};
  root.innerHTML=`<h3>Spelling & vocabulary word bank</h3><p>${words.length} words across Years 1–7 difficulty bands, including an introductory advanced 11+ range. These are practice bands, not a judgement about the learner’s school year. This is a starter bank, not complete 11+ coverage.</p><p class="small">Learnt requires five unassisted, due recalls on separate days over at least two weeks. Errors or revealed answers return a word to learning. Learnt words return for maintenance; they are never deleted. Timing is reported but slow typing does not prevent mastery.</p><form><label>Lowest practice band<select name="min">${[1,2,3,4,5,6,7].map(n=>`<option ${settings.minYear===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Highest practice band<select name="max">${[1,2,3,4,5,6,7].map(n=>`<option ${settings.maxYear===n?'selected':''}>${n}</option>`).join('')}</select></label><button>Save practice range</button><p data-range-status role="status"></p></form><label>Skill<select data-mode><option value="spelling">Spelling</option><option value="meaning">Vocabulary</option></select></label><label>Show<select data-state><option value="">All words</option><option>to learn</option><option>learning</option><option>learnt</option></select></label><div data-counts></div><div data-list></div>`;
  function render(){const mode=root.querySelector('[data-mode]').value,state=root.querySelector('[data-state]').value;const rows=words.map(w=>({w,s:wordState(profile.events,w.id,mode)}));root.querySelector('[data-counts]').textContent=['to learn','learning','learnt'].map(s=>`${rows.filter(x=>x.s.state===s).length} ${s}`).join(' · ');root.querySelector('[data-list]').innerHTML=rows.filter(x=>!state||x.s.state===state).map(({w,s})=>`<details><summary>${h(w.word)} · ${s.state}</summary><p>Band ${w.year}. ${h(w.meaning)}<br>${h(w.sentence)}<br>${s.seen?`Next review: ${new Date(s.due).toLocaleDateString()}`:'Ready for introduction'}</p></details>`).join('');}
  root.querySelector('[data-mode]').onchange=render;root.querySelector('[data-state]').onchange=render;
  root.querySelector('form').onsubmit=e=>{e.preventDefault();const minYear=+e.target.elements.min.value,maxYear=+e.target.elements.max.value;if(minYear>maxYear){root.querySelector('[data-range-status]').textContent='The lowest band must not exceed the highest.';return;}onSave(answerEvent({minYear,maxYear},'word-settings'));};render();
}
