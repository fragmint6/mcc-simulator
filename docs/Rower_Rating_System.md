# McLean Crew Simulator Rower Rating System

This document defines the official overall rating (OVR) calculation for rowers.

---

# Overall Rating

First calculate the player's **Base OVR**.

```text
BaseOVR =
0.50 Ã— R2k +
0.25 Ã— RTech +
0.15 Ã— RPW +
0.10 Ã— RMental
```

Then apply the medal bonus.

```text
FinalOVR =
Round(BaseOVR + MedalBonus)
```

---

# 1. 2k Rating (50%)

Calculated continuously without rounding 2k times to preserve precise performance gaps.

```text
R2k =
92 - ((Total2kSeconds - 390) / 5) Ã— 3
```

### Benchmark Examples

| 2k Time | Seconds | R2k |
|:-------:|:-------:|:---:|
| 6:15.0 | 375.0 | 101.0 |
| 6:20.0 | 380.0 | 98.0 |
| 6:25.0 | 385.0 | 95.0 |
| 6:30.0 | 390.0 | 92.0 |
| 6:35.0 | 395.0 | 89.0 |
| 6:40.0 | 400.0 | 86.0 |
| 6:45.0 | 405.0 | 83.0 |
| 6:50.0 | 410.0 | 80.0 |
| 6:55.0 | 415.0 | 77.0 |
| 7:00.0 | 420.0 | 74.0 |
| 7:30.0 | 450.0 | 56.0 |
| 8:00.0 | 480.0 | 38.0 |

---

# 2. Technique Rating (25%)

When a seat side is known, only that side's technique is used.

When the seat is unknown:

```text
TechniqueStars =
(2 Ã— max(PortTech, StarboardTech) +
min(PortTech, StarboardTech)) / 3
```

Convert to rating:

```text
RTech =
18 Ã— TechniqueStars + 9
```

### Benchmarks

| Stars | Rating |
|------:|-------:|
| 5.0 | 99 |
| 4.5 | 90 |
| 4.0 | 81 |
| 3.5 | 72 |
| 3.0 | 63 |

---

# 3. Power-to-Weight Rating (15%)

```text
SplitSeconds =
Total2kSeconds / 4
```

```text
Watts =
2.80 / ((SplitSeconds / 500)^3)
```

```text
PowerToWeight =
Watts / WeightLbs
```

```text
RPW =
max(50, min(99, PowerToWeight Ã— 38))
```

---

# 4. Mentality Rating (10%)

```text
RMental =
18 Ã— MentalityStars + 9
```

---

# 5. Medal Bonus

All medals represent **VHSL State Championship medals**.

| Medal | Bonus |
|------:|------:|
| ðŸ¥‡ Gold | +1.5 |
| ðŸ¥ˆ Silver | +1.0 |
| ðŸ¥‰ Bronze | +0.5 |

Calculate:

```text
MedalBonus =
min(
4,
1.5 Ã— Gold +
1.0 Ã— Silver +
0.5 Ã— Bronze
)
```

The medal bonus is capped at **+4 OVR**.

---

# Final Formula

```text
BaseOVR =
0.50 Ã— R2k +
0.25 Ã— RTech +
0.15 Ã— RPW +
0.10 Ã— RMental

FinalOVR =
Round(BaseOVR + MedalBonus)
```

---

# Design Philosophy

- Raw 2k speed is the most important factor.
- Technique rewards athletes who move boats efficiently.
- Power-to-weight rewards efficiency without overshadowing raw speed.
- Mentality captures consistency under pressure.
- State Championship medals reward proven race performance.
- Medal bonuses are intentionally capped so championships complement ability rather than replace it.
