Cool — here’s a Firebase-first implementation blueprint you can basically paste into your repo as the “source of truth”.

1) Firestore structure
Global (read-only to users)

/seasons/{seasonId}

name (e.g., "Six Nations 2026")

startsAt (Timestamp)

endsAt (Timestamp)

/seasons/{seasonId}/matches/{matchId}

round (1..5)

kickoffAt (Timestamp, UTC)

homeTeamId, awayTeamId

venue (optional)

status ("scheduled" | "live" | "final")

homeScore (int | null)

awayScore (int | null)

updatedAt (Timestamp)

You’ll seed these once per season.

Pools

/pools/{poolId}

seasonId

name

joinCode

createdBy

createdAt

membersCount

scoringVersion (e.g., "v1")

maxMargin = 99

constants:

closestBonusPool = 5

winnerPoints = 10

marginBands = [{maxErr:2, pts:10},{maxErr:5, pts:7},{maxErr:9, pts:5},{maxErr:14, pts:2}]

/pools/{poolId}/members/{userId}

displayName

photoURL (optional)

joinedAt

Picks (split into status + detail)

This makes “reminder dots” safe and easy, without field-level masking tricks.

Status doc (everyone in pool can read)

/pools/{poolId}/picks_status/{matchId}_{userId}

matchId

userId

isComplete (bool) ✅ autosave complete pick counts as “Picked”

lockedAt (Timestamp | null) ✅ irreversible once set

finalizedAt (Timestamp | null) ✅ set at kickoff

updatedAt (Timestamp)

Detail doc (restricted before kickoff)

/pools/{poolId}/picks_detail/{matchId}_{userId}

matchId

userId

pickedTeamId (team id | null)

pickedMargin (int 1..99 | null)

updatedAt (Timestamp)

After match is final & scored, you can also store:

winnerCorrect (bool)

err (int)

marginBonus (int)

closestBonus (int)

totalPoints (int)

Alternative: keep scoring in a separate scores_match/{matchId}_{userId} doc. But embedding in detail is fine.

Leaderboard (precomputed)

/pools/{poolId}/leaderboard/{userId}

totalPoints (int)

lastUpdatedAt

/pools/{poolId}/rounds/{round}/scores/{userId}

roundPoints (int)

lastUpdatedAt

2) Security rules (core constraints)

Below is a tight rule set that enforces:

only pool members can read pool data

status visible to all members

detail visible only when both locked OR after kickoff

lock is irreversible

edits blocked after lock (before kickoff)

edits blocked after kickoff (auto-final)

