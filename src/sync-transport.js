import { eventsOf, metadata, mergeMetadata, hydrate, uniqueEvents } from './sync-model.js';

// Transport is injected so the actual synchronisation path can be tested with
// lost responses, denied reads and edits arriving during a network request.
export async function syncLearning(store, cloud, active = () => true) {
  const remote = await cloud.readEvents();
  if (!active()) return false;
  const snapshot = store.read();
  uniqueEvents([...remote,...eventsOf(snapshot)]); // Reject conflicting IDs first.
  const known = new Set(remote.map(e=>e.id));
  const pending = eventsOf(snapshot).filter(e=>!known.has(e.id));
  for (let i=0;i<pending.length;i+=100) {
    if (!active()) return false;
    await cloud.writeEvents(pending.slice(i,i+100));
  }
  if (!active()) return false;
  const merged = await cloud.updateMetadata(old=>mergeMetadata(old,metadata(snapshot)));
  const latest = await cloud.readEvents();
  if (!active()) return false;
  store.merge(hydrate(merged,latest));
  return true;
}
