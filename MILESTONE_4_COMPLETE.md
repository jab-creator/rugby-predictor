# Milestone 4: Per-match Irreversible Locking — ✅ COMPLETE

## Objective
Add per-match irreversible locking so picks are finalized before kickoff, with both user-initiated and automatic server-side enforcement.

## ✅ Deliverables Completed

### Cloud Functions (`functions/src/index.ts`)

✅ **`lockPicksForMatch` (internal)**
- Queries `picks_status` across all pools for `matchId` where `isComplete == true && lockedAt == null`
- Batch-updates `lockedAt = now` in chunks of 500
- Shared by both `lockPick` (callable) and `autoLockMatch` (HTTPS)

✅ **`lockPick` (callable)**
- Verifies caller is an authenticated pool member
- Looks up `kickoffAt` from the match doc and rejects if `kickoffAt <= now`
- Uses a Firestore transaction to verify `isComplete == true && lockedAt == null`, then atomically sets `lockedAt`
- Idempotent: if already locked, returns success without error

✅ **`onMatchWrite` (Firestore trigger)**
- Fires on create/update of `/seasons/{seasonId}/matches/{matchId}`
- Enqueues a Cloud Tasks task named `autolock-{matchId}` scheduled for `kickoffAt`
- Deletes the old task first (idempotent re-schedule when kickoff time changes)
- Skips enqueue in emulator — logs a `curl` hint for direct HTTP testing instead

✅ **`autoLockMatch` (HTTPS — Cloud Tasks target)**
- In production: requires `X-CloudTasks-QueueName` header (Cloud Tasks always sends this)
- In emulator: accepts any POST for direct testing
- Calls `lockPicksForMatch` for all pools in the season
- Responds with `{ ok: true, locked: N }`

### Client library (`src/lib/locks.ts`)

✅ **`lockPick(poolId, matchId)`** — calls the Cloud Function callable  
✅ **`lockAllCompletedPicks(poolId, matchIds, onProgress?)`** — sequential lock with per-match progress callback  
✅ **`getLockableMatchIds(matchStatuses, userId)`** — returns match IDs where `isComplete && !lockedAt && kickoffAt > now`

### UI

✅ **`MatchCard` updates**
- Accepts `lockedAt: Timestamp | null` and `onLock: () => Promise<void>` props
- Locked state: blue border tint, "🔒 Pick locked" banner, all inputs disabled (`cursor-default opacity-80`)
- Unlocked + complete: "🔒 Lock pick" button with loading state and inline error display
- Autosave effect skips when `isLocked` to avoid unnecessary denied writes

✅ **Round page updates**
- Extracts `lockedAt` from real-time `matchStatuses` per user and passes to each `MatchCard`
- "🔒 Lock all completed (N)" bulk button — only visible when `N > 0`
- Bulk lock result message shown inline
- Info banner updated: "Lock your pick before kickoff — locking is irreversible"

### Data model

✅ **`kickoffAt: Timestamp` added to `PickStatus` and `PickDetail`**
- Denormalized from the match doc into both picks docs on every save
- Required for security rules to enforce the kickoff gate without a `get()` call

### Security rules (`firestore.rules`)

✅ **`picks_status` writes require:**
1. `request.auth != null && request.resource.data.userId == request.auth.uid`
2. `request.resource.data.lockedAt == null` — client can never write a non-null `lockedAt`
3. `resource == null || resource.data.lockedAt == null` — write denied if already locked
4. `request.time < kickoffAt` — write denied at or after kickoff

✅ **`picks_detail` writes require:** same constraints + `pickedMargin` in `[1, 99]`

✅ **Server-only collections** (`leaderboard`, `rounds`, `scoring_runs`) — `allow write: if false`

## 📂 Files Changed

