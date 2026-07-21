# Deployment stats

> Reminder: manually refresh this file after each deploy, or wire it into CI later if automated stats are desired.

## How to refresh these stats

Do not estimate or invent the values below. Refresh them from the live Firebase project before replacing any placeholders.

1. Confirm the Firebase project ID:

   ```bash
   firebase projects:list
   ```

   Use the project that matches `VITE_FIREBASE_PROJECT_ID` in the deployment environment.

2. Open Firebase Console for that project.
3. Go to **Usage and billing** to confirm the current pricing tier (**Spark** or **Blaze**) and billing summary.
4. Go to **Authentication** → **Users** and record the current Auth user count.
5. Go to **Firestore Database** → **Usage** and record current reads, writes, deletes, and stored data size for the relevant time range.
6. If Firebase Hosting is used, go to **Hosting** → **Usage** and record hosting bandwidth and storage. If the app is deployed to GitHub Pages or another static host instead, record the equivalent bandwidth/storage metrics from that host and note the provider in the table.
7. Use Firebase pricing documentation and the visible usage/billing page to calculate the estimated monthly cost at current usage. Leave notes for any free-tier assumptions.

## Current deployment metrics

| Metric                                  | Current value                                                             | Source / notes                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Firebase project ID                     | <!-- fill in after checking Firebase Console -->                          | `firebase projects:list` / `.env` deployment value                                         |
| Firebase pricing tier (Spark/Blaze)     | <!-- fill in after checking Firebase Console -->                          | Firebase Console → Usage and billing                                                       |
| Auth user count                         | <!-- fill in after checking Firebase Console -->                          | Firebase Console → Authentication → Users                                                  |
| Firestore reads                         | <!-- fill in after checking Firebase Console -->                          | Firebase Console → Firestore Database → Usage                                              |
| Firestore writes                        | <!-- fill in after checking Firebase Console -->                          | Firebase Console → Firestore Database → Usage                                              |
| Firestore deletes                       | <!-- fill in after checking Firebase Console -->                          | Firebase Console → Firestore Database → Usage                                              |
| Firestore storage                       | <!-- fill in after checking Firebase Console -->                          | Firebase Console → Firestore Database → Usage                                              |
| Hosting provider                        | <!-- fill in after checking hosting configuration -->                     | Current repo has no `firebase.json`; live README URL points to GitHub Pages unless changed |
| Hosting bandwidth                       | <!-- fill in after checking Firebase Console or static host dashboard --> | Firebase Console → Hosting → Usage, or equivalent static-host metric                       |
| Hosting storage                         | <!-- fill in after checking Firebase Console or static host dashboard --> | Firebase Console → Hosting → Usage, or equivalent static-host metric                       |
| Estimated monthly cost at current usage | <!-- fill in after checking Firebase Console -->                          | Use Firebase/host billing pages; do not estimate without source data                       |

## Cost notes

- <!-- fill in after checking Firebase Console -->
