
import pandas as pd
import numpy as np

df = pd.read_csv(
    "data/processed/forecast_actual_comparison.csv"
)

df["delivery_date"] = pd.to_datetime(
    df["delivery_date"]
)

df["forecast_error_mw"] = (
    df["forecast_mw"] - df["actual_mw"]
)

df["absolute_error_mw"] = (
    df["forecast_error_mw"].abs()
)

daily = (
    df.groupby("delivery_date")
    .agg(
        observations=("forecast_error_mw", "count"),
        actual_generation_mw=("actual_mw", "mean"),
        forecast_generation_mw=("forecast_mw", "mean"),
        mae=("absolute_error_mw", "mean"),
        bias=("forecast_error_mw", "mean"),
        rmse=("forecast_error_mw",
              lambda x: np.sqrt((x ** 2).mean()))
    )
    .reset_index()
)

daily.to_csv(
    "data/processed/daily_performance.csv",
    index=False
)

print("\nHighest MAE days:")
print(
    daily.nlargest(5, "mae")[
        ["delivery_date", "mae", "bias"]
    ].to_string(index=False)
)

print("\nLowest MAE days:")
print(
    daily.nsmallest(5, "mae")[
        ["delivery_date", "mae", "bias"]
    ].to_string(index=False)
)

print("\nDaily analysis saved.")
