# Documentation Update Summary — General Rugby Predictor Platform

## Overview

The project documentation has been successfully updated to reflect the evolution from a Six Nations-only predictor to a **rugby predictor platform** with universal scoring, dynamic leaderboards, and knockout stages.

## Core Principle Changes

### Before (Six Nations Predictor)
- Six Nations tournament only
- Pool-based picks with pool-specific aggregations
- Leaderboards per pool

### After (General Rugby Predictor Platform)
- **Universal scoring** — one score per user per tournament
- **Dynamic pools** — global, country, hemisphere, pundits (calculated from user attributes)
- **Manual pools** — friends, challenges, knockout (stored memberships)
- **Precomputed leaderboards** — ranks computed after each match
- **Pools change ranking context, NOT scoring rules**

---

## Files Updated

### 1. README.md
**Changes:**
- Title changed to "Rugby Predictor"
- Added feature highlights: public global competition, dynamic pools, knockout stages
- **Added "Core Principles" section** emphasizing:
  - Single source of truth for scoring
  - No pool-specific scoring
  - Dynamic vs manual pools
- Removed "Six Nations only" from locked decisions
- Updated locked decisions to emphasize universal scoring

**Key sections:**
- ✅ Single Source of Truth for Scoring
- ✅ No Pool-Specific Scoring  
- ✅ Dynamic Pools (Calculated, Not Stored)
- ✅ Manual Pools (Stored Membership)

---

### 2. docs/PRODUCT.md
**Changes:**
- Goal updated to general rugby prediction platform
- Added "Evolution" section explaining transition from Six Nations
- Added "Core Principles" section (matching README)
- **Updated user flows:**
  - Making predictions (core flow)
  - Global leaderboards (dynamic)
  - Manual pools (friends, challenges)
  - Knockout stages
  - Viral features
  - Status visibility & reminders
  - After kickoff & scoring
- Updated UX notes to emphasize universal scoring display

**Key concepts added:**
- Tournament (not just Six Nations)
- User Tournament Stats (single source of truth)
- Dynamic Pools vs Manual Pools distinction
- Universal scoring principle

---

### 3. docs/DATA_MODEL.md
**Changes:**
- **Complete restructure** to support universal scoring architecture
- Added "Core Principle" header emphasizing single source of truth

**New collections:**
- ✅ `users/{userId}` — with `countryCode`, `hemisphere`, `isPundit` attributes
- ✅ `tournaments/{tournamentId}` — multi-tournament support
- ✅ `predictions/{userId_matchId}` — **universal predictions** (not pool-specific)
- ✅ `user_tournament_stats/{tournamentId_userId}` — **SINGLE SOURCE OF TRUTH** for scoring
- ✅ `leaderboards/{leaderboardId}` — precomputed dynamic leaderboards
- ✅ `leaderboards/{leaderboardId}/entries/{userId}` — precomputed ranks
- ✅ `knockout_brackets/{bracketId}` — knockout stage support

**Updated collections:**
- ✅ `pools/{poolId}` — now manual pools only (friends, pundits, challenges)
- ✅ `pools/{poolId}/entries/{userId}` — precomputed pool rankings (same scores, different ranks)

**Removed collections:**
- ❌ `pools/{poolId}/picks_detail` — replaced by universal `predictions`
- ❌ `pools/{poolId}/picks_status` — replaced by universal `predictions`
- ❌ `pools/{poolId}/leaderboard` — replaced by `pools/{poolId}/entries`

