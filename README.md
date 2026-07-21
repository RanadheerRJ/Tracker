# Chrona — cloud-synced timesheet PWA 

Chrona is an offline-first, installable timesheet calendar. Users sign in with a username and PIN, then their calendar, hours, and notes follow them across devices through Firebase Authentication and Cloud Firestore.

## Features

- Present, Leave, and Holiday calendar statuses with hours and optional notes
- Bulk updates; quick actions to mark today, copy a prior workday, or fill weekdays in a range
- Dashboard summaries and daily/weekly/monthly reports
- JSON backups, Excel-friendly CSV exports (including notes), and print/save-as-PDF timesheets
- A local IndexedDB cache for offline read/write use; local edits sync automatically when a connection returns
- A separate, UID-gated `admin.html` dashboard for the one configured administrator

## Firebase setup checklist

1. **Create/select the project.** The supplied configuration in [`firebase-config.js`](firebase-config.js) currently targets `rare-inventory`. If you use a different Firebase project, replace the values in that *one file* with the Web app configuration from **Project settings → Your apps**. Never add server secrets to this static app.
2. **Enable email/password auth.** In **Firebase console → Authentication → Sign-in method**, enable **Email/Password**. Chrona maps each lowercase username to `username@timesheetledger.app`; that address is an internal identifier, not a deliverable email address. PINs are sent to Firebase as the password with an internal `tlk_` prefix so Firebase's six-character minimum is met.
3. **Create Firestore.** In **Firestore Database**, create a database in production mode. Deploy the contents of [`firestore.rules`](firestore.rules) in the Rules tab. Do **not** use test mode in production.
4. **Register the developer account first.** Deploy the site, use its normal **Create account** screen, then open **Firebase console → Authentication → Users** and copy that user's UID.
5. **Set the sole administrator.** Replace `PASTE_MY_UID_HERE` in both [`firebase-config.js`](firebase-config.js) (`ADMIN_UID`) and [`firestore.rules`](firestore.rules) (`isAdmin`). They must be identical. Publish the rules, redeploy the static site, sign in as that account, and visit `/admin.html` (for example, `https://<owner>.github.io/<repo>/admin.html`).
6. **Deploy to GitHub Pages.** GitHub Pages HTTPS is required for PWA features and is suitable for Firebase. No application server or database hosting is required beyond Firebase.

## Firestore model

```
ledgers/{uid}                 { username, name, data }
usernames/{lowercaseUsername} { uid }
```

`data` retains Chrona's calendar shape, such as:

```json
{
  "2026-07-20": { "status": "present", "hours": 8, "note": "Client workshop" }
}
```

The username lookup lets the admin dashboard enumerate users. Firestore rules make each ledger readable/writable only by its owner or the configured `ADMIN_UID`; the client-side UID check on `admin.html` is only a UI gate, not the security boundary.

## Admin deletion policy

`admin.html` can edit any ledger and delete a user's `ledgers/{uid}` and `usernames/{username}` documents. It intentionally **does not delete the Firebase Authentication account**: a static GitHub Pages client cannot securely use Firebase's privileged Admin SDK to delete another user. The result is a dormant Auth account that cannot recreate its username lookup without intervention.

This choice requires no Cloud Function and remains compatible with Firebase's Spark plan. If complete Auth-account deletion is needed later, add a protected Cloud Function/Admin SDK endpoint; deploying that normally requires the Blaze pay-as-you-go plan.

## Offline and backups

The browser keeps a per-user IndexedDB cache and a mirrored `localStorage` cache for offline use. Cloud sync is opportunistic: local edits are retained and uploaded when the device reconnects. Export JSON regularly as a portable backup. Clearing browser/site data removes the local cache but not a successfully synced cloud ledger.

## Local development

PWAs and Firebase modules must run from HTTP(S), not `file://`:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

When changing app shell files, bump the cache name in `sw.js` so installed PWA copies receive the update.
