# Security Rules Intent (Firestore)

## Goals
Enforce fair play:
- Picks can be edited only before kickoff
- Locking is irreversible and prevents edits
- Before kickoff, users can see status but not details unless both locked
- After kickoff, full pick details are visible to all pool members for that match
- Margin is constrained 1–99

## Membership
- Only pool members can read pool data.
- Only authenticated users can create pools and join pools.

## Status docs (`picks_status`)
Readable by any pool member:
- isComplete
- lockedAt
- updatedAt
- finalizedAt (optional)

Writable only by the owner (userId == auth.uid), with constraints:
- `lockedAt` can be set once (null -> timestamp) and never unset
- Clients may not write finalizedAt (server only)
- `isComplete` is a boolean

## Detail docs (`picks_detail`)
Owner can always read/write before kickoff (subject to locking constraints).

Read visibility:
- Before kickoff:
  - A user can read another user's detail ONLY if:
    - requester has lockedAt != null for that match AND
    - target has lockedAt != null for that match
- After kickoff: all pool members can read all users’ details for that match

Write constraints:
- No writes after kickoff
- If corresponding status.lockedAt != null, deny edits (irreversible lock)
- pickedMargin must be 1..99
- pickedWinnerTeamId must be valid (or at least a string/nullable)

## Server-only writes
- Match results
- Scoring fields on picks_detail
- Leaderboard docs
- Round score docs
- scoring_runs docs

