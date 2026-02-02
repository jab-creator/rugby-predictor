# Milestone 2: Fixtures & Round View — ✅ COMPLETE

## Objective
Seed match fixtures and implement round view with pick UI (no saving yet).

## ✅ Deliverables Completed

### Fixtures & Season Data

✅ **Six Nations 2025 Fixtures** (`src/lib/fixtures.ts`)
- 15 matches across 5 rounds
- Realistic dates (Feb 1 - Mar 15, 2025)
- Proper Six Nations schedule (each team plays every other team once)
- Kickoff times in UTC (stored as Firestore Timestamps)
- Team data: names, flags (emojis), IDs

✅ **Seed Utility** (`src/lib/seed.ts`)
- `seedSixNations2025()` — Seeds season + all fixtures
- Idempotency check (prevents duplicate seeding)
- Writes to `/seasons/{seasonId}` and `/seasons/{seasonId}/matches/{matchId}`

✅ **Seed API Route** (`src/app/api/seed/route.ts`)
- `GET/POST /api/seed` — Dev-only endpoint to trigger seeding
- Returns JSON response with success/failure
- Works in browser or with curl

### Round Navigation & Views

✅ **Pool Detail Updates**
- Round navigation buttons (1-5) added to pool page
- Click to navigate to specific round view
- Responsive grid layout

✅ **Round View Page** (`src/app/pools/[poolId]/round/[round]/page.tsx`)
- Dynamic route with poolId and round params
- Loads matches for specific season + round
- Round switcher navigation (quick jump between rounds)
- Empty state with "Seed Fixtures" link if no matches
- Sorted by kickoff time

### Match Cards & Pick UI

✅ **Match Card Component** (`src/components/MatchCard.tsx`)
- Team flags and names
- Kickoff time (UTC → local timezone display)
- Winner selection (click team to select)
- Margin input (1-99 validation)
- Visual feedback (blue border/background when selected)
- Pick completeness indicator
- "Not saved yet" notice (Milestone 3 feature)

✅ **Pick UI Features**
- Winner selection: Click home or away team
- Selected team shows blue border + checkmark
- Margin input: Number field with 1-99 constraint
- Real-time validation
- Visual feedback for complete picks
- **No persistence** (as per spec — autosave in M3)

## 📂 Files Created (6 new files)

### Data & Utilities
1. `src/lib/fixtures.ts` — Six Nations 2025 season + fixtures data
2. `src/lib/seed.ts` — Seed functions for Firestore

### API Routes
3. `src/app/api/seed/route.ts` — Dev endpoint to trigger seeding

### Components
4. `src/components/MatchCard.tsx` — Match card with pick UI

### Pages
5. `src/app/pools/[poolId]/round/[round]/page.tsx` — Round view page

### Updated Files
6. `src/app/pools/[poolId]/page.tsx` — Added round navigation
7. `src/lib/pools.ts` — Added `getMatchesForRound()` function

## 🎯 Fixture Data Structure

### Season Document
```typescript
/seasons/six-nations-2025
{
  name: "Six Nations 2025",
  startsAt: Timestamp(2025-02-01),
  endsAt: Timestamp(2025-03-15)
}
```

### Match Documents
```typescript
/seasons/six-nations-2025/matches/{matchId}
{
  round: 1,
  kickoffAt: Timestamp(UTC),
  homeTeamId: "FRA",
  awayTeamId: "WAL",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  updatedAt: Timestamp
}
```

### Match ID Format
`{seasonId}-r{round}-{homeTeamId}-{awayTeamId}`

Example: `six-nations-2025-r1-FRA-WAL`

## 🏉 Six Nations 2025 Schedule

| Round | Date | Matches |
|-------|------|---------|
| 1 | Feb 1 | FRA vs WAL, ITA vs SCO, IRE vs ENG |
| 2 | Feb 8 | SCO vs FRA, ENG vs WAL, ITA vs IRE |
| 3 | Feb 22 | IRE vs FRA, SCO vs WAL, ENG vs ITA |
| 4 | Mar 8 | WAL vs ITA, IRE vs SCO, FRA vs ENG |
| 5 | Mar 15 | ITA vs FRA, WAL vs IRE, ENG vs SCO |

**Total:** 15 matches

## ✅ Verification Results

| Test | Status | Details |
|------|--------|---------|
| TypeScript compilation | ✅ | 0 errors |
| Production build | ✅ | All routes build successfully |
| New routes created | ✅ | `/api/seed` + `/pools/[poolId]/round/[round]` |
| Round navigation | ✅ | 5 round buttons on pool detail |
| Match cards render | ✅ | Team flags, times, pick UI |
| Pick UI works | ✅ | Winner selection + margin input |
| Validation working | ✅ | Margin 1-99 enforced |
| No persistence | ✅ | Picks stay in state only (as per spec) |

## 📝 How to Seed Fixtures

### Method 1: Browser (Easiest)
1. Start dev server: `npm run dev`
2. Start Firebase emulators: `npm run emulators` (separate terminal)
3. Visit: http://localhost:3000/api/seed
4. Response shows success/failure

### Method 2: Curl
```bash
curl -X POST http://localhost:3000/api/seed
```

### Method 3: From Round Page
If you navigate to a round with no matches, you'll see a "Seed Fixtures" button that opens `/api/seed` in a new tab.

### Seeding Response
```json
{
  "success": true,
  "message": "Successfully seeded Six Nations 2025 with 15 fixtures"
}
```

