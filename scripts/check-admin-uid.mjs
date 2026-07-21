import { readFile } from 'node:fs/promises';

function parseDotEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );
}

const rules = await readFile('firestore.rules', 'utf8');
const rulesUid = rules.match(/request\.auth\.uid\s*==\s*"([^"]+)"/)?.[1];
if (!rulesUid) throw new Error('Could not find isAdmin UID in firestore.rules');

let envText = '';
try {
  envText = await readFile('.env', 'utf8');
} catch {
  console.warn(
    `No .env file found. Ensure VITE_FIREBASE_ADMIN_UID matches firestore.rules (${rulesUid}) before deploying.`,
  );
  process.exit(0);
}

const env = parseDotEnv(envText);
const adminUid = env.VITE_FIREBASE_ADMIN_UID;
if (!adminUid) throw new Error(`.env is missing VITE_FIREBASE_ADMIN_UID; it must match firestore.rules (${rulesUid}).`);
if (adminUid !== rulesUid) {
  throw new Error(
    `VITE_FIREBASE_ADMIN_UID (${adminUid}) does not match firestore.rules (${rulesUid}). Update both together.`,
  );
}

console.log('Admin UID matches firestore.rules.');
