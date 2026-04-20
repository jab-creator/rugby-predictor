# Testing Guide: Milestone 3 — Autosave + Real-Time Status

## Overview
This guide covers testing the autosave functionality and real-time status updates implemented in Milestone 3.

## Prerequisites
- Firebase emulators running
- Dev server running
- 2 browsers/windows (for multi-user testing)

---

## Setup

### Terminal 1: Firebase Emulators
```bash
npm run emulators
```

Wait for: `✔ All emulators ready!`

### Terminal 2: Dev Server
```bash
npm run dev
```

Wait for: `Ready on http://localhost:3000`

---

## Part 1: Single-User Autosave Testing

### Test 1.1: Initial Pick Creation

1. **Sign in**
   - Visit: http://localhost:3000
   - Click "Sign In with Google"
   - Use: `user1@test.com`

2. **Create pool**
   - Click "Create Pool"
   - Name: "Test Pool"
   - Season: "six-nations-2025"
   - Click "Create Pool"
   - **Note the join code** (e.g., "A3K7WN")

3. **Navigate to Round 1**
   - Click "Round 1" button
   - Should see 3 matches

4. **Make a pick**
   - Match 1 (France vs Wales)
   - Click on **France** (home team)
   - Should see: Blue border + checkmark on France
   - Enter margin: **7**
   - **Wait 1 second**

5. **Verify saving**
   - Should see: "💾 Saving..."
   - Then: "✓ Saved just now"

6. **Check Firestore**
   - Open: http://localhost:4000
   - Navigate: `/pools/{poolId}/picks_detail`
   - Should see 1 document: `six-nations-2025-r1-FRA-WAL_user1-id`
   - Fields:
     - `pickedWinnerTeamId`: "FRA"
     - `pickedMargin`: 7
     - `updatedAt`: recent timestamp

7. **Check picks_status**
   - Navigate: `/pools/{poolId}/picks_status`
   - Should see 1 document: `six-nations-2025-r1-FRA-WAL_user1-id`
   - Fields:
     - `isComplete`: true
     - `lockedAt`: null
     - `updatedAt`: recent timestamp

✅ **Expected:** Pick saves automatically to both collections

---

### Test 1.2: Pick Persistence

1. **Refresh page** (F5 or Cmd+R)
2. **Navigate back to Round 1**
3. **Verify pick loaded**
   - France should be selected (blue border + checkmark)
   - Margin should show: 7
   - Status: "✓ Pick Complete"

✅ **Expected:** Pick loads from Firestore on page load

---

### Test 1.3: Pick Update

1. **Change winner**
   - Click on **Wales** (away team)
   - France should deselect
   - Wales should select (blue border + checkmark)

2. **Change margin**
   - Clear current value
   - Enter: **12**
   - Wait 1 second

3. **Verify saving**
   - Should see: "💾 Saving..."
   - Then: "✓ Saved just now"

4. **Check Firestore**
   - Reload Firestore UI
   - Same document should update:
     - `pickedWinnerTeamId`: "WAL"
     - `pickedMargin`: 12
     - `updatedAt`: newer timestamp

✅ **Expected:** Updates overwrite previous pick

---

### Test 1.4: Debounced Saves

1. **Rapid changes**
   - Click France
   - Click Wales
   - Click France
   - Click Wales
   - Enter margin: 5
   - Change to: 8
   - Change to: 15
   - **All within 2 seconds**

2. **Verify single save**
   - Should see "Saving..." only once
   - After changes settle
   - Final values saved: Wales, 15

3. **Check Firestore**
   - Only 1 write should occur
   - Final state: Wales, 15

✅ **Expected:** Debouncing prevents excessive writes

---

## Part 2: Multi-User Real-Time Status

### Setup: User 2

1. **Open incognito/private window**
2. Visit: http://localhost:3000
3. Sign in as: `user2@test.com`
4. Click "Join Pool"
5. Enter join code from User 1
6. Click "Join Pool"
7. Navigate to Round 1

