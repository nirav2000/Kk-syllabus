export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}
// No countdown. Monotonic active time excludes hidden tabs and parent panels.
export function createClock(now = () => performance.now()) {
  const started=now(); let since=started, active=0, paused=false, interruptions=0;
  return {
    pause(){if(!paused){active+=now()-since;paused=true;interruptions++;}},
    resume(){if(paused){since=now();paused=false;}},
    read(){return {responseMs:Math.max(0,Math.round(active+(paused?0:now()-since))),elapsedMs:Math.max(0,Math.round(now()-started)),interruptions};}
  };
}
export function answerEvent(data, type='answer') {
  return {id:crypto.randomUUID(),ts:new Date().toISOString(),type,data};
}
export function median(values){if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
export function summarize(events) {
  const answers=events.filter(e=>typeof e.data?.correct==='boolean');
  const timed=answers.filter(e=>Number.isFinite(e.data.responseMs));
  return {count:answers.length,correct:answers.filter(e=>e.data.correct).length,medianMs:median(timed.map(e=>e.data.responseMs)),timed:timed.length,rapid:timed.filter(e=>e.data.responseMs<1500).length,supported:answers.filter(e=>e.data.supported).length};
}
