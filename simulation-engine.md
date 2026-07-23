# Race Simulation Engine

`simulation.js` exports a single `RaceSimulation` class with no UI dependencies.

## Overview

A race is 750 m internally. All displayed values (time, distance) are multiplied by 2, so the race appears as 1500 m. The simulation advances in discrete time steps via `tick(dt)`, where `dt` is simulation-seconds per frame (typically `realDt × speedMultiplier`).

## Stroke Rate Profile

Only hardcoded values in the engine. Rates are per-stroke (not per-distance), except the sprint which triggers by distance fraction.

| Strokes | Rate (spm) |
|---------|-----------|
| 0       | 20        |
| 1       | 26        |
| 2       | 32        |
| 3       | 38        |
| 4       | 40        |
| 5+      | 36        |
| last 1/5th | 38     |

Rates have a ±1 spm random variation per stroke (`(Math.random()-0.5)*2`). Stroke rate is set at stroke completion and stays constant within the stroke.

## Per-Rower Output (each stroke)

### Wattage
```
effPower = round(basePower × phaseMultiplier × decayPower + wattVariance)
```
- `wattVariance` = uniform in [-25, +25] W
- `phaseMultiplier` depends on race phase:
  - **Start** (stroke < 5): 1.20 (+20%)
  - **Sprint** (distance ≥ 600 m / 80%): 1.20 (+20%)
  - **Middle**: `0.85 + 0.03 × mentality` (clamped to [0, 5])
    - Mentality 0 → 0.85 (15% drop)
    - Mentality 5 → 1.00 (no drop)

### Technique
```
baseTech   = max(rower.port, rower.starboard)         // [0, 5]
effTech    = clamp(baseTech × decayTech + techVariance, 0.5, 5.0)
```
- `techVariance` = uniform in [-0.5, +0.5]

### Fatigue / Decay
As the race progresses, power and technique decay linearly. Mentality reduces decay.
```
raceFrac   = min(1, distanceFraction)
decayPower = 1 - raceFrac × 0.15 × (1 - mentality / 5)
decayTech  = 1 - raceFrac × 0.12 × (1 - mentality / 5)
```
At finish (raceFrac = 1):
- Mentality 0: power −15%, technique −12%
- Mentality 5: no decay

## Boat Speed

Computed once per stroke completion from crew aggregates:
```
rawSpeed    = cbrt(totalWatts) × 0.48
techFactor  = 0.85 + 0.03 × avgTech
rateFactor  = 0.70 + 0.0075 × strokeRate
speedNoise  = uniform in [0.985, 1.015]  (±1.5% per stroke)
speed       = max(0.1, rawSpeed × techFactor × rateFactor × speedNoise)
split       = 500 / speed   (seconds per 500 m)
```

### Initial speed (t=0)
Before the first stroke completes, initial speed is estimated from the crew's base power × 1.2 (start boost) at 20 spm, so the boat moves immediately at race start.

### Distance
```
distance += speed × dt
```
Capped at 750 m.

## Power Curve

Generated at stroke completion as a 21-point array spanning only the **drive portion** of the stroke. The x-axis represents drive % (0–100%). Displayed in real-time: during the drive phase, points build progressively; during recovery, the full drive curve remains visible.

The curve's shape is driven by the boat's **average technique** for that stroke:
```
t_skewed   = t^0.65                                // shifts peak left (earlier in drive)
ideal      = totalWatts × 0.5 × sin^1.6(π × t_skewed)
noiseLevel = (5 - clamp(avgTech, 0, 5)) / 5        // 0 (perfect) → 1 (worst)
maxJitter  = noiseLevel × totalWatts × 0.5 × 0.12
jitter     = uniform[-maxJitter, +maxJitter] × sin(π × t_skewed)
curve[i]   = max(0, ideal + jitter)
```

- `t^0.65` skews the curve left (peak earlier in the drive) — typical of high school crews
- High technique (avgTech ≈ 5): near-perfect smooth force curve
- Low technique (avgTech ≈ 0): erratic, noisy curve with up to ±12% jitter peaking mid-drive

## Stroke Cycle

Each boat tracks a `strokePhase` in [0, 1):
- **0 → 0.35**: Drive (oars in water)
- **0.35 → 1.0**: Recovery (oars out)

Phase advances each frame by `strokeRate / 60 × dt`. When phase wraps past 1, a stroke is counted and all per-stroke computations fire.

## Public API

| Method | Description |
|--------|-------------|
| `constructor(boat1Rowers, boat2Rowers)` | Accepts arrays of rower objects |
| `tick(dt)` | Advance simulation by `dt` seconds |
| `start()` | Begin/resume the race |
| `pause()` | Pause the race |
| `reset()` | Reset all state to pre-race |
| `getState()` | Returns `{ simTime, displayTime, running, finished, boat1, boat2 }` |
| `getBoatState(key)` | Returns single boat's distance, speed, strokeRate, strokePhase, strokeCount, displayCurve, rowerData, totalWatts, split500, crewSize |

## Rower Object Fields (input)

```js
{
  name:       string,
  power:      number,   // base watts (from 2k score)
  port:       number,   // [0-5] port technique
  starboard:  number,   // [0-5] starboard technique
  mentality:  number,   // [0-5] affects middle-maintenance
}
```
