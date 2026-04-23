# Build Plan — General Rugby Predictor Platform

This build plan reflects the evolution from a Six Nations-only predictor to a general rugby prediction platform with universal scoring, dynamic leaderboards, and knockout stages.

## Core Architecture Principles

Before starting any milestone, understand these principles:

1. **Single Source of Truth:** Each user has ONE score per tournament in `user_tournament_stats`
2. **No Pool-Specific Scoring:** Pools change ranking context, NOT scoring rules
3. **Dynamic Pools:** Global, country, hemisphere, pundits — calculated from user attributes
4. **Manual Pools:** Only for friends, pundits, challenges, knockout — stored membership
5. **Precomputed Leaderboards:** Ranks are precomputed after each match, not on the fly

---

## Milestone Status

### ✅ Completed (Current State)

#### Milestone 0: Scaffold
- Next.js 14 + React 18 + TypeScript
- Firebase SDK configured
- Cloud Functions scaffolded
- Emulator configuration
- Types defined

#### Milestone 1: Auth + Pool Membership
- Firebase Auth with Google sign-in
- Create/join pools with joinCode
- Members list
- User profiles

#### Milestone 2: Fixtures & Round View
- Six Nations 2025 fixtures
- Seed utility
- Round navigation
- Pick UI (winner + margin)

#### Milestone 3: Autosave Picks + Status Dots
- Dual-doc pattern (picks_detail + picks_status)
- Autosave with debounce
- Real-time status listeners
- Status dots per member

#### Milestone 4: Per-match Irreversible Locking
- `lockPick` Cloud Function
- Auto-lock at kickoff
- Lock button + bulk lock
- Security rules enforcement

---

## Upcoming Milestones (Restructured for General Rugby Predictor)

## Phase 1: Universal Predictions & Single Source of Truth

### Milestone 5: Universal Predictions Collection
**Goal:** Replace pool-specific picks with universal predictions

**In scope:**
- Create `predictions/{userId_matchId}` collection (universal)
- Update autosave logic to write to predictions
- Update status tracking
- Remove pool-specific picks collections

**Out of scope:** Scoring engine, leaderboards

**Done looks like:**
- Predictions stored globally, not per pool
- Autosave writes to universal predictions collection
- Data model ready for universal scoring

### Milestone 6: Universal Scoring Engine
**Goal:** Implement scoring that updates `user_tournament_stats` (single source of truth)

**In scope:**
- Create `user_tournament_stats/{tournamentId_userId}` collection with full schema:
  * Aggregate scoring: `totalPoints`, `correctWinners`, `exactScores`
  * Rebuild safety: `scoredMatchCount`, `lastScoredMatchId`, `pointsByRound`
  * Tiebreaker: `lastLockedPredictionAt` (set when predictions lock)
- Pure scoring functions (unit tested) from existing SCORING.md
- Cloud Function `onMatchFinalized`:
  * Fetch all predictions for match
  * Compute points per prediction (winner, margin accuracy)
  * Update `predictions/{userId_matchId}` with scoring fields
  * Update `user_tournament_stats` with all fields including rebuild safety fields
- Admin UI to mark match final + enter result
- Idempotency via `scoring_runs/{matchId}` + `scoredMatchCount`/`lastScoredMatchId` for partial-run detection

**Out of scope:** Leaderboards (built in Phase 2)

