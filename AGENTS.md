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
- Locking now defensively normalizes pool/match data in functions: `functions/src/firestore-coercion.ts` accepts Firestore `Timestamp`, ISO strings, `Date`, and `{seconds,nanoseconds}` objects for `kickoffAt`, and `lockPick` falls back to legacy pool `tournamentId` if `seasonId` is absent. This prevents generic `internal` callable failures on legacy/mis-typed Firestore data.


## Firestore rules / indexes
- `firestore.rules` allows signed-in reads of missing prediction docs (`resource == null`) so client `getDoc()` checks can safely probe for absent predictions before first save.
- `firebase.json` points Firestore indexes to `firestore.indexes.json`.
- Existing composite index supports auto-lock query: `predictions(matchId, isComplete, isLocked)`.
- Milestone 6 query readiness relies on single-field indexes for `matchId`, `userId`, and `tournamentId`; add composites only when combining filters/order clauses.

## Universal scoring engine (M6)
- `functions/src/scoring-engine.ts` is the server-side scoring boundary:
  - `scoreFinalizedMatch()` reads universal `predictions`, writes per-prediction scoring fields, aggregates `user_tournament_stats`, and creates top-level tournament-scoped `scoring_runs/{tournamentId}__{matchId}` idempotency docs (while still recognizing legacy `scoring_runs/{matchId}` records).
  - `upsertLastLockedPredictionAt()` is reused by manual lock and kickoff auto-lock so `lastLockedPredictionAt` stays tied to real lock time, not save time.
  - `deriveMatchOutcome()` normalizes winner/margin from final scores for both the callable admin flow and Firestore-trigger fallback.
- `functions/src/index.ts` now supports both result-entry paths:
  - `finalizeMatch` callable lets the current pool creator UI mark a match final and score it immediately.
  - `onMatchWrite` still schedules kickoff auto-lock for scheduled matches, and now also scores any match written as `status == "final"`.
- Creator-facing admin result entry currently lives on `src/app/pools/[poolId]/round/[round]/page.tsx`; there is no separate admin role model yet, so follow-up work should tighten authorization before exposing broader admin tooling.
- `src/components/MatchCard.tsx` treats finalized matches as read-only and shows a final-score banner so the round UI remains stable after scoring.
- Playwright scoring coverage lives in `e2e/scoring.spec.ts`; it validates both creator-driven finalization and trigger idempotency.


## User attributes + denormalized leaderboard filters (M7)
- Canonical user attributes now live on `users/{userId}`: optional `countryCode`, legacy/back-compat `hemisphere`, and server-managed `isPundit`.
- Client profile editing lives at `src/app/profile/page.tsx` and writes through `src/lib/users.ts`; users now edit only `countryCode`, while auth-owned identity fields (`displayName`, `photoURL`, `email`) continue syncing from sign-in.
- Tournament grouping config now lives on `seasons/{tournamentId}` via `leaderboardConfig` flags plus optional `countryHemisphereOverrides` (for example Nations Championship uses `JP -> south`).
- Admin pundit management lives at `src/app/admin/pundits/page.tsx` and functions `setUserPunditStatus` + `backfillUserTournamentStatsProfiles`.
- Functions-side denormalization boundary:
  - `functions/src/tournament-user-attributes.ts` resolves tournament-specific leaderboard fields from tournament config + canonical user profile.
  - `functions/src/scoring-engine.ts` writes `displayName`, `photoURL`, `countryCode`, tournament-specific `resolvedHemisphere`, and `isPundit` into `user_tournament_stats` during scoring/rebuilds, and deletes legacy stats `hemisphere` during profile sync patches.
  - Firestore trigger `onUserProfileWrite` re-syncs those same tournament-specific fields onto existing `user_tournament_stats` docs whenever a user profile changes.
- Admin authorization for pundit tooling currently accepts Firebase custom claim `admin == true`, `ADMIN_UIDS`, or `ADMIN_EMAILS`; emulator fallback allows `playwright-test@example.com` when no env vars are set.
- Milestone 7 leaderboard/filter indexes on `user_tournament_stats` now cover `(tournamentId + ranking sort)`, plus filtered variants for `countryCode`, `resolvedHemisphere`, and `isPundit`.



## E2E testing notes
- Demo project: `demo-six-nations-predictor`.
- Emulator stack used in local validation: Auth `9099`, Firestore `8080`, Functions `5001`.
- Playwright/global setup seeds future-dated season `nations-championship-test`; use this season for autosave/lock tests because rules reject writes after kickoff.
- `e2e/helpers/firestore.ts` uses `functions/node_modules/firebase-admin` for admin reads/cleanup of protected `predictions` docs.
- When cleaning pools in tests, delete universal predictions with admin access; unauthenticated REST deletes are blocked by prediction security rules.
