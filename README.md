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

## Local dev (placeholder)
This will be filled once the project is scaffolded.
