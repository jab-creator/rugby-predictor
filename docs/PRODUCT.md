# Product Spec

## Goal
A Six Nations-only predictor web app: create/join pools, make picks, track leaderboards, and compare picks.

## Core concepts
- **Season**: e.g., Six Nations 2026
- **Matches**: fixtures with kickoff times, teams, final results
- **Pool**: group of users competing on predictions
- **Prediction**: per user per match: pick winner + margin (1–99)
- **Status**: whether a user has made a pick and whether it is locked

## Locked decisions (do not change)
- Predictions are **winner + margin**, margin range **1–99**
- Picks autosave. A complete autosave counts as **Picked**
- Users can lock each match **irreversibly**
- Picks are auto-final at kickoff (no edits after kickoff)
- Visibility:
  - Before kickoff: everyone can see status (No pick / Picked / Locked)
  - Before kickoff: pick details visible only if both users locked that match
  - After kickoff: pick details visible to all pool members

## User flows
### 1) Create pool
- User creates a pool for a specific season.
- Pool generates a `joinCode`.

### 2) Join pool
- User joins by `joinCode`.
- User becomes a member and appears in leaderboards.

### 3) Round view / making picks
- User sees matches grouped by round.
- For each match, user selects winner and margin.
- Changes autosave immediately.

### 4) Locking picks
- User can lock an individual match pick.
- Locking is irreversible.
- UI also provides “Lock all completed picks” for the current round.

### 5) Status visibility & reminders
- In round view, show member list with per-match status.
- This supports “remind your mates to pick” without revealing actual picks.

### 6) After kickoff
- Picks are final.
- Everyone in pool can see everyone’s picks for that match.
- Scoring is computed once results are final.

## UX notes
- Mobile-first: making all picks for a round should take < 60 seconds.
- Clear status chips: Draft/Picked, Locked, Final.
- Avoid “submit” as a requirement; autosave is default.
