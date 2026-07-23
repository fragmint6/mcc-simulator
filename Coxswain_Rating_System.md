# Coxswain Rating System

## Overall Rating Formula

Compute the weighted star average:

``` text
WeightedStars =
0.30 * Motivation +
0.20 * Strategy +
0.15 * TechCalls +
0.35 * Steering
```

Convert the weighted stars into an overall rating:

``` text
OVR = 18 * WeightedStars + 9 + 4 * (WeightedStars - 4)^2
```

Round the final result to the nearest whole number.

## Attribute Weights

  Attribute           Weight
  ----------------- --------
  Steering               35%
  Motivation             30%
  Strategy               20%
  Technical Calls        15%

## Example: Charlie Murphy

``` text
Motivation = 4.8
Strategy = 4.5
Tech Calls = 4.7
Steering = 4.9

WeightedStars =
0.30 * 4.8 +
0.20 * 4.5 +
0.15 * 4.7 +
0.35 * 4.9
= 4.76

OVR = 18 * 4.76 + 9 + 4 * (4.76 - 4)^2
≈ 97.8

Final OVR = 98
```
