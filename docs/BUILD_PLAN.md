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
**Goal:** Migrate from pool-specific picks to universal predictions

**In scope:**
- Create `predictions/{userId_matchId}` collection (universal)
- Migrate existing picks to predictions format
- Update autosave logic to write to predictions
- Update status tracking
- Maintain backward compatibility with existing pool-based UI

**Out of scope:** Scoring engine, leaderboards

**Done looks like:**
- Predictions stored globally, not per pool
- UI still works with existing pool views
- Data model ready for universal scoring

### Milestone 6: Universal Scoring Engine
**Goal:** Implement scoring that updates `user_tournament_stats` (single source of truth)

**In scope:**
- Create `user_tournament_stats/{tournamentId_userId}` collection
- Pure scoring functions (unit tested) from existing SCORING.md
- Cloud Function `onMatchFinalized`:
  * Fetch all predictions for match
  * Compute points per prediction (winner, margin accuracy)
  * Update `predictions/{userId_matchId}` with scoring fields
  * Update `user_tournament_stats` with totalPoints, correctWinners, exactScores
- Admin UI to mark match final + enter result
- Idempotency via `scoring_runs/{matchId}`

**Out of scope:** Leaderboards, pools still use old aggregation temporarily

**Done looks like:**
- Match result entry triggers universal scoring
- Each user has ONE score in `user_tournament_stats`
- Tests verify scoring is universal and identical for all users
- Existing pool views still work (reading from user_tournament_stats)

**Kickoff prompt:**
```
Rugby predictor, Milestone 6: Universal Scoring Engine.
M0–M5 done. This is the most critical milestone.

In scope:
- user_tournament_stats/{tournamentId_userId} collection (SINGLE SOURCE OF TRUTH)
- Pure scoring function (no Firestore imports) following docs/SCORING.md
- Jest tests for all scoring rules (winner gate, margin bonuses, draws)
- Cloud Function onMatchFinalized:
  * Fetch all predictions globally
  * Compute points per prediction
  * Update user_tournament_stats (totalPoints, correctWinners, exactScores)
  * Write scoring_runs/{matchId} for idempotency
- Admin UI to mark match final

Key constraint: scoring is universal and identical for all users.
Verify this in tests.

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
**Goal:** Build precomputed leaderboards for global, country, hemisphere, pundits

**In scope:**
- `leaderboards/{leaderboardId}` collection
- `leaderboards/{leaderboardId}/entries/{userId}` subcollection
- Cloud Function `updateAllLeaderboards(tournamentId)`:
  * Triggered after scoring updates
  * Queries `user_tournament_stats` with filters
  * Sorts by totalPoints DESC, correctWinners DESC, exactScores DESC
  * Computes ranks (1, 2, 3, ...)
  * Writes leaderboard entries
- Leaderboard UI:
  * Global leaderboard (all users)
  * Country selector (shows country leaderboard)
  * Hemisphere toggle (North/South)
  * Pundits leaderboard
  * "Your score: 82 pts | Global: 14th | Canada: 2nd"

**Out of scope:** Manual pools, knockout

**Done looks like:**
- Users see their rank in multiple leaderboards
- Same score everywhere, different ranks
- Leaderboards update automatically after each match

**Kickoff prompt:**
```
Rugby predictor, Milestone 8: Dynamic Leaderboards.
M0–M7 done. Scoring engine and user_tournament_stats working.

In scope:
- Precomputed leaderboards (global, country, hemisphere, pundits)
- Cloud Function updateAllLeaderboards(tournamentId):
  * Queries user_tournament_stats with filters
  * Sorts and computes ranks
  * Writes leaderboards/{leaderboardId}/entries/{userId}
- Leaderboard UI with tabs: Global, Country, Hemisphere, Pundits
- Display: "Your score: 82 pts | Global: 14th | Canada: 2nd"

Key constraint: leaderboards show SAME score, different rank. Never imply
different scores per leaderboard.

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
  * Computes ranks within pool
  * Writes pools/{poolId}/entries/{userId}

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

## Migration Strategy (from Pool-Based to Universal)

Since Milestone 4 is complete with pool-based picks, the migration strategy is:

1. **Milestone 5:** Add `predictions` collection alongside existing `pools/{poolId}/picks_*`
2. **Milestone 6:** Implement scoring engine using `predictions` → `user_tournament_stats`
3. **Milestone 7–8:** Build dynamic leaderboards reading from `user_tournament_stats`
4. **Milestone 9:** Refactor pools to read from `user_tournament_stats` instead of pool-specific aggregates
5. **Later:** Deprecate `pools/{poolId}/picks_*` (keep pools for membership only)

This allows incremental migration without breaking existing functionality.

---

## Key Reminders for Future Milestones

- **Always read docs/SCORING.md, docs/DATA_MODEL.md, docs/PRODUCT.md before starting**
- **Test that scoring is universal and identical for all users**
- **Verify same score appears in all leaderboards**
- **Pools change rank, not score**
- **Precompute ranks, don't calculate on the fly**

---

## Summary

- **Current:** Milestone 4 complete (pool-based picks with locking)
- **Next:** Milestone 5–6 (universal predictions and scoring)
- **MVP:** Through Milestone 8 (global + dynamic leaderboards)
- **Full platform:** Through Milestone 12 (knockout stages)
- **Viral growth:** Milestone 13–14 (sharing and badges)
- **Production:** Milestone 15
