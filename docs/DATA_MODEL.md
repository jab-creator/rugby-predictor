# Firestore Data Model

## Core Principle: Single Source of Truth for Scoring

**Each user has ONE score per tournament, stored in `user_tournament_stats`**

- Scores are **NOT different per pool**
- Pools/leaderboards only change **who you are compared against**, not your points
- Scoring engine updates `user_tournament_stats`, then propagates to all leaderboards

## Architecture Overview

### 1. Global Collections (Shared)
- `tournaments/{tournamentId}` - Tournament metadata
- `tournaments/{tournamentId}/matches/{matchId}` - Match fixtures
- `users/{userId}` - User profiles with attributes
- `predictions/{userId_matchId}` - User predictions (universal across all contexts)
- `user_tournament_stats/{tournamentId_userId}` - **SINGLE SOURCE OF TRUTH** for user's score

> **Scaling note on `predictions`:** The top-level `predictions` collection works but may
> become operationally awkward at scale since most access is tournament-bound. If needed,
> consider migrating to `tournaments/{tournamentId}/predictions/{userId_matchId}` or
> `users/{userId}/predictions/{matchId}` with a scoring projection. The current model is
> valid for MVP — revisit if query patterns become painful.

### 2. Leaderboards (Precomputed, Dynamic)
- `leaderboards/{leaderboardId}` - Metadata + summary stats for cross-group comparison
- `leaderboards/{leaderboardId}/entries/{userId}` - Precomputed leaderboard entries

Leaderboard IDs are **tournament-scoped** using double-underscore separator:
- `six-nations-2026__global` - all users
- `six-nations-2026__country_CA`, `six-nations-2026__country_GB`, etc. - per country
- `six-nations-2026__hemisphere_north`, `six-nations-2026__hemisphere_south` - per hemisphere
- `six-nations-2026__pundits` - isPundit users only
- `six-nations-2026__fans` - !isPundit users only

**Why tournament-scoped IDs?** Without the tournament prefix, IDs like `global` or
`hemisphere_north` would collide across tournaments. The `{tournamentId}__{type}` pattern
avoids needing a subcollection under tournaments while keeping IDs globally unique.

### 3. Manual Pools (Stored Membership)
- `pools/{poolId}` - Pool metadata
- `pools/{poolId}/members/{userId}` - Pool membership
- `pools/{poolId}/entries/{userId}` - Precomputed pool leaderboard entries

### 4. Knockout Stages
- `knockout_brackets/{bracketId}` - Bracket metadata
- `knockout_brackets/{bracketId}/participants/{userId}` - Qualified users (snapshot)
- `knockout_brackets/{bracketId}/matches/{matchId}` - Bracket-specific match tracking

---

## Detailed Schema

## Global Collections

### `users/{userId}`
User profile with attributes for dynamic pool calculation.

