# Build Plan (milestones)

## Milestone 0: Scaffold
- Scaffold frontend (Next.js recommended) and Firebase config.
- Set up Firebase emulator config for local dev (Auth + Firestore + Functions).

Done looks like:
- App runs locally
- Firebase project configuration is present
- Basic routing exists

## Milestone 1: Auth + Pool membership
- Firebase Auth (Google + email magic link optional)
- Create pool (name, seasonId) and generate joinCode
- Join pool via joinCode
- Members list renders

Done looks like:
- Users can create/join pool and appear as members

## Milestone 2: Fixtures & Round view
- Seed matches for season into `/seasons/{seasonId}/matches`
- Round page shows matches with kickoff times
- User sees own pick input UI (winner + margin)

Done looks like:
- Round view loads from Firestore fixtures
- Pick UI works for each match (no saving yet is okay)

## Milestone 3: Autosave picks + status dots
- Implement batched writes:
  - picks_detail
  - picks_status (isComplete)
- Round view shows each member’s per-match status:
  - No pick / Picked / Locked

Done looks like:
- Editing pick updates status immediately and is reflected to other users

## Milestone 4: Per-match irreversible locking
- Add per-match lock button + “Lock all completed picks”
- Lock sets lockedAt once; cannot be undone
- After lock, pick becomes read-only

Done looks like:
- Locked pick cannot be edited
- Other users can see lock status

## Milestone 5: Visibility rules (details reveal)
- Before kickoff: reveal other users’ picks only if both locked for that match
- After kickoff: reveal all picks for that match

Done looks like:
- A locked user can see other locked picks
- Non-locked users cannot see details before kickoff

## Milestone 6: Scoring engine + leaderboards
- Admin entry (MVP) to mark match final and enter scores
- Cloud Function to compute scoring and update:
  - pick scoring fields
  - round totals
  - leaderboard totals
  - scoring_runs idempotency

Done looks like:
- Entering a final score updates match scoring + leaderboards correctly

## Milestone 7: Polish
- Better UX, loading states, mobile optimization
- Compare view: click a match to see everyone’s picks after kickoff
- Push/email reminders optional
