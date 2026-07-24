# Race Simulation Engine

`simulation.js` exports a single `RaceSimulation` class with no UI dependencies.

## Overview

A race is 750 m internally. All displayed values (time, distance) are multiplied by 2, so the race appears as 1500 m. The simulation advances in discrete time steps via `tick(dt)`, where `dt` is simulation-seconds per frame (typically `realDt × speedMultiplier`).

## Physics Model

The engine uses a **continuous physics model** where speed varies every frame. Two forces act on the boat at all times: **quadratic water drag** (always decelerating) and **stroke impulse** (accelerating during the drive phase only).

### Water Drag (always active)

Quadratic drag proportional to `v²` — realistic for water:

```
dragDecel = 0.008 × speed²
speed -= dragDecel × dt
```

- Between strokes, drag causes a gentle deceleration (a few percent per stroke)
- At high speed the effect is slightly stronger, at low speed weaker

### Stroke Impulse (active during drive phase, 0–35% of stroke cycle)

Each stroke delivers an impulse that accelerates the boat. The impulse is computed at stroke completion and applied gradually over the drive phase:

```
driveDuration = 0.35 / (strokeRate / 60)
raw = 1535 / (totalCrewWeight + coxWeight + 100)
massFactor = 1 + (raw - 1) × 0.6
impulse = totalWatts × techFactor × rateFactor × driveDuration × 0.00028 × massFactor
impulseRate = impulse / driveDuration
speed += impulseRate × dt    (applied each tick during drive)
```

Where:
- `techFactor = 0.60 + 0.08 × avgTech` — higher technique = more efficient force transfer
- `rateFactor = 0.70 + 0.0075 × strokeRate` — higher rates produce more force per stroke
- `massFactor` — normalizes total boat weight (crew + coxswain + 100 lb shell) against a reference 1535 lb (8 × 165 lb avg crew + shell), then blended 60% toward 1.0 via `1 + (raw - 1) * 0.6` so weight has a noticeable but mild effect. Heavier crews accelerate slightly less per watt, lighter crews slightly more.

The impulse is spread evenly across the drive phase so the boat accelerates smoothly through each stroke.

### Result: Speed is never static

- **During drive**: Stroke impulse accelerates the boat against drag
- **During recovery**: Only drag acts — speed smoothly decays
- **Net effect**: Speed oscillates within each stroke cycle (surge during drive, glide during recovery), with the overall trend determined by crew power, technique, and stroke rate

The displayed speed updates every frame, and split time reflects the instantaneous speed.

### First Stroke Initialization

On the first tick, the engine pre-computes the first stroke's impulse (using the crew's base power × 1.2 at 20 spm) so the boat starts accelerating immediately with no dead stop.

## Stroke Rate Profile

| Strokes | Rate (spm) |
|---------|-----------|
| 0       | 20        |
| 1       | 26        |
| 2       | 32        |
| 3       | 38        |
| 4       | 40        |
| 5+      | 36        |
| last 1/5th (≥80%) | 34 + round(motivation × 0.4) |

Rates have ±1 spm random variation. Stroke rate is set at stroke completion and stays constant within the stroke.

## Per-Rower Output (each stroke)

### Wattage
```
effPower = round(basePower × phaseMultiplier × decayPower + wattVariance)
```
- `wattVariance` = uniform in [-25, +25] W
- `phaseMultiplier` depends on race phase:
  - **Start** (stroke < 5): 1.20
  - **Sprint** (distance ≥ 80%): 1.02 + motivation × 0.015
  - **Middle**: `0.85 + 0.03 × mentality` (clamped [0, 5])

### Technique
```
baseTech   = rower.port or starboard  // [0, 5]
effTech    = clamp(baseTech × decayTech + techVariance, 0.5, 5.0)
```
- `techVariance` = uniform in [-0.35, +0.35]

### Fatigue / Decay
```
raceFrac   = min(1, distanceFraction)
decayPower = 1 - raceFrac × 0.20 × (1 - mentality / 5) × (1 - strategy × 0.10)
decayTech  = 1 - raceFrac × 0.18 × (1 - mentality / 5) × (1 - techCalls × 0.10)
```
Mentality 5: no decay at finish. Mentality 0: −20% power, −18% technique.
Coxswain strategy and tech_calls can mitigate decay.

## Power Curve

Generated at stroke completion as a 21-point array spanning the drive portion. The curve's shape is driven by average technique:
- High technique (avgTech ≈ 5): near-perfect smooth force curve
- Low technique (avgTech ≈ 0): erratic, noisy curve

## Stroke Cycle

Each boat tracks a `strokePhase` in [0, 1):
- **0 → 0.35**: Drive (oars in water, impulse applied)
- **0.35 → 1.0**: Recovery (oars out, only drag)

Phase advances each frame by `strokeRate / 60 × dt`. When phase wraps past 1, a stroke is counted and per-stroke computations fire.

## Public API

| Method | Description |
|--------|-------------|
| `constructor(boat1Rowers, boat2Rowers, boat1Coxswain, boat2Coxswain)` | Accepts arrays of rower objects and coxswain objects (or null) |
| `tick(dt)` | Advance simulation by `dt` seconds |
| `start()` | Begin/resume the race |
| `pause()` | Pause the race |
| `reset()` | Reset all state to pre-race |
| `getState()` | Returns `{ simTime, displayTime, running, finished, boat1, boat2 }` |
| `getBoatState(key)` | Returns single boat telemetry |

## Rower Object Fields (input)

```js
{
  name:       string,
  power:      number,   // base watts (from 2k score)
  weight:     number,   // lbs, used for mass factor
  port:       number,   // [0-5] port technique
  starboard:  number,   // [0-5] starboard technique
  mentality:  number,   // [0-5] affects middle-maintenance
}
```