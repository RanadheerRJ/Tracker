import { loginAccount, registerAccount, sendCloudPinReset } from './account.js';
import { usernameFor } from '../lib/utils.js';

export function setGreeting(name) {
  document.getElementById('nameplate').textContent = name ? '— ' + name + "'s ledger" : '';
}

export function showAccountGate(mode, storage = localStorage) {
  document.getElementById('appShell').classList.add('locked');
  document.getElementById('accountGate').classList.add('show');
  if (mode === 'login')
    document.getElementById('loginUsername').value = storage.getItem('chrona-last-username-v1') || '';
  document.getElementById('registerAccountCard').hidden = mode !== 'register';
  document.getElementById('loginAccountCard').hidden = mode !== 'login';
  setTimeout(() => document.getElementById(mode === 'login' ? 'loginUsername' : 'accountName').focus(), 0);
}

export function openApp({ profile, render, refreshSettings }) {
  document.getElementById('accountGate').classList.remove('show');
  document.getElementById('appShell').classList.remove('locked');
  setGreeting(profile?.name || '');
  render();
  refreshSettings();
}

export function bindAccountForms({
  auth,
  firestore,
  cache,
  getData,
  setProfile,
  setLegacyData,
  setRegistrationInProgress,
  setCurrentUser,
  getCurrentUser,
  showGate = showAccountGate,
  authApi,
  firestoreApi,
  storage = localStorage,
}) {
  document.getElementById('showLoginBtn').addEventListener('click', () => showGate('login'));
  document.getElementById('showRegisterBtn').addEventListener('click', () => showGate('register'));

  document.getElementById('registerAccountForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('registerAccountError');
    error.textContent = '';

    setRegistrationInProgress(true);
    try {
      const result = await registerAccount({
        auth,
        firestore,
        values: {
          name: document.getElementById('accountName').value,
          username: document.getElementById('accountUsername').value,
          email: document.getElementById('accountEmail').value,
          pin: document.getElementById('newPin').value,
          confirm: document.getElementById('confirmPin').value,
        },
        data: getData(),
        cache,
        storage,
        authApi,
        firestoreApi,
      });
      setCurrentUser(result.user);
      setProfile(result.profile);
      setLegacyData({});
      setRegistrationInProgress(false);
      showGate('login');
      document.getElementById('loginAccountError').style.color = 'var(--accent-green)';
      document.getElementById('loginAccountError').textContent = 'Account created. Enter your PIN to sign in.';
      document.getElementById('loginPin').focus();
    } catch (err) {
      setRegistrationInProgress(false);
      if (getCurrentUser()) await authApi.signOut(auth).catch(() => {});
      error.textContent = err.userMessage || 'Could not create your account. Please try again.';
      console.error(err.cause || err);
    }
  });

  document.getElementById('loginAccountForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('loginAccountError');
    error.style.color = '';
    error.textContent = '';
    try {
      await loginAccount({
        auth,
        firestore,
        username: document.getElementById('loginUsername').value,
        pin: document.getElementById('loginPin').value,
        storage,
        authApi,
        firestoreApi,
      });
    } catch (err) {
      error.textContent =
        err.userMessage ||
        'That username or PIN is not correct. If this is a new device, make sure the latest Firestore rules are published.';
      console.error(err.cause || err);
    }
  });

  document.getElementById('signOutBtn').addEventListener('click', async () => {
    try {
      await authApi.signOut(auth);
    } catch (error) {
      console.error(error);
      alert('Could not sign out. Please try again.');
    }
  });

  document
    .getElementById('loginAccountForm')
    .insertAdjacentHTML(
      'beforeend',
      '<button type="button" class="text-button" id="forgotCloudPinBtn">Forgot cloud PIN?</button>',
    );
  document.getElementById('forgotCloudPinBtn').addEventListener('click', async () => {
    const username = usernameFor(document.getElementById('loginUsername').value);
    const error = document.getElementById('loginAccountError');
    error.style.color = '';
    try {
      await sendCloudPinReset({ auth, firestore, username, authApi, firestoreApi });
      error.style.color = 'var(--accent-green)';
      error.textContent = 'If the account exists, a reset email has been sent.';
    } catch (err) {
      error.textContent = err.userMessage || 'Could not start password reset. Please try again.';
    }
  });
}
