# Scoring Spec (LOCKED)

> Do not change without explicit instruction.

## Inputs
Each prediction is:
- `pickedWinner` (team)
- `pickedMargin` (int 1–99)

Match result provides:
- `actualWinner` (team) if non-draw
- `actualMargin = abs(homeScore - awayScore)`
- `isDraw = (homeScore == awayScore)`

## Constants
- Winner points: `WINNER_PTS = 10`
- Closest bonus pool: `CLOSEST_POOL = 5`

Margin bonus is based on:
`err = abs(pickedMargin - actualMargin)`

Margin bonus table (points):
- err 0–2  => 10
- err 3–5  => 7
- err 6–9  => 5
- err 10–14 => 2
- err >=15 => 0

## Non-draw match scoring
### Winner gate (strict)
If `pickedWinner != actualWinner`:
- total points = 0
- not eligible for closest bonus

If `pickedWinner == actualWinner`:
- base = 10 + marginBonus(err)
- eligible for closest bonus if `err <= 14`

### Closest bonus (per pool, per match)
- Consider only eligible predictions (winner correct AND err <= 14)
- Find minimum `err`
- Let `k` = count of predictions with `err == minErr`
- Each tied user gets: `closestBonus = floor(5 / k)`
- Leftover points are discarded

Total for a correct-winner prediction:
`total = 10 + marginBonus + closestBonus`

Max per non-draw match: 25

## Draw match scoring (margin still pays)
On a draw:
- winner points are always 0 (no one can have correct winner)
- `actualMargin = 0`
- `err = abs(pickedMargin - 0) = pickedMargin`
- base = marginBonus(err)
- eligible for closest if `err <= 14` (no winner condition on draw)

Closest bonus works the same:
- eligible: err <= 14
- min err ties split with floor(5/k)

Total on draw:
`total = marginBonus + closestBonus`

Max on draw: 15

## Examples
- Non-draw: correct winner, predicted margin 8, actual margin 10 => err=2 => marginBonus=10
- Draw: predicted margin 2 => err=2 => marginBonus=10
