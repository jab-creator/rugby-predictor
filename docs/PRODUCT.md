# Product Spec

## Goal
A Nations Championship predictor platform featuring public global competition, dynamic leaderboards, pundit pools, and knockout stages with viral sharing potential.

## Evolution from Six Nations to Nations Championship
The app evolved from a Six Nations-only predictor into a general rugby prediction platform supporting:
- Multiple tournaments (Six Nations, Rugby Championship, Nations Championship, etc.)
- Public global competition alongside private pools
- Dynamic leaderboards based on user attributes
- Knockout stages for top performers
- Viral sharing features

## Core concepts
- **Tournament**: e.g., Six Nations 2026, Rugby Championship 2026, Nations Championship 2026
- **Matches**: fixtures with kickoff times, teams, final results
- **User Tournament Stats**: single source of truth for user's score in a tournament
- **Dynamic Pools**: leaderboards calculated from user attributes (country, hemisphere, isPundit)
- **Manual Pools**: stored memberships for friends, pundits, private groups, knockout qualification
- **Prediction**: per user per match: pick winner + margin (1–99)
- **Status**: whether a user has made a pick and whether it is locked

## Core Principles (CRITICAL)

### 1. Single Source of Truth for Scoring
- Each user has **ONE score per tournament**
- Scores are **NOT different per pool**
- Pools only change:
  - Who you are compared against
  - Your rank, **NOT your points**

### 2. No Pool-Specific Scoring
- Do **NOT** calculate points differently per pool
- Do **NOT** give bonus points based on pool membership or ranking
- Use **universal scoring rules** only
- Optional: Add badges/achievements per pool (non-scoring)

### 3. Dynamic Pools (Calculated, Not Stored)
These pools are calculated from user attributes:
- **Global**: all users
- **Country**: e.g., users where `countryCode == "CA"`
- **Hemisphere**: users where `hemisphere == "north"` or `"south"`
- **Pundits**: users where `isPundit == true`
- **Fans vs Pundits**: comparison view

### 4. Manual Pools (Stored Membership)
Only these require `pools/{poolId}/members/{userId}`:
- Pundit pools (invite-only communities)
- Private pools (friends, challenges)
- Knockout qualification pools (snapshot of top performers)

## Locked decisions (do not change)
- Predictions are **winner + margin**, margin range **1–99**
- Picks autosave. A complete autosave counts as **Picked**
- Users can lock each match **irreversibly**
- Picks are auto-final at kickoff (no edits after kickoff)
- **Scoring is universal** — one score per user per tournament
- **Pools change ranking context, NOT scoring rules**
- Visibility:
  - Before kickoff: everyone can see status (No pick / Picked / Locked)
  - Before kickoff: pick details visible only if both users locked that match
  - After kickoff: pick details visible to all pool members

## User flows

### 1) Making predictions (Core flow)
- User navigates to tournament fixtures (grouped by round)
- For each match, user selects winner and margin (1-99)
- Changes autosave immediately
- User can optionally lock picks irreversibly before kickoff
- After kickoff, picks are final and visible to all

### 2) Global leaderboards (Dynamic)
- User views **Global** leaderboard (all users, sorted by totalPoints)
- User views **Country** leaderboard (users from same country)
- User views **Hemisphere** leaderboard (North/South)
- User views **Pundits** leaderboard (isPundit users only)
- User views **Fans vs Pundits** comparison
- Same score everywhere, different rank based on comparison group

### 3) Manual pools (Friends, challenges, pundits)
- User creates a manual pool with `joinCode`
- Other users join via `joinCode`
- Members see each other's picks (subject to lock/kickoff visibility)
- Members compete on same universal scoring
- Pool shows **rankings** within that group, **NOT different scores**

### 4) Knockout stages
- Top N users from Global leaderboard qualify for knockout bracket
- Qualification is a **snapshot** — locked at bracket start
- Knockout rounds proceed with same universal scoring
- Winner determined by cumulative points in knockout matches

### 5) Viral features (Future)
- Shareable result cards: "I beat X% of players"
- Personal challenge pools
- Weekly/round winners
- Badges (non-scoring achievements)

### 6) Status visibility & reminders
- In any view, show user status per match (No pick / Picked / Locked)
- This supports "remind your mates to pick" without revealing actual picks
- Pick details revealed: before kickoff if both locked, after kickoff to all

### 7) After kickoff & scoring
- Picks are final
- Pick details visible to all relevant users
- Scoring computed once match is marked final
- Updates propagate to:
  - User's `user_tournament_stats` (single source of truth)
  - All affected leaderboards (global, country, hemisphere, pundits)
  - All affected manual pool rankings

## UX notes
- Mobile-first: making all picks for a round should take < 60 seconds
- Clear status chips: Draft/Picked, Locked, Final
- Avoid "submit" as a requirement; autosave is default
- Emphasize universal scoring: "Your score: 82 points. Global: 14th, Canada: 2nd"
- Leaderboards show rank and context, never imply different scores