**Done looks like:**
- Match result entry triggers universal scoring
- Each user has ONE score in `user_tournament_stats`
- `scoredMatchCount`, `lastScoredMatchId`, `pointsByRound` populated correctly
- Tests verify scoring is universal and identical for all users
- Tests verify idempotency (re-running doesn't double-count)
- Scoring engine updates both predictions and user_tournament_stats

**Kickoff prompt:**
```
Rugby predictor, Milestone 6: Universal Scoring Engine.
M0–M5 done. This is the most critical milestone.

In scope:
- user_tournament_stats/{tournamentId_userId} collection (SINGLE SOURCE OF TRUTH)
  with rebuild safety fields: scoredMatchCount, lastScoredMatchId, pointsByRound
- Pure scoring function (no Firestore imports) following docs/SCORING.md
- Jest tests for all scoring rules (winner gate, margin bonuses, draws)
- Cloud Function onMatchFinalized:
  * Fetch all predictions globally
  * Compute points per prediction
  * Update user_tournament_stats (totalPoints, correctWinners,
    sumErrOnCorrectWinners, exactScores, scoredMatchCount,
    lastScoredMatchId, pointsByRound)
  * Write scoring_runs/{matchId} for idempotency
- Admin UI to mark match final
- Tiebreaker fields stored in user_tournament_stats:
  * totalPoints, correctWinners, sumErrOnCorrectWinners, exactScores
  * lastLockedPredictionAt (set when prediction locks, NOT when saved/edited)
  * sumErrOnCorrectWinners: only incremented when winnerCorrect == true
  * exactScores: only incremented when winnerCorrect == true AND err == 0

Key constraint: scoring is universal and identical for all users.
Verify this in tests. Also test idempotency — re-running must not double-count.

Read docs/SCORING.md and docs/DATA_MODEL.md before starting.
```

---

## Phase 2: Dynamic Leaderboards

### Milestone 7: User Attributes & Denormalization
**Goal:** Add user attributes for dynamic pool filtering

**In scope:**
- Update `users/{userId}` schema:
  * `countryCode?: string` (ISO 3166-1 alpha-2)
  * `hemisphere?: "north" | "south"`
  * `isPundit: boolean`
- Profile edit UI for users to set country and hemisphere
- Admin UI to flag users as pundits
- Denormalize these fields into `user_tournament_stats` on score update
- Composite indexes for filtering

**Out of scope:** Leaderboard UI

**Done looks like:**
- Users can set their country and hemisphere
- `user_tournament_stats` has countryCode, hemisphere, isPundit for filtering
- Ready for dynamic leaderboard queries

### Milestone 8: Global & Dynamic Leaderboards
**Goal:** Build precomputed leaderboards with summary stats and cross-group comparison

**In scope:**
- `leaderboards/{leaderboardId}` collection with **tournament-scoped IDs**:
  * `{tournamentId}__global`, `{tournamentId}__country_CA`, `{tournamentId}__hemisphere_north`, etc.
- `leaderboards/{leaderboardId}/entries/{userId}` subcollection
- Leaderboard metadata with **summary stats** for cross-group comparison:
  * `avgPoints`, `medianPoints`, `top10AvgPoints`, `winnerPoints`, `percentileBuckets`
- Leaderboard entries with **tie-aware ranks** and **percentile**:
  * `rank` (tied users share same rank), `position` (sequential row number)
  * `percentile` (0–100 within this leaderboard)
- Cloud Function `updateLeaderboards(tournamentId)`:
  * Triggered after scoring updates
  * **Eager:** Global, hemisphere, pundits — updated immediately
  * **Lazy:** Country leaderboards — via queue or on-read refresh
  * Queries `user_tournament_stats` with filters
  * Sorts by tiebreaker chain: totalPoints DESC, correctWinners DESC, sumErrOnCorrectWinners ASC, exactScores DESC, lastLockedPredictionAt ASC
  * Computes tie-aware ranks (equal metrics → same rank, next = rank + tied count)
  * Computes summary stats (avg, median, percentiles) for leaderboard metadata
  * Writes leaderboard entries with rank + percentile
- Leaderboard UI:
  * Global leaderboard (all users)
  * Country selector (shows country leaderboard)
  * Hemisphere toggle (North/South)
  * Pundits leaderboard
  * "Your score: 82 pts | Global: 14th | Canada: 2nd"
  * Cross-group comparison: "North avg: 64 pts vs South avg: 58 pts"

**Out of scope:** Manual pools, knockout

**Done looks like:**
- Users see their rank in multiple leaderboards
- Same score everywhere, different ranks
- Tied users share the same rank
- Leaderboard metadata includes summary stats
- Cross-group comparison possible via summary stats
- Per-entry percentile enables normalized comparison
- Leaderboards update automatically (eager for public, lazy for niche)

**Kickoff prompt:**
```
Rugby predictor, Milestone 8: Dynamic Leaderboards.
M0–M7 done. Scoring engine and user_tournament_stats working.

In scope:
- Precomputed leaderboards (global, country, hemisphere, pundits)
- Tournament-scoped IDs: {tournamentId}__global, {tournamentId}__country_CA, etc.
- Leaderboard metadata with summary stats: avgPoints, medianPoints,
  top10AvgPoints, winnerPoints, percentileBuckets (p10/p25/p50/p75/p90)
- Tie-aware ranking: equal metrics = same rank, next rank skips
- Per-entry percentile (0–100 within leaderboard)
- Cloud Function updateLeaderboards(tournamentId):
  * Eager: global, hemisphere, pundits (immediate)
  * Lazy: country leaderboards (queue or on-read)
  * Queries user_tournament_stats with filters
  * Sorts by tiebreaker chain: totalPoints DESC, correctWinners DESC,
    sumErrOnCorrectWinners ASC, exactScores DESC, lastLockedPredictionAt ASC
  * Computes ranks, percentiles, and summary stats
  * Writes leaderboards/{leaderboardId} + entries/{userId}
- Leaderboard UI with tabs: Global, Country, Hemisphere, Pundits
- Display: "Your score: 82 pts | Global: 14th | Canada: 2nd"
- Cross-group comparison via summary stats (not raw rank)

Key constraints:
- Leaderboards show SAME score, different rank
- No pool-specific points — ever
- Cross-group comparison uses summary stats, not raw rank
- Ties are sports-style (shared rank, next skips)

Read docs/DATA_MODEL.md (Leaderboards section) before starting.
```

---

## Phase 3: Manual Pools & Pool Rankings

### Milestone 9: Manual Pools with Universal Scoring
**Goal:** Refactor pools to use universal scoring (no pool-specific scoring)

**In scope:**
- Keep `pools/{poolId}` and `pools/{poolId}/members/{userId}`
- Add `pools/{poolId}/entries/{userId}` (precomputed rankings)
- Update join pool flow to work with universal predictions
- Pool detail page:
  * Shows pool members
  * Shows pool leaderboard (same scores from user_tournament_stats, different ranks)
  * Members can see each other's predictions (subject to lock/kickoff visibility)
- Cloud Function `updatePoolLeaderboards`:
  * Queries user_tournament_stats for pool members
  * Computes tie-aware ranks within pool
  * Computes per-entry percentile
  * Writes pools/{poolId}/entries/{userId}
  * Updated **lazily** (on read or via batch job), not synchronously after every match

**Out of scope:** Pundit pools, knockout

**Done looks like:**
- Pools work as friend/challenge groups
- Pool rankings show same scores as global, different ranks
- "You: 82 pts | Pool rank: 3/20 | Global rank: 142"

---

## Phase 4: Pundit Pools & Beat X%

### Milestone 10: Pundit Pools
**Goal:** Special pools for expert pundits

**In scope:**
- Flag users as pundits (`isPundit: true`)
- Pundit pool type with invite-only join
- Pundits leaderboard (isPundit == true)
- Fans vs Pundits comparison view:
  * "You beat X% of pundits"
  * "You beat X% of fans"
- Admin UI to create pundit pools and invite members

**Out of scope:** Knockout

**Done looks like:**
- Pundits have special badge
- Users can compare their score against pundits
- Viral messaging: "Beat 78% of pundits!"

---

## Phase 5: Knockout Stages

### Milestone 11: Knockout Qualification
**Goal:** Qualify top N users from global leaderboard for knockout bracket

**In scope:**
- `knockout_brackets/{bracketId}` collection
- Qualification logic:
  * Admin triggers qualification (e.g., "Top 128 from Global")
  * Snapshot leaderboard at qualification time
  * Create `knockout_brackets/{bracketId}/participants/{userId}`
  * Seed participants by rank
- Qualification is immutable (no recalculation after qualification)

**Out of scope:** Bracket progression, elimination

**Done looks like:**
- Admin can qualify top N users for knockout
- Participants locked in at qualification
- UI shows "Qualified for Top 128 Knockout"

### Milestone 12: Knockout Bracket Progression
**Goal:** Track knockout bracket progression and standings

**In scope:**
- Knockout matches subset (optional — or use all tournament matches)
- Bracket-specific scoring tracking:
  * `knockoutPoints` per participant (points earned in knockout matches only)
- Bracket UI:
  * Shows participants sorted by knockoutPoints
  * Shows "round of 128", "round of 64", etc.
  * Elimination threshold (e.g., bottom 50% after each round)
- Winner determination

**Out of scope:** Custom bracket fixtures (use existing tournament matches for MVP)

**Done looks like:**
- Knockout bracket shows standings
- Users eliminated as bracket progresses
- Champion crowned at the end

---

## Phase 6: Viral Features & Polish

### Milestone 13: Shareable Result Cards
**Goal:** Viral sharing to grow user base

**In scope:**
- Generate shareable images:
  * "I scored 82 points in Six Nations 2026"
  * "Beat 89% of players globally"
  * "Ranked 2nd in Canada"
- Share to social media (Twitter, Facebook, etc.)
- QR code or link for others to join

**Out of scope:** Weekly winners, badges

**Done looks like:**
- Users can share their results
- Shareable cards drive sign-ups

### Milestone 14: Badges & Achievements (Non-Scoring)
**Goal:** Add gamification without breaking universal scoring

**In scope:**
- Non-scoring badges:
  * "Closest in Canada" (badge, not points)
  * "Perfect Round" (all correct winners in a round)
  * "Underdog Hero" (picked unlikely winner correctly)
- Badge display on profile and leaderboards

**Out of scope:** Badges affecting scores

**Done looks like:**
- Users collect badges
- Badges add engagement without breaking scoring principles

### Milestone 15: Polish & Production Hardening
**Goal:** Ship to production

**In scope:**
- Environment config (`.env.production`)
- Deploy rules, functions, hosting
- Cloud Scheduler for auto-lock
- Error monitoring (Cloud Functions logs, Sentry optional)
- Rate limits on Cloud Functions
- Loading states, error boundaries
- Mobile optimization
- Accessibility pass

**Done looks like:**
- Production URL live
- Auto-lock working on real fixtures
- Monitoring in place

---

## Key Reminders for Future Milestones

- **Always read docs/SCORING.md, docs/DATA_MODEL.md, docs/PRODUCT.md before starting**
- **Test that scoring is universal and identical for all users**
- **Verify same score appears in all leaderboards**
- **Pools change rank, not score — never create pool-specific points**
- **Precompute ranks, don't calculate on the fly**
- **Use tournament-scoped leaderboard IDs** (`{tournamentId}__{type}`)
- **Handle ties sports-style** (equal metrics = same rank, next skips)
- **Cross-group comparison uses summary stats and percentile**, not raw rank
- **Leaderboard updates use eager/lazy split** for scaling
- **Scoring must be safely rebuildable** from scored predictions

---

## Summary

- **Current:** Milestone 4 complete (pool-based picks with locking)
- **Next:** Milestone 5–6 (universal predictions and scoring)
- **MVP:** Through Milestone 8 (global + dynamic leaderboards)
- **Full platform:** Through Milestone 12 (knockout stages)
- **Viral growth:** Milestone 13–14 (sharing and badges)
- **Production:** Milestone 15
