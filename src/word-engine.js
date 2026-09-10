import { words } from './words-data.js';
const DAY=86400000, intervals=[1,3,7,14,30];
export const normalizeSpelling=value=>value.trim().normalize('NFC').toLocaleLowerCase('en-GB');
export function wordState(events,wordId,mode,now=Date.now()) {
  const rows=events.filter(e=>e.type==='word-answer'&&e.data.wordId===wordId&&e.data.mode===mode).sort((a,b)=>a.ts.localeCompare(b.ts)||a.id.localeCompare(b.id));
  let due=0,streak=0,first=0,lastDay='',seen=0,slow=false;
  for(const e of rows){const t=Date.parse(e.ts),d=e.data;if(!Number.isFinite(t))continue;seen++;
    if(!d.correct||d.supported){streak=0;first=0;due=t+DAY;lastDay='';continue;}
    // Only unassisted, due retrievals on separate UTC dates extend spacing.
    // Timing is evidence for the parent, never a speed requirement for mastery.
    if(t<due||e.ts.slice(0,10)===lastDay)continue;
    if(!first)first=t;lastDay=e.ts.slice(0,10);streak++;due=t+intervals[Math.min(streak-1,4)]*DAY;
    slow=Number.isFinite(d.responseMs)&&d.responseMs>45000;
  }
  const span=rows.length?Date.parse(rows.at(-1).ts)-first:0;
  return {state:!seen?'to learn':streak>=5&&span>=14*DAY?'learnt':'learning',due,streak,seen,slow,dueNow:due<=now};
}
export function chooseWords(events,mode,now=Date.now(),cursor=0,count=5) {
  const settings=events.filter(e=>e.type==='word-settings').sort((a,b)=>a.ts.localeCompare(b.ts)||a.id.localeCompare(b.id)).at(-1)?.data||{};
  const scored=words.filter(w=>w.year>=(settings.minYear||1)&&w.year<=(settings.maxYear||7)).map(w=>({w,s:wordState(events,w.id,mode,now)}));
  const due=scored.filter(x=>x.s.seen&&x.s.dueNow).sort((a,b)=>a.s.due-b.s.due);
  // Rotate genuinely tied due dates; a finished band never hides harder words.
  const rotated=[];for(let i=0;i<due.length;){let j=i+1;while(j<due.length&&due[j].s.due===due[i].s.due)j++;const g=due.slice(i,j),n=cursor%g.length;rotated.push(...g.slice(n),...g.slice(0,n));i=j;}
  const fresh=scored.filter(x=>!x.s.seen).sort((a,b)=>a.w.year-b.w.year);
  // Reserve one place for new learning when reviews are numerous.
  return [...rotated.slice(0,fresh.length?count-1:count),...fresh].slice(0,count).map(x=>x.w);
}
export function meaningChoices(word,random=Math.random) {
  // Every distractor is another word's distinct meaning, never a synonym of this word.
  const overlapping=[['ephemeral','transient'],['diligent','meticulous'],['cautious','vigilant'],['generous','benevolent'],['certain','definite'],['coherent','concise','eloquent']];
  const exclude=new Set(overlapping.find(group=>group.includes(word.word))||[word.word]);
  const candidates=words.filter(w=>w.id!==word.id&&w.meaning!==word.meaning&&!exclude.has(w.word));
  candidates.sort((a,b)=>Math.abs(a.year-word.year)-Math.abs(b.year-word.year));
  const pool=candidates.slice(0,12),picked=[];
  while(picked.length<3){picked.push(pool.splice(Math.floor(random()*pool.length),1)[0].meaning);}
  return [word.meaning,...picked];
}
