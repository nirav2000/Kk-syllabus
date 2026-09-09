import { record, blankProfile } from './engine.js';
import { byItem } from './content.js';
import { initialGarden } from './garden-model.js';

export function uniqueEvents(events) {
  const map = new Map();
  for (const e of events || []) {
    if (!e || typeof e.id !== 'string' || !['quiz', 'garden'].includes(e.kind) || !e.event) continue;
    const old = map.get(e.id);
    if (old && canonical(old) !== canonical(e)) throw new Error('An event ID has conflicting data; sync stopped to preserve history.');
    map.set(e.id, e);
  }
  return [...map.values()].sort((a,b) => String(a.event.ts).localeCompare(String(b.event.ts)) || a.id.localeCompare(b.id));
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function eventsOf(data) {
  const quiz = (data.profile?.events || []).map(event => ({ id: 'quiz-' + event.id, kind: 'quiz', event }));
  const garden = (data.garden?.attempts || []).map((a,index) => {
    // Deterministic IDs preserve already-existing attempts across repeated imports.
    const event = a.id ? a : { ...a, id: 'legacy-' + encodeURIComponent(JSON.stringify([index,a])) };
    return { id: 'garden-' + event.id, kind: 'garden', event };
  });
  return uniqueEvents([...quiz,...garden]);
}
export function metadata(data) {
  const p = data.profile;
  const g = data.garden || initialGarden();
  const { attempts, ...garden } = g;
  return { version: 1, profile: p ? { id:p.id, displayName:p.displayName, placed:!!p.placed, sessionsStarted:p.sessionsStarted||0 } : null, garden };
}
export function mergeMetadata(a, b) {
  a = a || {}; b = b || {};
  const ga = a.garden || initialGarden(), gb = b.garden || initialGarden();
  const later = (gb.updatedAt || '') > (ga.updatedAt || '') ? gb : ga;
  const hints = { ...ga.hints };
  for (const [key,n] of Object.entries(gb.hints || {})) hints[key] = Math.max(hints[key]||0,n);
  return { version:1, profile: a.profile || b.profile ? {
    ...(a.profile || b.profile),
    placed: !!(a.profile?.placed || b.profile?.placed),
    // This is a scheduling cursor, not a count of unique sessions.
    sessionsStarted: Math.max(a.profile?.sessionsStarted||0,b.profile?.sessionsStarted||0),
  } : null, garden: { ...later, stage: (ga.updatedAt || gb.updatedAt) ? later.stage : Math.max(ga.stage||0,gb.stage||0), completed:!!(ga.completed||gb.completed),
    hints, visited:[...new Set([...(ga.visited||[]),...(gb.visited||[])])] } };
}
export function hydrate(meta, records) {
  records = uniqueEvents(records);
  let profile = null;
  if (meta.profile) {
    profile = { ...blankProfile(meta.profile.displayName), ...meta.profile, mastery:{}, ratings:{maths:800,english:800}, events:[], outbox:[] };
    for (const { kind,event } of records) {
      if (kind !== 'quiz') continue;
      const objective = byItem(event.data?.itemId);
      if (event.type === 'answer' && objective && typeof event.data.correct === 'boolean') {
        record(profile,objective.items.find(i=>i.id===event.data.itemId),objective,event.data.correct);
        profile.events.pop(); profile.outbox.pop();
      }
      profile.events.push(event);
    }
  }
  return { version:1, profile, garden:{ ...initialGarden(), ...meta.garden, attempts:records.filter(e=>e.kind==='garden').map(e=>e.event) } };
}
export function mergeData(a,b) {
  return hydrate(mergeMetadata(metadata(a),metadata(b)),[...eventsOf(a),...eventsOf(b)]);
}
