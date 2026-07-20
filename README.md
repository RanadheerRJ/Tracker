# Timesheet Ledger — PWA

Your Timesheet Ledger is now an installable Progressive Web App. It works offline
and remembers everything you enter (data is stored in the browser's `localStorage`,
so it survives refreshes, app restarts, and being offline).

## What was added

| File | Purpose |
|------|---------|
| `index.html` | Now includes the manifest link, theme color, iOS home-screen meta tags, favicons, safe-area insets, and service-worker registration. |
| `manifest.json` | Tells the OS/browser how to install the app (name, icons, colors, standalone display). |
| `sw.js` | Service worker — caches the app shell + Google Fonts so it loads with no connection and qualifies for installation. |
| `icons/` | App icons (192/512 standard + maskable for Android, plus an Apple touch icon and favicons). |

## How to install / add to Home Screen

> PWAs must be served over **HTTPS** from a real server — they will **not** install if
> you just open `index.html` from the file system (`file://`). Deploy the folder to any
> static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, your own server, etc.).

- **Android (Chrome/Edge):** open the URL → menu (⋮) → **Add to Home screen** / **Install app**.
- **iPhone/iPad (Safari):** open the URL → Share → **Add to Home Screen**. (iOS uses the
  apple-touch-icon + apple meta tags rather than the manifest.)
- **Desktop (Chrome/Edge):** open the URL → click the **install** icon in the address bar,
  or use the menu → **Install Timesheet Ledger**.

## Quick local test

A service worker needs `http(s)`, so run a tiny local server instead of opening the file directly:

```bash
# from this folder
python3 -m http.server 8080
# then open http://localhost:8080  (Chrome's Install prompt appears in the address bar)
```

Use Chrome DevTools → **Application** tab to inspect the **Manifest**, **Service Workers**,
and **Storage** (localStorage) to confirm everything is registered.

## Where the data lives

All entries are saved in `localStorage` under the keys `timesheet_ledger_v1` (your days)
and `timesheet_ledger_user_name` (your name). Use the in-app **Export** button regularly to
keep a JSON backup, or **Import** to restore/move your records to another device.
