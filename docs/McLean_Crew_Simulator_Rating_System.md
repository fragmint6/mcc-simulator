# McLean Crew Simulator Rating System

## Overall Rating

OVR = 0.50 × R2k + 0.25 × RTech + 0.15 × RPW + 0.10 × RMental

Round OVR to the nearest whole number.

---

## 1. 2k Rating (50%)

Calculated continuously without rounding 2k times to preserve precise performance gaps.

R2k = 92 - ((Total2kSeconds - 390) / 5) × 3

### Benchmark Examples

| 2k Time | Seconds | R2k |
| :---: | :---: | :---: |
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

## 2. Technique Rating (25%)

When a seat side is known (port or starboard), the rower's rating uses only that side's technique. When unknown, it uses a weighted average favoring the stronger side:

Seat known: techStars = side-specific technique (port or starboard)
Seat unknown: techStars = (2 × max(port, starboard) + min(port, starboard)) / 3

RTech = 18 × techStars + 9

### Benchmark Examples
* 5.0 Stars: 99.0
* 4.5 Stars: 90.0
* 4.0 Stars: 81.0
* 3.5 Stars: 72.0
* 3.0 Stars: 63.0

---

## 3. Power-to-Weight Rating (15%)

Uses a linear scale that rewards high efficiency (lightweight speed) without overly penalizing heavier rowers pulling high raw wattage.

SplitSeconds = Total2kSeconds / 4

Watts = 2.80 / ((SplitSeconds / 500) ^ 3)

PowerToWeight = Watts / WeightLbs

RPW = max(50, min(99, PowerToWeight × 38.0))

---

## 4. Mentality Rating (10%)

RMental = 18 × MentalityStars + 9

---

## Final Formula Summary

OVR = Round(0.50 × R2k + 0.25 × RTech + 0.15 × RPW + 0.10 × RMental)