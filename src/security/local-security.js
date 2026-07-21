// Chrona local app-lock security. This is intentionally separate from Firebase Auth:
// it protects against casual access on this browser only and does not encrypt the
// IndexedDB/localStorage ledger or provide cross-device account recovery.
const ITERATIONS = 120000;
const ACCOUNT_PREFIX = 'chrona-account-v1:';
const RECOVERY_PREFIX = 'chrona-account-recovery-state-v1:';
const LOCK_KEY = 'chrona-private-lock-v1';
const PANIC_KEY = 'chrona-panic-v1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  'What was the name of your first school?',
  'What is your favourite childhood book?',
  'What was your childhood nickname?',
  'What was the first concert you attended?',
];

const keyFor = (prefix, uid) => prefix + uid;
const encode = (bytes) => btoa(String.fromCharCode(...bytes));
const decode = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const randomSalt = () => {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else {
    console.warn('Chrona local security is using a weak random fallback because Web Crypto is unavailable.');
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return encode(bytes);
};
export const normalizeAnswer = (value) => value.trim().toLowerCase().replace(/\s+/g, ' ');
export const validPin = (pin) =>
  /^\d{4,6}$/.test(pin) &&
  !/^(\d)\1+$/.test(pin) &&
  !['0123', '1234', '2345', '3456', '4567', '5678', '6789', '012345', '123456', '234567', '345678', '456789'].includes(
    pin,
  );

function weakHash(value, salt) {
  // Compatibility only: old/locked-down webviews without Web Crypto. Do not
  // treat this as equivalent to PBKDF2; callers expose a warning in Settings.
  let hash = 2166136261;
  const input = salt + ':' + value;
  for (let round = 0; round < 2000; round++)
    for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
async function verifier(value, salt) {
  if (!globalThis.crypto?.subtle) return { value: weakHash(value, salt), algorithm: 'weak-fallback' };
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: decode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return { value: encode(new Uint8Array(bits)), algorithm: 'PBKDF2-SHA-256' };
}
async function protectedValue(value) {
  const salt = randomSalt();
  const result = await verifier(value, salt);
  return {
    salt,
    verifier: result.value,
    algorithm: result.algorithm,
    iterations: result.algorithm === 'PBKDF2-SHA-256' ? ITERATIONS : 0,
  };
}
async function matches(value, record) {
  if (!record?.salt || !record?.verifier) return false;
  return (await verifier(value, record.salt)).value === record.verifier;
}

export function loadAccount(uid) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(ACCOUNT_PREFIX, uid)) || 'null');
  } catch {
    return null;
  }
}
export function saveAccount(uid, account) {
  localStorage.setItem(keyFor(ACCOUNT_PREFIX, uid), JSON.stringify(account));
}
export function loadRecoveryState(uid) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(RECOVERY_PREFIX, uid)) || '{"failures":0,"lockedUntil":0}');
  } catch {
    return { failures: 0, lockedUntil: 0 };
  }
}
export function saveRecoveryState(uid, state) {
  localStorage.setItem(keyFor(RECOVERY_PREFIX, uid), JSON.stringify(state));
}
export function setPrivateLock(value) {
  localStorage.setItem(LOCK_KEY, JSON.stringify(value));
}
export function setPanicState(value) {
  localStorage.setItem(PANIC_KEY, JSON.stringify(value));
}
export function getPrivateLock() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
  } catch {
    return null;
  }
}

export function generateRecoveryCode() {
  const group = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  return `CHR-${group()}-${group()}-${group()}`;
}
export async function createAccount(uid, pin, questionIndexes, answers) {
  const recoveryCode = generateRecoveryCode();
  const account = {
    version: 1,
    autoLock: true,
    panicShortcut: true,
    pin: await protectedValue(pin),
    questions: await Promise.all(
      questionIndexes.map(async (index, i) => ({ index, answer: await protectedValue(normalizeAnswer(answers[i])) })),
    ),
    recoveryCode: await protectedValue(recoveryCode),
    recoveryAcknowledged: false,
    createdAt: new Date().toISOString(),
  };
  saveAccount(uid, account);
  saveRecoveryState(uid, { failures: 0, lockedUntil: 0 });
  return { account, recoveryCode };
}
export async function verifyPin(account, pin) {
  return matches(pin, account?.pin);
}
export async function updatePin(uid, pin) {
  const account = loadAccount(uid);
  account.pin = await protectedValue(pin);
  saveAccount(uid, account);
  return account;
}
export async function updateQuestions(uid, indexes, answers) {
  const account = loadAccount(uid);
  account.questions = await Promise.all(
    indexes.map(async (index, i) => ({ index, answer: await protectedValue(normalizeAnswer(answers[i])) })),
  );
  saveAccount(uid, account);
  return account;
}
export async function regenerateRecoveryCode(uid) {
  const account = loadAccount(uid);
  const recoveryCode = generateRecoveryCode();
  account.recoveryCode = await protectedValue(recoveryCode);
  account.recoveryAcknowledged = false;
  saveAccount(uid, account);
  return recoveryCode;
}
export function acknowledgeRecoveryCode(uid) {
  const account = loadAccount(uid);
  if (account) {
    account.recoveryAcknowledged = true;
    saveAccount(uid, account);
  }
}
export async function verifyRecoveryCode(uid, code) {
  const account = loadAccount(uid);
  if (!(await matches(code.trim().toUpperCase(), account?.recoveryCode))) return false;
  const replacement = await regenerateRecoveryCode(uid);
  saveRecoveryState(uid, { failures: 0, lockedUntil: 0 });
  return replacement;
}
export async function verifyQuestions(uid, answers) {
  const state = loadRecoveryState(uid);
  if (state.lockedUntil > Date.now()) return { ok: false, lockedUntil: state.lockedUntil };
  const account = loadAccount(uid);
  const okay =
    account?.questions?.length === 2 &&
    (await Promise.all(account.questions.map((q, i) => matches(normalizeAnswer(answers[i] || ''), q.answer)))).every(
      Boolean,
    );
  if (okay) {
    saveRecoveryState(uid, { failures: 0, lockedUntil: 0 });
    return { ok: true };
  }
  const failures = (state.failures || 0) + 1;
  if (failures >= 2) {
    const lockedUntil = Date.now() + 15 * 60 * 1000;
    saveRecoveryState(uid, { failures, lockedUntil });
    return { ok: false, lockedUntil };
  }
  saveRecoveryState(uid, { failures, lockedUntil: 0 });
  return { ok: false, remaining: 1 };
}
export const isWeakFallback = (account) => account?.pin?.algorithm === 'weak-fallback';
