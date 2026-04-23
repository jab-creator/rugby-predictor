# Repository Memory

## Universal predictions migration (M5)
- Universal predictions live in top-level `predictions/{userId}_{matchId}`.
- Prediction writes store explicit fields: `userId`, `matchId`, `tournamentId`, `winner`, `margin`, `kickoffAt`, `isComplete`, `isLocked`, `lockedAt`, `createdAt`, `updatedAt`.
- Current UI still relies on pool-scoped `picks_status` / `picks_detail` as a compatibility layer for round-page status dots and member status lists.
- `src/lib/picks.ts` is the main client compatibility boundary:
  - writes universal predictions first-class
  - mirrors legacy pool docs on save/clear
  - reads user picks from predictions first, legacy detail second
  - reads/subscribes status dots from legacy `picks_status`
- Functions lock flow is the server compatibility boundary:
  - `lockPick` locks the universal prediction and mirrors `lockedAt` to legacy `picks_status`
  - `autoLockMatch` / `lockPicksForMatch` lock universal predictions and mirror `lockedAt` to legacy status docs via `collectionGroup('picks_status')`

## Firestore rules / indexes
- `firestore.rules` allows signed-in reads of missing prediction docs (`resource == null`) so client `getDoc()` checks can safely probe for absent predictions before first save.
- `firebase.json` points Firestore indexes to `firestore.indexes.json`.
- Existing composite index supports auto-lock query: `predictions(matchId, isComplete, isLocked)`.
- Milestone 6 query readiness relies on single-field indexes for `matchId`, `userId`, and `tournamentId`; add composites only when combining filters/order clauses.

## E2E testing notes
- Demo project: `demo-six-nations-predictor`.
- Emulator stack used in local validation: Auth `9099`, Firestore `8080`, Functions `5001`.
- Playwright/global setup seeds future-dated season `nations-championship-test`; use this season for autosave/lock tests because rules reject writes after kickoff.
- `e2e/helpers/firestore.ts` uses `functions/node_modules/firebase-admin` for admin reads/cleanup of protected `predictions` docs.
- When cleaning pools in tests, delete universal predictions with admin access; unauthenticated REST deletes are blocked by prediction security rules.
