import { firebaseAuthApi as defaultAuthApi, firestoreApi as defaultFirestoreApi } from '../lib/firebase.js';
import { emailFor, passwordFor, usernameFor, validEmail, validPin, validUsername } from '../lib/utils.js';

export class ChronaAuthError extends Error {
  constructor(userMessage, cause) {
    super(userMessage);
    this.name = 'ChronaAuthError';
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

export function validateRegistration({ name, username, email, pin, confirm }) {
  if (!name) return 'Please enter your name.';
  if (!validUsername(username)) return 'Use 3–24 letters, numbers, dots, underscores, or hyphens.';
  if (!validEmail(email)) return 'Enter a valid recovery email.';
  if (!validPin(pin)) return 'Choose a 4–6 digit PIN that is not all the same digit.';
  if (pin !== confirm) return 'PIN entries do not match.';
  return '';
}

export function validateLogin({ username, pin }) {
  return validUsername(username) && validPin(pin);
}

export async function registerAccount({
  auth,
  firestore,
  values,
  data,
  cache,
  storage = localStorage,
  authApi = defaultAuthApi,
  firestoreApi = defaultFirestoreApi,
}) {
  const name = values.name.trim();
  const username = usernameFor(values.username);
  const email = values.email.trim().toLowerCase();
  const pin = values.pin;
  const confirm = values.confirm;
  const validationMessage = validateRegistration({ name, username, email, pin, confirm });
  if (validationMessage) throw new ChronaAuthError(validationMessage);

  let user = null;
  const profile = { name, username, email };

  try {
    const usernameLookup = await firestoreApi.getDoc(firestoreApi.doc(firestore, 'usernames', username));
    if (usernameLookup.exists()) {
      throw new ChronaAuthError('That username or recovery email is already in use.');
    }

    const credential = await authApi.createUserWithEmailAndPassword(auth, email, passwordFor(pin));
    user = credential.user;

    storage.setItem('chrona-last-username-v1', username);
    storage.setItem('chrona-login-email-v1:' + username, email);

    const batch = firestoreApi.writeBatch(firestore);
    batch.set(firestoreApi.doc(firestore, 'ledgers', user.uid), { username, name, email, data });
    batch.set(firestoreApi.doc(firestore, 'usernames', username), { uid: user.uid, email });
    await batch.commit();

    await cache.setProfile(user, profile);
    await cache.setLedger(user, data);
    cache.writeLocalCache(user, data);
    await cache.setPending(user, false);
    await authApi.signOut(auth);

    return { user, profile };
  } catch (error) {
    if (user) {
      if (authApi.deleteUser) await authApi.deleteUser(user).catch(() => {});
      await authApi.signOut(auth).catch(() => {});
    }
    if (error instanceof ChronaAuthError) throw error;
    const message =
      error?.code === 'auth/email-already-in-use'
        ? 'That username or recovery email is already in use.'
        : 'Could not create your account. Please try again.';
    throw new ChronaAuthError(message, error);
  }
}

export async function loginAccount({
  auth,
  firestore,
  username,
  pin,
  storage = localStorage,
  authApi = defaultAuthApi,
  firestoreApi = defaultFirestoreApi,
}) {
  const normalizedUsername = usernameFor(username);
  if (!validateLogin({ username: normalizedUsername, pin })) {
    throw new ChronaAuthError('Enter your username and PIN.');
  }

  try {
    storage.setItem('chrona-last-username-v1', normalizedUsername);
    let loginEmail = storage.getItem('chrona-login-email-v1:' + normalizedUsername) || emailFor(normalizedUsername);

    try {
      const lookup = await firestoreApi.getDoc(firestoreApi.doc(firestore, 'usernames', normalizedUsername));
      if (lookup.exists() && lookup.data().email) loginEmail = lookup.data().email;
    } catch {
      // Same-device sign-in uses the saved email; legacy accounts use the synthetic address.
    }

    await authApi.signInWithEmailAndPassword(auth, loginEmail, passwordFor(pin));
    storage.setItem('chrona-login-email-v1:' + normalizedUsername, loginEmail);
    return { loginEmail };
  } catch (error) {
    throw new ChronaAuthError(
      'That username or PIN is not correct. If this is a new device, make sure the latest Firestore rules are published.',
      error,
    );
  }
}

export async function sendCloudPinReset({
  auth,
  firestore,
  username,
  authApi = defaultAuthApi,
  firestoreApi = defaultFirestoreApi,
}) {
  const normalizedUsername = usernameFor(username);
  if (!validUsername(normalizedUsername)) throw new ChronaAuthError('Enter your username first.');

  try {
    const lookup = await firestoreApi.getDoc(firestoreApi.doc(firestore, 'usernames', normalizedUsername));
    const email = lookup.exists() && lookup.data().email;
    if (!email) {
      throw new ChronaAuthError(
        'This legacy account needs a recovery email added from Settings before cloud PIN reset is available.',
      );
    }
    await authApi.sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    if (error instanceof ChronaAuthError) throw error;
    throw new ChronaAuthError('Could not start password reset. Please try again.', error);
  }
}

export async function changeCloudPin({ currentUser, currentPin, nextPin, confirmPin, authApi = defaultAuthApi }) {
  if (!currentPin || !validPin(nextPin || '') || nextPin !== confirmPin) {
    throw new ChronaAuthError('Cloud PIN was not changed.');
  }

  try {
    await authApi.reauthenticateWithCredential(
      currentUser,
      authApi.EmailAuthProvider.credential(currentUser.email, passwordFor(currentPin)),
    );
    await authApi.updatePassword(currentUser, passwordFor(nextPin));
    return true;
  } catch (error) {
    throw new ChronaAuthError('Could not change cloud PIN. Check your current PIN and try again.', error);
  }
}

export async function updateRecoveryEmail({
  firestore,
  currentUser,
  profile,
  email,
  cloudPin,
  cache,
  authApi = defaultAuthApi,
  firestoreApi = defaultFirestoreApi,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!validEmail(normalizedEmail)) throw new ChronaAuthError('Enter a valid email.');
  if (!cloudPin) return { cancelled: true };

  try {
    await authApi.reauthenticateWithCredential(
      currentUser,
      authApi.EmailAuthProvider.credential(currentUser.email, passwordFor(cloudPin)),
    );
    await authApi.updateEmail(currentUser, normalizedEmail);
    const nextProfile = { ...profile, email: normalizedEmail };
    await firestoreApi.setDoc(
      firestoreApi.doc(firestore, 'ledgers', currentUser.uid),
      { email: normalizedEmail },
      { merge: true },
    );
    await firestoreApi.setDoc(
      firestoreApi.doc(firestore, 'usernames', profile.username),
      { uid: currentUser.uid, email: normalizedEmail },
      { merge: true },
    );
    await cache.setProfile(currentUser, nextProfile);
    return { profile: nextProfile };
  } catch (error) {
    throw new ChronaAuthError('Could not update email. Check your cloud PIN and try again.', error);
  }
}