**Key sections:**
- Architecture Overview
- Detailed Schema
- Scoring Flow (Backend)
- Tiebreakers
- Key Rules (DO / DON'T)
- Indexes
- Migration Notes
- Updated schema with denormalization for filtering

---

### 4. docs/SCORING.md
**Changes:**
- Title changed to "Scoring Spec — Universal Scoring Rules"
- **Added "Core Principle: Universal Scoring" section** at top
- Updated "Closest bonus" section:
  - Changed from "per pool" to "GLOBAL"
  - Emphasized calculated across ALL users, not per pool
  - Added note: "Users earn the same closest bonus regardless of which pool they're in"
- **Added "Implementation Notes" section:**
  - Universal Scoring Flow (7 steps)
  - Critical Rules (DO / DON'T)
  - Testing guidelines

**Key additions:**
- ✅ Scoring is universal across all contexts
- ✅ NO pool-specific scoring
- ✅ Closest bonus is GLOBAL, not per pool
- ✅ Score stored in `user_tournament_stats`
- ✅ Leaderboards show same score, different rank

---

### 5. docs/BUILD_PLAN.md
**Changes:**
- **Complete restructure** with 15 milestones aligned to general rugby predictor architecture
- Added "Core Architecture Principles" section at top
- Restructured into 6 phases:

**Phase 1: Universal Predictions & Single Source of Truth**
- Milestone 5: Universal Predictions Collection
- Milestone 6: Universal Scoring Engine

**Phase 2: Dynamic Leaderboards**
- Milestone 7: User Attributes & Denormalization
- Milestone 8: Global & Dynamic Leaderboards

**Phase 3: Manual Pools & Pool Rankings**
- Milestone 9: Manual Pools with Universal Scoring

**Phase 4: Pundit Pools & Beat X%**
- Milestone 10: Pundit Pools

**Phase 5: Knockout Stages**
- Milestone 11: Knockout Qualification
- Milestone 12: Knockout Bracket Progression

**Phase 6: Viral Features & Polish**
- Milestone 13: Shareable Result Cards
- Milestone 14: Badges & Achievements (Non-Scoring)
- Milestone 15: Polish & Production Hardening

**Key additions:**
- ✅ Migration strategy from pool-based to universal
- ✅ Kickoff prompts for critical milestones
- ✅ Clear scope per milestone
- ✅ Phase-based organization
- ✅ Emphasis on testing universal scoring

---

## Critical Principles Emphasized Throughout

### 1. Single Source of Truth for Scoring
- Each user has **ONE score per tournament** in `user_tournament_stats`
- Scores are **NOT different per pool**
- Pools only change **who you are compared against**, not your points

**Example:** Josh = 82 points everywhere; Global rank = 14, Canada rank = 2

### 2. No Pool-Specific Scoring
- Do **NOT** calculate points differently per pool
- Do **NOT** give bonus points for "closest in X pool"
- Use **universal scoring rules** only

### 3. Dynamic Pools (Calculated, Not Stored)
These are **calculated from user attributes**:
- Global (all users)
- Country (by `countryCode`)
- Hemisphere (by `hemisphere`)
- Pundits (by `isPundit`)

### 4. Manual Pools (Stored Membership)
Only these require stored memberships:
- Pundit pools
- Private/friend pools
- Challenge pools
- Knockout qualification pools

### 5. Precomputed Leaderboards
- Ranks are **NOT calculated on the fly**
- Cloud Function computes ranks after each match
- Writes to `leaderboards/{leaderboardId}/entries/{userId}`

---

## Migration Path (from Current State)

**Current State (Milestone 4):**
- Pool-based picks: `pools/{poolId}/picks_detail` and `picks_status`
- Pool-specific leaderboards

**Target State:**
- Universal predictions: `predictions/{userId_matchId}`
- Single source of truth: `user_tournament_stats/{tournamentId_userId}`
- Dynamic leaderboards + manual pools

**Migration Strategy:**
1. Add `predictions` collection alongside existing picks (M5)
2. Implement universal scoring engine (M6)
3. Build dynamic leaderboards (M7-8)
4. Refactor pools to use universal scoring (M9)
5. Deprecate pool-specific picks (later)

---

## Testing Requirements

When implementing universal scoring:
- ✅ Verify closest bonus is calculated **globally**, not per pool
- ✅ Verify same score appears in **all leaderboards** for a user
- ✅ Verify rank **changes based on comparison group**, not score
- ✅ Test: Josh has 82 points in Global (rank 14) AND Canada (rank 2)

---

## Key Files Reference

For implementation, always refer to:
- **docs/PRODUCT.md** — User flows and product rules
- **docs/DATA_MODEL.md** — Collection schemas and architecture
- **docs/SCORING.md** — Universal scoring rules (locked)
- **docs/BUILD_PLAN.md** — Milestone roadmap

---

## What's NOT Changed

- ✅ Predictions are still **winner + margin** (1-99)
- ✅ Picks still **autosave**
- ✅ Locking is still **per match** and **irreversible**
- ✅ Visibility rules (lock/kickoff) unchanged
- ✅ Scoring constants (winner points, margin bonuses) unchanged
- ✅ Tech stack (Firebase, Next.js) unchanged
- ✅ Milestone 0-4 implementation unchanged (foundation is solid)

---

## Summary

**Status:** ✅ All documentation updated and aligned

**Next Steps:**
1. Review updated documentation to ensure understanding
2. Begin Milestone 5 (Universal Predictions Collection)
3. Implement Milestone 6 (Universal Scoring Engine) — most critical
4. Build dynamic leaderboards (M7-8)
5. MVP complete at Milestone 8

**Critical Success Factors:**
- Maintain single source of truth principle
- Test global closest bonus thoroughly
- Never calculate different scores per pool
- Precompute all leaderboards

The documentation now provides a clear, consistent roadmap for building the general rugby prediction platform with universal scoring at its core.
