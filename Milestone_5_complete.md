# Milestone 5 Complete — Universal Predictions Collection

## Summary
Milestone 5 is complete. The app now stores predictions in a universal top-level Firestore collection and preserves current round-page behavior through a minimal compatibility layer.

This milestone establishes the data foundation for Milestone 6 universal scoring.

## What was delivered

### 1. Universal predictions collection
Canonical prediction documents now live at:

- `predictions/{userId}_{matchId}`

Each prediction stores explicit queryable fields and does not rely on parsing the document ID:

- `userId`
- `matchId`
- `tournamentId`
- `winner`
- `margin`
- `isComplete`
- `isLocked`
- `lockedAt`
- `createdAt`
- `updatedAt`
- `kickoffAt`

### 2. Autosave migrated to predictions
Client autosave now writes to `predictions` as the primary pick record.

Current UX remains the same:
- winner + margin validation still applies
- autosave stays debounced
- saved/pick-complete feedback remains intact
- existing picks still reload into the match cards

### 3. Compatibility layer retained
Legacy pool-scoped docs were not hard deleted.

The app still mirrors:
- `pools/{poolId}/picks_status/{matchId_userId}`
- `pools/{poolId}/picks_detail/{matchId_userId}`

This keeps the current UI stable while universal predictions become the canonical source.

### 4. Locking migrated safely
Lock state now lives canonically on predictions:
- `isLocked`
- `lockedAt`

Both manual locking and kickoff auto-lock continue to work.

Compatibility behavior preserved:
- universal predictions are locked first-class
- compatibility status docs receive mirrored `lockedAt`
- `lockedAt` is preserved for future tiebreakers

### 5. Status-dot behavior preserved
Round-page status dots and member status lists still work.

For now they continue to read from pool `picks_status` as a compatibility boundary, while prediction reads/writes are already universal.

### 6. Firestore rules and index readiness
Prediction rules now support the universal model and safely allow signed-in reads of missing prediction docs for first-save existence checks.

Added/configured:
- `firebase.json` → Firestore indexes file wired in
- `firestore.indexes.json`

Composite index currently required:
- `predictions(matchId ASC, isComplete ASC, isLocked ASC)`

Milestone 6 query readiness is in place for:
- all predictions for a given match
- all predictions for a given user
- all predictions for a given tournament

## Validation completed

### Build
- `cd functions && npm run build` ✅

### Focused end-to-end validation
Verified with Playwright + Firebase emulators:
- autosave writes the universal prediction document ✅
- auto-lock writes `lockedAt` to both universal predictions and compatibility status docs ✅

## Migration behavior
This was implemented as a safe migration, not a destructive rewrite.

### Canonical source now
- `predictions` is now the canonical per-user/per-match prediction store

### Still retained temporarily
- `picks_status`
- `picks_detail`

### Why they remain
They still support:
- current round status subscriptions
- existing status-dot/member-status UI
- a low-risk transition into universal scoring

## Milestone 6 handoff
Milestone 6 should build scoring from:

### Input
- `predictions`

### Output
- `user_tournament_stats/{tournamentId_userId}`

### Important constraint
Do not reintroduce pool-specific scoring. Pools affect ranking context only, not the points a user earns.

### Recommended Milestone 6 focus
1. Pure scoring logic from `docs/SCORING.md`
2. Match-finalization scoring function over universal predictions
3. Idempotent writes to prediction scoring fields
4. Aggregate writes to `user_tournament_stats`
5. `lastLockedPredictionAt` support derived from prediction locking behavior
6. Leave compatibility pick docs in place until scoring and visibility work are proven stable

## Notes
- Existing app terminology still uses `seasonId` in some pool/match flows; Milestone 5 maps this into prediction `tournamentId` without changing the wider app structure.
- A later cleanup milestone can remove the compatibility layer once status/visibility/scoring fully run from universal prediction data.
