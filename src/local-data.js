import { mergeData } from './sync-model.js';
import { initialGarden } from './garden-model.js';
export const DATA_KEY = 'curious-data-v2';
export function createLocalStore(storage, notify = () => {}) {
  function read() {
    const raw = storage.getItem(DATA_KEY);
    if (raw) return JSON.parse(raw);
    return {version:1, profile:JSON.parse(storage.getItem('curious-profile') || 'null'),garden:JSON.parse(storage.getItem('curious-garden-v1') || 'null') || initialGarden()};
  }
  function write(data, source = 'local') {
    // One atomic localStorage write keeps profile and lesson history together.
    storage.setItem(DATA_KEY, JSON.stringify(data));
    notify(source);
    return data;
  }
  function merge(data, source = 'cloud') { return write(mergeData(data,read()),source); }
  return { read, write, merge,
    saveProfile(profile) { return write(mergeData(read(),{profile,garden:initialGarden()})).profile; },
    saveGarden(garden) { return write(mergeData(read(),{profile:null,garden:{...garden,updatedAt:new Date().toISOString()}})).garden; },
    clear() { for(const key of [DATA_KEY,'curious-profile','curious-garden-v1','curious-pin']) storage.removeItem(key);notify('reset'); }
  };
}
export const localData = typeof localStorage === 'undefined' ? null : createLocalStore(localStorage,source => window.dispatchEvent(new CustomEvent('curious-data',{detail:{source}})));
