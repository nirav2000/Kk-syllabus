import { localData } from './local-data.js';
import { rectangle, validPair, initialGarden, stages, evidence } from './garden-model.js';

const KEY = 'curious-garden-v1';
export function loadGarden() {
  try { const s = localData.read().garden; return s?.version === 1 && Number.isInteger(s.stage) && s.stage >= 0 && s.stage < stages.length && Array.isArray(s.attempts) && Array.isArray(s.visited) && s.hints ? s : initialGarden(); }
  catch { return initialGarden(); }
}
export function gardenSummary() {
  const e = evidence(loadGarden());
  return `<h3>Area & perimeter investigation</h3><p class="small">Different shapes explored: ${e.explored ? 'yes' : 'not yet'}.<br>Applying the idea: ${e.applied}.<br>New-context question: ${e.transferred}.<br>Own counterexample built: ${e.created ? 'yes' : 'not yet'}.</p><p class="small">This is lesson evidence, not a mastery certificate. Spoken explanations are not recorded or automatically assessed.</p>`;
}
export function openGarden(root, onExit) {
  let s = loadGarden();
  let mode = 'area', edge = 0;
  const persist = () => {
    try { s = localData.saveGarden(s); }
    catch { root.querySelector('#save-note').textContent = 'Your browser could not save this step. You can keep exploring, but it may not survive a reload.'; }
  };
  const titles = ['Could the same garden need less fence?', 'Change the shape. What stays the same?', 'Inside space or outside edge?', 'Try it with a new rectangle', 'Take the idea into a room', 'Make your own counterexample'];
  function picture(w, h, reveal = true) {
    const r = rectangle(w, h);
    const cells = Array.from({ length: r.area }, () => '<i></i>').join('');
    return `<figure class="garden-figure"><div class="garden-board ${mode === 'edge' ? 'edge-mode' : ''}" style="--cols:${w};width:${w / 12 * 100}%" role="img" aria-label="${w} by ${h} rectangle. Each tile is one square metre.">${cells}${mode === 'edge' ? `<span class="edge-mark edge-${edge}" aria-hidden="true"></span>` : ''}</div><figcaption>${w} m × ${h} m · Each tile is 1 m²</figcaption></figure>${reveal ? `<div class="garden-measures"><span>Inside: <b>${r.area} m²</b></span><span>Around: <b>${r.perimeter} m</b></span></div>` : ''}`;
  }
  const button = (id, label) => `<button id="${id}" class="primary">${label}</button>`;
  function draw() {
    const stage = stages[s.stage];
    root.className = 'shell garden-shell';
    root.innerHTML = `<section class="card garden"><div class="session-head"><span class="eyebrow">The garden lab · ${stage}</span><button id="garden-finish">Finish for now</button></div><h2 tabindex="-1">${titles[s.stage]}</h2><div id="garden-body"></div><p id="save-note" class="small" role="status"></p></section>`;
    root.querySelector('#garden-finish').onclick = close;
    const body = root.querySelector('#garden-body');
    if (stage === 'predict') {
      body.innerHTML = `<p>You have 24 square tiles. Rearrange them without adding or removing any. Which rectangle do you think needs the least fence?</p>${picture(6,4,false)}<div class="garden-controls">${[12,8,6].map(w=>`<button data-predict="${w}">${w} × ${24/w}</button>`).join('')}<button data-predict="unsure">I’m not sure yet</button></div><p class="small">A prediction is an idea to investigate, not a test.</p>`;
      body.querySelectorAll('[data-predict]').forEach(b => b.onclick = () => { s.prediction=b.dataset.predict; next(); });
    }
    if (stage === 'explore') {
      body.innerHTML = `<p>Try different layouts. Count the tiles inside, then follow the outside edge. Do internal joins need a fence?</p><div class="garden-controls">${[12,8,6].map(w=>`<button data-shape="${w}" aria-pressed="${s.width===w}">${w} × ${24/w}</button>`).join('')}</div>${picture(s.width,24/s.width,s.revealed)}<div class="garden-controls"><button id="reveal">${s.revealed?'Hide':'Reveal'} measurements</button><button id="mode">${mode==='area'?'Follow the edge':'Show the tiles'}</button>${mode==='edge'?'<button id="edge">Next side</button>':''}</div><p id="edge-note" class="small">${mode==='edge'?['Top','Right','Bottom','Left'][edge]+' side: '+(edge%2?24/s.width:s.width)+' m. Only the outside boundary counts.':'The tiles show the space covered, not the distance around.'}</p><div class="actions">${button('continue','What did we notice?')}</div>`;
      body.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{s.width=+b.dataset.shape;if(!s.visited.includes(s.width))s.visited.push(s.width);persist();draw();});
      body.querySelector('#reveal').onclick=()=>{s.revealed=!s.revealed;if(!s.visited.includes(s.width))s.visited.push(s.width);persist();draw();};
      body.querySelector('#mode').onclick=()=>{mode=mode==='area'?'edge':'area';draw();};
      if(body.querySelector('#edge'))body.querySelector('#edge').onclick=()=>{edge=(edge+1)%4;draw();};
      body.querySelector('#continue').onclick=next;
    }
    if (stage === 'explain') {
      body.innerHTML=`<p><b>Area</b> measures the space inside. <b>Perimeter</b> measures the distance around the outside.</p>${picture(6,4)}<div class="garden-teach"><p>Four rows of six tiles cover <b>6 × 4 = 24 square metres</b>.</p><p>The four outside sides measure <b>6 + 4 + 6 + 4 = 20 metres</b>.</p><p>The 12 × 2 layout still covers 24 m², but needs 28 m of fence. Same area does not always mean the same perimeter.</p></div><p>Explain aloud or point: what stayed the same when you rearranged the tiles? What changed?</p><p class="small">No microphone or typing needed. You can also work it out with paper squares.</p><div class="actions">${button('continue','Try another shape')}</div>`;
      body.querySelector('#continue').onclick=next;
    }
    if(stage==='apply') {
      body.innerHTML=`<p>A rectangular play space is 5 m long and 3 m wide. How much space does it cover, and how much fence goes all the way around it, with no gap?</p>${picture(5,3,false)}<form id="apply-form" class="garden-inputs"><label>Area (m²)<input name="area" type="number" min="1" step="1" required inputmode="numeric"></label><label>Perimeter (m)<input name="perimeter" type="number" min="1" step="1" required inputmode="numeric"></label><button class="primary">Check my reasoning</button></form>${helpUI()}<div id="answer-feedback" aria-live="polite"></div><div class="actions"><button id="continue">Explore the next idea</button></div>`;
      wireHelp(['Count rows of tiles for the inside. For the fence, count all four sides.', 'Area: three rows of five. Perimeter: 5 + 3 + 5 + 3.', 'The area is 15 m². The perimeter is 16 m. Notice the different units.']);
      body.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),a=Number(f.get('area')),p=Number(f.get('perimeter')),ok=a===15&&p===16;attempt(ok,{area:a,perimeter:p});feedback(ok?'You counted the space inside and the whole outside boundary.':a===16&&p===15?'Those measurements look exchanged. Tiles cover the inside; fence follows the outside.':p===8?'Five plus three counts only two sides. What about the other two?':'Try counting the rows for area and all four sides for perimeter. You can ask for a clue.');};
      body.querySelector('#continue').onclick=next;
    }
    if(stage==='transfer') {
      body.innerHTML=`<p>Two rectangular rooms need the same amount of carpet. Must they need the same length of trim all the way around their walls? Ignore doors.</p><div class="choices"><button data-answer="yes" class="choice">Yes — same carpet means same trim.</button><button data-answer="no" class="choice">Not necessarily — the room shapes matter.</button></div>${helpUI()}<div id="answer-feedback" aria-live="polite"></div><p>Can you explain which part is like the tiles, and which part is like the fence?</p><div class="actions"><button id="continue">Build an example</button></div>`;
      wireHelp(['Carpet covers a surface. Trim follows a boundary. Think back to the garden.', 'A 10 × 2 room and a 5 × 4 room both cover 20 m². Compare their four outside sides.', 'They need 24 m and 18 m of trim. Equal areas can have different perimeters.']);
      body.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{const ok=b.dataset.answer==='no';attempt(ok,{answer:b.dataset.answer});feedback(ok?'Yes: carpet measures area, while trim measures perimeter. Different shapes can change the trim needed.':'Let’s test that idea. Both a 10 × 2 room and a 5 × 4 room cover 20 m². Add their four sides: do you get the same distance?');});
      body.querySelector('#continue').onclick=next;
    }
    if(stage==='create') {
      body.innerHTML=`<p>Now reverse the challenge: make two rectangles with the <b>same perimeter but different areas</b>. Use whole-number side lengths from 1 to 12 metres.</p><form id="create-form" class="garden-inputs">${['A','B'].map(n=>`<fieldset><legend>Rectangle ${n}</legend><label>Width (m)<input name="w${n}" type="number" min="1" max="12" step="1" value="4" required inputmode="numeric"></label><label>Height (m)<input name="h${n}" type="number" min="1" max="12" step="1" value="4" required inputmode="numeric"></label></fieldset>`).join('')}<button class="primary">Compare my rectangles</button></form>${helpUI()}<div id="answer-feedback" aria-live="polite"></div><div id="pair-pictures"></div><div class="actions">${button('complete','Finish my investigation')}</div>`;
      wireHelp(['Keep width + height equal for both rectangles. Does multiplying them give different results?', 'Try increasing the width by one and decreasing the height by one.', 'A 4 × 4 square and a 5 × 3 rectangle both have perimeter 16 m. Their areas are 16 m² and 15 m².']);
      body.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);try{const a=rectangle(+f.get('wA'),+f.get('hA')),b=rectangle(+f.get('wB'),+f.get('hB')),ok=validPair(a,b);attempt(ok,{a,b});mode='area';body.querySelector('#pair-pictures').innerHTML=`<h3>Rectangle A</h3>${picture(a.width,a.height)}<h3>Rectangle B</h3>${picture(b.width,b.height)}`;feedback(ok?'You built a counterexample: the same boundary length can enclose different amounts of space.':a.area===b.area?'These cover the same space. Try changing the side lengths while keeping their sum the same.':'The perimeters differ. Keep width + height the same for both rectangles, then compare their areas.');}catch{feedback('Use whole numbers from 1 to 12 for each side.');}};
      body.querySelector('#complete').onclick=()=>{s.completed=true;persist();close();};
    }
    root.querySelector('h2').focus();
  }
  function helpUI(){return '<div class="garden-help"><button id="hint">Give me a clue</button><p id="hint-text" aria-live="polite"></p></div>';}
  function wireHelp(hints){const stage=stages[s.stage];const count=s.hints[stage]||0;if(count)root.querySelector('#hint-text').textContent=hints[Math.min(count,3)-1];root.querySelector('#hint').onclick=()=>{s.hints[stage]=Math.min(3,(s.hints[stage]||0)+1);root.querySelector('#hint-text').textContent=hints[s.hints[stage]-1];persist();};}
  function attempt(correct,data){const stage=stages[s.stage];s.attempts.push({id:crypto.randomUUID(),stage,correct,supported:!!s.hints[stage]||s.attempts.some(a=>a.stage===stage),data,ts:new Date().toISOString()});persist();}
  function feedback(text){root.querySelector('#answer-feedback').textContent=text;root.querySelector('#answer-feedback').className='feedback';}
  function next(){s.stage=Math.min(stages.length-1,s.stage+1);persist();draw();}
  function close(){persist();root.innerHTML='<section class="card"><div class="eyebrow">A good place to pause</div><h2>Ideas grow when you explore them.</h2><p>You can come back to the investigation. Outside the app, try making two shapes with the same length of string.</p><button id="back-home" class="primary">All done</button></section>';root.querySelector('#back-home').onclick=onExit;}
  draw();
}
