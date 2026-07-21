# Chrona — private timesheet PWA

Chrona is an installable, offline-first timesheet ledger. Track attendance, hours and notes in a calendar, review reports, and export records without a hosted backend.

## Local account and privacy

On first open, Chrona asks for a name, local username, and 4–6 digit PIN. This is a **device-only app lock** designed to prevent casual access on a shared device:

- The PIN is never stored in readable form. It is verified locally using a salted PBKDF2/SHA-256 verifier.
- Chrona locks when the app/browser leaves the foreground and requires the PIN to reopen it.
- There is no server account, email sign-in, cloud sync, or cross-device login. GitHub Pages can host the app because all information remains in the user’s browser.
- A person with browser developer tools or access to the browser profile can still access/delete local data. This is not full disk-level encryption.

Entries are stored in **IndexedDB** (`chrona-ledger`) rather than localStorage. Existing `timesheet_ledger_v1` entries are migrated automatically on first launch. Clearing site data or uninstalling the browser can erase both the account and ledger, so export backups regularly.

## Features

- Calendar statuses: Present, Leave, and Holiday; hours and optional notes
- Bulk marking and quick actions: mark today, copy the previous workday, and fill weekdays over a date range
- Dashboard summaries and daily/weekly/monthly hour breakdowns
- JSON backup export/import with validation and legacy backup support
- Excel-friendly CSV reports with properly escaped notes
- Print-ready time sheet—choose **Print / save as PDF** in the dashboard and select “Save as PDF” in your browser’s print dialog
- Offline PWA shell and install support

## Install / local test

PWAs require `http(s)`—do not open `index.html` using `file://`.

```bash
# from this folder
python3 -m http.server 8080
# visit http://localhost:8080
```

- **Android / Chrome / Edge:** browser menu → **Install app** or **Add to Home screen**.
- **iPhone / iPad Safari:** Share → **Add to Home Screen**.
- **Desktop Chrome / Edge:** select the install icon in the address bar.

## Deployment on GitHub Pages

Deploy the repository as a static GitHub Pages site. GitHub Pages serves HTTPS, which is required for the service worker, IndexedDB-backed PWA experience, and Web Crypto PIN verification. No environment variables, database, or backend setup are needed.

Whenever `index.html`, the manifest, or assets change, update the `CACHE` value in `sw.js` so installed copies fetch the new app shell.
