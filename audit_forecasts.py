
import pandas as pd

FILE = "data/raw/windfor_jan_decision_window.json"

df = pd.read_json(FILE)

df["startTime"] = pd.to_datetime(
    df["startTime"], utc=True
)

df["publishTime"] = pd.to_datetime(
    df["publishTime"], utc=True
)

df["delivery_local"] = (
    df["startTime"].dt.tz_convert("Europe/London")
)

df["publish_local"] = (
    df["publishTime"].dt.tz_convert("Europe/London")
)

# Keep January delivery periods
df = df[
    (df["delivery_local"] >= pd.Timestamp(
        "2026-01-01", tz="Europe/London"
    ))
    &
    (df["delivery_local"] < pd.Timestamp(
        "2026-02-01", tz="Europe/London"
    ))
].copy()

# Count forecast versions for each delivery period
versions = (
    df.groupby("delivery_local")
    .agg(
        forecast_versions=("publishTime", "nunique"),
        earliest_publish=("publish_local", "min"),
        latest_publish=("publish_local", "max")
    )
)

print("\n========== VERSION ANALYSIS ==========")
print(versions.head(10))

print("\nVersion count distribution:")
print(versions["forecast_versions"].value_counts())

# Calculate day-ahead cutoff for each delivery period
df["cutoff"] = (
    df["delivery_local"].dt.normalize()
    - pd.Timedelta(days=1)
    + pd.Timedelta(hours=11)
)

df["eligible"] = df["publish_local"] <= df["cutoff"]

print("\n========== DAY-AHEAD ELIGIBILITY ==========")

print("Total January forecast records:", len(df))
print("Eligible records:", df["eligible"].sum())

print(
    "Delivery periods with at least one eligible forecast:",
    df.groupby("delivery_local")["eligible"].any().sum()
)

# Inspect three delivery periods
test_hours = [
    "2026-01-01 00:00",
    "2026-01-15 12:00",
    "2026-01-31 23:00"
]

print("\n========== SAMPLE FORECAST HISTORY ==========")

for hour in test_hours:

    target = pd.Timestamp(
        hour,
        tz="Europe/London"
    )

    records = df[
        df["delivery_local"] == target
    ].sort_values("publish_local")

    print(f"\nDelivery period: {target}")
    print("Decision cutoff:", target.normalize()
          - pd.Timedelta(days=1)
          + pd.Timedelta(hours=11))

    print(
        records[
            [
                "publish_local",
                "generation",
                "eligible"
            ]
        ].to_string(index=False)
    )
