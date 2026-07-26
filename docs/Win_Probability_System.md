# Race Prediction System

This document defines the official pre-race prediction system used by the McLean Crew Simulator.

Unlike the race engine, which simulates physics frame-by-frame, this system provides a quick estimate of each boat's expected performance before the race begins.

The prediction is based on the same factors that directly influence the simulation engine, ensuring that predictions remain consistent with the underlying physics.

---

# Step 1: Calculate Boat Performance

Each boat receives a **Boat Performance** score.

```text
BoatPerformance =
TotalWatts
× TechFactor
× MassFactor
× ChemistryFactor
× MentalityFactor
× CoxFactor
```

Where:

---

## TotalWatts

The sum of every rower's base power.

```text
TotalWatts =
Σ(BasePower)
```

---

## TechFactor

Higher average technique transfers power more efficiently into boat speed.

```text
TechFactor =
0.60 + 0.08 × AverageTechnique
```

AverageTechnique is the average technique (0–5 stars) of the eight rowers on their raced side.

---

## MassFactor

Lighter boats accelerate slightly more efficiently.

```text
Raw =
1535 /
(TotalCrewWeight + CoxWeight + 100)

MassFactor =
1 + (Raw - 1) × 0.6
```

This is identical to the race engine.

---

## ChemistryFactor

Experienced lineups row together more efficiently.

```text
ChemistryFactor =
0.98 + 0.0004 × Chemistry
```

| Chemistry | Factor |
|----------:|-------:|
| 0 | 0.980 |
| 25 | 0.990 |
| 50 | 1.000 |
| 75 | 1.010 |
| 100 | 1.020 |

---

## MentalityFactor

Higher mentality allows crews to maintain speed throughout the race.

```text
MentalityFactor =
0.97 + 0.01 × AverageMentality
```

| Avg Mentality | Factor |
|--------------:|-------:|
| 1 | 0.98 |
| 2 | 0.99 |
| 3 | 1.00 |
| 4 | 1.01 |
| 5 | 1.02 |

---

## CoxFactor

Represents the coxswain's overall race impact.

```text
CoxFactor =
0.97 + CoxOVR / 3000
```

| Cox OVR | Factor |
|---------:|-------:|
| 70 | 0.993 |
| 80 | 0.997 |
| 90 | 1.000 |
| 97 | 1.002 |
| 99 | 1.003 |

---

# Step 2: Compare Boats

Calculate each boat's relative performance.

```text
PerformanceRatio =
BoatPerformanceA /
BoatPerformanceB
```

```text
RelativeDifference =
PerformanceRatio - 1
```

A positive value favors Boat A.

A negative value favors Boat B.

---

# Step 3: Win Probability

Convert the relative performance difference into a win probability using a logistic function.

```text
BoatAWinProbability =
1 /
(1 + e^(-RelativeDifference / 0.03))
```

```text
BoatBWinProbability =
1 - BoatAWinProbability
```

Multiply by 100 to display as a percentage.

---

## Example Win Probabilities

| Performance Advantage | Win Probability |
|----------------------:|----------------:|
| 0% | 50% |
| 1% | 58% |
| 2% | 66% |
| 3% | 73% |
| 4% | 79% |
| 5% | 84% |
| 6% | 88% |
| 7% | 91% |
| 8% | 94% |

---

# Step 4: Predicted Winning Margin

Determine the stronger and weaker boats.

```text
WinnerPerformance =
max(BoatPerformanceA, BoatPerformanceB)

LoserPerformance =
min(BoatPerformanceA, BoatPerformanceB)
```

Compute the relative performance difference.

```text
RelativeDifference =
(WinnerPerformance / LoserPerformance) - 1
```

Then calculate the predicted margin.

```text
PredictedMarginSeconds =
35 × RelativeDifference^0.44
```

Where:

- The power-law fit is calibrated from empirical race data.
- The result is the expected winning margin.
- Round to one decimal place.

---

## Example Predicted Margins

| Performance Ratio | Predicted Margin |
|------------------:|-----------------:|
| 1.005 | 3.4 s |
| 1.010 | 4.6 s |
| 1.015 | 5.5 s |
| 1.020 | 6.3 s |
| 1.025 | 6.9 s |
| 1.030 | 7.5 s |
| 1.040 | 8.5 s |
| 1.050 | 9.4 s |

Display the margin from the perspective of the favored boat.

Example:

```text
McLean
Win Probability: 76%

Predicted Margin:
McLean by 6.8 seconds
```

---

# Confidence Levels

| Win Probability | Confidence |
|----------------:|------------|
| 0–20% | Coughing Baby |
| 20–30% | No Chance |
| 30–40% | Disadvantage |
| 40–60% | Coin Flip |
| 60–70% | Slight Edge |
| 70–80% | Heavy Favorite |
| 80–100% | Hydrogen Bomb |

---

# Design Philosophy

- Predictions are derived directly from the same variables that drive the race simulation.
- Overall ratings (OVR) are intentionally **not** used, preventing double-counting of athlete attributes.
- Raw power is the largest determinant of boat speed.
- Technique, boat weight, chemistry, mentality, and coxswain ability act as efficiency multipliers rather than standalone scores.
- Win probability uses a logistic curve to avoid unrealistic certainty while still rewarding stronger boats.
- Predicted margin is based on relative boat performance and provides a realistic estimate without running a full race simulation.
- Actual race outcomes may differ due to randomness, race execution, traits, steering, and other in-race events.