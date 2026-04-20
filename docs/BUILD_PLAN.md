# Build Plan (milestones)

Each milestone has a **kickoff prompt** — copy-paste it into a fresh Claude chat when starting that milestone to load context without replaying the whole project history.

---

## Milestone 0: Scaffold ✅

- Scaffold frontend (Next.js) and Firebase config.
- Set up Firebase emulator config for local dev (Auth + Firestore + Functions).

**Done looks like:**
- App runs locally
- Firebase project configuration present
- Basic routing exists

---

## Milestone 1: Auth + Pool membership ✅

- Firebase Auth (Google + optional email magic link)
- Create pool (name, seasonId) and generate joinCode
- Join pool via joinCode (handle collisions)
- User profile doc created on first sign-in
- Members list renders
- **Security rules:** users can read/write own profile; pool membership gates pool reads

**Done looks like:**
- Users can create/join pool and appear as members
- Rejoining with same joinCode is idempotent

### Kickoff prompt
```
I'm working on a Six Nations predictor app. Tech stack: Next.js 14 + React 18 +
TypeScript, Firebase Auth/Firestore/Functions, Firebase Hosting. Source-of-truth
specs are in docs/PRODUCT.md, docs/DATA_MODEL.md, docs/SECURITY_RULES.md.

This is Milestone 1: Auth + Pool membership. In scope:
- Google sign-in via Firebase Auth
- Create pool with auto-generated joinCode (handle collisions)
- Join pool via joinCode
- User profile doc on first sign-in
- Members list with avatars
- Firestore security rules for users + pools + members

Out of scope: fixtures, picks, scoring.

Please read the data model and security rules specs before suggesting code,
and confirm the pool/member collection structure before we start.
```

---

## Milestone 2: Fixtures & Round view ✅

- Seed matches for season into `/seasons/{seasonId}/matches`
- Round page shows matches with kickoff times in user's local tz
- Pick input UI (winner + margin 1–99), no persistence yet

**Done looks like:**
- Round view loads from Firestore fixtures
- Pick UI works for each match

### Kickoff prompt
```
Six Nations predictor, Milestone 2: Fixtures & Round view. Specs in
docs/PRODUCT.md and docs/DATA_MODEL.md. Auth + pool membership already
working from M1.

In scope:
- Seed Six Nations 2025 fixtures into /seasons/{seasonId}/matches
- Round navigation from pool detail
- Round view: match cards with kickoff in local tz
- Pick UI: winner + margin 1–99 (no save yet, M3)

kickoffTime MUST be stored as Firestore Timestamp, not string — security rules
and kickoff enforcement in later milestones depend on this.

Out of scope: autosave, locking, visibility, scoring.
```

---

## Milestone 3: Autosave picks + status dots ✅

- Dual-doc pattern: `picks_detail` (private) + `picks_status` (public status only)
- Autosave with 500ms debounce, batched writes
- Real-time status listeners
- Status dots per member per match: No pick / Picked / Locked

**Done looks like:**
- Editing pick updates status immediately and reflects to other users
- Pick details never leak to other users pre-lock

### Kickoff prompt
```
Six Nations predictor, Milestone 3: Autosave picks + status dots. M0–M2 done
(auth, pools, fixtures, pick UI). Specs in docs/DATA_MODEL.md and
docs/SECURITY_RULES.md.

In scope:
- Dual-doc write pattern: picks_detail (private) + picks_status (public)
- 500ms debounced autosave, batched writes to Firestore
- Load existing picks on page load
- onSnapshot listeners for other members' status
- Status dots: No pick / Picked / Locked
- Security rules: only self can read own picks_detail; picks_status readable
  by pool members

Out of scope: locking logic, kickoff enforcement, reveal.

Confirm the batched-write structure before writing the autosave hook.
```

---

## Milestone 4: Per-match irreversible locking

- **Lock via Cloud Function** (client never writes `lockedAt` directly)
- Function validates: pick complete, kickoff not passed, user owns pick
- Per-match lock button + "Lock all completed picks" bulk action
- **Auto-lock at kickoff** via scheduled function — unlocked-but-picked users get locked with their current pick
- After lock, pick becomes read-only (UI + rules)
- **Security rules update:** picks_detail/status writes blocked after kickoff; `lockedAt` only writable by Cloud Function service account

**Done looks like:**
- Locked pick cannot be edited via client or direct Firestore write
- Kickoff passes → all complete picks auto-locked, incomplete stay as "No pick"
- Other users see lock status update in real-time

### Kickoff prompt
```
Six Nations predictor, Milestone 4: Per-match irreversible locking.
M0–M3 done (auth, pools, fixtures, autosave picks, status dots).
Specs in docs/PRODUCT.md (locking rules), docs/SECURITY_RULES.md.

In scope:
- Cloud Function `lockPick(userId, poolId, matchId)` that:
  * verifies caller owns the pick
  * verifies pick is complete
  * verifies kickoffTime > now
  * sets lockedAt atomically, writes to both picks_detail and picks_status
- UI: per-match Lock button + "Lock all completed" bulk action
- Scheduled Cloud Function that auto-locks complete-but-unlocked picks at
  kickoff. Incomplete picks stay "No pick" (do NOT auto-fill).
- Security rules: block client writes to lockedAt; block any writes to
  picks_detail/picks_status once kickoffTime <= request.time
- UI: locked picks render read-only

Out of scope: revealing other users' pick details, scoring.

Key constraint: locking is IRREVERSIBLE. Once lockedAt is set, no code path
(including admin) can unset it in this milestone. Discuss the Cloud Function
signature and scheduled function strategy before writing code.
```

