import { changeCloudPin, updateRecoveryEmail } from '../auth/account.js';
import {
  QUESTIONS,
  acknowledgeRecoveryCode,
  createAccount as createLocalAccount,
  isWeakFallback,
  loadAccount as loadLocalAccount,
  regenerateRecoveryCode,
  setPanicState,
  setPrivateLock,
  updatePin as updateLocalPin,
  updateQuestions as updateLocalQuestions,
  validPin as validLocalPin,
  verifyPin as verifyLocalPin,
  verifyQuestions,
  verifyRecoveryCode,
} from '../security/local-security.js';
import { validPin } from '../lib/utils.js';

export function createSettingsController({
  auth,
  firestore,
  cache,
  getCurrentUser,
  getProfile,
  setProfile,
  authApi,
  firestoreApi,
}) {
  const localSetupOverlay = document.getElementById('localSetupOverlay');
  const localLockOverlay = document.getElementById('localLockOverlay');
  const localRecoveryOverlay = document.getElementById('localRecoveryOverlay');
  let afterRecoverySetup = false;

  function localAccount() {
    const currentUser = getCurrentUser();
    return currentUser ? loadLocalAccount(currentUser.uid) : null;
  }

  function populateQuestions() {
    const first = Math.floor(Math.random() * QUESTIONS.length);
    let second = Math.floor(Math.random() * (QUESTIONS.length - 1));
    if (second >= first) second++;
    ['questionOne', 'questionTwo'].forEach((id, position) => {
      const select = document.getElementById(id);
      select.innerHTML = '';
      QUESTIONS.forEach((question, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = question;
        if (index === (position ? second : first)) option.selected = true;
        select.appendChild(option);
      });
    });
  }

  function showRecoveryCode(code) {
    document.getElementById('recoveryCodeText').textContent = code;
    document.getElementById('recoveryCodeAck').checked = false;
    document.getElementById('recoveryCodeOverlay').classList.add('show');
  }

  function openLocalSetup() {
    if (!getCurrentUser()) return;
    populateQuestions();
    document.getElementById('localSetupError').textContent = '';
    localSetupOverlay.classList.add('show');
  }

  function refreshSettings() {
    const account = localAccount();
    const profile = getProfile();
    const currentUser = getCurrentUser();
    const username = profile?.username || '';
    document.getElementById('settingsUsername').value = username;
    document.getElementById('settingsUsernameText').textContent = username ? '@' + username : '—';
    document.getElementById('profileHeading').textContent = username ? username + "'s space" : 'Profile & preferences';
    document.getElementById('settingsEmail').value = profile?.email || currentUser?.email || '';
    document.getElementById('securitySettings').hidden = !account;
    document.getElementById('securityEmpty').hidden = !!account;
    document.getElementById('setupSecurityBtn').hidden = !!account;
    if (account) {
      document.getElementById('autoLockToggle').checked = account.autoLock !== false;
      document.getElementById('securityMessage').textContent = isWeakFallback(account)
        ? 'This browser uses a reduced security fallback. Use a current browser for the strongest protection.'
        : 'Your local privacy lock is active on this device.';
    }
  }

  function lockPrivate(reason = 'locked') {
    const account = localAccount();
    const currentUser = getCurrentUser();
    if (!account || !currentUser) return;
    setPrivateLock({ uid: currentUser.uid, reason, lockedAt: Date.now() });
    setPanicState(reason === 'panic');
    document.getElementById('appShell').classList.add('locked');
    document.getElementById('unlockLocalPin').value = '';
    document.getElementById('localLockError').textContent = '';
    localLockOverlay.classList.add('show');
    setTimeout(() => document.getElementById('unlockLocalPin').focus(), 0);
  }

  function bind() {
    document.addEventListener('visibilitychange', () => {
      const account = localAccount();
      if (document.hidden && account?.autoLock !== false) lockPrivate('background');
    });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        lockPrivate('panic');
      }
    });
    document.getElementById('panicBtn').addEventListener('click', () => lockPrivate('panic'));
    document.getElementById('setupSecurityBtn').addEventListener('click', openLocalSetup);
    document
      .getElementById('localSetupCancel')
      .addEventListener('click', () => localSetupOverlay.classList.remove('show'));
    document.getElementById('localSetupSave').addEventListener('click', async () => {
      const pin = document.getElementById('localPin').value;
      const confirm = document.getElementById('localPinConfirm').value;
      const a1 = document.getElementById('answerOne').value;
      const a2 = document.getElementById('answerTwo').value;
      const error = document.getElementById('localSetupError');
      const currentUser = getCurrentUser();
      error.textContent = '';
      if (!validLocalPin(pin)) return (error.textContent = 'Choose a non-obvious 4–6 digit local PIN.');
      if (pin !== confirm) return (error.textContent = 'PIN entries do not match.');
      if (!a1.trim() || !a2.trim()) return (error.textContent = 'Answer both security questions.');
      if (document.getElementById('questionOne').value === document.getElementById('questionTwo').value) {
        return (error.textContent = 'Choose two different questions.');
      }
      const created = await createLocalAccount(
        currentUser.uid,
        pin,
        [Number(document.getElementById('questionOne').value), Number(document.getElementById('questionTwo').value)],
        [a1, a2],
      );
      localSetupOverlay.classList.remove('show');
      refreshSettings();
      showRecoveryCode(created.recoveryCode);
    });
    document.getElementById('recoveryCodeContinue').addEventListener('click', () => {
      const currentUser = getCurrentUser();
      if (!document.getElementById('recoveryCodeAck').checked) return;
      acknowledgeRecoveryCode(currentUser.uid);
      document.getElementById('recoveryCodeOverlay').classList.remove('show');
      document.getElementById('securityMessage').textContent =
        'Recovery code saved. It will only be shown again if regenerated.';
      if (afterRecoverySetup) {
        afterRecoverySetup = false;
        openLocalSetup();
      }
    });
    document.getElementById('unlockLocalBtn').addEventListener('click', async () => {
      if (await verifyLocalPin(localAccount(), document.getElementById('unlockLocalPin').value)) {
        setPrivateLock(null);
        setPanicState(false);
        localLockOverlay.classList.remove('show');
        document.getElementById('appShell').classList.remove('locked');
      } else document.getElementById('localLockError').textContent = 'That local PIN is not correct.';
    });
    document.getElementById('showRecoveryBtn').addEventListener('click', () => {
      const account = localAccount();
      document.getElementById('recoveryQuestions').innerHTML = account.questions
        .map(
          (q, i) =>
            '<div class="field" style="margin-top:10px"><label>' +
            QUESTIONS[q.index] +
            '</label><input id="recoverAnswer' +
            i +
            '" type="text"></div>',
        )
        .join('');
      document.getElementById('recoverCodeInput').value = '';
      document.getElementById('recoveryError').textContent = '';
      localRecoveryOverlay.classList.add('show');
    });
    document
      .getElementById('recoveryCancel')
      .addEventListener('click', () => localRecoveryOverlay.classList.remove('show'));
    document.getElementById('recoverLocalBtn').addEventListener('click', async () => {
      const currentUser = getCurrentUser();
      const code = document.getElementById('recoverCodeInput').value.trim();
      const error = document.getElementById('recoveryError');
      error.textContent = '';
      let replacement = false;
      if (code) replacement = await verifyRecoveryCode(currentUser.uid, code.toUpperCase());
      if (replacement) {
        localRecoveryOverlay.classList.remove('show');
        afterRecoverySetup = true;
        showRecoveryCode(replacement);
        return;
      }
      const result = await verifyQuestions(currentUser.uid, [
        document.getElementById('recoverAnswer0')?.value,
        document.getElementById('recoverAnswer1')?.value,
      ]);
      if (result.ok) {
        localRecoveryOverlay.classList.remove('show');
        openLocalSetup();
        return;
      }
      error.textContent = result.lockedUntil
        ? 'Security questions are locked for 15 minutes. Use your recovery code.'
        : result.remaining
          ? 'Answers did not match. 1 attempt remaining.'
          : 'Recovery failed.';
    });
    document.getElementById('autoLockToggle').addEventListener('change', () => {
      const currentUser = getCurrentUser();
      const account = localAccount();
      account.autoLock = document.getElementById('autoLockToggle').checked;
      localStorage.setItem('chrona-account-v1:' + currentUser.uid, JSON.stringify(account));
      document.getElementById('securityMessage').textContent = 'Lock preference saved.';
    });

    document.getElementById('changeLocalPinBtn').addEventListener('click', () =>
      requireLocalPin(async () => {
        const currentUser = getCurrentUser();
        const pin = prompt('New local PIN (4–6 digits):');
        const confirm = prompt('Confirm new local PIN:');
        if (!validLocalPin(pin || '') || pin !== confirm) {
          return (document.getElementById('securityMessage').textContent = 'PIN was not changed.');
        }
        await updateLocalPin(currentUser.uid, pin);
        document.getElementById('securityMessage').textContent = 'Local PIN changed successfully.';
      }),
    );
    document.getElementById('changeQuestionsBtn').addEventListener('click', () =>
      requireLocalPin(async () => {
        const currentUser = getCurrentUser();
        const account = localAccount();
        const first = prompt(QUESTIONS[account.questions[0].index] + '\nNew answer:');
        const second = prompt(QUESTIONS[account.questions[1].index] + '\nNew answer:');
        if (!first?.trim() || !second?.trim()) return;
        await updateLocalQuestions(
          currentUser.uid,
          account.questions.map((q) => q.index),
          [first, second],
        );
        document.getElementById('securityMessage').textContent = 'Security answers updated successfully.';
      }),
    );
    document
      .getElementById('regenCodeBtn')
      .addEventListener('click', () =>
        requireLocalPin(async () => showRecoveryCode(await regenerateRecoveryCode(getCurrentUser().uid))),
      );
    document.getElementById('changeCloudPinBtn').addEventListener('click', async () => {
      const current = prompt('Enter your current cloud PIN:');
      const next = prompt('New cloud PIN (4–6 digits):');
      const confirm = prompt('Confirm new cloud PIN:');
      if (!current || !validPin(next || '') || next !== confirm) return alert('Cloud PIN was not changed.');
      try {
        await changeCloudPin({
          currentUser: getCurrentUser(),
          currentPin: current,
          nextPin: next,
          confirmPin: confirm,
          authApi,
        });
        alert('Cloud PIN changed successfully.');
      } catch (error) {
        alert(error.userMessage || 'Could not change cloud PIN. Check your current PIN and try again.');
      }
    });
    document.getElementById('updateEmailBtn').addEventListener('click', async () => {
      const email = document.getElementById('settingsEmail').value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return alert('Enter a valid email.');
      const cloudPin = prompt('Enter your current cloud PIN to update recovery email:');
      if (!cloudPin) return;
      try {
        const result = await updateRecoveryEmail({
          auth,
          firestore,
          currentUser: getCurrentUser(),
          profile: getProfile(),
          email,
          cloudPin,
          cache,
          authApi,
          firestoreApi,
        });
        setProfile(result.profile);
        alert('Recovery email updated successfully.');
      } catch (error) {
        alert(error.userMessage || 'Could not update email. Check your cloud PIN and try again.');
      }
    });
  }

  async function requireLocalPin(action) {
    const pin = prompt('Enter your local app-lock PIN to continue:');
    if (pin && (await verifyLocalPin(localAccount(), pin))) return action();
    document.getElementById('securityMessage').textContent = 'Current local PIN was not accepted.';
  }

  return { bind, lockPrivate, openLocalSetup, refreshSettings };
}
