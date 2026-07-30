# Race Simulation Engine

`simulation.js` exports a single `RaceSimulation` class with no UI dependencies.

## Overview

A race is 750 m internally. All displayed values (time, distance) are multiplied by 2, so the race appears as 1500 m. The simulation advances in discrete time steps via `tick(dt)`, where `dt` is simulation-seconds per frame (typically `realDt Ã— speedMultiplier`).

## Physics Model

The engine uses a **continuous physics model** where speed varies every frame. Two forces act on the boat at all times: **quadratic water drag** (always decelerating) and **stroke impulse** (accelerating during the drive phase only).

### Water Drag (always active)

Quadratic drag proportional to `vÂ²` â€” realistic for water:

```
dragDecel = 0.008 Ã— speedÂ²
speed -= dragDecel Ã— dt
```

- Between strokes, drag causes a gentle deceleration (a few percent per stroke)
- At high speed the effect is slightly stronger, at low speed weaker

### Stroke Impulse (active during drive phase, 0â€“35% of stroke cycle)

Each stroke delivers an impulse that accelerates the boat. The impulse is computed at stroke completion and applied gradually over the drive phase:

```
driveDuration = 0.35 / (strokeRate / 60)
raw = 1535 / (crewWeight + coxWeight + 100)
massFactor = 1 + (raw - 1) Ã— 0.6
chemistryFactor = 0.98 + 0.0004 Ã— chemistry
impulse = totalWatts Ã— techFactor Ã— rateFactor Ã— driveDuration Ã— 0.00028 Ã— massFactor Ã— chemistryFactor
impulseRate = impulse / driveDuration
speed += impulseRate Ã— dt    (applied each tick during drive)
```

Where:
- `techFactor = 0.60 + 0.08 Ã— avgTech` â€” higher technique = more efficient force transfer
- `rateFactor = 0.70 + 0.0075 Ã— strokeRate` â€” higher rates produce more force per stroke
- `massFactor` â€” normalizes total boat weight (crew + coxswain + 100 lb shell) against a reference 1535 lb (8 Ã— 165 lb avg crew + shell), then blended 60% toward 1.0 via `1 + (raw - 1) * 0.6` so weight has a noticeable but mild effect. Heavier crews accelerate slightly less per watt, lighter crews slightly more.
- `chemistryFactor` â€” chemistry (0â€“100) produces a multiplier in [0.98, 1.02], with higher chemistry giving a small speed advantage.

The impulse is spread evenly across the drive phase so the boat accelerates smoothly through each stroke.

### Result: Speed is never static

- **During drive**: Stroke impulse accelerates the boat against drag
- **During recovery**: Only drag acts â€” speed smoothly decays
- **Net effect**: Speed oscillates within each stroke cycle (surge during drive, glide during recovery), with the overall trend determined by crew power, technique, chemistry, and stroke rate

The displayed speed updates every frame, and split time reflects the instantaneous speed.

### First Stroke Initialization

On the first tick, the engine pre-computes the first stroke's impulse using the crew's base (with `executionFactor` applied) at 20 spm so the boat accelerates immediately with no dead stop. An initial speed estimate is set: `speed = cbrt(totalWatts) Ã— 0.48 Ã— 0.7`.

### Execution Factors

Each boat has four independent execution factors, each randomized between 0.95â€“1.05 at race start. They multiply every rower's `effPower` and `effTech` (technique still capped at 5.0) on the applicable strokes, and also scale the initial launch `baseTotal`:

| Factor | Phase | Applied |
|--------|-------|---------|
| `startEF` | Start | First 5 strokes (stroke count â‰¤ 5) |
| `middleMoveEF` | Middle move | 5-stroke power move at 750â€¯m |
| `sprintEF` | Sprint | Losing with â‰¤400â€¯m to go or final â…• |
| `executionFactor` | Middle | All other strokes |

For winâ€‘probability predictions, only the overall `executionFactor` is swept; the three phaseâ€‘specific factors are fixed at 1.0 (100â€¯%).

## Stroke Rate Profile

| Strokes | Rate (spm) |
|---------|-----------|
| 0       | 20        |
| 1       | 26        |
| 2       | 32        |
| 3       | 38        |
| 4       | 40        |
| 5+      | 36        |
| 5-stroke middle move at 750â€¯m (Â½) | sprint (see above) |
| last â…• (â‰¥80%) or losing with â‰¤400â€¯m to go | 34 + round(motivation Ã— 0.4) |

Rates have Â±1 spm random variation. Stroke rate is set at stroke completion and stays constant within the stroke.

### Middle Move

At 750â€¯m (halfway, internal 375â€¯m), each boat executes a **5-stroke power move** using the same sprint rate and phase-multiplier formulas (coxswain motivation, rower power, mentality all apply). This is independent of any later sprint â€” if the boat is already sprinting when the middle move triggers, it simply continues sprinting.

## Per-Rower Output (each stroke)

