import { profiles } from './profiles.js';
export { createLocalStore, DATA_KEY } from './data-store.js';
// Existing learner screens access only the currently selected profile.
export const localData = profiles ? {
  read:()=>profiles.store().read(),
  write:(...args)=>profiles.store().write(...args),
  merge:(...args)=>profiles.store().merge(...args),
  saveProfile:(p)=>profiles.store().saveProfile(p),
  saveGarden:(g)=>profiles.store().saveGarden(g)
}:null;
