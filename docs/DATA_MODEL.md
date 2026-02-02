# Firestore Data Model (Firebase-first)

## Principles
- Use Firestore as source of truth.
- Split picks into two docs:
  - `picks_status`: readable by all pool members (for reminders)
  - `picks_detail`: restricted visibility before kickoff
- Precompute leaderboards and round totals (do not aggregate in client).

## Collections

## Global fixtures (shared)
`/seasons/{seasonId}`
- name, startsAt, endsAt

`/seasons/{seasonId}/matches/{matchId}`
- round (1..5)
- kickoffAt (Timestamp UTC)
- homeTeamId, awayTeamId
- status: scheduled|live|final
- homeScore, awayScore (nullable)
- updatedAt

## Pools
`/pools/{poolId}`
- seasonId
- name
- joinCode
- createdBy, createdAt
- membersCount
- scoringVersion: "v1"
- maxMargin: 99
- scoring constants (optional duplication)

`/pools/{poolId}/members/{userId}`
- displayName
- photoURL (optional)
- joinedAt

## Picks (status)
`/pools/{poolId}/picks_status/{matchId}_{userId}`
- matchId
- userId
- isComplete (bool)  // autosaved complete pick counts as "Picked"
- lockedAt (Timestamp | null) // irreversible
- finalizedAt (Timestamp | null) // optional cosmetic; writes by server only
- updatedAt

## Picks (detail)
`/pools/{poolId}/picks_detail/{matchId}_{userId}`
- matchId
- userId
- pickedWinnerTeamId (nullable)
- pickedMargin (nullable, int 1–99)
- updatedAt
- scoring fields (written by server when match final):
  - winnerCorrect (bool)
  - err (int)
  - marginBonus (int)
  - closestBonus (int)
  - totalPoints (int)

## Leaderboard (precomputed)
`/pools/{poolId}/leaderboard/{userId}`
- totalPoints (int)
- lastUpdatedAt

Round totals:
`/pools/{poolId}/rounds/{round}/scores/{userId}`
- roundPoints (int)
- lastUpdatedAt

## Idempotency / scoring runs
When applying scoring to aggregates, store:
`/pools/{poolId}/scoring_runs/{matchId}`
- scoredAt
- scoringVersion ("v1")
- seasonId
- round
- matchId

If `scoring_runs/{matchId}` exists, do not apply increments again unless in explicit "recompute" mode.

## Suggested indexes
- pools by joinCode (for joining)
- picks_detail where matchId == X (per pool)
- picks_status where matchId == X (per pool)
- leaderboard ordered by totalPoints desc
- rounds/{round}/scores ordered by roundPoints desc