You’ll need helper functions in rules. This is written in Firestore Rules v2 style.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isPoolMember(poolId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/pools/$(poolId)/members/$(request.auth.uid));
    }

    function getMatch(seasonId, matchId) {
      return get(/databases/$(database)/documents/seasons/$(seasonId)/matches/$(matchId));
    }

    function nowTs() {
      return request.time;
    }

    // ----- Global fixtures -----
    match /seasons/{seasonId} {
      allow read: if true; // public fixtures are ok
      allow write: if false;

      match /matches/{matchId} {
        allow read: if true;
        allow write: if false; // admin via functions only (or use custom claims)
      }
    }

    // ----- Pools -----
    match /pools/{poolId} {
      allow read: if isPoolMember(poolId);
      allow create: if isSignedIn();
      allow update, delete: if false; // simplify; do updates via functions/admin

      match /members/{userId} {
        allow read: if isPoolMember(poolId);
        allow create: if isSignedIn() && request.auth.uid == userId;
        allow update: if request.auth.uid == userId; // displayName/photo changes
        allow delete: if false;
      }

      // Status docs: readable to all pool members
      match /picks_status/{docId} {
        allow read: if isPoolMember(poolId);

        // Users can create/update their own status doc with constraints
        allow create, update: if isPoolMember(poolId)
          && request.resource.data.userId == request.auth.uid
          && resourceOrNewUserMatches(request.resource.data.userId)
          && statusWriteAllowed(poolId, request.resource.data);

        // No deletes
        allow delete: if false;

        function resourceOrNewUserMatches(uid) {
          return uid == request.auth.uid;
        }

        function statusWriteAllowed(poolId, newData) {
          // docId format is matchId_userId, but we won't parse it here.
          // Must include required keys
          return newData.keys().hasAll(['matchId','userId','isComplete','updatedAt'])
            // lockedAt can be null or timestamp
            && (!('lockedAt' in newData) || newData.lockedAt == null || newData.lockedAt is timestamp)
            // finalizedAt can be null or timestamp (but only server should set it; see below)
            && (!('finalizedAt' in newData) || newData.finalizedAt == null);

          // NOTE: finalizedAt is set by Cloud Functions using admin SDK bypassing rules.
          // If you want clients to never write finalizedAt, keep it blocked like above.
        }
      }

      // Detail docs: restricted visibility before kickoff
      match /picks_detail/{docId} {
        allow read: if isPoolMember(poolId) && canReadPickDetail(poolId, resource.data);

        allow create, update: if isPoolMember(poolId)
          && request.resource.data.userId == request.auth.uid
          && canWritePickDetail(poolId, request.resource.data);

        allow delete: if false;

        function canReadPickDetail(poolId, data) {
          // Allow owner always
          if (request.auth.uid == data.userId) return true;

          // Need match to check kickoff
          let pool = get(/databases/$(database)/documents/pools/$(poolId));
          let m = getMatch(pool.data.seasonId, data.matchId);

          // After kickoff: everyone in pool can see all pick details
          if (nowTs() >= m.data.kickoffAt) return true;

          // Before kickoff: only if BOTH locked for this match
          // Check requester's status doc lockedAt != null AND target's status doc lockedAt != null
          let requesterStatus = get(
            /databases/$(database)/documents/pools/$(poolId)/picks_status/$(data.matchId + '_' + request.auth.uid)
          );

          let targetStatus = get(
            /databases/$(database)/documents/pools/$(poolId)/picks_status/$(data.matchId + '_' + data.userId)
          );

          return requesterStatus.exists()
            && targetStatus.exists()
            && requesterStatus.data.lockedAt != null
            && targetStatus.data.lockedAt != null;
        }

        function canWritePickDetail(poolId, newData) {
          let pool = get(/databases/$(database)/documents/pools/$(poolId));
          let m = getMatch(pool.data.seasonId, newData.matchId);

          // No writes after kickoff
          if (nowTs() >= m.data.kickoffAt) return false;

          // Validate margin/team shape
          let teamOk = !('pickedTeamId' in newData) || newData.pickedTeamId == null || newData.pickedTeamId is string;
          let marginOk = !('pickedMargin' in newData) || newData.pickedMargin == null ||
            (newData.pickedMargin is int && newData.pickedMargin >= 1 && newData.pickedMargin <= 99);

          if (!(teamOk && marginOk)) return false;

          // If already locked, deny changing pick fields
          // We gate with status doc, since lock lives there.
          let statusDoc = get(
            /databases/$(database)/documents/pools/$(poolId)/picks_status/$(newData.matchId + '_' + request.auth.uid)
          );

          if (statusDoc.exists() && statusDoc.data.lockedAt != null) {
            // allow updating ONLY non-pick fields (like updatedAt), but simplest: block updates entirely
            return false;
          }

          return true;
        }
      }

      // Leaderboard / scores - members can read, only server writes
      match /leaderboard/{userId} {
        allow read: if isPoolMember(poolId);
        allow write: if false;
      }

      match /rounds/{round}/scores/{userId} {
        allow read: if isPoolMember(poolId);
        allow write: if false;
      }
    }
  }
}

One important addition: irreversible lock

