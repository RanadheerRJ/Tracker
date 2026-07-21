export const STORAGE_KEY = 'timesheet_ledger_v1'; // legacy localStorage key, migrated once
export const DB_NAME = 'chrona-ledger';
export const DB_VERSION = 2;
export const DATA_RECORD = 'ledger';
export const PENDING_RECORD = 'pendingSync';
export const PROFILE_RECORD = 'profile';

export const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function usernameFor(value = '') {
  return value.trim().toLowerCase();
}

export function emailFor(username) {
  return username + '@timesheetledger.app';
}

export function passwordFor(pin) {
  // Firebase passwords require six characters; the PIN itself remains 4–6 digits.
  return 'tlk_' + pin;
}

export function validPin(pin) {
  return /^\d{4,6}$/.test(pin) && !/^(\d)\1+$/.test(pin);
}

export function validUsername(username) {
  return /^[a-z0-9_.-]{3,24}$/.test(username);
}

export function validEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

export function keyFor(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

export function isoLocal(date) {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

export function escapeHtml(value) {
  return String(value || '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}
