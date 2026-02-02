# Milestone 0: Scaffold — ✅ COMPLETE

## Objective
Scaffold Next.js frontend and Firebase configuration with local emulator setup.

## ✅ Deliverables Completed

### Project Structure
```
rugby-predictor/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx             # Landing page
│   │   └── globals.css          # Tailwind CSS
│   ├── lib/
│   │   ├── firebase.ts          # Firebase SDK initialization (client)
│   │   └── types.ts             # TypeScript interfaces from DATA_MODEL.md
│   ├── components/              # (empty, ready for Milestone 1)
│   └── hooks/                   # (empty, ready for Milestone 1)
├── functions/
│   ├── src/
│   │   └── index.ts             # Cloud Functions entry (placeholder)
│   ├── package.json
│   └── tsconfig.json
├── docs/                        # (already existed with specs)
├── firebase.json                # Firebase services config
├── .firebaserc                  # Project ID placeholder
├── firestore.rules              # Basic emulator-friendly rules
├── .env.example                 # Template for Firebase config
├── .env.local                   # Local emulator config (gitignored)
├── .gitignore                   # Next.js + Firebase
├── package.json                 # Frontend dependencies
├── next.config.js               # Standard Next.js App Router
├── tsconfig.json                # Strict TypeScript config
├── tailwind.config.js           # Tailwind CSS config
└── postcss.config.js            # PostCSS config
```

### Frontend Stack
- **Next.js 14.2** with App Router
- **React 18.3**
- **TypeScript 5.4** (strict mode)
- **Tailwind CSS 3.4**
- **Firebase SDK 10.12** (client-side)

### Firebase Services Configured
1. ✅ **Authentication** (emulator port 9099)
2. ✅ **Cloud Firestore** (emulator port 8080)
3. ✅ **Cloud Functions** (emulator port 5001)
4. ✅ **Emulator UI** (port 4000)

### Cloud Functions
- **firebase-functions 5.0**
- **firebase-admin 12.0**
- TypeScript compiled successfully
- Health check endpoint placeholder

## ✅ Verification Status

| Requirement | Status | Evidence |
|------------|--------|----------|
| npm install completes | ✅ | 463 frontend + 237 functions packages |
| npm run dev starts | ✅ | Server runs on localhost:3000 |
| Landing page loads | ✅ | Shows "Six Nations Predictor" with Milestone 0 badge |
| Firebase config present | ✅ | firebase.json, .firebaserc, firestore.rules |
| TypeScript compiles | ✅ | Both frontend and functions build with 0 errors |
| Basic routing exists | ✅ | App Router with layout.tsx and page.tsx |
| Emulator config ready | ✅ | firebase.json with all emulator ports |

## 📝 Implementation Notes

### Changes from Initial Proposal (per user request)
1. ✅ **No `output: 'export'`** — Standard Next.js App Router preserved
2. ✅ **`.env.example` instead of `.env.local.example`** — Naming convention followed
3. ✅ **Emulator-friendly firestore.rules** — Allows auth'd users for development

### TypeScript Types
Created comprehensive interfaces matching `docs/DATA_MODEL.md`:
- Season, Match, Pool, PoolMember
- PickStatus, PickDetail
- Leaderboard, RoundScore, ScoringRun
- Helper types for client-side views

### Firebase SDK Setup
- Client-side initialization in `src/lib/firebase.ts`
- Auto-connects to emulators when `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`
- Singleton pattern to prevent re-initialization
- Graceful error handling for emulator connections

### Development Environment
- `.env.local` created with placeholder values for emulator use
- `.env.example` serves as template for production config
- Git ignores secrets (`.env.local` in `.gitignore`)

## 🚀 Next Steps (Milestone 1)

**Focus:** Auth + Pool membership

Tasks:
1. Implement Firebase Auth (Google provider)
2. Create pool (name, seasonId, joinCode generation)
3. Join pool via joinCode
4. Members list component
5. Auth-protected routes

**Done looks like:**
- Users can sign in with Google
- Users can create/join pools
- Members appear in pool member list

## 📚 Commands Reference

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Development
npm run dev                    # Next.js dev server
npm run emulators              # Firebase emulators

# Build
npm run build                  # Production build
cd functions && npm run build  # Compile functions

# Type checking
npx tsc --noEmit              # Frontend types
cd functions && npm run build  # Functions types
```

## ⚠️ Known Limitations

1. **Emulators require Java JRE** — Not installed in current environment, but configuration is complete
2. **No real Firebase project** — Using placeholder project ID "six-nations-predictor-dev"
3. **Security rules basic** — Full rules implementation deferred to Milestone 5
4. **No real secrets** — `.env.local` contains placeholder values for emulator-only use

---

**Milestone 0 Status: ✅ COMPLETE**

All scaffolding requirements met. Ready to proceed with Milestone 1 (Auth + Pools).
