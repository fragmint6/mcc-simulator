# Lineup OVR Formula

## Overview

The new Lineup OVR replaces the simple average with a more meaningful team rating. It gives proper credit to star athletes while still valuing the full crew and the coxswain.

## Core Principles

- Rowers remain the dominant factor
- Exceptional athletes (Generationals, Freaks) meaningfully raise the boat rating
- The coxswain has a real but secondary impact
- Side-specific technique ratings are respected
- The formula stays simple and transparent

## How the Formula Works

### 1. Side-Adjusted Rower OVRs
For every rower assigned to a seat, we calculate their OVR using the existing `computeOVR(rower, side)` function:
- Port seat â†’ uses the rowerâ€™s `port` technique rating
- Starboard seat â†’ uses the rowerâ€™s `starboard` technique rating

This produces 8 individual side-adjusted OVR values.

### 2. Average Rower Score (â‰ˆ 70%)
We take the arithmetic mean of all 8 side-adjusted OVRs. This forms the base of the boat rating.

### 3. Star Power Bonus (â‰ˆ 18%)
We identify the **three highest** side-adjusted OVRs in the boat and give them extra weight.

This is the key improvement for lineups like the 2024/25 1V:
- Even if the bottom five rowers average only ~82â€“84, the presence of three Generationals (Charlie, Carson, Sam) in the top three will push the overall OVR well above 85.
- Boats with multiple elite athletes are now properly rewarded.

### 4. Coxswain Contribution (â‰ˆ 12%)
The coxswainâ€™s pre-calculated `ovr` (derived from motivation, strategy, tech_calls, and steering) is added as a distinct component.

A high-90s coxswain will noticeably improve the boat OVR. A low-70s coxswain will have a mild negative effect.

## Final Weighted Formula

Boat OVR = (Average of 8 rowers Ã— 0.70)
+ (Average of Top 3 rowers Ã— 0.18)
+ (Coxswain OVR Ã— 0.12)

The result is clamped between 40 and 99.

## Why This Is Better Than a Simple Average

| Scenario                        | Simple Average | New Formula | Result |
|--------------------------------|----------------|-------------|--------|
| 3 Generationals + 5 average    | ~85            | 88â€“91       | Fair   |
| All 8 rowers very close        | Accurate       | Accurate    | Same   |
| Weak coxswain                  | Ignored        | Small penalty | Realistic |
| Strong coxswain                | Ignored        | Visible boost | Realistic |
| Star rower on wrong side       | Penalized      | Penalized   | Same   |

## Notes

- The formula uses only data that already exists in the app.
- No consistency or synergy bonuses are included.
- The weights (70/18/12) can be adjusted later if desired.
- The OVR is recalculated live whenever rowers or coxswains are added/removed.