### Wattage
```
rawPower = round(basePower Ã— phaseMultiplier Ã— decayPower + wattVariance)
effPower = rawPower Ã— executionFactor
```
- `wattVariance` = uniform in [-25, +25] W
- `phaseMultiplier` depends on race phase:
  - **Start** (stroke < 5): `1.05 + 0.15 Ã— powerFactor`
  - **Sprint** (distance â‰¥ 80%): `0.98 + motivation Ã— 0.015 + 0.10 Ã— powerFactor`
  - **Middle**: `0.85 + 0.03 Ã— mentality` (clamped [0, 5])
- `powerFactor = clamp(power / 340, 0.6, 1.3)`, so the start/sprint multiplier varies by rower strength

### Technique
```
baseTech   = rower.port or starboard  // [0, 5]
effTech    = clamp((baseTech Ã— decayTech + techVariance) Ã— executionFactor, 0.5, 5.0)
```
- `techVariance` = uniform in [-0.7, +0.7]

### Fatigue / Decay
```
raceFrac   = min(1, distanceFraction)
decayPower = 1 - raceFrac Ã— 0.20 Ã— (1 - mentality / 5) Ã— (1 - strategy Ã— 0.10)
decayTech  = 1 - raceFrac Ã— 0.18 Ã— (1 - mentality / 5) Ã— (1 - techCalls Ã— 0.10)
```
Mentality 5: no decay at finish. Mentality 0: âˆ’20% power, âˆ’18% technique.
Coxswain strategy and tech_calls can mitigate decay.

## Steering & Lane Position

Each boat tracks `centerY` (lateral position) and `headingAngle` (direction). The coxswain's `steering` rating (0â€“5) controls how straight the boat travels:

- **Random drift**: Every 1.5 s of sim time, the heading target is perturbed. Higher steering = smaller drift.
- **Lane centering**: Coxswains with steering > 0 actively steer the bow back toward center (`centerY = 0`).
- **Heading smoothing**: The actual heading converges toward the target with a time constant.
- **Effective forward speed** is reduced by the heading angle: `xEff = 1 / (1 + |headingAngle| Ã— 0.70)`, and the total path distance is inflated by a reciprocal factor.

The boat is clamped to `|centerY| â‰¤ 2.0` to stay within lane bounds.

## Power Curve

Generated at stroke completion as a 21-point array spanning the drive portion. The curve's shape is driven by average technique:
- High technique (avgTech â‰ˆ 5): near-perfect smooth force curve
- Low technique (avgTech â‰ˆ 0): erratic, noisy curve

At the start of each stroke the curve is revealed incrementally (via `_buildDisplayCurve`) so the chart animates from catch to finish.

## Finish Sequence

When `centerX â‰¥ 750`, the boat crosses the finish line:
1. `finishSimTime` and `finishDisplayTime` are recorded.
2. The current stroke is completed (if needed).
3. The stroke phase is frozen at its current position (either end of drive or end of recovery).
4. The boat coasts under drag (`speed *= max(0, 1 - dt Ã— 0.35)`) and an additional constant deceleration until `speed < 0.05`.
5. Once both boats have `speed < 0.05`, `this.finished = true` and no more ticks process.

## Stroke Cycle

Each boat tracks a `strokePhase` in [0, 1):
- **0 â†’ 0.35**: Drive (oars in water, impulse applied)
- **0.35 â†’ 1.0**: Recovery (oars out, only drag)

Phase advances each frame by `strokeRate / 60 Ã— dt`. When phase wraps past 1, a stroke is counted and per-stroke computations fire.

## Boat Object (internal state)

```js
{
  rowers, coxswain,           // input objects (rowers have _seatIdx, _seatSide)
  centerX, centerY,            // position (m)
  headingAngle,                // radians
  totalDistTraveled,           // path length (m)
  boatLength: 17.6,           // hull length (m, for reference)
  speed,                       // current speed (m/s)
  strokeRate,                  // strokes per minute
  strokePhase,                 // 0â€“1
  strokeCount,                 // total strokes completed
  finishSimTime,               // sim time at finish (or null)
  finishDisplayTime,           // display time at finish (or null)
  fullCurve, displayCurve,     // power curve data
  rowerData,                   // per-stroke outputs array
  totalWatts,                  // sum of effPower this stroke
  split500,                    // 500 m split from current speed
  executionFactor,             // 0.95â€“1.05, multiplied into every stroke
  chemistry,                   // 0â€“100, set externally before start
  // internal:
  _strokeFrozen,               // true once finish stroke animation is done
  _finishSpeed, _finishDisplayDist,
  _impulseThisStroke,          // impulse (NÂ·s) for the current stroke
  _steeringTarget, _steeringTimer,
}
```

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
  mentality:  number,   // [0-5] affects middle-maintenance and decay
  year:       number,   // used for chemistry calculation
}
```

## Coxswain Object Fields (input)

```js
{
  name:        string,
  weight:      number,    // lbs, used for mass factor
  motivation:  number,    // [0-5] sprint rate boost
  strategy:    number,    // [0-5] mitigates power decay
  tech_calls:  number,    // [0-5] mitigates technique decay
  steering:    number,    // [0-5] reduces lateral drift
}
```
