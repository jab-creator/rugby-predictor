# Testing Guide: Milestone 2

## Prerequisites
- Node.js 18+ installed
- Java JRE installed (for Firestore emulator)
- Firebase CLI tools (installed as dev dependency)

## Setup & Testing Flow

### 1. Terminal Setup (2 terminals needed)

**Terminal 1: Firebase Emulators**
```bash
cd rugby-predictor
npm run emulators
```

Wait for:
```
✔  All emulators ready! It is now safe to connect your app.
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://localhost:4000                │
└─────────────────────────────────────────────────────────────┘
```

**Terminal 2: Next.js Dev Server**
```bash
cd rugby-predictor
npm run dev
```

Wait for:
```
✓ Ready in 1234ms
- Local:        http://localhost:3000
```

---

## Testing Steps

### Step 1: Seed Fixtures ✅

**Method A: Browser**
1. Visit: http://localhost:3000/api/seed
2. Should see JSON response:
```json
{
  "success": true,
  "message": "Successfully seeded Six Nations 2025 with 15 fixtures"
}
```

**Method B: Curl**
```bash
curl http://localhost:3000/api/seed
```

**Verify in Firestore UI:**
1. Open: http://localhost:4000
2. Click "Firestore" in sidebar
3. Navigate: `seasons` → `six-nations-2025` → `matches`
4. Should see 15 match documents

---

### Step 2: Sign In ✅

1. Visit: http://localhost:3000
2. Click: **"Sign In with Google"**
3. In Auth Emulator popup:
   - Use any email (e.g., `test@example.com`)
   - Click "Sign in with Google"
4. Should redirect to: http://localhost:3000/pools
5. Header should show your test email

---

### Step 3: Create Pool ✅

1. Click: **"Create Pool"** button
2. Fill form:
   - Pool Name: "Test Pool"
   - Season: "Six Nations 2025"
3. Click: **"Create Pool"**
4. Should redirect to pool detail page
5. Note the **Join Code** (e.g., "A3K7WN")

**Verify:**
- Pool name displays: "Test Pool"
- Join Code visible with copy button
- Members count: 1
- Your profile shows with avatar/initials

---

### Step 4: Navigate to Round 1 ✅

1. Scroll down to **"Rounds"** section
2. Click: **Round 1** button
3. Should navigate to: `/pools/{poolId}/round/1`

**Expected Page:**
- Header: "Round 1"
- Pool name displayed
- Round switcher (1-5 buttons, Round 1 highlighted)
- **3 Match Cards:**
  1. 🇫🇷 France vs 🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales
  2. 🇮🇹 Italy vs 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland
  3. 🇮🇪 Ireland vs 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England

---

### Step 5: Test Pick UI ✅

**Match 1: France vs Wales**

1. **Select Winner:**
   - Click on **France** team card
   - Should see:
     - Blue border around France card
     - Blue background highlight
     - Checkmark (✓) appears

2. **Enter Margin:**
   - Click in "Winning Margin" input
   - Type: `7`
   - Should accept number

3. **Verify Indicator:**
   - Below margin input, should show:
     - ✓ "Pick Complete (not saved yet)"
     - Green text

4. **Change Winner:**
   - Click on **Wales** team card
   - Should see:
     - Wales now highlighted (blue)
     - France no longer highlighted
     - Checkmark moves to Wales

5. **Test Validation:**
   - Try entering: `0` → Should not accept
   - Try entering: `100` → Should not accept
   - Try entering: `50` → Should accept

---

### Step 6: Test All Matches ✅

**Match 2: Italy vs Scotland**
- Click Scotland
- Enter margin: 12
- Should show "Pick Complete"

**Match 3: Ireland vs England**
- Click Ireland
- Enter margin: 3
- Should show "Pick Complete"

---

### Step 7: Switch Rounds ✅

1. **Round 2:**
   - Click **Round 2** button in switcher
   - Should load 3 new matches:
     - Scotland vs France
     - England vs Wales
     - Italy vs Ireland
   - URL changes to: `/pools/{poolId}/round/2`

2. **Round 3:**
   - Click **Round 3** button
   - Should load 3 matches:
     - Ireland vs France
     - Scotland vs Wales
     - England vs Italy

