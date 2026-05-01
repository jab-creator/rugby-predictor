# Build Plan — General Rugby Predictor Platform

This build plan reflects the evolution from a Six Nations-only predictor to a general rugby prediction platform with universal scoring, dynamic leaderboards, manual pool leaderboards, member prediction visibility, and knockout stages.

## Core Architecture Principles

Before starting any milestone, understand these principles:

1. **Single Source of Truth:** Each user has ONE score per tournament in `user_tournament_stats`
2. **No Pool-Specific Scoring:** Pools change ranking context, NOT scoring rules
3. **Dynamic Pools:** Global, country, hemisphere, pundits — calculated from user attributes
4. **Manual Pools:** Only for friends, pundits, challenges, knockout — stored membership
5. **Scoring Aggregates Are Maintained by Finalization:** Scoring/leaderboard aggregate data must be updated by scoring/finalization flows, not computed only when a user first views a leaderboard
6. **UI Data May Lazy-Load:** It is acceptable for the UI to query/subcribe to leaderboard display data only when the leaderboard page or tab opens

### Lazy-Loading Clarification

- Aggregation lazy-on-first-view: **No**
- UI query/subscription lazy-loaded on page open: **Yes**
- `user_tournament_stats` remains the reliable source of truth for leaderboard rows until stored leaderboard projections are implemented and verified.

---

## Milestone Status

### Verified Complete

#### Milestone 0: Scaffold
- Next.js 14 + React 18 + TypeScript
- Firebase SDK configured
- Cloud Functions scaffolded
- Emulator configuration
- Types defined

#### Milestone 1: Auth + Pool Membership
- Firebase Auth with emulator-backed E2E auth helpers
- Create/join pools with joinCode
- Members list
- User profiles

#### Milestone 2: Fixtures & Round View
- Nations Championship fixture model under `seasons/{seasonId}/matches`
- Seed utility
- Round navigation
- Pick UI (winner + margin)

#### Milestone 3: Autosave Picks + Status Dots
- Dual-doc compatibility pattern (`picks_detail` + `picks_status`)
- Autosave with debounce
- Real-time status listeners
- Status dots per member
- E2E coverage exists for autosave behavior

#### Milestone 4: Per-match Irreversible Locking
- `lockPick` Cloud Function
- Auto-lock at kickoff path
- Lock button + bulk lock
- Security rules enforcement
- E2E coverage verifies locking and `lastLockedPredictionAt`

#### Milestone 5: Universal Predictions Collection
- Canonical `predictions/{userId_matchId}` collection added
- Autosave writes universal predictions
- Explicit prediction schema supports match/user/tournament queries
- Legacy `picks_status` / `picks_detail` retained as compatibility layer for current UI
- Manual lock + kickoff auto-lock mirror `lockedAt` into universal predictions and compatibility status docs
- Firestore rules and index config updated for universal prediction flow
- Focused E2E coverage verifies universal autosave + lock mirroring

#### Milestone 6: Universal Scoring Engine
- Finalized matches score universal `predictions` into top-level `user_tournament_stats/{tournamentId_userId}`
- Top-level tournament-scoped `scoring_runs/{tournamentId}__{matchId}` prevents double-counting on repeated match finalization
- Lock flows now maintain `lastLockedPredictionAt` for future ranking tiebreakers
- Round page includes creator-facing final score entry that triggers scoring without replacing the existing pick UI
- Finalized matches render read-only with visible final-score state in the current round view
- Unit + Playwright coverage verifies universal scoring output and idempotency

#### Milestone 7: User Attributes & Denormalization
**Goal:** Add user attributes for dynamic pool filtering

**Verified complete:**
- `users/{userId}` schema supports:
  * `countryCode?: string` (ISO 3166-1 alpha-2)
  * `hemisphere?: "north" | "south"` (legacy/back-compat only)
  * `isPundit: boolean`
- Profile edit UI lets users set country; hemisphere is resolved per tournament from country + tournament rules
- Admin UI can flag users as pundits
- Scoring/profile sync denormalizes fields into `user_tournament_stats`
- Composite indexes exist for filtered leaderboard queries

**Done looks like:**
- Users can set their country
- `user_tournament_stats` has countryCode, resolvedHemisphere, isPundit for filtering
- Ready for dynamic leaderboard queries

#### Milestone 8: Global & Dynamic Leaderboards
**Goal:** Build leaderboard views with universal scores and dynamic filters

**Verified complete in current implementation:**
- Leaderboard UI route exists at `/pools/{poolId}/leaderboard`
- UI supports Overall, Country, Hemisphere, and Pundits tabs
- UI queries `user_tournament_stats` directly when the leaderboard page/tab opens
- Rows sort by the agreed tiebreaker chain:
  * `totalPoints DESC`
  * `correctWinners DESC`
  * `sumErrOnCorrectWinners ASC`
  * `exactScores DESC`
  * `lastLockedPredictionAt ASC`
- Country selector queries `countryCode`
- Hemisphere selector queries `resolvedHemisphere`
- Pundits tab queries `isPundit == true`
- E2E coverage verifies overall render and dynamic filters

**Implemented but needs test coverage or future expansion:**
- Stored `leaderboards/{leaderboardId}` metadata and `entries/{userId}` projections are defined in docs/data model but are not the verified current implementation
- Summary stats (`avgPoints`, `medianPoints`, `top10AvgPoints`, `winnerPoints`, `percentileBuckets`) are not verified in UI or functions
- Per-entry percentile display is not verified in UI
- Cross-group comparison copy such as "North avg vs South avg" is not verified

**Corrected scope note:**
- Do **not** lazy-compute leaderboard/scoring aggregates only when someone first views a leaderboard.
- Current verified behavior reads maintained `user_tournament_stats` rows on page/tab open. This is acceptable UI lazy-loading.

