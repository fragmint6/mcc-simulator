# Boat Chemistry System

This document defines the official boat chemistry calculation used by the rowing simulator.

The goal of chemistry is to estimate how comfortable a lineup is rowing together based on two factors:

- Graduation year familiarity
- Previous lineups in the historical database

Boat chemistry is displayed as a percentage from **0–100**.

---

# Formula

```text
Chemistry = ClassBonus + LineupBonus
```

The final chemistry value is capped between **0 and 100**.

```text
Chemistry = min(100, ClassBonus + LineupBonus)
```

---

# Class Bonus

Crews made up of athletes from similar graduation years generally have more experience together.

First, calculate the average graduation year difference between every pair of rowers in the boat.

Example:

```text
2025
2025
2025
2025
2026
2026
2026
2027
```

Then award the following bonus:

| Average Year Difference | Class Bonus |
|------------------------:|------------:|
| 0.0 | +20 |
| 0.5 | +17 |
| 1.0 | +14 |
| 1.5 | +10 |
| 2.0 | +6 |
| 3.0 or greater | +0 |

If the calculated average falls between two values, linearly interpolate between them.

---

# Lineup Bonus

Search the historical lineup database for the lineup that has the greatest overlap with the current lineup.

The overlap is determined by the number of rowers that appear in both boats.

The coxswain is **not** considered when calculating overlap.

## Overlap Formula

```text
Overlap =
MatchingRowers / 8
```

where

- MatchingRowers is the number of identical rowers in both boats.
- Seat order does not matter.
- Coxswains are ignored.

Examples:

| Matching Rowers | Overlap |
|----------------:|---------:|
| 8 | 1.000 |
| 7 | 0.875 |
| 6 | 0.750 |
| 5 | 0.625 |
| 4 | 0.500 |
| 3 | 0.375 |
| 2 | 0.250 |
| 1 | 0.125 |
| 0 | 0.000 |

Convert overlap into chemistry:

```text
LineupBonus = 80 × Overlap
```

Examples:

| Matching Rowers | Lineup Bonus |
|----------------:|-------------:|
| 8 | +80 |
| 7 | +70 |
| 6 | +60 |
| 5 | +50 |
| 4 | +40 |
| 3 | +30 |
| 2 | +20 |
| 1 | +10 |
| 0 | +0 |

---

# Final Examples

## Example 1

A boat shares 7 of 8 rowers with a historical lineup.

Average graduation year difference is 0.5.

```text
ClassBonus = 17
LineupBonus = 70

Chemistry = 87
```

---

## Example 2

A completely experimental lineup.

No previous lineup exists.

Average graduation year difference is 2.5.

```text
ClassBonus = 3
LineupBonus = 0

Chemistry = 3
```

---

## Example 3

An identical historical lineup.

All rowers are from the same graduating class.

```text
ClassBonus = 20
LineupBonus = 80

Chemistry = 100
```

---

# Design Philosophy

- Chemistry represents how comfortable a lineup is rowing together.
- Previous lineups are weighted much more heavily than graduation year because racing and practicing together builds chemistry far more effectively than simply being in the same class.
- Exact historical lineups receive the highest chemistry.
- Swapping only one or two athletes from an established lineup results in only a small chemistry loss.
- Completely new lineups will naturally have lower chemistry, even if the individual rowers have high overall ratings.