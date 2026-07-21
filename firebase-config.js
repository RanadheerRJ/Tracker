// Firebase web configuration is injected by Vite from environment variables.
// Copy .env.example to .env for local development; do not commit real .env files.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Manual sync point: VITE_FIREBASE_ADMIN_UID must match firestore.rules isAdmin().
// Run `npm run check:admin-uid` before deploying after changing either value.
// Prefer server-side custom claims in a future iteration so this is not duplicated.
export const ADMIN_UID = import.meta.env.VITE_FIREBASE_ADMIN_UID || '';

export const REQUIRED_FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export function missingFirebaseEnv(env = import.meta.env) {
  return REQUIRED_FIREBASE_ENV.filter((key) => !env[key]);
}
