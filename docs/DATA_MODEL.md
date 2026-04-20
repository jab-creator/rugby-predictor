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

### 2. Leaderboards (Precomputed, Dynamic)
- `leaderboards/{leaderboardId}` - Metadata
- `leaderboards/{leaderboardId}/entries/{userId}` - Precomputed leaderboard entries

Leaderboard IDs:
- `global` - all users
- `country_CA`, `country_GB`, etc. - per country
- `hemisphere_north`, `hemisphere_south` - per hemisphere
- `pundits` - isPundit users only
- `fans` - !isPundit users only

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
  exactScores: number;       // count of err == 0
  
  // Tiebreakers
  lastPredictionAt?: Timestamp;
  
  updatedAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: server only (Cloud Functions).

**Usage:**
- When match finalized → scoring engine computes points per prediction → updates this doc
- Leaderboards read from this doc, NOT from individual predictions

---

## Leaderboards (Precomputed, Dynamic)

### `leaderboards/{leaderboardId}`
Leaderboard metadata.

```typescript
{
  id: string;                // "global", "country_CA", "hemisphere_north", "pundits"
  name: string;              // "Global", "Canada", "Northern Hemisphere", "Pundits"
  tournamentId: string;
  type: "global" | "country" | "hemisphere" | "pundit_status";
  
  // Filter criteria (for dynamic leaderboards)
  filterKey?: string;        // "countryCode", "hemisphere", "isPundit"
  filterValue?: string;      // "CA", "north", "true"
  
  totalUsers: number;        // denormalized count
  lastUpdatedAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: server only.

### `leaderboards/{leaderboardId}/entries/{userId}`
Precomputed leaderboard entry.

```typescript
{
  userId: string;
  displayName: string;
  photoURL?: string;
  
  // Copied from user_tournament_stats
  totalPoints: number;
  correctWinners: number;
  exactScores: number;
  
  // Computed rank
  rank: number;              // 1-indexed
  
  updatedAt: Timestamp;
}
```

**Security:** Read: all authenticated. Write: server only.

**How ranks are computed:**
- **NOT on the fly** — precomputed by Cloud Function after each match
- Sort by: `totalPoints DESC`, then `correctWinners DESC`, then `exactScores DESC`, then `lastPredictionAt ASC`
- Assign `rank = 1, 2, 3, ...`

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
  
  // Copied from user_tournament_stats (SAME SCORE)
  totalPoints: number;
  correctWinners: number;
  exactScores: number;
  
  // Rank within THIS pool
  rank: number;
  
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
     - `exactScores += 1` (if err == 0)
5. Trigger `updateAllLeaderboards(tournamentId)`
   - For each dynamic leaderboard (global, country, hemisphere, pundits):
     - Query `user_tournament_stats` filtered by leaderboard criteria
     - Sort and compute ranks
     - Write/update `leaderboards/{leaderboardId}/entries/{userId}`
   - For each manual pool:
     - Query `user_tournament_stats` for pool members
     - Sort and compute ranks
     - Write/update `pools/{poolId}/entries/{userId}`

**Idempotency:** Use `scoring_runs/{matchId}` to prevent double-scoring.

---

## Tiebreakers (Order)

1. `totalPoints` DESC
2. `correctWinners` DESC
3. `exactScores` DESC
4. `lastPredictionAt` ASC (earlier submission wins)

---

## Key Rules

### ✅ DO
- Store ONE score per user per tournament in `user_tournament_stats`
- Precompute leaderboards after each match finalized
- Use user attributes (`countryCode`, `hemisphere`, `isPundit`) to filter dynamic leaderboards
- Copy score from `user_tournament_stats` to leaderboard entries (same score, different rank)

### ❌ DON'T
- Store different scores per pool
- Calculate scores differently per leaderboard
- Give bonus points based on pool membership or ranking
- Compute ranks on the fly in client queries

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
  exactScores: number;
  
  // Tiebreakers
  lastPredictionAt?: Timestamp;
  
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

## Migration Notes

**Current state (Milestone 4):** Pool-based architecture with `picks_detail` and `picks_status` per pool.

**Target state:** Global predictions with `user_tournament_stats` and dynamic leaderboards.

**Migration strategy:**
- Phase 1: Add `predictions` and `user_tournament_stats` collections alongside existing pools
- Phase 2: Migrate scoring engine to update `user_tournament_stats`
- Phase 3: Build dynamic leaderboards and precomputed entries
- Phase 4: Deprecate pool-specific picks (keep pools for manual membership only)

---

## Summary

- **ONE score per user per tournament** in `user_tournament_stats`
- **Predictions are universal** across all contexts
- **Dynamic pools** (global, country, hemisphere, pundits) calculated from user attributes
- **Manual pools** (friends, pundits, knockout) store membership but use same scoring
- **Leaderboards are precomputed** with ranks, not calculated on the fly
- **Pools change ranking context, NOT scoring rules**
