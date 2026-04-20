# Firestore Data Model (Nations Championship)

## Principles
- Universal scoring source of truth: one tournament score per user.
- Dynamic public leaderboard slices are computed from user attributes.
- Manual membership is used only where needed (private/pundit/challenge/knockout pools).
- Leaderboards are precomputed and rank-stamped server-side.

## Core Collections

### Users
`/users/{userId}`
- `displayName`
- `photoURL` (optional)
- `countryCode` (e.g. `CA`)
- `hemisphere` (`north` | `south`)
- `isPundit` (bool)
- `createdAt`, `updatedAt`

### Tournaments
`/tournaments/{tournamentId}`
- `name`
- `startsAt`, `endsAt`
- `status` (`upcoming` | `live` | `complete`)

### Matches
`/matches/{matchId}`
- `tournamentId`
- `stage` (`group` | `knockout`)
- `round`
- `kickoffAt` (Timestamp UTC)
- `homeTeamId`, `awayTeamId`
- `status` (`scheduled` | `live` | `final`)
- `homeScore`, `awayScore` (nullable until final)
- `updatedAt`

### Predictions
`/predictions/{userId_matchId}`
- `userId`, `matchId`, `tournamentId`
- prediction payload (winner, margin, optional scoreline inputs)
- scoring breakdown fields (server-written)
- `pointsEarned`
- `lockedAt` (if used by UX flow)
- `updatedAt`

### User Tournament Aggregates
`/user_tournament_stats/{tournamentId_userId}`
- `userId`, `tournamentId`
- `totalPoints`
- `correctWinners`
- `exactScores`
- optional secondary metrics (`updatedAt`, submission timing aggregates, etc.)

## Precomputed Leaderboards

### Leaderboard roots
`/leaderboards/{leaderboardId}`
- `tournamentId`
- `type` (`global` | `country` | `hemisphere` | `pundits` | `custom`)
- optional filter metadata (`countryCode`, `hemisphere`, etc.)
- `lastComputedAt`

Examples of `leaderboardId`:
- `global`
- `country_CA`
- `hemisphere_north`
- `pundits`

### Leaderboard entries
`/leaderboards/{leaderboardId}/entries/{userId}`
- `userId`
- `displayName`
- `totalPoints`
- `rank`
- `correctWinners`
- `exactScores`
- optional percentile/beat-X% metrics

## Manual Pools (Stored Membership)
Use explicit membership only for:
- Invite-only pundit pools
- Private/friends/challenge pools
- Knockout qualification/result pools

### Pool docs
`/pools/{poolId}`
- `name`
- `type` (`pundit` | `private` | `challenge` | `knockout`)
- `entryRule` (`invite` | `auto_snapshot`)
- `tournamentId`
- `createdBy`, `createdAt`

### Pool membership
`/pools/{poolId}/members/{userId}`
- `joinedAt`
- optional role metadata

### Pool entries
`/pools/{poolId}/entries/{userId}`
- denormalized tournament stats for fast display
- `totalPoints`
- `rank`
- tiebreak fields

## Knockout Brackets
`/knockout_brackets/{bracketId}`
- `tournamentId`
- `sourceLeaderboardId` (e.g. `global`)
- `qualifiedSize` (e.g. 128)
- `snapshottedAt`

`/knockout_brackets/{bracketId}/participants/{userId}`
- qualification snapshot fields (`seed`, `qualifiedRank`, `qualifiedPoints`)

`/knockout_brackets/{bracketId}/matches/{matchId}`
- bracket round + fixture + result metadata

## Index/Query Guidance
- `predictions` by `matchId` for scoring fan-out
- `user_tournament_stats` by `tournamentId` and `totalPoints` if needed for recompute workflows
- `leaderboards/*/entries` ordered by `rank`
- `leaderboards` by `tournamentId` + `type`
- `pools` by `type` and `tournamentId`
