# Nations Championship Predictor

A modern rugby predictor platform focused on universal scoring with dynamic competition contexts. Users make predictions once, earn one tournament score, and compare across global, country, hemisphere, pundit, and knockout experiences.

## Tech stack (locked)
- Firebase Auth
- Cloud Firestore
- Cloud Functions
- Cloud Scheduler
- Firebase Hosting
- Frontend: Next.js

## Specs (source of truth)
- [Product rules](docs/PRODUCT.md)
- [Scoring rules](docs/SCORING.md)
- [Firestore data model](docs/DATA_MODEL.md)
- [Security rules intent](docs/SECURITY_RULES.md)
- [Build plan](docs/BUILD_PLAN.md)

## Locked product principles
- Universal scoring: one tournament score per user
- Pools/leaderboards change rank context, not points
- No pool-specific scoring modifiers or “closest per pool” bonuses
- Public pools (global/country/hemisphere/fans-vs-pundits) are dynamic slices
- Manual pool membership is for private/pundit/challenge/knockout use cases
- Leaderboards are precomputed (including rank)

## Competition types
- Public dynamic pools (global/country/hemisphere/fans vs pundits)
- Invite/manual pools (pundit, private, challenge)
- Knockout pools (qualification snapshot, then bracket rounds)

## Local dev

### Prerequisites
- Node.js 18+ (tested with 22.x)
- Java JDK 21+ for Firebase emulators

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

#### Firebase Emulators
```bash
npm run emulators
```
- Emulator UI: http://localhost:4000
- Auth Emulator: http://localhost:9099
- Firestore Emulator: http://localhost:8080
- Functions Emulator: http://localhost:5001

## Project structure
```
rugby-predictor/
├── src/                    # Next.js app
├── functions/              # Cloud Functions
├── docs/                   # Product/spec docs
├── firebase.json           # Firebase config
└── firestore.rules         # Security rules
```
