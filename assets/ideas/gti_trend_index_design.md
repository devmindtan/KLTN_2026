# General Trend Index (GTI) -- Traffic Trend Calculation

## Overview

The **General Trend Index (GTI)** is a normalized metric used to
evaluate the overall predicted traffic trend of a road segment.

Instead of evaluating each prediction point separately, GTI aggregates
multiple forecast horizons into a single weighted indicator.

The index is normalized by the **maximum road capacity (Max)** observed
during the last **7 days**.

This approach combines: - **Weighted Moving Average** - **Threshold
Ratio Normalization**

It allows the system to generate a single decision-friendly indicator
for dashboards and automated decision systems.

------------------------------------------------------------------------

# GTI Formula

GTI is calculated as:

GTI = ( Σ(P_i × w_i) / Max ) × 100

Where:

-   **P_i**: Predicted value at time horizon *i*
-   **w_i**: Weight of that prediction horizon
-   **Max**: Maximum vehicle capacity of the road segment

Constraints:

Σ w_i = 1

------------------------------------------------------------------------

# Recommended Prediction Horizons

  Horizon   Description
  --------- ---------------------------------
  5 min     Immediate short-term prediction
  10 min    Very short-term
  15 min    Short-term
  30 min    Mid-term
  60 min    Long-term

------------------------------------------------------------------------

# Recommended Weight Table

The system prioritizes near-future predictions because they have higher
practical impact on traffic decisions.

  Horizon        5m     10m    15m    30m    60m
  -------------- ------ ------ ------ ------ ------
  Weight (w_i)   0.35   0.25   0.20   0.15   0.05

Properties:

-   Near predictions dominate the index
-   Long-term prediction is kept to reduce noise
-   Total weight = **1.0**

------------------------------------------------------------------------

# System State Classification

After computing GTI, classify the system state using the following
thresholds.

  GTI Value    System State          Trend Level
  ------------ --------------------- -------------
  0 -- 30 %    Free Flow             Low
  31 -- 60 %   Stable / Normal       Medium
  61 -- 85 %   Congestion Starting   High
  \> 85 %      Congestion Risk       Critical

------------------------------------------------------------------------

# Current Ratio

To determine whether the system is increasing or decreasing, compare GTI
with the **Current Ratio**.

Current Ratio = ( Current / Max ) × 100

Where:

-   **Current** = current number of vehicles on the road segment

------------------------------------------------------------------------

# Trend Decision Rule

  Condition                   Result
  --------------------------- ------------
  GTI \> Current_Ratio + 5%   Increasing
  GTI \< Current_Ratio - 5%   Decreasing
  Difference within ±5%       Stable

------------------------------------------------------------------------

# Example Calculation

Input data:

  Horizon   Value
  --------- -------
  5 min     10
  10 min    15
  15 min    30
  30 min    20
  60 min    10

Current vehicles: **12**\
Max capacity: **50**

## Step 1 -- Weighted Sum

(10 × 0.35) + (15 × 0.25) + (30 × 0.20) + (20 × 0.15) + (10 × 0.05)

= 3.5 + 3.75 + 6 + 3 + 0.5

= **16.75**

## Step 2 -- Compute GTI

GTI = (16.75 / 50) × 100

GTI = **33.5 %**

## Step 3 -- Current Ratio

Current_Ratio = (12 / 50) × 100

Current_Ratio = **24 %**

------------------------------------------------------------------------

# Final Result

| Metric \| Value \|

\|------\|------\| GTI \| 33.5 % \| \| Current Ratio \| 24 % \|

System State: **Medium**

Trend: **Increasing**

Trend Strength: **Moderate Increase (\~9.5%)**

------------------------------------------------------------------------

# Benefits of GTI

-   Provides **a single interpretable indicator**
-   Reduces noise from individual predictions
-   Prioritizes near-future events
-   Easy to visualize on dashboards
-   Suitable for **traffic decision support systems**

------------------------------------------------------------------------

# Suggested Use in Backend

Typical pipeline:

1.  Collect prediction outputs (5m, 10m, 15m, 30m, 60m)
2.  Apply weighted sum
3.  Normalize by Max capacity
4.  Compare with Current Ratio
5.  Classify trend
6.  Push result to Dashboard API

------------------------------------------------------------------------
