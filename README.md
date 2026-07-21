# Chrona — cloud timesheet with a local privacy lock

**Live app:** [https://ranadheerrj.github.io/Tracker/](https://ranadheerrj.github.io/Tracker/)

Chrona is an offline-first, installable timesheet ledger. A username and cloud PIN sign a user into Firebase so the calendar follows them across devices. An optional **separate local app-lock PIN** protects an already signed-in Chrona session on a particular browser.

## Security model and boundaries

- **Cloud account:** Firebase Email/Password Auth stores the cloud PIN password verifier; Chrona never stores a raw cloud PIN. New accounts use a real recovery email. Username login privately resolves through the public username lookup document, so the lookup necessarily contains the account email—this is a deliberate privacy tradeoff chosen to preserve username + PIN login without a backend.
- **Local app lock:** uses a random 16-byte salt and PBKDF2-SHA-256 with 120,000 iterations via Web Crypto. It is browser-local and separate from the cloud PIN. In old webviews without `SubtleCrypto`, Chrona uses a clearly flagged weak compatibility fallback.
- **Not encryption:** the local app lock prevents casual same-device access only. It does not encrypt IndexedDB/localStorage records, defeat browser developer tools, or recover/replace a Firebase account on another device.
- **No raw secrets:** local PINs, security-question answers, and recovery codes are stored only as verifiers. Recovery codes are shown once.

Existing cloud users continue to log in normally. They are not reset or signed out. They can add a real recovery email from Settings to enable cloud “Forgot PIN”; legacy synthetic-address accounts otherwise continue to work but cannot receive Firebase reset mail.

## Local security features

After signing in, use **Settings** to set up the optional browser-local app lock:

- a separate 4–6 digit local PIN;
- two security questions, normalized then verifier-hashed;
- a one-time `CHR-XXXX-XXXX-XXXX` recovery code, acknowledged before closing;
- automatic locking on background/visibility change (enabled by default for newly configured locks);
- a deliberate panic/lock action plus `Ctrl/⌘ + Shift + L`.

Wrong answers to security questions give one remaining-attempt warning, then lock that path for 15 minutes. Recovery-code use remains available while questions are locked, invalidates the code, and produces a replacement code. The app keeps the stable browser keys `chrona-account-v1:<uid>`, `chrona-account-recovery-state-v1:<uid>`, `chrona-private-lock-v1`, and `chrona-panic-v1`; releases and service-worker cache changes never delete them.

## Firebase setup checklist

1. Enable **Email/Password** under Firebase Console → Authentication → Sign-in method.
2. Create Firestore in production mode, then publish [`firestore.rules`](firestore.rules). The lookup is intentionally public to resolve username login to the user’s real Firebase email. Do not broaden ledger permissions.
3. Confirm the web config in [`firebase-config.js`](firebase-config.js).
4. Register your administrator account, copy its Firebase Auth UID, and put it in both `ADMIN_UID` in `firebase-config.js` and `isAdmin()` in `firestore.rules`.
5. Publish rules again and use `/admin.html` while signed in as that UID.

## Firestore model

```
ledgers/{uid}                 { username, name, email, data }
usernames/{lowercaseUsername} { uid, email }
```

`data` remains the existing calendar map, including optional notes. Owners and the single configured admin can read/write ledgers. The admin dashboard can edit data or delete the ledger and lookup. It intentionally leaves a dormant Firebase Auth account: deleting another Auth user securely requires an Admin SDK endpoint/Cloud Function and normally Firebase Blaze.

## Offline behavior

Each user has an IndexedDB cache plus a mirrored `localStorage` cache. Edits made offline are retained and synced to Firestore when the connection returns. Export JSON backups regularly. Clearing browser data erases the local app lock/cache but not successfully synced cloud data.

## Local test / deployment

```bash
python3 -m http.server 8080
```

Serve from HTTP(S), not `file://`. GitHub Pages HTTPS works for Firebase and PWA features. The service worker only clears stale asset caches; it never accesses user storage.
