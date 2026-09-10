import { objectives } from './content.js';
import { shuffle } from './attempts.js';
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
export const blankProfile=(name='Explorer')=>({id:uid(),displayName:name,sessionsStarted:0,placed:false,ratings:{maths:800,english:800},mastery:{},events:[],outbox:[]});
export const subjectOf=o=>o.id[0]==='M'?'maths':'english';
export const eligible=(p,o)=>o.prerequisites.every(id=>['secure','settled'].includes(p.mastery[id]?.state));
export const score=m=>({unseen:0,introduced:1,practising:2,secure:3,settled:4}[m?.state||'unseen']*100)+(m?.seen||0);
export function chooseObjective(p,pool=objectives){const c=pool.filter(o=>eligible(p,o)&&p.mastery[o.id]?.state!=='settled');if(!c.length)return pool[p.sessionsStarted%pool.length];const low=Math.min(...c.map(o=>score(p.mastery[o.id]))),ties=c.filter(o=>score(p.mastery[o.id])===low);return ties[p.sessionsStarted%ties.length];}
export function buildSession(p,placement=false){
  const target=chooseObjective(p);
  const picked=[1,2,3].map(t=>shuffle(target.items.filter(i=>i.tier===t))[0]).filter(Boolean);
  const review=shuffle(objectives.filter(o=>o!==target&&p.mastery[o.id]?.seen).flatMap(o=>o.items)).slice(0,2);
  return {placement,items:shuffle([...picked,...review]),id:uid()};
}
export function record(p,item,o,correct,details={}){
  if(!details.supported){
    const old=p.mastery[o.id]||{state:'unseen',seen:0,correct:0,tier3Correct:0,reviews:0};
    const m={...old,seen:old.seen+1,correct:old.correct+Number(correct),tier3Correct:old.tier3Correct+Number(correct&&item.tier===3),recent:[...(old.recent||[]),correct].slice(-6)};
    m.state=m.seen===1?'introduced':m.seen>=3?'practising':old.state;
    if(m.seen>=4&&m.tier3Correct&&m.recent.filter(Boolean).length/m.recent.length>=.75)m.state='secure';
    if(['secure','settled'].includes(old.state)&&correct){m.reviews=(m.reviews||0)+1;if(m.reviews>=3)m.state='settled';}
    if(['secure','settled'].includes(old.state)&&m.recent.length>=4&&m.recent.filter(Boolean).length/m.recent.length<.5){m.state='practising';m.reviews=0;}
    p.mastery[o.id]=m;const s=subjectOf(o),r=p.ratings[s],d=o.band*400,e=1/(1+10**((d-r)/400));p.ratings[s]=Math.round(r+24*((correct?1:0)-e));
  }
  const event={id:uid(),ts:new Date().toISOString(),type:'answer',data:{...details,objectiveId:o.id,itemId:item.id,tier:item.tier,correct}};p.events.push(event);p.outbox.push(event);
}
export function progress(p,s){const os=objectives.filter(o=>subjectOf(o)===s);return Math.round(os.reduce((n,o)=>n+Math.min(1,score(p.mastery[o.id])/400),0)/os.length*100);}
