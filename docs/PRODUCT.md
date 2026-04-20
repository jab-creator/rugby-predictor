# Product Spec

## Goal
Evolve the app into a **Nations Championship predictor platform** with:
- Public global competition
- Dynamic segmentation leaderboards (country, hemisphere, fans vs pundits)
- Manual invite/challenge pools
- Knockout stages for top performers
- Viral sharing hooks

## Core Rule (Source of Truth)
**Pools change ranking context, not scoring rules.**

Every user has **one tournament score** across the entire product.
- ✅ Correct: Josh has 82 points globally, and that same 82 in country/hemisphere views.
- ❌ Incorrect: Josh has different points in different pools.

## Competition Types

### 1) Public (dynamic) pools
Computed from user attributes; no membership writes required.
- Global
- Country pools (e.g. Canada, England)
- Hemisphere pools (North/South)
- Fans vs Pundits

### 2) Expert / pundit pools (manual)
Invite-only or curated groups used for “beat the pundits” style comparison.

### 3) Knockout pools (manual + snapshot)
Top users from a qualifying leaderboard snapshot advance to bracket rounds.
Qualification is snapshotted once; entrants are not continuously recomputed.

## User Profile Segmentation Fields
Each user profile supports dynamic public leaderboard grouping:
- `countryCode` (e.g. `CA`)
- `hemisphere` (`north` | `south`)
- `isPundit` (boolean)

## Scoring & Visibility Principles
- Universal scoring for all users/matches.
- No pool-specific point modifiers.
- No “closest in country/pool” scoring bonuses.
- Optional pool badges/achievements are allowed, but **non-scoring**.

## Leaderboard Rules
- Leaderboards are **precomputed**, not ranked on the fly.
- Tiebreak order:
  1. Total points
  2. Correct winners
  3. Exact scores
  4. Submission timing (optional)

## Scoring Lifecycle (backend)
When a match becomes final:
1. Fetch all predictions for the match.
2. Compute points per prediction using universal scoring.
3. Update prediction scoring fields.
4. Update user tournament aggregate stats.
5. Update affected precomputed leaderboards.

## MVP Delivery Phases
1. Predictions + match scoring + user tournament stats
2. Global/country/hemisphere leaderboards
3. Pundit pools + “beat X%” stats
4. Knockout qualification + bracket system

## Viral Features (post-MVP)
- Shareable result cards
- “Beat X% of players” highlights
- Personal challenge pools
- Weekly winners
