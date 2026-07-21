import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';

import { ADMIN_UID, createFirebaseServices } from './lib/firebase.js';

const { auth, firestore } = createFirebaseServices();
let selected = null;
let users = [];
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value || '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
function setError(message = '') {
  $('editorError').textContent = message;
}
function showDashboard() {
  $('loadingGate').hidden = true;
  $('deniedGate').hidden = true;
  $('dashboard').hidden = false;
}
function entryRow(key = '', entry = { status: 'present', hours: 8, note: '' }) {
  const row = document.createElement('div');
  row.className = 'entry';
  row.innerHTML = `<input class="entry-date" type="date" value="${esc(key)}"><select class="entry-status"><option value="present">Present</option><option value="leave">Leave</option><option value="holiday">Holiday</option></select><input class="entry-hours" type="number" min="0" max="24" step="0.5" value="${Number(entry.hours ?? 0)}"><input class="entry-note" maxlength="500" placeholder="Optional note" value="${esc(entry.note)}"><button class="mini remove-entry" title="Remove entry">Remove</button>`;
  row.querySelector('.entry-status').value = entry.status || 'present';
  row.querySelector('.remove-entry').onclick = () => row.remove();
  return row;
}
async function listUsers() {
  $('userList').innerHTML = '';
  $('userCount').textContent = 'Loading users…';
  try {
    const snapshots = await getDocs(collection(firestore, 'usernames'));
    users = (
      await Promise.all(
        snapshots.docs.map(async (item) => {
          const uid = item.data().uid;
          const ledger = await getDoc(doc(firestore, 'ledgers', uid));
          return { uid, username: item.id, ledger: ledger.exists() ? ledger.data() : null };
        }),
      )
    ).sort((a, b) => a.username.localeCompare(b.username));
    $('userCount').textContent = `${users.length} registered ${users.length === 1 ? 'user' : 'users'}`;
    users.forEach((user) => {
      const button = document.createElement('button');
      button.className = 'user' + (selected?.uid === user.uid ? ' active' : '');
      button.innerHTML = `<strong>${esc(user.username)}</strong><small>${esc(user.ledger?.name || 'No ledger document')}</small>`;
      button.onclick = () => openUser(user);
      $('userList').appendChild(button);
    });
  } catch (error) {
    $('userCount').textContent = 'Could not load users.';
    console.error(error);
  }
}
function openUser(user) {
  selected = { ...user, ledger: user.ledger || { username: user.username, name: '', data: {} } };
  $('editorEmpty').hidden = true;
  $('editor').hidden = false;
  $('editorTitle').textContent = '@' + user.username;
  $('editName').value = selected.ledger.name || '';
  $('editUsername').value = user.username;
  const entries = $('entries');
  entries.innerHTML = '';
  Object.entries(selected.ledger.data || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => entries.appendChild(entryRow(key, value)));
  $('entryCount').textContent = `${entries.children.length} entries`;
  setError();
}
$('addEntryBtn').onclick = () => {
  $('entries').appendChild(entryRow());
  $('entryCount').textContent = `${$('entries').children.length} entries`;
};
$('saveUserBtn').onclick = async () => {
  if (!selected) return;
  setError();
  const name = $('editName').value.trim();
  const data = {};
  const seen = new Set();
  for (const row of $('entries').children) {
    const key = row.querySelector('.entry-date').value;
    const status = row.querySelector('.entry-status').value;
    const hours = Number(row.querySelector('.entry-hours').value);
    const note = row.querySelector('.entry-note').value.trim();
    if (!key) return setError('Every entry needs a date.');
    if (seen.has(key)) return setError('Each date can appear only once.');
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) return setError('Hours must be between 0 and 24.');
    seen.add(key);
    data[key] = { status, hours: status === 'holiday' ? 0 : hours };
    if (note) data[key].note = note;
  }
  try {
    await setDoc(doc(firestore, 'ledgers', selected.uid), { username: selected.username, name, data });
    selected.ledger = { username: selected.username, name, data };
    $('entryCount').textContent = `${Object.keys(data).length} entries saved`;
    await listUsers();
  } catch (error) {
    setError('Could not save this ledger. Check the admin rules and try again.');
    console.error(error);
  }
};
$('deleteUserBtn').onclick = async () => {
  if (!selected || !confirm(`Delete Firestore data for @${selected.username}? This cannot be undone.`)) return;
  setError();
  try {
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'ledgers', selected.uid));
    batch.delete(doc(firestore, 'usernames', selected.username));
    await batch.commit();
    selected = null;
    $('editor').hidden = true;
    $('editorEmpty').hidden = false;
    await listUsers();
  } catch (error) {
    setError('Could not delete this user data.');
    console.error(error);
  }
};
$('refreshBtn').onclick = listUsers;
onAuthStateChanged(auth, (user) => {
  if (!user || ADMIN_UID === 'PASTE_MY_UID_HERE' || user.uid !== ADMIN_UID) {
    $('loadingGate').hidden = true;
    $('deniedGate').hidden = false;
    return;
  }
  showDashboard();
  listUsers();
});
