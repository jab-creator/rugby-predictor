# Closest Bonus Removal Summary

## Change Overview

The **closest bonus** scoring feature has been completely removed from the Nations Championship Predictor to simplify the scoring system.

## Rationale

- Eliminates confusion about whether closest bonus should be pool-specific or global
- Simplifies scoring implementation
- Reduces complexity in testing and maintenance
- Makes scoring rules easier to understand for users

---

## Scoring Changes

### Before (With Closest Bonus)

**Non-draw match:**
- Correct winner: 10 points
- Margin accuracy: 0-10 points (based on error)
- Closest bonus: 0-5 points (global, split among users with minimum error)
- **Max: 25 points**

**Draw match:**
- Margin accuracy: 0-10 points
- Closest bonus: 0-5 points
- **Max: 15 points**

### After (Without Closest Bonus)

**Non-draw match:**
- Correct winner: 10 points
- Margin accuracy: 0-10 points (based on error)
- **Max: 20 points**

**Draw match:**
- Margin accuracy: 0-10 points
- **Max: 10 points**

### Scoring Formula (Simplified)

```javascript
// Non-draw
if (pickedWinner === actualWinner) {
  totalPoints = 10 + marginBonus(err);
} else {
  totalPoints = 0;
}

// Draw
totalPoints = marginBonus(err);

// Margin bonus table unchanged:
// err 0-2  => 10 points
// err 3-5  => 7 points
// err 6-9  => 5 points
// err 10-14 => 2 points
// err >=15 => 0 points
```

---

## Files Updated

### 1. docs/SCORING.md ✅
**Changes:**
- Removed `CLOSEST_POOL = 5` constant
- Removed "Closest bonus (GLOBAL, per match)" section from non-draw scoring
- Removed closest bonus calculation from draw scoring
- Updated max points: non-draw 25 → **20**, draw 15 → **10**
- Simplified Universal Scoring Flow (removed step 3: "Compute closest bonus globally")
- Updated examples to reflect new max points
- Removed closest bonus from Critical Rules and Testing sections

### 2. docs/DATA_MODEL.md ✅
**Changes:**
- Removed `closestBonus?: number` field from `predictions/{userId_matchId}` schema
- Updated `totalPoints` comment to: "10 (winner) + marginBonus, or 0 if wrong winner"
- Removed step 4 from Scoring Flow: "Compute global `closestBonus`..."
- Updated totalPoints calculation in step 3
- Updated Key Rules DON'T section: removed "closest in X pool" reference

### 3. README.md ✅
**Changes:**
- Updated "No Pool-Specific Scoring" section
- Changed from: "Do **NOT** give bonus points for 'closest in X pool'"
- Changed to: "Do **NOT** give bonus points based on pool membership or ranking"

### 4. docs/PRODUCT.md ✅
**Changes:**
- Updated "No Pool-Specific Scoring" section (same as README.md)

### 5. docs/BUILD_PLAN.md ✅
**Changes:**
- Milestone 6 In Scope: "winner, margin, closest GLOBALLY" → "winner, margin accuracy"
- Milestone 6 Done looks like: "Tests verify closest bonus is global" → "Tests verify scoring is universal"
- Kickoff prompt: "Jest tests for all scoring rules + global closest bonus" → "Jest tests for all scoring rules (winner gate, margin bonuses, draws)"
- Kickoff prompt: "Key constraint: closest bonus is GLOBAL" → "Key constraint: scoring is universal"
- Key Reminders: "Test that closest bonus is global" → "Test that scoring is universal"

---

## Schema Changes

### `predictions/{userId_matchId}` (Before)
```typescript
{
  // Scoring fields
  winnerCorrect?: boolean;
  err?: number;
  marginBonus?: number;
  closestBonus?: number;     // ❌ REMOVED
  totalPoints?: number;
}
```

### `predictions/{userId_matchId}` (After)
```typescript
{
  // Scoring fields
  winnerCorrect?: boolean;
  err?: number;
  marginBonus?: number;
  totalPoints?: number;      // 10 + marginBonus, or 0 if wrong winner
}
```

---

## Implementation Impact

### Simplified Scoring Flow

**Before (7 steps):**
1. Fetch predictions
2. Compute winnerCorrect, err, marginBonus for each
3. **Compute global closestBonus (min err, split pool of 5)** ← Removed
4. Update predictions with scoring fields
5. Update user_tournament_stats
6. Propagate to leaderboards

**After (5 steps):**
1. Fetch predictions
2. Compute winnerCorrect, err, marginBonus for each
3. Update predictions with scoring fields (totalPoints = winner correct ? 10 + marginBonus : 0)
4. Update user_tournament_stats
5. Propagate to leaderboards

### Benefits

✅ **Simpler implementation** - No need to find global minimum error and split bonus  
✅ **Easier testing** - No edge cases for tied closest predictions  
✅ **Faster computation** - One less pass through predictions  
✅ **Clearer user experience** - Points are purely based on your own prediction accuracy  
✅ **No pool confusion** - Eliminates any debate about pool-specific vs global closest

---

## Testing Updates

### Before
- Verify closest bonus is calculated globally
- Verify closest bonus split correctly among tied users
- Verify closest bonus not calculated per pool

### After
- Verify scoring is universal and identical for all users
- Verify wrong winner = 0 points (strict gate)
- Verify max points: 20 (correct winner + err 0-2), 10 (draw + err 0-2)
- Verify margin bonus applied correctly at all error levels

---

## Migration Notes

**Current implementation (Milestone 4):**
- Does NOT yet implement scoring engine
- Scoring changes will be implemented in Milestone 6

**No data migration needed** since scoring hasn't been implemented yet.

If scoring HAD been implemented with closest bonus:
1. Re-run scoring for all finalized matches
2. Recalculate user_tournament_stats totals
3. Regenerate all leaderboards

---

## Summary

**What changed:** Removed closest bonus feature entirely

**Impact on scoring:**
- Max points reduced: 25 → 20 (non-draw), 15 → 10 (draw)
- Scoring formula simplified
- Universal scoring principle maintained
- Implementation complexity reduced

**Status:** ✅ All documentation updated, all references removed

**Next:** Implement universal scoring engine in Milestone 6 using simplified rules
