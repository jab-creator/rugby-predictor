# Build Plan (Nations Championship)

## Phase 1 — Core prediction + universal scoring
- Prediction capture per user per match
- Match finalization pipeline
- Universal scoring function (single scoring system for everyone)
- `user_tournament_stats` aggregate maintenance

**Done looks like:**
- Every user has one tournament score
- Match scoring is reproducible/idempotent

## Phase 2 — Public dynamic leaderboards
- Precomputed global leaderboard
- Precomputed country leaderboards (derived from `users.countryCode`)
- Precomputed hemisphere leaderboards (derived from `users.hemisphere`)

**Done looks like:**
- Same score appears consistently across all public leaderboard contexts
- Rank differs by leaderboard context, not points

## Phase 3 — Pundit/Expert competition
- Pundit segmentation leaderboard (`isPundit`)
- Optional manual invite-only pundit pools
- “Beat X%” percentile views (fans and pundits)

**Done looks like:**
- User can see global rank + contextual rank (country, hemisphere, pundits)

## Phase 4 — Knockout stage
- Qualification snapshot from chosen leaderboard (e.g. top 128 global)
- Bracket generation and progression
- Knockout-specific views and outcomes

**Done looks like:**
- Qualified entrants fixed at snapshot time
- Bracket progresses independently of later group leaderboard movement

## Post-MVP Enhancements
- Shareable result cards
- Weekly winners
- Friend/challenge pools
- Achievement badges (non-scoring, e.g., “Closest in Canada”)

## Architecture Guardrails
- No pool-specific scoring logic
- No duplicate score totals per pool
- Precompute leaderboard ranks server-side
- Store manual pool membership only when required (private/pundit/challenge/knockout)
