# Six Nations Predictor

A modern, fast Six Nations predictor (SuperBru-style, but cleaner). Users join pools with friends and predict each match by picking **winner + margin**. Picks autosave, and users can **irreversibly lock** per match to reveal other locked picks.

## Tech stack (locked)
- Firebase Auth
- Cloud Firestore
- Cloud Functions
- Cloud Scheduler
- Firebase Hosting
- Frontend: Next.js (recommended) or React SPA

## Specs (source of truth)
- [Product rules](docs/PRODUCT.md)
- [Scoring rules](docs/SCORING.md) **(locked)**
- [Firestore data model](docs/DATA_MODEL.md)
- [Security rules intent](docs/SECURITY_RULES.md)
- [Build plan](docs/BUILD_PLAN.md)

## Locked decisions (do not change without explicit instruction)
- Six Nations only
- Predictions are **winner + margin** (margin 1–99)
- Autosaved complete pick counts as **Picked**
- Locking is **per match** and **irreversible**
- Before kickoff, users can see other users' **status** (No pick / Picked / Locked)
- Before kickoff, users can see other users’ **pick details** only if **both users locked** that match
- After kickoff, everyone can see everyone’s picks for that match
- Scoring system is universal and defined in `docs/SCORING.md`

## Local dev

### Prerequisites
- Node.js 18+ (tested with 22.x)
- Java JRE (required for Firebase Firestore emulator)

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

3. Build Cloud Functions:
   ```bash
   cd functions && npm run build && cd ..
   ```

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

**Next:** Milestone 4 — Lock picks + kickoff enforcement
