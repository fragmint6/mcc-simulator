# Coxswain Rating System

This document defines the official rating calculation for coxswains in the rowing game.

---

## Overall Rating Formula

### Step 1: Calculate Weighted Stars

Each coxswain is rated from **1.0–5.0 stars** in the following attributes:
- Motivation
- Strategy
- Technical Calls
- Steering

Calculate the weighted average:

```
WeightedStars = 0.28 × Motivation + 0.18 × Strategy + 0.14 × TechCalls + 0.35 × Steering
```

Steering is weighted the highest because it has the greatest direct impact on race performance.

---

### Step 2: Calculate Base Overall

Convert the weighted stars into an overall rating:

```
BaseOVR = 18 × WeightedStars + 9 + 4 × (WeightedStars - 4)²
```

This nonlinear bonus rewards elite coxswains more heavily while keeping average coxswains balanced.

---

### Step 3: Apply Weight Adjustment

A lighter coxswain provides a slight advantage by reducing boat weight, but weight should never outweigh skill.

Use Charlie Murphy (105 lbs) as the baseline.

```
WeightAdjustment = (105 - WeightLbs) / 10
```

Examples:

| Weight | Adjustment |
|--------:|-----------:|
| 95 lbs | +1.0 |
| 100 lbs | +0.5 |
| 105 lbs | 0.0 |
| 110 lbs | -0.5 |
| 115 lbs | -1.0 |
| 120 lbs | -1.5 |
| 125 lbs | -2.0 |
| 130 lbs | -2.5 |

---

### Step 4: Final Overall

```
FinalOVR = BaseOVR + WeightAdjustment
```

Round the final result to the nearest whole number.

---

## Attribute Weights

| Attribute | Weight |
|-----------|-------:|
| Steering | **35%** |
| Motivation | **28%** |
| Strategy | **18%** |
| Technical Calls | **14%** |
| Weight | Small adjustment after OVR |

---

## Example Calculations

### Charlie Murphy

```
Motivation = 4.8
Strategy = 4.5
TechCalls = 4.7
Steering = 4.9
Weight = 105 lbs
```

#### Weighted Stars

```
WeightedStars = 0.28(4.8) + 0.18(4.5) + 0.14(4.7) + 0.35(4.9) = 4.52
```

#### Base Overall

```
BaseOVR = 18(4.52) + 9 + 4(4.52-4)² ≈ 97.3
```

#### Weight Adjustment

```
(105-105)/10 = 0
```

#### Final Rating

```
FinalOVR ≈ 97
```

---

### Alexander Tran

```
Motivation = 4.4
Strategy = 4.0
TechCalls = 4.3
Steering = 3.5
Weight = 125 lbs
```

#### Final Rating

Approximately **82 OVR**

---

### Orie Butler

```
Motivation = 3.0
Strategy = 2.0
TechCalls = 2.0
Steering = 2.2
Weight = 95 lbs
```

#### Final Rating

Approximately **53 OVR**

---

## Design Philosophy

- Steering is the most important coxswain skill.
- Motivation is the second most important because it directly influences race execution.
- Strategy and technical calls are important but less impactful than steering.
- Weight is intentionally treated as a small tiebreaker rather than a primary attribute.
- Elite coxswains receive a nonlinear bonus, allowing truly exceptional leaders to separate themselves from merely good ones.
- Charlie Murphy is considered a **generational** coxswain and serves as the benchmark for the top end of the rating scale.