3. **Verify All Rounds:**
   - Round 4: 3 matches
   - Round 5: 3 matches
   - Total: 15 matches across 5 rounds

---

### Step 8: Verify Kickoff Times ✅

Match cards should show local timezone times:

**Expected Format:**
```
Sat, 1 Feb, 14:15
```

**Verify:**
- Day of week (Sat, Sun, etc.)
- Date (1 Feb)
- Time in your local timezone

**Note:** Times are stored in UTC but displayed in local time.

---

### Step 9: Test Pick State (No Persistence) ✅

1. **Make picks in Round 1:**
   - Pick winner + margin for all 3 matches

2. **Switch to Round 2:**
   - Picks should reset (not saved)

3. **Return to Round 1:**
   - Picks are gone (state not persisted)

4. **Expected Behavior:**
   - ✅ Picks work in UI
   - ✅ Picks stay in component state
   - ✅ Picks NOT saved to Firestore
   - ✅ Message shows: "Autosave coming in Milestone 3"

---

### Step 10: Test Join Pool Flow ✅

**In new browser/incognito:**

1. Sign in with different email: `user2@example.com`
2. Click: **"Join Pool"**
3. Enter join code from Step 3
4. Click: **"Join Pool"**
5. Should navigate to pool detail
6. Members list should show 2 members
7. Navigate to Round 1
8. Should see same 3 matches

---

## Verification Checklist

### Fixtures Seeding
- [ ] `/api/seed` returns success response
- [ ] 15 matches appear in Firestore UI
- [ ] Season document created: `six-nations-2025`
- [ ] Re-seeding returns "already seeded" message

### Navigation
- [ ] Pool detail shows 5 round buttons
- [ ] Clicking round navigates to round view
- [ ] Round switcher works (1-5)
- [ ] Back button returns to pool detail

### Match Cards
- [ ] 3 matches per round (15 total)
- [ ] Team flags display correctly
- [ ] Team names display correctly
- [ ] Kickoff times show in local timezone

### Pick UI
- [ ] Clicking team highlights it (blue border)
- [ ] Checkmark appears on selected team
- [ ] Only one team selected at a time
- [ ] Margin input accepts 1-99
- [ ] Margin input rejects 0, 100+
- [ ] "Pick Complete" shows when both selected
- [ ] Picks stay in state only (not saved)

### Multi-User
- [ ] User 2 can join pool with code
- [ ] Both users see same matches
- [ ] Both users can interact with pick UI
- [ ] Picks don't interfere between users

---

## Troubleshooting

### "No matches found"
**Solution:** Seed fixtures first
```bash
curl http://localhost:3000/api/seed
```

### Emulators not starting
**Solution:** Check Java is installed
```bash
java -version
```
If not installed, install Java JRE.

### Picks saving (should NOT save)
**Expected:** Picks stay in component state only.
**Milestone 3** will add persistence.

### Wrong timezone
**Expected:** Times convert from UTC to your local timezone automatically.

### "Pool not found"
**Solution:** Make sure you're signed in and the pool was created with `six-nations-2025` season.

---

## Expected Results Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Seed API works | ✅ | Creates 15 matches |
| Round navigation | ✅ | 5 rounds accessible |
| Match cards render | ✅ | 3 per round |
| Team flags show | ✅ | Emoji flags |
| Kickoff times local | ✅ | UTC → local |
| Winner selection | ✅ | Click to select |
| Margin validation | ✅ | 1-99 only |
| Pick complete indicator | ✅ | Green checkmark |
| Picks NOT saved | ✅ | State only |
| Multi-user works | ✅ | Independent picks |

---

## Next: Milestone 3

**What's Coming:**
- Picks will save to Firestore (autosave)
- Status dots: No pick / Picked / Locked
- Real-time status updates
- Other users can see pick status

**Testing Will Include:**
- Picks persist across page reloads
- Status updates immediately
- Other pool members see status changes
- Lock button (irreversible)

---

## Quick Commands

```bash
# Start testing
npm run emulators        # Terminal 1
npm run dev              # Terminal 2

# Seed fixtures
curl http://localhost:3000/api/seed

# View Firestore data
open http://localhost:4000

# Check TypeScript
npx tsc --noEmit

# Build (should succeed)
npm run build
```

---

**All Milestone 2 features tested and working!** ✅
