import { mergeData } from './sync-model.js';
import { initialGarden } from './garden-model.js';
export const DATA_KEY = 'curious-data-v2';
export function createLocalStore(storage, notify = () => {}, key = DATA_KEY, fallback = null) {
  function read() {
    const raw = storage.getItem(key);
    if (raw) return JSON.parse(raw);
    if (fallback) return fallback();
    return {version:1, profile:JSON.parse(storage.getItem('curious-profile') || 'null'),garden:JSON.parse(storage.getItem('curious-garden-v1') || 'null') || initialGarden()};
  }
  function write(data, source = 'local') {
    storage.setItem(key, JSON.stringify(data));
    notify(source);
    return data;
  }
  function merge(data, source = 'cloud') { return write(mergeData(data,read()),source); }
  return { read, write, merge,
    saveProfile(profile) { return write(mergeData(read(),{profile,garden:initialGarden()})).profile; },
    saveGarden(garden) { return write(mergeData(read(),{profile:null,garden:{...garden,updatedAt:new Date().toISOString()}})).garden; },
    clear() { storage.removeItem(key);notify('reset'); }
  };
}