---

## Milestone 5: Visibility rules (details reveal) + Compare view

- Pre-kickoff: reveal other user's pick details only if **both** users locked
- Post-kickoff: all picks visible to all pool members
- **Compare view:** click a match post-kickoff to see everyone's picks side-by-side
- **Enforce in security rules**, not just UI — rules are the source of truth

**Done looks like:**
- Locked user sees other locked users' picks for that match
- Non-locked user cannot read others' pick details via client OR direct Firestore query
- Post-kickoff: all pool members see all picks
- Compare view shows winner/margin/points (points come in M6)

### Kickoff prompt
```
Six Nations predictor, Milestone 5: Visibility rules + compare view.
M0–M4 done. Specs in docs/PRODUCT.md, docs/SECURITY_RULES.md.

In scope:
- Firestore rules for picks_detail reads:
  * self: always
  * pool member pre-kickoff: only if both self and target have locked
  * pool member post-kickoff: always (once kickoffTime <= request.time)
- Client reveal logic matching the rules (for UX; rules are the actual gate)
- Compare view: post-kickoff match detail page showing all pool members'
  picks side-by-side with winner + margin

Out of scope: scoring, points display (M6).

Test the rules with the Firebase rules emulator before shipping — I want
unit tests for: self-read, locked-vs-unlocked pre-kickoff, cross-pool
isolation, post-kickoff reveal.
```

---

## Milestone 6: Scoring engine + leaderboards

- **Pure scoring functions first**, with unit tests (no Firestore dependency)
- Admin entry UI to mark match final + enter actual winner/margin
- Cloud Function trigger on match finalization:
  - computes points per pick per `docs/SCORING.md`
  - updates pick scoring fields
  - updates round totals
  - updates leaderboard totals
  - writes `scoring_runs` doc for idempotency
- Recalculation: admin can re-trigger scoring if a result is corrected

**Done looks like:**
- Scoring unit tests pass for all edge cases in docs/SCORING.md
- Entering a final score updates leaderboard correctly
- Re-running scoring on same match is idempotent (no double-count)
- Corrections update all downstream totals

### Kickoff prompt
```
Six Nations predictor, Milestone 6: Scoring engine + leaderboards.
M0–M5 done. Specs in docs/SCORING.md (locked scoring rules) and
docs/DATA_MODEL.md.

In scope:
- Pure scoring function in functions/src/scoring.ts — takes (pick, actual)
  returns points breakdown. No Firestore imports. Unit tested.
- Jest tests covering every rule in docs/SCORING.md + edge cases
  (exact margin, wrong winner, no pick, margin tie-break if applicable)
- Admin UI for a designated admin uid to mark match final + enter result
- Cloud Function onUpdate trigger on match doc that:
  * calls pure scoring fn for each pick
  * writes points back to picks_detail
  * updates round_totals and leaderboard docs
  * writes scoring_runs/{matchId}_{runId} for idempotency
- Recalculation path: admin clicks "Recompute" → new scoring_run, deltas
  applied correctly
- Leaderboard view per pool

Out of scope: push notifications, polish.

Start with the pure function + tests. Do not touch Firestore triggers until
tests are green.
```

---

## Milestone 7: Deployment + production hardening

- Real Firebase project (dev + prod)
- Environment config (`.env.production`)
- Deploy rules, functions, hosting
- Cloud Scheduler configured for auto-lock function
- Error monitoring (Cloud Functions logs, Sentry optional)
- Rate limits / abuse checks on Cloud Functions

**Done looks like:**
- Production URL serves the app
- Auto-lock scheduler firing correctly on real fixtures
- Rules match emulator behavior
- Logs visible for function errors

### Kickoff prompt
```
Six Nations predictor, Milestone 7: Production deployment. M0–M6 working
in emulators. Need to ship to real Firebase.

In scope:
- Create firebase project (or use existing), separate dev/prod if needed
- .env.production and deployment envs
- firebase deploy: rules, functions, hosting
- Cloud Scheduler config for auto-lock function (cron matching match kickoffs
  OR a single "check every 5 min during match windows" job)
- Basic error monitoring — Cloud Functions logs at minimum
- Smoke test checklist: sign in, create pool, join pool, pick, lock, kickoff
  auto-lock, result entry, leaderboard update

Out of scope: new features.

Before deploying, audit: are there any test-mode rules left? Any hardcoded
localhost URLs? Any emulator-only code paths?
```

---

## Milestone 8: Polish

- Loading states, error boundaries, empty states
- Mobile optimization (most predictor use is on phone during match)
- Push/email reminders for unlocked picks near kickoff
- Pool admin features (kick member, rename pool, delete pool)
- Accessibility pass

### Kickoff prompt
```
Six Nations predictor, Milestone 8: Polish. App is live. Need UX work.

In scope:
- Loading states and skeletons for async data
- Error boundaries around each route
- Empty states (no pools, no fixtures, no picks)
- Mobile layout audit — predictor is used on phone during matches
- FCM push notifications: "Kickoff in 1hr, you haven't locked pick for X"
- Pool admin actions: rename, kick member, delete
- Accessibility: keyboard nav, screen reader labels, contrast

Pick the two items with highest user-visible impact and start there.
```