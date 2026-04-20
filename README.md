# Nations Championship Predictor

A modern rugby prediction platform that evolved from a Six Nations predictor into a global Nations Championship app. Features include:

- **Public global competition** with dynamic leaderboards
- **Dynamic pools** (country, hemisphere, fans vs pundits) calculated from user attributes
- **Manual pools** for friends, challenges, and pundit communities
- **Knockout stages** for top performers
- **Universal scoring** — one score per user per tournament, compared across different contexts

Users predict matches by picking **winner + margin**. Picks autosave, and users can **irreversibly lock** per match to reveal other locked picks.

## Tech stack
- Firebase Auth
- Cloud Firestore
- Cloud Functions
- Cloud Scheduler
- Firebase Hosting
- Frontend: Next.js 14 + React 18 + TypeScript

## Specs (source of truth)
- [Product rules](docs/PRODUCT.md)
- [Scoring rules](docs/SCORING.md) — **Universal scoring, no pool-specific scoring**
- [Firestore data model](docs/DATA_MODEL.md)
- [Security rules intent](docs/SECURITY_RULES.md)
- [Build plan](docs/BUILD_PLAN.md)

## Core Principles (CRITICAL)

### 1. Single Source of Truth for Scoring
- Each user has **ONE score per tournament**
- Scores are **NOT different per pool**
- Pools only change:
  - Who you are compared against
  - Your rank, **NOT your points**

**✅ Correct:** Josh = 82 points everywhere; Global rank = 14, Canada rank = 2  
**❌ Incorrect:** Josh has different points in different pools

### 2. No Pool-Specific Scoring
- Do **NOT** calculate points differently per pool
- Do **NOT** give bonus points based on pool membership or ranking
- Use **universal scoring rules** only
- Optional: Add badges/achievements per pool (non-scoring)

### 3. Dynamic Pools (Calculated, Not Stored)
These pools are **calculated from user attributes**, not stored memberships:
- Global leaderboard
- Country leaderboards (e.g., Canada, England)
- Hemisphere leaderboards (North/South)
- Fans vs Pundits

User fields used: `countryCode`, `hemisphere`, `isPundit`

### 4. Manual Pools (Stored Membership)
Only these require stored memberships:
- Pundit pools
- Private/friend pools
- Challenge pools
- Knockout qualification pools

## Locked decisions (do not change without explicit instruction)
- Predictions are **winner + margin** (margin 1–99)
- Autosaved complete pick counts as **Picked**
- Locking is **per match** and **irreversible**
- Before kickoff, users can see other users' **status** (No pick / Picked / Locked)
- Before kickoff, users can see other users’ **pick details** only if **both users locked** that match
- After kickoff, everyone can see everyone’s picks for that match
- **Scoring system is universal** — defined in `docs/SCORING.md` and applied identically across all contexts
- **Pools change ranking context, NOT scoring rules**

## Local dev

### Prerequisites
- Node.js 18+ (tested with 22.x)
- **Java JDK 21+** (the Firebase emulators now require Java 21 or later; a plain JRE is not sufficient). You can install it system‑wide or unzip a build locally and point `JAVA_HOME` to it. For example:
  ```powershell
  curl -L -o jdk21.zip https://aka.ms/download-jdk/microsoft-jdk-21.0.10-windows-x64.zip
  Expand-Archive jdk21.zip -DestinationPath jdk21
  $env:JAVA_HOME = "$PWD\jdk21\jdk-21.0.10+7"
  $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
  java -version  # should report 21+
  ```
- (or install via installer/package manager if you have admin rights)

### Setup
1. Install dependencies:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

2. Copy environment template:
   ```bash
   cp .env.example .env.local
   ```
   For local development with emulators, the provided `.env.local` has placeholder values that work out of the box.

3. Build Cloud Functions (required before starting the emulators):
   ```bash
   cd functions && npm run build && cd ..
   ```

4. (Optional) ensure your terminal session is using a Java 21+ runtime. If you installed a local JDK as shown above, export `JAVA_HOME`/`PATH` before running emulators:
   ```powershell
   $env:JAVA_HOME = "$PWD\jdk21\jdk-21.0.10+7"
   $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
   ```