Rules above block changing pick details once status.lockedAt exists, but we also must ensure clients can’t flip lockedAt back to null in picks_status. Because rules can’t easily refer to resource for create vs update with the helper above, here’s the clean way:

Add these constraints inside match /picks_status/{docId} for update:

If resource.data.lockedAt != null, then request.resource.data.lockedAt == resource.data.lockedAt

If resource.data.lockedAt == null, then request.resource.data.lockedAt can be null or a timestamp (set once)

If you want, I can paste a revised statusWriteAllowed() that implements that precisely.

3) Client write logic (autosave + lock-all)
Autosave (per match)

When user edits a match:

write /picks_detail/{matchId}_{uid} with pickedTeamId, pickedMargin, updatedAt

compute isComplete = pickedTeamId != null && pickedMargin != null

write /picks_status/{matchId}_{uid} with isComplete, updatedAt

do NOT touch lockedAt

Use a batched write for (detail + status) to keep them in sync.

Lock a match (irreversible)

requires isComplete == true

set lockedAt = serverTimestamp() on picks_status doc

after this, rules prevent edits to the detail doc

“Lock all completed picks” (round button)

fetch user’s picks_status for the matches in that round

for those where isComplete == true && lockedAt == null, set lockedAt

batched write

4) Cloud Functions (scoring + closest split-floor)
A) Match finalize/scoring trigger

When a match result is entered/updated to status="final" in /seasons/{seasonId}/matches/{matchId}:

Steps per pool

load all pools for that season (/pools where seasonId == ...)

for each pool:

fetch all picks_detail for that match (query by matchId == matchId)

fetch matching picks_status if you need lock flags (you probably don’t for scoring)

compute scoring for each prediction:

if draw:

err = pickedMargin (since actual_margin=0)

marginBonus from table

winnerCorrect = false (optional)

base = marginBonus

eligible for closest if err <= 14

else:

if pickedTeamId != actual_winner_teamId: total=0, not eligible for closest

else:

err = abs(pickedMargin - actual_margin)

marginBonus from table

base = 10 + marginBonus

eligible for closest if err <= 14

Closest bonus per pool:

take all eligible predictions

minErr = min(err)

let k = count(err == minErr)

closestEach = floor(5 / k)

each tied pred gets closestBonus = closestEach

Write back scoring fields to each user’s picks_detail doc (or separate score docs)

Update aggregates:

update /rounds/{round}/scores/{uid}.roundPoints += totalPoints (idempotency below)

update /leaderboard/{uid}.totalPoints += totalPoints

Idempotency (must-have)

Store per pool+match whether you’ve already applied scoring to aggregates:

/pools/{poolId}/scoring_runs/{matchId}

scoredAt

version "v1"

Then:

if doc exists, skip aggregate increment

still allow “recompute” mode via admin if you need (but MVP: avoid)

B) Kickoff auto-finalize

You said: “auto locked at kickoff” (finalized). That’s not the same as user “lockedAt”; it just means no edits.

Easiest: don’t write finalizedAt for everyone — just enforce “no writes after kickoff” via rules using match kickoff time (already done). That’s enough.

If you still want finalizedAt for UI:

scheduler runs every minute

finds matches with kickoff <= now and status == scheduled/live

for each pool member pick status doc for that match, set finalizedAt if null

(this is cosmetic; not required for correctness)

5) Queries your UI will run (fast + predictable)
Round view (for a pool)

For each match in the round:

listen to /picks_status docs for that match for all members (status dots)

read your /picks_detail for input UI

if you locked:

read other users’ /picks_detail where their status shows locked too

simplest: show list of locked users, then fetch their detail docs (small pools = fine)

Leaderboard

read /leaderboard collection ordered by totalPoints desc (precomputed)

6) Tiny adjustments I recommend (practical)

Put round on pick docs too (round: 1..5) so you can query “all picks for round” easily.

Store teamId strings for team selection (no “home/away” ambiguity).

Keep joinCode indexed and queryable for joining pools.