**Original full target scope retained for future implementation:**
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
  * Eager: Global, hemisphere, pundits — updated immediately
  * Deferred/background: Country leaderboards — via queue or scheduled/batch refresh, but not scoring-on-first-view
  * Queries `user_tournament_stats` with filters
  * Sorts by tiebreaker chain
  * Computes tie-aware ranks (equal metrics -> same rank, next = rank + tied count)
  * Computes summary stats for leaderboard metadata
  * Writes leaderboard entries with rank + percentile
- Leaderboard UI:
  * Global leaderboard (all users)
  * Country selector (shows country leaderboard)
  * Hemisphere toggle (North/South)
  * Pundits leaderboard
  * "Your score: 82 pts | Global: 14th | Canada: 2nd"
  * Cross-group comparison: "North avg: 64 pts vs South avg: 58 pts"

**Out of scope for verified M8:** Manual pools, knockout

**Kickoff prompt retained for future stored leaderboard projection work:**
```
Rugby predictor, Milestone 8 stored projections: Dynamic Leaderboards.
M0-M7 done. Scoring engine and user_tournament_stats working.

In scope:
- Precomputed/stored leaderboards (global, country, hemisphere, pundits)
- Tournament-scoped IDs: {tournamentId}__global, {tournamentId}__country_CA, etc.
- Leaderboard metadata with summary stats: avgPoints, medianPoints,
  top10AvgPoints, winnerPoints, percentileBuckets (p10/p25/p50/p75/p90)
- Tie-aware ranking: equal metrics = same rank, next rank skips
- Per-entry percentile (0-100 within leaderboard)
- Cloud Function updateLeaderboards(tournamentId):
  * Triggered after scoring updates
  * Eager: global, hemisphere, pundits (immediate)
  * Deferred/background: country leaderboards (queue/scheduled/batch)
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
- Do not compute scoring aggregates only when a leaderboard is first viewed

Read docs/DATA_MODEL.md (Leaderboards section) before starting.
```

---

## Phase 3: Manual Pools & Pool Rankings

### Milestone 9: Manual Pool Leaderboards & Member Prediction Visibility
**Goal:** Add manual pool ranking context and correct member prediction visibility while preserving universal scoring

**Status in current branch:** Implemented; full completion depends on final E2E verification passing after the current milestone test work.

**In scope:**
- Keep `pools/{poolId}` and `pools/{poolId}/members/{userId}`
- Manual pool leaderboard view:
  * Uses the same `user_tournament_stats` scores as global/dynamic leaderboards
  * Ranks only stored pool members
  * Shows rank, display name, totalPoints, correctWinners, sumErrOnCorrectWinners, exactScores
  * Sorts by:
    1. `totalPoints DESC`
    2. `correctWinners DESC`
    3. `sumErrOnCorrectWinners ASC`
    4. `exactScores DESC`
    5. `lastLockedPredictionAt ASC`
- Pool member prediction visibility:
  * Users can always see their own predictions
  * Before kickoff, users can see other members' prediction status
  * Before kickoff, prediction details are visible between two members only if both have locked that same match
  * If only one member has locked, prediction details remain hidden and only status is visible
  * After kickoff, prediction details are visible to pool members
  * After final, predictions, actual result, points earned, margin error, and winner correctness are visible
- Robust Playwright E2E coverage using Firebase emulators:
  * Create/sign in at least 3 test users
  * Create/join one manual pool
  * Seed at least 4 matches
  * Submit and lock predictions for all users
  * Verify hidden/visible prediction details before kickoff based on mutual lock state
  * Finalize matches
  * Verify leaderboard sorting and score values

**Out of scope:** Pundit pools, knockout

**Done looks like:**
- Pools work as friend/challenge groups
- Pool rankings show same scores as global, different ranks
- Prediction details are redacted exactly by lock/kickoff/final state
- "You: 82 pts | Pool rank: 3/20 | Global rank: 142" remains a future enhancement unless verified

**Needs verification:**
- Full `npm run test:e2e` pass after Milestone 9 implementation
- Any stored `pools/{poolId}/entries/{userId}` projection path, if later implemented, must be maintained by scoring/finalization or a background refresh flow, not scoring-on-first-view

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
- **Do not lazy-compute scoring aggregates only when a leaderboard is first viewed**
- **UI leaderboard queries may lazy-load on page/tab open**
- **Use tournament-scoped leaderboard IDs** (`{tournamentId}__{type}`)
- **Handle ties sports-style** (equal metrics = same rank, next skips)
- **Cross-group comparison uses summary stats and percentile**, not raw rank
- **Scoring must be safely rebuildable** from scored predictions

---

## Local Verification Commands

Build and unit tests:

```bash
npm run build
cd functions && npm run build && npm test && cd ..
```

E2E tests require Firebase emulators in one terminal:

```bash
npm run emulators
```

Then run Playwright in another terminal:

```bash
npm run test:e2e
```

E2E expects:
- Auth emulator: `localhost:9099`
- Firestore emulator: `localhost:8080`
- Functions emulator: `localhost:5001`
- Next.js app: `localhost:3000` (started by Playwright config)

---

## Summary

- **Verified current:** Milestones 0-8 are implemented for the current direct-query leaderboard scope
- **Current work:** Milestone 9 manual pool leaderboard + member prediction visibility
- **Needs verification:** Full Milestone 9 E2E pass
- **MVP:** Through Milestone 9 for friend pools with universal scoring
- **Full platform:** Through Milestone 12 (knockout stages)
- **Viral growth:** Milestone 13-14 (sharing and badges)
- **Production:** Milestone 15
