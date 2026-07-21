import { DATA_RECORD, DB_NAME, DB_VERSION, PENDING_RECORD, PROFILE_RECORD, STORAGE_KEY } from '../lib/utils.js';

export function openDatabase(indexedDb = indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('app')) request.result.createObjectStore('app');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createLedgerCache({ indexedDb = indexedDB, storage = localStorage } = {}) {
  let db;

  function requireDb() {
    if (!db) throw new Error('Chrona IndexedDB cache has not been initialized.');
    return db;
  }

  function dbGet(key) {
    return new Promise((resolve, reject) => {
      const request = requireDb().transaction('app', 'readonly').objectStore('app').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function dbSet(key, value) {
    return new Promise((resolve, reject) => {
      const request = requireDb().transaction('app', 'readwrite').objectStore('app').put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function ledgerKey(user) {
    return 'ledger:' + user.uid;
  }

  function profileKey(user) {
    return 'profile:' + user.uid;
  }

  function pendingKey(user) {
    return 'pendingSync:' + user.uid;
  }

  function localCacheKey(user) {
    return 'timesheet_ledger_cloud_cache_' + user.uid;
  }

  function readLocalCache(user) {
    try {
      return JSON.parse(storage.getItem(localCacheKey(user)) || 'null');
    } catch {
      return null;
    }
  }

  function writeLocalCache(user, data) {
    storage.setItem(localCacheKey(user), JSON.stringify(data));
  }

  async function initialize() {
    db = await openDatabase(indexedDb);
    let legacyData = (await dbGet(DATA_RECORD)) || {};
    if (!Object.keys(legacyData).length) legacyData = readLegacyStorage();
    const legacyProfile = (await dbGet(PROFILE_RECORD)) || null;
    return { legacyData, legacyProfile };
  }

  function readLegacyStorage() {
    try {
      const legacy = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
      return legacy && typeof legacy === 'object' ? legacy : {};
    } catch (error) {
      console.warn('Could not migrate legacy ledger.', error);
      return {};
    }
  }

  return {
    dbGet,
    dbSet,
    getLedger: (user) => dbGet(ledgerKey(user)),
    setLedger: (user, data) => dbSet(ledgerKey(user), data),
    getPending: (user) => dbGet(pendingKey(user)),
    setPending: (user, value) => dbSet(pendingKey(user), value),
    getProfile: (user) => dbGet(profileKey(user)),
    setProfile: (user, profile) => dbSet(profileKey(user), profile),
    initialize,
    ledgerKey,
    localCacheKey,
    pendingKey,
    profileKey,
    readLocalCache,
    writeLocalCache,
  };
}

export const cacheRecordKeys = {
  DATA_RECORD,
  PENDING_RECORD,
  PROFILE_RECORD,
};