---

### Test 2.1: Initial Status Visibility

1. **User 2 views Match 1**
   - Scroll to "Pool Status" section
   - Should see 2 members:
     - User 1: 🟢 Green dot
     - User 2: 🔘 Gray dot
   - Header: "Pool Status (1/2 picked)"

2. **Verify privacy**
   - User 2 **cannot see** France or 12
   - Only sees green dot

✅ **Expected:** Status visible, details hidden

---

### Test 2.2: Real-Time Status Update (User 2 → User 1)

**User 2 window:**

1. **Make pick on Match 1**
   - Click **France**
   - Enter margin: **3**
   - Wait 1 second
   - Should see: "✓ Saved just now"

**User 1 window (DO NOT REFRESH):**

2. **Check status update**
   - Status should auto-update:
     - User 1: 🟢 Green dot
     - User 2: 🟢 Green dot (NEW)
   - Header: "Pool Status (2/2 picked)" (NEW)

3. **Verify no pick details**
   - User 1 **cannot see** User 2's France or 3
   - Only sees green dot

✅ **Expected:** Real-time update without refresh

---

### Test 2.3: Real-Time Update on Pick Change (User 1 → User 2)

**User 1 window:**

1. **Change pick on Match 2**
   - Match 2 (Italy vs Scotland)
   - Click **Scotland**
   - Enter margin: **8**
   - Wait 1 second

**User 2 window (DO NOT REFRESH):**

2. **Check status update**
   - Match 2 status should update:
     - User 1: 🟢 Green dot (NEW)
     - User 2: 🔘 Gray dot
   - Header: "Pool Status (1/2 picked)"

✅ **Expected:** Real-time update on different match

---

### Test 2.4: Simultaneous Picks

**Both users simultaneously:**

1. **User 1: Match 3**
   - Click Ireland
   - Enter: 5

2. **User 2: Match 3** (at same time)
   - Click England
   - Enter: 10

3. **Wait 2 seconds**

4. **Both check status**
   - User 1: 🟢 Green dot
   - User 2: 🟢 Green dot
   - Header: "Pool Status (2/2 picked)"

5. **Check Firestore**
   - 2 separate documents:
     - `{matchId}_user1-id` → Ireland, 5
     - `{matchId}_user2-id` → England, 10

✅ **Expected:** No conflicts, both saved independently

---

## Part 3: UI/UX Testing

### Test 3.1: Status Legend

1. **Round 1 view**
2. **Top of page** should show:
   ```
   🔘 No pick    🟢 Picked    🔵 Locked
   ```

✅ **Expected:** Legend displays at top

---

### Test 3.2: Member Sorting

1. **Create pool as User 1** (creator)
2. **User 2 joins**
3. **User 3 joins** (sign in as `user3@test.com`)

4. **Check member list**
   - Order should be:
     1. User 1 👑 (creator first)
     2. User 2 (alphabetical)
     3. User 3 (alphabetical)

✅ **Expected:** Creator first, then alphabetical

---

### Test 3.3: Pick Count Accuracy

1. **Round with 3 matches**
2. **3 pool members**

**Match 1:**
- User 1: Picked
- User 2: No pick
- User 3: No pick
- **Status:** "Pool Status (1/3 picked)"

**Match 2:**
- User 1: Picked
- User 2: Picked
- User 3: No pick
- **Status:** "Pool Status (2/3 picked)"

**Match 3:**
- User 1: Picked
- User 2: Picked
- User 3: Picked
- **Status:** "Pool Status (3/3 picked)"

✅ **Expected:** Count updates correctly per match

---

## Part 4: Edge Cases

### Test 4.1: Incomplete Pick (No Save)

1. **Click winner** (France)
2. **Don't enter margin**
3. **Wait 2 seconds**
4. **Check Firestore**
   - No document should be created
   - "Select winner and margin" message

✅ **Expected:** Incomplete picks don't save

---

