# Scoring Spec — Universal Scoring Rules

> **CRITICAL:** Scoring is **universal** across all contexts. Each user has ONE score per tournament. Pools/leaderboards only change ranking context, NOT scoring rules.

## Core Principle: Universal Scoring

- Each prediction earns points based on **universal rules** defined below
- Points are calculated **identically** for all users
- **NO pool-specific scoring** — do NOT give different points based on pool membership
- User's score is stored in `user_tournament_stats` (single source of truth)
- Leaderboards (global, country, hemisphere, pools) show the **same score**, different **rank**

## Inputs
Each prediction is:
- `pickedWinner` (team)
- `pickedMargin` (int 1–99)

Match result provides:
- `actualWinner` (team) if non-draw
- `actualMargin = abs(homeScore - awayScore)`
- `isDraw = (homeScore == awayScore)`

## Constants
- Winner points: `WINNER_PTS = 10`

Margin bonus is based on:
`err = abs(pickedMargin - actualMargin)`

Margin bonus table (points):
- err 0–2  => 10
- err 3–5  => 7
- err 6–9  => 5
- err 10–14 => 2
- err >=15 => 0

## Non-draw match scoring
### Winner gate (strict)
If `pickedWinner != actualWinner`:
- total points = 0

If `pickedWinner == actualWinner`:
- total = 10 + marginBonus(err)

Total for a correct-winner prediction:
`total = 10 + marginBonus`

**Max per non-draw match: 20**

## Draw match scoring (margin still pays)
On a draw:
- winner points are always 0 (no one can have correct winner)
- `actualMargin = 0`
- `err = abs(pickedMargin - 0) = pickedMargin`
- total = marginBonus(err)

Total on draw:
`total = marginBonus`

**Max on draw: 10**

## Examples
- Non-draw: correct winner, predicted margin 8, actual margin 10 => err=2 => 10 + 10 = **20 points**
- Non-draw: correct winner, predicted margin 5, actual margin 10 => err=5 => 10 + 7 = **17 points**
- Non-draw: wrong winner => **0 points**
- Draw: predicted margin 2, actual 0 => err=2 => **10 points**
- Draw: predicted margin 8, actual 0 => err=8 => **5 points**

---

## Implementation Notes

### Universal Scoring Flow

When a match is finalized:

1. **Fetch all predictions** for the match (globally, across all contexts)
2. **Compute points for each prediction:**
   - Check if winner is correct (if not a draw)
   - Calculate `err = abs(pickedMargin - actualMargin)`
   - Apply margin bonus based on err
   - Wrong winner = 0 points
   - Correct winner = 10 + marginBonus
   - Draw = marginBonus only
3. **Write points to `predictions/{userId_matchId}`:**
   - `winnerCorrect`, `err`, `marginBonus`, `totalPoints`
4. **Update `user_tournament_stats/{tournamentId_userId}`:**
   - `totalPoints += prediction.totalPoints`
   - `correctWinners += 1` (if winner correct)
   - `sumErrOnCorrectWinners += prediction.err` (only if winner correct)
   - `exactScores += 1` (if winner correct AND err == 0)
   - `scoredMatchCount += 1`
   - `lastScoredMatchId = matchId`
   - `pointsByRound[match.round] += prediction.totalPoints`
   - Copy current denormalized leaderboard fields (`displayName`, `photoURL`, `countryCode`,
     `resolvedHemisphere`, `isPundit`) so leaderboard filters never need joins
   - Resolve `resolvedHemisphere` from the tournament config + `countryCode` (for example,
     Nations Championship can override `JP -> south` without making Japan a globally southern user)
5. **Propagate to leaderboards** (see DATA_MODEL.md for eager/lazy strategy):
   - Global leaderboard (eager)
   - Hemisphere/Pundit leaderboards (eager)
   - Country leaderboards (lazy — queue or on-read)
   - Manual pool leaderboards (lazy)

### Critical Rules

- ✅ **DO:** Store the same score in `user_tournament_stats` for each user
- ✅ **DO:** Copy score from `user_tournament_stats` to all leaderboard entries
- ✅ **DO:** Apply scoring rules identically for all users
- ❌ **DON'T:** Calculate different scores per pool
- ❌ **DON'T:** Give bonus points based on pool membership or ranking
- ❌ **DON'T:** Modify scoring rules based on leaderboard context

### Scoring Summary

**Non-draw match (correct winner):**
- Winner correct: 10 points
- Margin within 2: +10 points (total: 20)
- Margin within 3-5: +7 points (total: 17)
- Margin within 6-9: +5 points (total: 15)
- Margin within 10-14: +2 points (total: 12)
- Margin off by 15+: +0 points (total: 10)

**Non-draw match (wrong winner):**
- 0 points

**Draw match:**
- Margin within 2: 10 points
- Margin within 3-5: 7 points
- Margin within 6-9: 5 points
- Margin within 10-14: 2 points
- Margin off by 15+: 0 points

### Testing

When testing scoring:
- Verify same score appears in all leaderboards for a user
- Verify rank changes based on comparison group, not score
- Verify wrong winner = 0 points (strict gate)
- Verify max points: 20 (non-draw with correct winner and err 0-2), 10 (draw with err 0-2)
- Verify `sumErrOnCorrectWinners` only incremented when `winnerCorrect == true`
- Verify `exactScores` only incremented when `winnerCorrect == true` AND `err == 0`
- Example: Josh = 82 points everywhere; Global rank = 14, Canada rank = 2

### Tiebreaker Order

Leaderboard ranking uses this tiebreaker chain (see DATA_MODEL.md for full details):
1. `totalPoints` DESC
2. `correctWinners` DESC
3. `sumErrOnCorrectWinners` ASC (lower cumulative error = better)
4. `exactScores` DESC
5. `lastLockedPredictionAt` ASC (earlier lock = better)

Test scenarios:
- Same points, different `correctWinners` → higher correctWinners wins
- Same `correctWinners`, different `sumErrOnCorrectWinners` → lower sumErr wins
- Same `sumErr`, different `exactScores` → higher exactScores wins
- Full tie on all above → `lastLockedPredictionAt` breaks it (earlier wins)
- Identical on all fields → users share the same rank

### Idempotency & Rebuild Safety

Use tournament-scoped `scoring_runs/{tournamentId}__{matchId}` docs to ensure scoring is only applied once per match.
The `scoredMatchCount` and `lastScoredMatchId` fields on `user_tournament_stats`
provide an additional check for partial-run detection (e.g., function retried mid-batch).

**Score correction flow** (if a match result needs to be corrected):
1. Delete the `scoring_runs/{tournamentId}__{matchId}` doc
2. Re-score all predictions for that match with the corrected result
3. Recompute `user_tournament_stats` — either:
   - Subtract old points + add new points (incremental), or
   - Derive totals from all scored predictions (full rebuild)
4. Rebuild affected leaderboards

**Full rebuild flow** (if scoring rules change or data integrity is in question):
1. Re-score all predictions from scratch
2. Recompute `user_tournament_stats` entirely from scored predictions
3. `pointsByRound` can be used for partial round-level rebuilds
4. Rebuild all leaderboards with summary stats and ranks

The normal flow uses increments for efficiency, but the model is designed so that
leaderboard state can always be **derived** from scored predictions if needed.
