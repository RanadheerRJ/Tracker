import { describe, expect, it, vi } from 'vitest';

import { chooseLedgerData, createLedgerSync } from '../src/ledger/sync.js';

function createCache({ pending = false } = {}) {
  return {
    pending,
    ledger: undefined,
    profile: undefined,
    localCache: undefined,
    getPending: vi.fn(async function getPending() {
      return this.pending;
    }),
    setPending: vi.fn(async function setPending(_user, value) {
      this.pending = value;
    }),
    setLedger: vi.fn(async function setLedger(_user, value) {
      this.ledger = value;
    }),
    setProfile: vi.fn(async function setProfile(_user, value) {
      this.profile = value;
    }),
    writeLocalCache: vi.fn(function writeLocalCache(_user, value) {
      this.localCache = value;
    }),
  };
}

function createFirestoreApi(cloudDoc) {
  const writes = [];
  const firestoreApi = {
    doc: (_firestore, collectionName, id) => ({ path: `${collectionName}/${id}` }),
    getDoc: vi.fn(async () => ({
      exists: () => cloudDoc !== null,
      data: () => cloudDoc,
    })),
    setDoc: vi.fn(async (ref, data) => {
      writes.push({ ref, data });
    }),
  };
  return { firestoreApi, writes };
}

describe('ledger sync', () => {
  it('chooses cloud data when no local changes are pending', () => {
    expect(
      chooseLedgerData({
        pending: false,
        cloudData: { '2026-07-21': { status: 'present', hours: 8 } },
        localData: { local: true },
      }),
    ).toEqual({ '2026-07-21': { status: 'present', hours: 8 } });
  });

  it('keeps local data when pending sync changes would conflict with cloud', () => {
    expect(
      chooseLedgerData({
        pending: true,
        cloudData: { cloud: true },
        localData: { local: true },
      }),
    ).toEqual({ local: true });
  });

  it('loads cloud data into the local cache when there is no pending sync', async () => {
    const cloudData = { '2026-07-21': { status: 'present', hours: 8 } };
    const { firestoreApi } = createFirestoreApi({
      username: 'alice',
      name: 'Alice',
      email: 'alice@example.com',
      data: cloudData,
    });
    const cache = createCache({ pending: false });
    const sync = createLedgerSync({ firestore: {}, firestoreApi, navigatorRef: { onLine: true } });

    const result = await sync.loadCloudLedger({
      user: { uid: 'uid-1', email: 'auth@example.com' },
      profile: { username: 'alice', name: '', email: '' },
      data: { local: true },
      cache,
    });

    expect(result.data).toEqual(cloudData);
    expect(result.profile).toEqual({ username: 'alice', name: 'Alice', email: 'alice@example.com' });
    expect(cache.setLedger).toHaveBeenCalledWith({ uid: 'uid-1', email: 'auth@example.com' }, cloudData);
    expect(cache.writeLocalCache).toHaveBeenCalledWith({ uid: 'uid-1', email: 'auth@example.com' }, cloudData);
    expect(firestoreApi.setDoc).not.toHaveBeenCalled();
  });

  it('uploads local pending data and clears the pending flag', async () => {
    const { firestoreApi, writes } = createFirestoreApi({
      username: 'alice',
      name: 'Alice',
      email: 'alice@example.com',
      data: { cloud: true },
    });
    const cache = createCache({ pending: true });
    const sync = createLedgerSync({ firestore: {}, firestoreApi, navigatorRef: { onLine: true } });
    const localData = { '2026-07-21': { status: 'leave', hours: 8 } };

    const result = await sync.loadCloudLedger({
      user: { uid: 'uid-1', email: 'auth@example.com' },
      profile: { username: 'alice', name: 'Alice', email: '' },
      data: localData,
      cache,
    });

    expect(result.data).toBe(localData);
    expect(writes).toEqual([
      {
        ref: { path: 'ledgers/uid-1' },
        data: {
          username: 'alice',
          name: 'Alice',
          email: 'alice@example.com',
          data: localData,
        },
      },
    ]);
    expect(cache.setPending).toHaveBeenCalledWith({ uid: 'uid-1', email: 'auth@example.com' }, false);
    expect(cache.pending).toBe(false);
  });

  it('does not clear pending sync while offline', async () => {
    const { firestoreApi } = createFirestoreApi(null);
    const cache = createCache({ pending: true });
    const sync = createLedgerSync({ firestore: {}, firestoreApi, navigatorRef: { onLine: false } });

    const uploaded = await sync.queueCloudSync({
      user: { uid: 'uid-1', email: 'auth@example.com' },
      profile: { username: 'alice', name: 'Alice', email: 'alice@example.com' },
      data: {},
      cache,
    });

    expect(uploaded).toBe(false);
    expect(firestoreApi.setDoc).not.toHaveBeenCalled();
    expect(cache.pending).toBe(true);
  });
});