```typescript
{
  uid: string;               // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  
  // Dynamic pool attributes
  countryCode?: string;      // ISO 3166-1 alpha-2 (e.g., "CA", "GB", "NZ")
  hemisphere?: "north" | "south";
  isPundit: boolean;         // default false
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Security:** User can read/write own doc only.

### `tournaments/{tournamentId}`
Tournament metadata.

```typescript
{
  id: string;                // e.g., "six-nations-2026"
  name: string;              // e.g., "Six Nations 2026"
  startsAt: Timestamp;
  endsAt: Timestamp;
  status: "scheduled" | "active" | "completed";
  createdAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: admin only.

### `tournaments/{tournamentId}/matches/{matchId}`
Match fixture.

```typescript
{
  id: string;
  tournamentId: string;
  round: number;             // e.g., 1..5 for Six Nations
  kickoffAt: Timestamp;      // UTC
  homeTeamId: string;
  awayTeamId: string;
  status: "scheduled" | "live" | "final";
  
  // Set when status == "final"
  homeScore?: number;
  awayScore?: number;
  actualWinner?: string;     // teamId (or null if draw)
  actualMargin?: number;     // abs(homeScore - awayScore)
  
  updatedAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: admin only.

### `predictions/{userId_matchId}`
User's prediction for a match. **Universal across all contexts.**

```typescript
{
  id: string;                // composite: "{userId}_{matchId}"
  userId: string;
  tournamentId: string;
  matchId: string;
  
  // Prediction
  pickedWinnerTeamId?: string;
  pickedMargin?: number;     // 1-99
  
  // Status
  isComplete: boolean;       // both winner and margin set
  lockedAt?: Timestamp;      // irreversible
  
  // Scoring (set after match finalized)
  winnerCorrect?: boolean;
  err?: number;              // abs(pickedMargin - actualMargin)
  marginBonus?: number;      // points from margin accuracy
  totalPoints?: number;      // 10 (winner) + marginBonus, or 0 if wrong winner
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Security:**
- Read: self always; after kickoff: all authenticated
- Write: self only, before kickoff, cannot set `lockedAt` (Cloud Function only)

### `user_tournament_stats/{tournamentId_userId}`
**SINGLE SOURCE OF TRUTH for user's score in a tournament.**

```typescript
{
  id: string;                // composite: "{tournamentId}_{userId}"
  userId: string;
  tournamentId: string;
  
  // Aggregate scoring
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;  // cumulative err across correct-winner predictions only
  exactScores: number;             // count of predictions where err == 0 AND winnerCorrect
  
  // Rebuild safety — enables safe re-scoring and partial-run detection
  scoredMatchCount: number;        // how many matches have been scored for this user
  lastScoredMatchId?: string;      // last match that updated this doc
  pointsByRound?: {                // map of round number → points earned that round
    [round: string]: number;       // e.g., { "1": 37, "2": 45, "3": 0 }
  };
  
  // Tiebreaker — timestamp of the user's most recent prediction that was
  // locked (either manually or auto-locked at kickoff). Deterministic: only
  // set/updated when a prediction transitions to locked state.
  lastLockedPredictionAt?: Timestamp;
  
  updatedAt: Timestamp;
}
```

**`sumErrOnCorrectWinners`:** Only incremented when `winnerCorrect == true`. Represents
cumulative margin error across all correct-winner predictions. Lower is better — a user
who gets 5 winners correct with total err of 8 is ranked above one with 5 correct and
total err of 15 (they were closer to the actual margins on their correct picks).

**`exactScores`:** Counts predictions where `err == 0`. Used only as a tiebreaker
(not part of `totalPoints`).

**Security:** Read: all authenticated. Write: server only (Cloud Functions).

**Usage:**
- When match finalized → scoring engine computes points per prediction → updates this doc
- Leaderboards read from this doc, NOT from individual predictions
- `scoredMatchCount` and `lastScoredMatchId` allow detection of partial scoring runs
- `pointsByRound` enables leaderboard rebuilds without re-querying all predictions
- If a score correction or re-scoring is needed, leaderboard totals can be **derived**
  from scored predictions as a fallback, even though normal flow uses increments

---

## Leaderboards (Precomputed, Dynamic)

### `leaderboards/{leaderboardId}`
Leaderboard metadata and **summary statistics for cross-group comparison**.

```typescript
{
  id: string;                // tournament-scoped: "six-nations-2026__global",
                             // "six-nations-2026__country_CA", etc.
  tournamentId: string;
  type: "global" | "country" | "hemisphere" | "pundit_status";
  name: string;              // "Global", "Canada", "Northern Hemisphere", "Pundits"
  
  // Filter criteria (for dynamic leaderboards)
  filterKey?: string;        // "countryCode", "hemisphere", "isPundit"
  filterValue?: string;      // "CA", "north", "true"
  
  totalUsers: number;        // denormalized count
  
  // Summary stats — enable fair cross-group comparison
  // (e.g., "Which hemisphere is stronger?" or "How elite is this group?")
  avgPoints: number;
  medianPoints: number;
  top10AvgPoints?: number;   // average of top 10 users (or all if < 10)
  winnerPoints?: number;     // points of rank-1 user
  percentileBuckets?: {
    p10: number;             // points at 10th percentile
    p25: number;
    p50: number;             // same as medianPoints
    p75: number;
    p90: number;
  };
  
  lastUpdatedAt: Timestamp;
}
```

**Why summary stats?** Raw rank alone is misleading for cross-group comparison.
North hemisphere (400 users) rank 1 vs South hemisphere (120 users) rank 1 are not
equivalent. Summary stats let you compare groups fairly:
- `avgPoints` — "Which group is stronger overall?"
- `medianPoints` — robust against outlier skew
- `top10AvgPoints` — "Which group's elite players are stronger?"
- `winnerPoints` — headline stat
- `percentileBuckets` — full distributional comparison

**Security:** Read: all authenticated. Write: server only.

### `leaderboards/{leaderboardId}/entries/{userId}`
Precomputed leaderboard entry.

```typescript
{
  userId: string;
  displayName: string;
  photoURL?: string;
  
  // Copied from user_tournament_stats (universal — same in every leaderboard)
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  lastLockedPredictionAt?: Timestamp;
  
  // Rank within this leaderboard (tie-aware — see ranking rules below)
  rank: number;              // 1-indexed, tied users share the same rank
  position: number;          // row number for display (1, 2, 3, ... always unique)
  
  // Normalized context for cross-leaderboard comparison
  percentile?: number;       // 0–100 within this leaderboard (100 = best)
  zScore?: number;           // optional, standard deviations from mean
  
  updatedAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: server only.

**How ranks are computed:**
- **NOT on the fly** — precomputed by Cloud Function after each match
- Sort by tiebreaker chain:
  1. `totalPoints` DESC
  2. `correctWinners` DESC
  3. `sumErrOnCorrectWinners` ASC (lower cumulative error = better)
  4. `exactScores` DESC
  5. `lastLockedPredictionAt` ASC (earlier lock = better)
- **Tie handling (sports-style):**
  - Users with identical metrics on all tiebreakers share the same `rank`
  - The next distinct user gets `rank = previous rank + count of tied users`
  - Example: two users tied at rank 1 → next user is rank 3
  - `position` is always sequential (1, 2, 3, ...) for display/pagination
  - This matters for knockout qualification cutoffs — ties at the cutoff boundary
    should include all tied users (qualify N+tied, not exclude arbitrarily)

---

## Manual Pools (Stored Membership)

### `pools/{poolId}`
Manual pool metadata (friends, pundits, private groups).

```typescript
{
  id: string;
  name: string;
  tournamentId: string;
  joinCode: string;          // 6-char unique
  type: "private" | "pundit" | "knockout";
  
  createdBy: string;         // userId
  membersCount: number;      // denormalized
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Security:**
- Read: members only (via `exists(/databases/$(database)/documents/pools/$(poolId)/members/$(request.auth.uid))`)
- Write: admin only (join via joinCode handled by Cloud Function)

### `pools/{poolId}/members/{userId}`
Pool membership.

```typescript
{
  userId: string;
  displayName: string;
  photoURL?: string;
  joinedAt: Timestamp;
}
```

**Security:** Read: pool members only. Write: server only (join via Cloud Function).

### `pools/{poolId}/entries/{userId}`
Precomputed pool leaderboard entry. **Same scoring as global, different ranking context.**

```typescript
{
  userId: string;
  displayName: string;
  photoURL?: string;
  
  // Copied from user_tournament_stats (SAME SCORE — universal)
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  lastLockedPredictionAt?: Timestamp;
  
  // Rank within THIS pool (tie-aware, same tiebreaker chain as dynamic leaderboards)
  rank: number;
  position: number;
  percentile?: number;       // 0–100 within this pool
  
  updatedAt: Timestamp;
}
```

**Security:** Read: pool members only. Write: server only.

---

## Knockout Stages

### `knockout_brackets/{bracketId}`
Knockout bracket metadata.

```typescript
{
  id: string;
  name: string;              // e.g., "Top 128 Knockout"
  tournamentId: string;
  
  qualificationSource: "global" | "pool";
  qualificationLeaderboardId?: string;
  qualificationPoolId?: string;
  
  qualificationCutoff: number; // e.g., 128 (top N)
  qualifiedAt: Timestamp;      // snapshot timestamp
  
  status: "qualifying" | "active" | "completed";
  
  createdAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: admin only.

### `knockout_brackets/{bracketId}/participants/{userId}`
Snapshot of qualified user.

```typescript
{
  userId: string;
  displayName: string;
  photoURL?: string;
  
  // Snapshot at qualification
  seedRank: number;
  seedPoints: number;
  
  // Knockout-specific stats
  knockoutPoints: number;    // points earned in knockout matches only
  
  status: "active" | "eliminated";
  
  qualifiedAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: server only.

### `knockout_brackets/{bracketId}/matches/{matchId}`
Bracket-specific match tracking (optional — if knockout has unique fixtures).

```typescript
{
  bracketId: string;
  matchId: string;           // references tournaments/{tournamentId}/matches/{matchId}
  round: "round_of_128" | "round_of_64" | "round_of_32" | "round_of_16" | "quarter_final" | "semi_final" | "final";
  
  // Standings after this match
  topUser: string;           // userId with most points after this match
  
  updatedAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: server only.

---

## Scoring Flow (Backend)

When a match is finalized (`status: "final"`, `homeScore` and `awayScore` set):

1. **Cloud Function trigger: `onMatchFinalized`**
2. Fetch all `predictions` where `matchId == X`
3. For each prediction:
   - Compute `winnerCorrect`, `err`, `marginBonus`
   - Compute `totalPoints = winnerCorrect ? (10 + marginBonus) : 0`
   - Update `predictions/{userId_matchId}` with scoring fields
4. For each user:
   - Update `user_tournament_stats/{tournamentId_userId}`:
     - `totalPoints += prediction.totalPoints`
     - `correctWinners += 1` (if winner correct)
     - `sumErrOnCorrectWinners += prediction.err` (only if winner correct)
     - `exactScores += 1` (if winner correct AND err == 0)
     - `scoredMatchCount += 1`
     - `lastScoredMatchId = matchId`
     - `pointsByRound[match.round] += prediction.totalPoints`
5. Trigger `updateLeaderboards(tournamentId)` — see scaling strategy below

**Idempotency:** Use `scoring_runs/{matchId}` to prevent double-scoring. The
`scoredMatchCount` and `lastScoredMatchId` fields on `user_tournament_stats` provide
an additional check for partial-run detection (e.g., function retried mid-batch).

### Leaderboard Update Strategy

After scoring, leaderboards need rank recomputation:

**Eager updates (always run immediately):**
- Global leaderboard (`{tournamentId}__global`)
- Other high-visibility public leaderboards (hemisphere, pundits)

**Lazy updates (acceptable delay):**
- Country leaderboards — update via background queue or on next read
- Manual pool leaderboards — update lazily on read, or via batch job

This split matters at scale. Updating every pool and every country leaderboard
synchronously after each match becomes a scaling bottleneck as user count grows.
The pattern is:
- `user_tournament_stats` is always the **source of truth**
- Public leaderboards are **eagerly projected**
- Pool/niche leaderboards are **lazily refreshed** (stale for seconds/minutes, not hours)

For each leaderboard update (eager or lazy):
1. Query `user_tournament_stats` filtered by leaderboard criteria
2. Sort by tiebreaker chain, compute tie-aware ranks
3. Compute summary stats (`avgPoints`, `medianPoints`, `percentileBuckets`, etc.)
4. Write/update `leaderboards/{leaderboardId}` metadata
5. Write/update `leaderboards/{leaderboardId}/entries/{userId}` with rank + percentile

### Score Correction / Rebuild

If a match result is corrected or scoring rules change:
1. Delete `scoring_runs/{matchId}`
2. Re-score all predictions for that match
3. Recompute `user_tournament_stats` from scored predictions (or subtract old + add new)
4. Rebuild affected leaderboards

`pointsByRound` and `scoredMatchCount` make partial rebuilds feasible without
re-querying every prediction. For a full rebuild, derive totals from all scored
predictions as the canonical fallback.

---

## Tiebreakers (Order)

1. `totalPoints` DESC
2. `correctWinners` DESC
3. `sumErrOnCorrectWinners` ASC — lower cumulative error on correct picks is better
4. `exactScores` DESC
5. `lastLockedPredictionAt` ASC — earlier lock wins

**`sumErrOnCorrectWinners`:** Only incremented when `winnerCorrect == true` for a
prediction. It is the sum of `err` values across all correct-winner predictions.
Lower is better — it rewards users who were closer to actual margins on their correct
picks. Two users with the same total points and same number of correct winners are
separated by who was more precise on those correct picks.

**`exactScores`:** Counts predictions where `err == 0` (perfect margin). Used only
as a tiebreaker, not part of `totalPoints`.

**`lastLockedPredictionAt`:** The timestamp of the user's most recent prediction that
transitioned to locked state (either via manual lock or auto-lock at kickoff). This is
deterministic — it does not change after lock, and is unambiguous unlike "last prediction"
which could mean last edit, last save, or last submission.

**If all tiebreakers are equal:** Users share the same `rank`. See ranking rules in
the leaderboard entries section above.

---

## Key Rules

### ✅ DO
- Store ONE score per user per tournament in `user_tournament_stats`
- Precompute leaderboards after each match finalized
- Use user attributes (`countryCode`, `hemisphere`, `isPundit`) to filter dynamic leaderboards
- Copy score from `user_tournament_stats` to leaderboard entries (same score, different rank)
- Use tournament-scoped leaderboard IDs (`{tournamentId}__{type}`)
- Handle ties: equal metrics → same rank, next rank skips
- Store leaderboard summary stats for cross-group comparison
- Store per-entry percentile for normalized context
- Design scoring updates to be safely re-runnable (idempotency + rebuild fields)

### ❌ DON'T
- Store different scores per pool
- Calculate scores differently per leaderboard
- Give bonus points based on pool membership or ranking
- Compute ranks on the fly in client queries
- Create "pool points" or alternate point systems for different leaderboards
- Compare groups by raw rank alone (use percentile/summary stats instead)
- Force unique ranks when tiebreaker metrics are identical

---

## Indexes

```
// Dynamic leaderboards
user_tournament_stats: (tournamentId, totalPoints DESC, correctWinners DESC)

// Country leaderboards (composite index with user data)
// Requires joining with users collection or denormalizing countryCode

// Predictions by match
predictions: (matchId, userId)

// Pool membership
pools/{poolId}/members: (userId)

// Leaderboard entries
leaderboards/{leaderboardId}/entries: (rank ASC)
pools/{poolId}/entries: (rank ASC)
```

**Note on dynamic leaderboards:** Since Firestore doesn't support cross-collection queries, we have two options:
1. **Denormalize** `countryCode`, `hemisphere`, `isPundit` into `user_tournament_stats` (recommended)
2. **Precompute** leaderboard entries for all dynamic pools after each scoring update

**Recommendation:** Denormalize user attributes into `user_tournament_stats` for efficient querying.

---

## Updated `user_tournament_stats` Schema (with denormalization)

```typescript
{
  id: string;                // composite: "{tournamentId}_{userId}"
  userId: string;
  tournamentId: string;
  
  // Aggregate scoring
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  
  // Rebuild safety
  scoredMatchCount: number;
  lastScoredMatchId?: string;
  pointsByRound?: { [round: string]: number };
  
  // Tiebreaker
  lastLockedPredictionAt?: Timestamp;
  
  // Denormalized from users/{userId} for dynamic leaderboard filtering
  displayName: string;
  photoURL?: string;
  countryCode?: string;
  hemisphere?: "north" | "south";
  isPundit: boolean;
  
  updatedAt: Timestamp;
}
```

This allows queries like:
```javascript
// Global leaderboard
db.collection('user_tournament_stats')
  .where('tournamentId', '==', 'six-nations-2026')
  .orderBy('totalPoints', 'desc')
  .limit(100)

// Canada leaderboard
db.collection('user_tournament_stats')
  .where('tournamentId', '==', 'six-nations-2026')
  .where('countryCode', '==', 'CA')
  .orderBy('totalPoints', 'desc')
  .limit(100)

// Pundits leaderboard
db.collection('user_tournament_stats')
  .where('tournamentId', '==', 'six-nations-2026')
  .where('isPundit', '==', true)
  .orderBy('totalPoints', 'desc')
  .limit(100)
```

---

## Summary

- **ONE score per user per tournament** in `user_tournament_stats`
- **No pool-specific points** — keep one universal score, never create alternate point systems
- **Predictions are universal** across all contexts
- **Dynamic pools** (global, country, hemisphere, pundits) calculated from user attributes
- **Manual pools** (friends, pundits, knockout) store membership but use same scoring
- **Leaderboards are precomputed** with ranks, not calculated on the fly
- **Leaderboard IDs are tournament-scoped** (`{tournamentId}__{type}`)
- **Ties are sports-style** — equal metrics share the same rank
- **Cross-group comparison** uses leaderboard summary stats + per-entry percentile, not raw rank
- **Scoring is safely rebuildable** via `scoredMatchCount`, `pointsByRound`, and derivation from predictions
- **Leaderboard updates scale** via eager/lazy split — public projections are immediate, pool/niche are batched
- **Pools change ranking context, NOT scoring rules**
