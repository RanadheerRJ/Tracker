import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, writeBatch } from 'firebase/firestore';

import { ADMIN_UID, firebaseConfig, missingFirebaseEnv } from '../../firebase-config.js';

export { ADMIN_UID, firebaseConfig };

export const firebaseAuthApi = {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
};

export const firestoreApi = {
  doc,
  getDoc,
  setDoc,
  writeBatch,
};

export function createFirebaseServices(config = firebaseConfig) {
  const missing = missingFirebaseEnv();
  if (missing.length) {
    throw new Error('Missing Firebase environment variables: ' + missing.join(', '));
  }

  const firebaseApp = initializeApp(config);
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  return { firebaseApp, auth, firestore };
}