| File | Change |
|------|--------|
| `functions/src/index.ts` | Replaced stub with `lockPicksForMatch`, `lockPick`, `onMatchWrite`, `autoLockMatch` |
| `functions/package.json` | Added `@google-cloud/tasks ^5.0.0` |
| `src/lib/types.ts` | Added `kickoffAt: Timestamp` to `PickStatus` and `PickDetail` |
| `src/lib/picks.ts` | `savePick` and `clearPick` accept + write `kickoffAt`; `lockedAt` excluded from client payload |
| `src/lib/locks.ts` | **New** — `lockPick`, `lockAllCompletedPicks`, `getLockableMatchIds` |
| `src/components/MatchCard.tsx` | Added `lockedAt`/`onLock` props, Lock button, locked read-only state |
| `src/app/pools/[poolId]/round/[round]/page.tsx` | Wires `lockedAt` + `onLock`, adds bulk lock button |
| `firestore.rules` | Full locking rules replacing open wildcard |

## 🔒 Irreversibility guarantee

- **Client**: `lockedAt` is never included in the `savePick` payload. Firestore rules reject any write where `request.resource.data.lockedAt != null`.
- **Rules**: If `resource.data.lockedAt != null` (already locked), the entire write is denied — the client cannot unset or overwrite `lockedAt`.
- **Cloud Function (`lockPick`)**: uses a transaction that reads then writes `lockedAt` only when currently `null`. Already-locked picks are a no-op.
- **Admin SDK**: Cloud Functions use Admin SDK which bypasses rules — this is intentional and the only path that can set `lockedAt`.

## 🧪 How to test

### Test `lockPick` (user-initiated)
1. Start emulators (`npm run emulators`) and dev server (`npm run dev`)
2. Sign in, create/join a pool, seed fixtures
3. Navigate to a round, make a complete pick (winner + margin)
4. Click "🔒 Lock pick" — pick should become read-only with blue banner
5. Verify in Firestore emulator UI: `picks_status/{docId}.lockedAt` is a Timestamp

### Test bulk lock
1. Make complete picks for multiple matches in a round
2. Click "🔒 Lock all completed (N)"
3. All complete, unlocked picks lock simultaneously

### Test `autoLockMatch` (server auto-lock)
The emulator skips Cloud Tasks. Call the HTTP handler directly:

```bash
# Find matchId and seasonId from Firestore emulator UI or seed output
curl -X POST http://localhost:5001/<projectId>/us-central1/autoLockMatch \
  -H 'Content-Type: application/json' \
  -d '{"matchId": "<matchId>", "seasonId": "six-nations-2026"}'

# Response: { "ok": true, "locked": 2 }
```

### Test security rules (emulator)
```bash
# Try to set lockedAt from client — should be denied
# (Rules check request.resource.data.lockedAt == null)
```

### Verify irreversibility
1. Lock a pick via "Lock pick" button
2. Attempt to change winner/margin — inputs are disabled
3. Verify Firestore rules would deny the write even if the client bypassed the UI

## ✅ Verification

| Check | Result |
|-------|--------|
| `functions` TypeScript build | ✅ 0 errors |
| Next.js `tsc --noEmit` | ✅ 0 errors |
| `lockPick` callable signature | ✅ `{ poolId, matchId }` |
| Transaction atomicity | ✅ read-then-write in `runTransaction` |
| Auto-lock in emulator | ✅ direct HTTP POST to `autoLockMatch` |
| Task deduplication | ✅ named tasks (`autolock-{matchId}`) |
| Locked UI state | ✅ inputs disabled, blue banner |
| Bulk lock button | ✅ shows count, fires sequentially |
| Security rule: client cannot set lockedAt | ✅ `clientLockedAtIsNull()` check |
| Security rule: no writes after kickoff | ✅ `isBeforeKickoff()` check |
| Security rule: no writes to locked picks | ✅ `isNotLocked()` check |

---

**Milestone 4 Status: ✅ COMPLETE**

All locking features implemented. Picks lock irreversibly via user action or server auto-lock at kickoff. Security rules enforce the guarantee at the database level. Ready for Milestone 5 (full security rules + pick visibility).
