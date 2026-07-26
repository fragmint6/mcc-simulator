# McLean Crew Simulator Coxswain Rating System

This document defines the official overall rating (OVR) calculation for coxswains.

---

# Overall Rating

First calculate the **Base OVR**.

```text
BaseOVR =
18 × WeightedStars +
9 +
4 × (WeightedStars - 4)^2
```

Then apply weight adjustment and medal bonus.

```text
FinalOVR =
Round(
BaseOVR +
WeightAdjustment +
MedalBonus
)
```

---

# 1. Weighted Stars

Each coxswain is rated from **1.0–5.0 stars** in four attributes.

```text
WeightedStars =
0.28 × Motivation +
0.18 × Strategy +
0.14 × TechCalls +
0.35 × Steering
```

### Attribute Weights

| Attribute | Weight |
|-----------|-------:|
| Steering | 35% |
| Motivation | 28% |
| Strategy | 18% |
| Technical Calls | 14% |

Steering is weighted most heavily because it has the greatest direct impact on race performance.

---

# 2. Base Overall

Convert weighted stars into an overall rating.

```text
BaseOVR =
18 × WeightedStars +
9 +
4 × (WeightedStars - 4)^2
```

The nonlinear bonus rewards elite coxswains more heavily.

---

# 3. Weight Adjustment

105 lbs is considered the ideal reference weight.

```text
WeightAdjustment =
(105 - WeightLbs) / 10
```

Examples:

| Weight | Adjustment |
|-------:|-----------:|
| 95 | +1.0 |
| 100 | +0.5 |
| 105 | 0.0 |
| 110 | -0.5 |
| 115 | -1.0 |
| 120 | -1.5 |
| 125 | -2.0 |
| 130 | -2.5 |

Weight is intentionally treated as a small tiebreaker rather than a primary skill.

---

# 4. Medal Bonus

All medals represent **VHSL State Championship medals**.

| Medal | Bonus |
|------:|------:|
| 🥇 Gold | +1.5 |
| 🥈 Silver | +1.0 |
| 🥉 Bronze | +0.5 |

Calculate:

```text
MedalBonus =
min(
4,
1.5 × Gold +
1.0 × Silver +
0.5 × Bronze
)
```

The medal bonus is capped at **+4 OVR**.

---

# Final Formula

```text
FinalOVR =
Round(
18 × WeightedStars +
9 +
4 × (WeightedStars - 4)^2 +
(105 - WeightLbs) / 10 +
MedalBonus
)
```

---

# Design Philosophy

- Steering is the most valuable coxswain skill.
- Motivation is the second most important attribute.
- Strategy and technical calls support race execution.
- Weight provides only a small adjustment because skill is significantly more important than body weight.
- State Championship medals reward proven racing success.
- Medal bonuses are capped at +4 OVR to ensure that elite leadership remains more important than accumulated hardware.