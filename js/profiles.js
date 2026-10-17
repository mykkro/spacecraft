/**
 * Profile-scoped save storage. Loaded before any game systems restore state.
 * The session ID stays fixed until reload: beforeunload handlers must still save
 * the outgoing expedition after the manifest selects the next profile.
 */
const Profiles = (() => {
  const INDEX = 'spacecraft-profiles-v1';
  const keys = ['spacecraft-save-v1','spacecraft-chart-v1','spacecraft-weapons-v1','spacecraft-pirates-v1'];
  let manifest, ready = false;
  const path = (id,key) => 'spacecraft-profile:' + id + ':' + key;
  try {
    const saved = JSON.parse(localStorage.getItem(INDEX) || 'null');
    if (saved) {
      if (!Array.isArray(saved.profiles) || !saved.profiles.length ||
          saved.profiles.some(p => !p || typeof p.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(p.id) ||
            typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40) ||
          new Set(saved.profiles.map(p=>p.id)).size !== saved.profiles.length ||
          !saved.profiles.some(p=>p.id===saved.active)) throw Error('Invalid profile index');
      manifest = saved;
    } else {
      // Copy legacy saves first, publish the index last. Leave originals intact.
      manifest = {active:'original',profiles:[{id:'original',name:'Original expedition'}]};
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value !== null) localStorage.setItem(path('original',key),value);
      }
      localStorage.setItem(INDEX,JSON.stringify(manifest));
    }
    ready = true;
  } catch {
    // If storage is blocked or corrupt, keep the legacy session playable.
    manifest = {active:null,profiles:[]};
  }
  const session = manifest.active;
  function commit(next) {
    if (!ready) throw Error('storage');
    localStorage.setItem(INDEX,JSON.stringify(next));
    manifest = next;
  }
  function create(name) {
    name = String(name).trim().normalize('NFC');
    if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) throw Error('name');
    if (manifest.profiles.some(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase())) throw Error('duplicate');
    const id = crypto.randomUUID();
    commit({active:id,profiles:[...manifest.profiles,{id,name}]});
    return id;
  }
  function select(id) {
    if (!manifest.profiles.some(p=>p.id===id)) throw Error('profile');
    commit({...manifest,active:id});
  }
  return {
    create, select,
    getItem(key) { return localStorage.getItem(session ? path(session,key) : key); },
    setItem(key,value) { localStorage.setItem(session ? path(session,key) : key,value); },
    get current() { return manifest.profiles.find(p=>p.id===session)?.name || 'Original expedition'; },
    get sessionId() { return session; },
    get list() { return manifest.profiles.map(p=>({...p})); }
  };
})();