### Idempotency
Seeding checks if fixtures already exist. If found:
```json
{
  "success": false,
  "message": "Six Nations 2025 already seeded. Delete existing fixtures to re-seed."
}
```

## 🧪 How to Test in Emulators

### Full Test Flow

1. **Start Emulators**
   ```bash
   npm run emulators
   ```
   - Firestore UI: http://localhost:4000
   - Auth Emulator: http://localhost:9099

2. **Start Dev Server** (separate terminal)
   ```bash
   npm run dev
   ```
   - App: http://localhost:3000

3. **Sign In**
   - Click "Sign In with Google"
   - Use any test email in emulator (e.g., test@example.com)

4. **Seed Fixtures**
   - Visit http://localhost:3000/api/seed
   - OR go to any round page and click "Seed Fixtures"

5. **Verify Seeding** (Firestore UI)
   - Open http://localhost:4000
   - Check `/seasons/six-nations-2025`
   - Check `/seasons/six-nations-2025/matches` (should have 15 docs)

6. **Create/Join Pool**
   - Create a pool with seasonId: `six-nations-2025`
   - Note the joinCode

7. **Navigate to Rounds**
   - Go to pool detail page
   - Click any Round button (1-5)

8. **View Matches**
   - See 3 match cards per round
   - Kickoff times shown in local timezone

9. **Test Pick UI**
   - Click a team (should highlight with blue border + checkmark)
   - Enter margin (1-99)
   - See "Pick Complete (not saved yet)" indicator

10. **Switch Rounds**
    - Use round switcher at top
    - Each round shows different matches

## 🎨 UI Features Implemented

### Match Card Design
- **Team Selection**: Large clickable areas with flags + names
- **Visual Feedback**: Blue border/background when selected
- **Checkmark**: Shows on selected winner
- **Kickoff Display**: Local timezone (e.g., "Sat, 1 Feb, 14:15")
- **Margin Input**: Center-aligned, large font, numeric input
- **Status Indicator**: Green checkmark when pick complete
- **Reminder**: "Autosave coming in Milestone 3"

### Round Navigation
- **Pool Detail**: 5 round buttons in grid
- **Round View**: Round switcher bar with active state
- **Back Button**: Return to pool detail

### Responsive Layout
- 1 column (mobile)
- 2 columns (tablet)
- 3 columns (desktop)

## 🔒 Data Model Compliance

### Season Structure ✅
```typescript
interface Season {
  name: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
}
```

### Match Structure ✅
```typescript
interface Match {
  round: number;
  kickoffAt: Timestamp;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: Timestamp;
}
```

All fields match `docs/DATA_MODEL.md` exactly.

## 🚧 Known Limitations (By Design)

1. **No pick persistence** — Picks stay in component state only (Milestone 3)
2. **No pick status visibility** — Coming in Milestone 3 with `picks_status`
3. **Single season** — Only Six Nations 2025 seeded
4. **Manual seeding** — No automated fixture updates
5. **No live scores** — Matches are all "scheduled"

## 📊 Routes Summary

| Route | Type | Description |
|-------|------|-------------|
| `/` | Page | Landing (updated) |
| `/pools` | Page | Pool list |
| `/pools/create` | Page | Create pool |
| `/pools/join` | Page | Join pool |
| `/pools/[poolId]` | Page | Pool detail **+ Round nav** |
| `/pools/[poolId]/round/[round]` | Page | **NEW: Round view** |
| `/api/seed` | API | **NEW: Seed fixtures** |

## 🚀 Next Steps (Milestone 3)

**Focus:** Autosave picks + status dots

Tasks:
1. Implement batched writes to `picks_detail` and `picks_status`
2. Create real-time pick status listener
3. Show per-match status for all pool members (No pick / Picked / Locked)
4. Add status visibility UI in round view
5. Persist picks on every change (debounced)

**Done looks like:**
- Editing pick updates status immediately
- Other users see status change in real-time
- Pick completeness tracked in Firestore
- Round view shows who has picked

---

## 📚 Commands Reference

```bash
# Development
npm run dev                    # Next.js dev server
npm run emulators              # Firebase emulators

# Seeding
curl http://localhost:3000/api/seed     # Seed fixtures
# OR visit in browser: http://localhost:3000/api/seed

# Verification
npx tsc --noEmit              # Type check
npm run build                 # Production build

# Firestore UI
open http://localhost:4000    # View seeded data
```

## 🎉 Success Criteria Met

✅ Six Nations 2025 season + fixtures defined  
✅ Seed utility function created  
✅ Dev API route for seeding works  
✅ Round navigation added to pool detail  
✅ Round view page loads fixtures correctly  
✅ Match cards display with kickoff times (local)  
✅ Pick UI works (winner + margin 1-99)  
✅ Picks stay in state (no save yet, as per spec)  
✅ TypeScript compiles without errors  
✅ Production build succeeds  
✅ Emulator-friendly (no production dependencies)  

---

## 📸 Feature Highlights

### Match Card Features
- 🏴 Team flags (emoji)
- ⏰ Local timezone kickoff times
- ✓ Visual winner selection
- 🔢 Margin input validation (1-99)
- ✅ Pick completeness indicator
- 💡 "Not saved yet" reminder

### Round View Features
- 🏉 3 matches per round
- 🔄 Quick round switcher
- 📅 Sorted by kickoff time
- 📍 Back to pool navigation
- 🌐 Empty state with seed link

---

**Milestone 2 Status: ✅ COMPLETE**

All fixtures and round view features implemented. Pick UI working without persistence (as specified). Ready to proceed with Milestone 3 (Autosave Picks + Status).
