import { describe, expect, it, vi } from 'vitest';

import { ChronaAuthError, loginAccount, registerAccount } from '../src/auth/account.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function createMockFirestoreApi() {
  const docs = new Map();
  const doc = (_firestore, collectionName, id) => ({ collectionName, id, path: `${collectionName}/${id}` });
  const getDoc = vi.fn(async (ref) => {
    const value = docs.get(ref.path);
    return {
      exists: () => value !== undefined,
      data: () => value,
    };
  });
  const setDoc = vi.fn(async (ref, data) => {
    docs.set(ref.path, data);
  });
  const writeBatch = vi.fn(() => {
    const writes = [];
    return {
      set: (ref, data) => writes.push(['set', ref, data]),
      commit: vi.fn(async () => {
        writes.forEach(([, ref, data]) => docs.set(ref.path, data));
      }),
    };
  });

  return { docs, doc, getDoc, setDoc, writeBatch };
}

function createMockCache() {
  return {
    setProfile: vi.fn(async () => {}),
    setLedger: vi.fn(async () => {}),
    setPending: vi.fn(async () => {}),
    writeLocalCache: vi.fn(),
  };
}

describe('auth account flow', () => {
  it('registers, writes lookup docs, signs out, then logs in through username resolution', async () => {
    const storage = createMemoryStorage();
    const firestoreApi = createMockFirestoreApi();
    const cache = createMockCache();
    const authApi = {
      createUserWithEmailAndPassword: vi.fn(async (_auth, email) => ({ user: { uid: 'uid-1', email } })),
      signOut: vi.fn(async () => {}),
      signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'uid-1' } })),
    };

    const result = await registerAccount({
      auth: {},
      firestore: {},
      values: {
        name: 'Alice Example',
        username: 'Alice',
        email: 'alice@example.com',
        pin: '583214',
        confirm: '583214',
      },
      data: { '2026-07-21': { status: 'present', hours: 8 } },
      cache,
      storage,
      authApi,
      firestoreApi,
    });

    expect(result.profile).toEqual({ name: 'Alice Example', username: 'alice', email: 'alice@example.com' });
    expect(authApi.createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'alice@example.com', 'tlk_583214');
    expect(authApi.signOut).toHaveBeenCalledTimes(1);
    expect(firestoreApi.docs.get('ledgers/uid-1')).toMatchObject({ username: 'alice', email: 'alice@example.com' });
    expect(firestoreApi.docs.get('usernames/alice')).toEqual({ uid: 'uid-1', email: 'alice@example.com' });
    expect(cache.setPending).toHaveBeenCalledWith({ uid: 'uid-1', email: 'alice@example.com' }, false);

    storage.removeItem('chrona-login-email-v1:alice');
    await loginAccount({
      auth: {},
      firestore: {},
      username: 'ALICE',
      pin: '583214',
      storage,
      authApi,
      firestoreApi,
    });

    expect(firestoreApi.getDoc).toHaveBeenCalledWith({
      collectionName: 'usernames',
      id: 'alice',
      path: 'usernames/alice',
    });
    expect(authApi.signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'alice@example.com', 'tlk_583214');
    expect(storage.getItem('chrona-login-email-v1:alice')).toBe('alice@example.com');
  });

  it('surfaces duplicate registration as the existing user-facing message', async () => {
    const authApi = {
      createUserWithEmailAndPassword: vi.fn(async () => {
        const error = new Error('duplicate');
        error.code = 'auth/email-already-in-use';
        throw error;
      }),
      signOut: vi.fn(async () => {}),
    };

    await expect(
      registerAccount({
        auth: {},
        firestore: {},
        values: {
          name: 'Alice Example',
          username: 'alice',
          email: 'alice@example.com',
          pin: '583214',
          confirm: '583214',
        },
        data: {},
        cache: createMockCache(),
        storage: createMemoryStorage(),
        authApi,
        firestoreApi: createMockFirestoreApi(),
      }),
    ).rejects.toMatchObject({ userMessage: 'That username or recovery email is already in use.' });
  });

  it('keeps login errors generic and user-facing', async () => {
    const authApi = {
      signInWithEmailAndPassword: vi.fn(async () => {
        throw new Error('bad password');
      }),
    };

    await expect(
      loginAccount({
        auth: {},
        firestore: {},
        username: 'alice',
        pin: '583214',
        storage: createMemoryStorage(),
        authApi,
        firestoreApi: createMockFirestoreApi(),
      }),
    ).rejects.toBeInstanceOf(ChronaAuthError);

    await expect(
      loginAccount({
        auth: {},
        firestore: {},
        username: 'alice',
        pin: '583214',
        storage: createMemoryStorage(),
        authApi,
        firestoreApi: createMockFirestoreApi(),
      }),
    ).rejects.toMatchObject({
      userMessage:
        'That username or PIN is not correct. If this is a new device, make sure the latest Firestore rules are published.',
    });
  });
});
