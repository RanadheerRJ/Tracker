import { firestoreApi as defaultFirestoreApi } from '../lib/firebase.js';

export function chooseLedgerData({ pending, cloudData, localData }) {
  if (pending) return localData || {};
  return cloudData && typeof cloudData === 'object' ? cloudData : {};
}

export function mergeProfile({ cloud, profile, user }) {
  return {
    name: cloud.name || profile?.name || '',
    username: cloud.username || profile?.username || '',
    email: cloud.email || profile?.email || user.email || '',
  };
}

export function createLedgerSync({ firestore, firestoreApi = defaultFirestoreApi, navigatorRef = navigator } = {}) {
  let syncInFlight = false;

  async function queueCloudSync({ user, profile, data, cache }) {
    if (syncInFlight || !user || !navigatorRef.onLine) return false;
    syncInFlight = true;
    try {
      await firestoreApi.setDoc(firestoreApi.doc(firestore, 'ledgers', user.uid), {
        username: profile.username,
        name: profile.name,
        email: profile.email || user.email || '',
        data,
      });
      await cache.setPending(user, false);
      return true;
    } catch (error) {
      console.warn('Chrona will sync when a connection is available.', error);
      return false;
    } finally {
      syncInFlight = false;
    }
  }

  async function loadCloudLedger({ user, profile, data, cache }) {
    const pending = await cache.getPending(user);
    let nextProfile = profile;
    let nextData = data;

    try {
      const snapshot = await firestoreApi.getDoc(firestoreApi.doc(firestore, 'ledgers', user.uid));
      if (snapshot.exists()) {
        const cloud = snapshot.data();
        nextProfile = mergeProfile({ cloud, profile, user });
        nextData = chooseLedgerData({ pending, cloudData: cloud.data, localData: data });

        if (!pending) {
          await cache.setLedger(user, nextData);
          cache.writeLocalCache(user, nextData);
        }
        await cache.setProfile(user, nextProfile);
      }
      if (pending) await queueCloudSync({ user, profile: nextProfile, data: nextData, cache });
    } catch (error) {
      console.warn('Using the saved offline ledger until Chrona reconnects.', error);
    }

    return { profile: nextProfile, data: nextData };
  }

  return { loadCloudLedger, queueCloudSync };
}
