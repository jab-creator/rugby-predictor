# Scoring Spec (Universal Tournament Scoring)

## Non-negotiable rule
Scoring is global and universal per tournament.
- A user has one total score per tournament.
- Pools/leaderboards only change who the user is compared against.
- No pool-specific points, multipliers, or “closest in pool” bonuses.

## Per-match scoring model
Each finalized match awards points from universal components:
- Correct winner points
- Margin accuracy points
- Team score accuracy points (optional)
- Exact scoreline bonus (optional)

A practical baseline example:
- Correct winner = 3 points
- Exact margin = 2 points
- Exact team score = 1 point per team
- Exact scoreline = additional bonus

> Constants are configurable but must be shared globally for all users.

## Disallowed scoring behavior
- No “closest in Canada/hemisphere/pundits pool gets extra points.”
- No manual-pool-specific scoring tweaks.
- No dynamic leaderboard-specific point adjustments.

If “closest” recognition is desired, use **badges/achievements only** (non-scoring).

## Tiebreakers (leaderboard ordering)
1. Total points
2. Correct winners
3. Exact scores
4. Submission timing (optional)

## Backend scoring flow
When a match is marked final:
1. Fetch all predictions for that match.
2. Calculate points with the universal scoring function.
3. Update prediction scoring fields.
4. Update user tournament aggregate stats.
5. Recompute affected precomputed leaderboards.

## Idempotency requirement
Scoring updates must be idempotent to prevent double application on retries/recomputes.
