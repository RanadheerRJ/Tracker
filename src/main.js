import { bindAccountForms, openApp, showAccountGate } from './auth/ui.js';
import { createCalendarController } from './calendar/calendar.js';
import { firebaseAuthApi, firestoreApi, createFirebaseServices } from './lib/firebase.js';
import { refreshIcons } from './lib/utils.js';
import { createImportExportController } from './ledger/import-export.js';
import { createLedgerCache } from './ledger/cache.js';
import { createLedgerSync } from './ledger/sync.js';
import { createReportsController } from './ledger/reports.js';
import { createSettingsController } from './settings/settings.js';

const state = {
  data: {},
  legacyData: {},
  profile: null,
  currentUser: null,
  registrationInProgress: false,
};

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
}

function bindTabs({ generateReport, refreshSettings }) {
  document.getElementById('refreshAppBtn').addEventListener('click', () => {
    window.location.reload();
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'dashboardPanel') generateReport();
      if (btn.dataset.tab === 'settingsPanel') refreshSettings();
    });
  });
}

function startApp() {
  const { auth, firestore } = createFirebaseServices();
  const cache = createLedgerCache();
  const sync = createLedgerSync({ firestore, firestoreApi });

  const getData = () => state.data;
  const setData = (nextData) => {
    state.data = nextData;
  };
  const getProfile = () => state.profile;
  const setProfile = (nextProfile) => {
    state.profile = nextProfile;
  };
  const getCurrentUser = () => state.currentUser;
  const setCurrentUser = (user) => {
    state.currentUser = user;
  };

  async function queueCloudSync() {
    await sync.queueCloudSync({ user: state.currentUser, profile: state.profile, data: state.data, cache });
  }

  async function save() {
    if (!state.currentUser) return;
    cache.writeLocalCache(state.currentUser, state.data);
    await cache.setLedger(state.currentUser, state.data);
    await cache.setPending(state.currentUser, true);
    queueCloudSync();
  }

  const calendar = createCalendarController({ getData, save });
  calendar.bind();

  const reports = createReportsController({ getData, getProfile });
  reports.bind();

  const settings = createSettingsController({
    auth,
    firestore,
    cache,
    getCurrentUser,
    getProfile,
    setProfile,
    authApi: firebaseAuthApi,
    firestoreApi,
  });
  settings.bind();

  const importExport = createImportExportController({
    getData,
    setData,
    save,
    render: calendar.render,
  });
  importExport.bind();

  bindTabs({ generateReport: reports.generateReport, refreshSettings: settings.refreshSettings });

  bindAccountForms({
    auth,
    firestore,
    cache,
    getData,
    setProfile,
    setLegacyData: (legacyData) => {
      state.legacyData = legacyData;
    },
    setRegistrationInProgress: (value) => {
      state.registrationInProgress = value;
    },
    setCurrentUser,
    getCurrentUser,
    showGate: showAccountGate,
    authApi: firebaseAuthApi,
    firestoreApi,
  });

  window.addEventListener('online', queueCloudSync);

  async function loadCloudLedger() {
    const result = await sync.loadCloudLedger({
      user: state.currentUser,
      profile: state.profile,
      data: state.data,
      cache,
    });
    state.profile = result.profile;
    state.data = result.data;
  }

  async function initializeStorage() {
    if (!('indexedDB' in window)) {
      alert('Chrona needs IndexedDB enabled to save your offline ledger.');
      return;
    }
    const initialized = await cache.initialize();
    state.legacyData = initialized.legacyData;
    state.profile = initialized.legacyProfile;

    firebaseAuthApi.onAuthStateChanged(auth, async (user) => {
      state.currentUser = user;
      if (state.registrationInProgress) return;
      if (user) {
        state.data = (await cache.getLedger(user)) || cache.readLocalCache(user) || state.legacyData || {};
        state.profile = (await cache.getProfile(user)) || state.profile;
        await loadCloudLedger();
        openApp({ profile: state.profile, render: calendar.render, refreshSettings: settings.refreshSettings });
      } else showAccountGate('login');
    });
  }

  initializeStorage().catch((err) => {
    console.error('Chrona storage failed to initialize:', err);
    alert('Chrona could not open its local database. Please check your browser storage settings.');
    showAccountGate('login');
  });
}

registerServiceWorker();
refreshIcons();

try {
  startApp();
} catch (error) {
  console.error(error);
  alert('Chrona is missing its Firebase configuration. Add the Vite environment variables and reload.');
  showAccountGate('login');
}