### Test 4.2: Invalid Margin

1. **Click winner** (France)
2. **Enter margin: 0**
   - Should reject
3. **Enter margin: 100**
   - Should reject
4. **Enter margin: 50**
   - Should accept and save

✅ **Expected:** Only 1-99 margins accepted

---

### Test 4.3: Network Error Simulation

1. **Make pick**
2. **Stop emulator** (Ctrl+C)
3. **Try to make another pick**
4. **Check console** for error
5. **Restart emulator**
6. **Reload page**
7. **Original pick should still be there**

✅ **Expected:** Graceful error handling

---

### Test 4.4: Rapid Round Switching

1. **Round 1** → Pick France, 7
2. **Immediately switch to Round 2**
3. **Pick Scotland, 5**
4. **Immediately switch to Round 3**
5. **Pick Ireland, 3**
6. **Check Firestore**
   - All 3 picks should save correctly

✅ **Expected:** No data loss on rapid navigation

---

## Part 5: Performance Testing

### Test 5.1: Load Time with Picks

1. **Create 3 rounds of picks** (9 matches)
2. **Reload page**
3. **Navigate to round with picks**
4. **Time should be < 2 seconds**

✅ **Expected:** Fast loading with multiple picks

---

### Test 5.2: Real-Time Update Latency

1. **User 1 makes pick**
2. **Time until User 2 sees update**
3. **Should be < 1 second**

✅ **Expected:** Near-instant updates

---

## Part 6: Firestore Verification

### Check Data Structure

**picks_detail document:**
```javascript
{
  matchId: "six-nations-2025-r1-FRA-WAL",
  userId: "user1-firebase-uid",
  pickedWinnerTeamId: "FRA",
  pickedMargin: 7,
  updatedAt: Timestamp(2025-01-15 10:30:00)
}
```

**picks_status document:**
```javascript
{
  matchId: "six-nations-2025-r1-FRA-WAL",
  userId: "user1-firebase-uid",
  isComplete: true,
  lockedAt: null,
  finalizedAt: null,
  updatedAt: Timestamp(2025-01-15 10:30:00)
}
```

✅ **Expected:** Both collections have matching documents

---

## Verification Checklist

### Autosave
- [ ] Picks save automatically after 500ms
- [ ] Debouncing prevents multiple writes
- [ ] "Saving..." indicator shows
- [ ] "Saved" confirmation shows
- [ ] Picks persist across reloads

### Real-Time Status
- [ ] Status updates without refresh
- [ ] Updates appear within 1 second
- [ ] All users see updates
- [ ] Pick count updates correctly

### Privacy
- [ ] Pick details hidden from others
- [ ] Only status dots visible
- [ ] User can edit own picks
- [ ] Other users can't edit

### UI/UX
- [ ] Status legend displays
- [ ] Member list sorted correctly
- [ ] Creator crown shows
- [ ] Avatars/initials display
- [ ] Status dots colored correctly

### Data Integrity
- [ ] Both collections updated
- [ ] Document IDs match pattern
- [ ] Timestamps are accurate
- [ ] No orphaned documents

---

## Common Issues

### Issue: "Saving..." never completes
**Cause:** Emulator not running or connection error  
**Fix:** Check emulator is running on port 8080

### Issue: Status doesn't update in real-time
**Cause:** Listener not subscribed or unmounted early  
**Fix:** Check console for errors, verify subscription

### Issue: Pick details visible to others
**Cause:** Using wrong collection (detail instead of status)  
**Fix:** Verify MemberStatusList uses picks_status

### Issue: Picks not loading on page load
**Cause:** getUserPick() not called or wrong matchId  
**Fix:** Check MatchCard useEffect dependencies

---

## Success Criteria

✅ All autosave tests pass  
✅ All real-time tests pass  
✅ All UI/UX tests pass  
✅ All edge cases handled  
✅ Performance acceptable  
✅ Data structure correct  

**Milestone 3 testing complete!** 🎉