5. Run the emulators (see below) and, if you hit port errors, kill any processes listening on 4000, 9099, 8080, etc., or choose alternate ports via `firebase.json`.

### Running the app

#### Next.js dev server only
```bash
npm run dev
```
Visit http://localhost:3000

#### Firebase Emulators (Auth + Firestore + Functions)
```bash
npm run emulators
```
- Emulator UI: http://localhost:4000
- Auth Emulator: http://localhost:9099
- Firestore Emulator: http://localhost:8080
- Functions Emulator: http://localhost:5001

> ⚠️ **Port conflicts** – if you see errors like “port 8080 is not open” or “emulator UI port taken”, another process is using the port. Kill the offending process (`netstat -ano | findstr :8080` then `taskkill /PID <pid> /F`) or adjust the ports in `firebase.json`/`firebase emulators:start --port` before retrying.

#### Run both together
Terminal 1:
```bash
npm run emulators
```

Terminal 2:
```bash
npm run dev
```

### Project structure
```
rugby-predictor/
├── src/                    # Next.js app
│   ├── app/               # App Router pages
│   ├── components/        # React components
│   ├── lib/               # Firebase config & types
│   └── hooks/             # Custom React hooks
├── functions/             # Cloud Functions
│   └── src/               # Functions source
├── docs/                  # Specs (PRODUCT, SCORING, etc.)
├── firebase.json          # Firebase config
└── firestore.rules        # Security rules
```

### Milestone Status

#### Milestone 0: ✅ Complete (Scaffold)
- [x] Next.js 14 + React 18 + TypeScript scaffolded
- [x] Firebase SDK configured (client-side)
- [x] Cloud Functions scaffolded
- [x] Emulator configuration ready
- [x] Types defined from DATA_MODEL.md
- [x] Landing page loads successfully
- [x] TypeScript compiles with no errors

#### Milestone 1: ✅ Complete (Auth + Pool Membership)
- [x] Firebase Auth with Google sign-in
- [x] Create pool with auto-generated joinCode
- [x] Join pool via joinCode
- [x] Members list renders
- [x] Pool detail page with member avatars
- [x] User profile management

#### Milestone 2: ✅ Complete (Fixtures & Round View)
- [x] Six Nations 2025 fixtures (15 matches, 5 rounds)
- [x] Seed utility + API route (`/api/seed`)
- [x] Round navigation from pool detail
- [x] Round view page with match cards
- [x] Pick UI (winner + margin 1-99)
- [x] Kickoff times in local timezone
- [x] No persistence yet (autosave in M3)

#### Milestone 3: ✅ Complete (Autosave Picks + Status Dots)
- [x] Dual-doc pattern (picks_detail + picks_status)
- [x] Autosave picks (500ms debounced)
- [x] Batched writes to Firestore
- [x] Load existing picks on page load
- [x] Real-time status listeners
- [x] Status dots: No pick / Picked / Locked
- [x] Member status list per match
- [x] Pick details hidden from others
- [x] Visual save feedback

#### Milestone 4: ✅ Complete (Per-match Irreversible Locking)
- [x] `lockPick` Cloud Function (callable) — verifies membership, kickoff > now, completeness; sets `lockedAt` atomically
- [x] `autoLockMatch` Cloud Function (HTTPS) — Cloud Tasks target; locks all complete picks for a match at kickoff
- [x] `onMatchWrite` Firestore trigger — enqueues a named Cloud Task (`autolock-{matchId}`) at `kickoffAt`; idempotent re-enqueue when kickoff changes
- [x] Lock button per match (only shown when pick is complete and unlocked)
- [x] "Lock all completed (N)" bulk action on round page
- [x] Locked picks render read-only (inputs disabled, blue locked banner)
- [x] `lockedAt` denormalized into picks docs; security rules enforce before-kickoff writes only
- [x] Security rules: client can never write `lockedAt != null`; writes denied once doc is locked or past kickoff
- [x] Testing: `autoLockMatch` accepts direct POST in emulator (`curl http://localhost:5001/.../autoLockMatch`)

**Next:** Milestone 5 — Full security rules + visibility (locked-both reveal, post-kickoff reveal)
