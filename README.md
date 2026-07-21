# Chrona — cloud timesheet with a local privacy lock

**Live app:** [https://ranadheerrj.github.io/Tracker/](https://ranadheerrj.github.io/Tracker/)

Chrona is an offline-first, installable timesheet ledger. A username and cloud PIN sign a user into Firebase so the calendar follows them across devices. An optional **separate local app-lock PIN** protects an already signed-in Chrona session on a particular browser.

## Local development

Prerequisites: Node.js 22+ and npm.

```bash
git clone https://github.com/RanadheerRJ/Tracker.git
cd Tracker
npm install
cp .env.example .env
```

Fill `.env` with values from Firebase Console → Project settings → Your apps:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIREBASE_ADMIN_UID=...
```

`VITE_FIREBASE_ADMIN_UID` must match the hardcoded admin UID in `firestore.rules`.

Run the app locally:

```bash
npm run dev
```

Vite serves the app from `/public/index.html` in development and bundles the GitHub Pages-ready static site to `docs/` for production.

Useful checks:

```bash
npm run check:syntax
npm run check:admin-uid
npm run format:check
npm run lint
npm test
npm run build
npm run preview
```

## Project structure

```text
/public
  index.html       # markup shell only
  styles.css       # visual design moved out of the legacy inline style block
  manifest.json
  sw.js
  icons/
/src
  /auth            # registration, login, password reset, cloud PIN/email updates
  /ledger          # IndexedDB cache, Firestore sync, import/export, reports
  /calendar        # calendar grid, day modal, bulk edit, quick actions
  /settings        # profile/security UI glue
  /security        # browser-local PIN/recovery implementation
  /lib             # Firebase init and shared utilities
  main.js          # single app entry point
firebase-config.js # Vite env-backed Firebase config exports
firestore.rules
admin.html
```

## Firebase setup checklist

1. Enable **Email/Password** under Firebase Console → Authentication → Sign-in method.
2. Create Firestore in production mode, then publish [`firestore.rules`](firestore.rules). The lookup is intentionally public to resolve username login to the user’s real Firebase email. Do not broaden ledger permissions.
3. Copy `.env.example` to `.env` and fill in `VITE_FIREBASE_*` values.
4. Register your administrator account, copy its Firebase Auth UID, and put it in both `VITE_FIREBASE_ADMIN_UID` and `isAdmin()` in `firestore.rules`.
5. Run `npm run check:admin-uid` before deploying rules/app changes.
6. Publish rules again and use `/admin.html` while signed in as that UID.

## Firestore model

```text
ledgers/{uid}                 { username, name, email, data }
usernames/{lowercaseUsername} { uid, email }
```

`data` remains the existing calendar map, including optional notes. Owners and the single configured admin can read/write ledgers. The admin dashboard can edit data or delete the ledger and lookup. It intentionally leaves a dormant Firebase Auth account: deleting another Auth user securely requires an Admin SDK endpoint/Cloud Function and normally Firebase Blaze.

## Deployment

There is currently no `firebase.json` or `.firebaserc` in this repository. The documented live URL is GitHub Pages, so this repo now commits the static Vite build in `docs/` for branch-based GitHub Pages deployment.

Recommended verification flow before publishing a new build:

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run build
```

`npm run build` refreshes `docs/`. Commit and push the updated `docs/` folder with the source changes.

### GitHub Pages branch deployment

In GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**. Select the branch containing these changes, then select the `/docs` folder. GitHub Pages will serve the latest committed `docs/` build at the repository Pages URL.

A small root `index.html` redirects to `docs/` as a fallback if Pages is accidentally pointed at the repository root, but `/docs` is the intended Pages source.

If you decide to move hosting to Firebase Hosting later, initialize hosting once with `docs` as the public directory, keep `npm run build` before deploy, then use:

```bash
firebase deploy --only hosting,firestore:rules
```

## Rollback

- **Current GitHub Pages/static host:** redeploy a previously known-good commit or revert the bad commit and rerun the build/deploy job. If Pages is published from a branch, reset/revert that branch to the last good `dist/` output.
- **If migrated to Firebase Hosting later:** Firebase Console → Hosting → Release history → select a previous release → Roll back. The CLI can also deploy a rebuilt previous git tag/commit.
- Firestore rules rollback is separate from app hosting: redeploy the previous `firestore.rules` file if a rules change caused the incident.

## Security model and boundaries

- **Cloud account:** Firebase Email/Password Auth stores the cloud PIN password verifier; Chrona never stores a raw cloud PIN. New accounts use a real recovery email. Username login resolves through the username lookup document, so the lookup currently contains the account email—this is a deliberate privacy tradeoff chosen to preserve username + PIN login without a backend.
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

## Offline behavior

Each user has an IndexedDB cache plus a mirrored `localStorage` cache. Edits made offline are retained and synced to Firestore when the connection returns. Export JSON backups regularly. Clearing browser data erases the local app lock/cache but not successfully synced cloud data.

## Known limitations

- **Low-entropy cloud auth:** cloud login intentionally preserves the existing `passwordFor(pin) = 'tlk_' + pin` compatibility scheme. A 4–6 digit PIN is much lower entropy than a normal password. Future hardening options include requiring longer PINs/passphrases, adding Firebase App Check, or moving login/rate limiting behind a backend/Cloud Function.
- **Username lookup privacy tradeoff:** `usernames/{username}` is readable so unauthenticated username + PIN login can resolve the Firebase Auth email. That exposes recovery/auth emails in lookup documents. A tighter design would use a Cloud Function that accepts a username and returns only what the client needs while keeping email server-side.
- **Admin UID manual sync:** the admin UID is duplicated in `VITE_FIREBASE_ADMIN_UID` and `firestore.rules`. `npm run check:admin-uid` catches local `.env` mismatches, but a future server-side custom-claims approach would remove this manual sync point.
