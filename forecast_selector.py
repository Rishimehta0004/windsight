
import pandas as pd
from pathlib import Path
import numpy as np

# ==========================================
# CONFIGURATION
# ==========================================

RAW_DIR = Path("data/raw")
OUTPUT_DIR = Path("data/processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TIMEZONE = "Europe/London"
DECISION_HOUR = 11

START_DATE = "2026-01-01"
END_DATE = "2026-01-31"


# ==========================================
# 1. LOAD DATA
# ==========================================

def load_data():

    actuals = pd.read_json(
        RAW_DIR / "fuelhh_jan_2026.json"
    )

    forecasts = pd.read_json(
        RAW_DIR / "windfor_jan_decision_window.json"
    )

    print("Actual records:", len(actuals))
    print("Forecast records:", len(forecasts))

    return actuals, forecasts


# ==========================================
# 2. PREPARE ACTUAL GENERATION
# ==========================================

def prepare_actuals(actuals):

    actuals["startTime"] = pd.to_datetime(
        actuals["startTime"], utc=True
    )

    actuals["delivery_time"] = (
        actuals["startTime"].dt.tz_convert(TIMEZONE)
    )

    start = pd.Timestamp(START_DATE, tz=TIMEZONE)
    end = (
        pd.Timestamp(END_DATE, tz=TIMEZONE)
        + pd.Timedelta(days=1)
    )

    actuals = actuals[
        (actuals["delivery_time"] >= start)
        & (actuals["delivery_time"] < end)
    ].copy()

    actuals["hour"] = (
        actuals["delivery_time"].dt.floor("h")
    )

    hourly = (
        actuals.groupby("hour")
        .agg(
            actual_mw=("generation", "mean"),
            actual_periods=("generation", "count")
        )
        .reset_index()
    )

    # Only accept complete hourly observations
    hourly.loc[
        hourly["actual_periods"] != 2,
        "actual_mw"
    ] = np.nan

    return hourly


# ==========================================
# 3. PREPARE FORECASTS
# ==========================================

def prepare_forecasts(forecasts):

    forecasts["startTime"] = pd.to_datetime(
        forecasts["startTime"], utc=True
    )

    forecasts["publishTime"] = pd.to_datetime(
        forecasts["publishTime"], utc=True
    )

    forecasts["delivery_time"] = (
        forecasts["startTime"].dt.tz_convert(TIMEZONE)
    )

    forecasts["publish_time"] = (
        forecasts["publishTime"].dt.tz_convert(TIMEZONE)
    )

    start = pd.Timestamp(START_DATE, tz=TIMEZONE)
    end = (
        pd.Timestamp(END_DATE, tz=TIMEZONE)
        + pd.Timedelta(days=1)
    )

    forecasts = forecasts[
        (forecasts["delivery_time"] >= start)
        & (forecasts["delivery_time"] < end)
    ].copy()

    # WINDFOR delivery resolution is hourly in our audited sample.
    forecasts = forecasts[
        forecasts["delivery_time"].dt.minute == 0
    ].copy()

    # D-1 decision cutoff in UK local time
    forecasts["decision_cutoff"] = (
        forecasts["delivery_time"].dt.normalize()
        - pd.DateOffset(days=1)
        + pd.Timedelta(hours=DECISION_HOUR)
    )

    return forecasts


# ==========================================
# 4. SELECT DAY-AHEAD FORECAST
# ==========================================

def select_forecasts(forecasts):

    eligible = forecasts[
        forecasts["publish_time"]
        <= forecasts["decision_cutoff"]
    ].copy()

    # Latest publication for each delivery hour
    selected = (
        eligible.sort_values(
            ["delivery_time", "publish_time"]
        )
        .drop_duplicates(
            subset=["delivery_time"],
            keep="last"
        )
        .copy()
    )

    selected = selected.rename(
        columns={"generation": "forecast_mw"}
    )

    selected["forecast_age_hours"] = (
        (
            selected["decision_cutoff"]
            - selected["publish_time"]
        ).dt.total_seconds() / 3600
    )

    # Safety check: no future information
    assert (
        selected["publish_time"]
        <= selected["decision_cutoff"]
    ).all()

    assert selected["delivery_time"].is_unique

    return selected


# ==========================================
# 5. BUILD COMPLETE HOURLY DATASET
# ==========================================

def create_comparison(selected, actuals):

    # Build all expected delivery hours
    hours = pd.date_range(
        start=pd.Timestamp(START_DATE, tz=TIMEZONE),
        end=(
            pd.Timestamp(END_DATE, tz=TIMEZONE)
            + pd.Timedelta(days=1)
        ),
        freq="h",
        inclusive="left"
    )

    result = pd.DataFrame({
        "delivery_time": hours
    })

    # Merge actual generation
    result = result.merge(
        actuals,
        left_on="delivery_time",
        right_on="hour",
        how="left"
    )

    result = result.drop(columns=["hour"])

    # Merge selected forecast
    forecast_columns = [
        "delivery_time",
        "forecast_mw",
        "publish_time",
        "decision_cutoff",
        "forecast_age_hours"
    ]

    result = result.merge(
        selected[forecast_columns],
        on="delivery_time",
        how="left",
        validate="one_to_one"
    )

    # Calculate forecast error
    result["forecast_error_mw"] = (
        result["forecast_mw"] - result["actual_mw"]
    )

    result["absolute_error_mw"] = (
        result["forecast_error_mw"].abs()
    )

    result["squared_error"] = (
        result["forecast_error_mw"] ** 2
    )

    result["delivery_date"] = (
        result["delivery_time"].dt.strftime("%Y-%m-%d")
    )

    return result


# ==========================================
# 6. CALCULATE ACCURACY METRICS
# ==========================================

def calculate_metrics(df):

    valid = df.dropna(
        subset=["forecast_mw", "actual_mw"]
    )

    if valid.empty:
        raise ValueError("No matched forecast/actual records.")

    error = (
        valid["forecast_mw"] - valid["actual_mw"]
    )

    mae = error.abs().mean()
    rmse = np.sqrt((error ** 2).mean())
    bias = error.mean()

    total_actual = valid["actual_mw"].abs().sum()

    wape = (
        error.abs().sum() / total_actual * 100
        if total_actual > 0 else np.nan
    )

    mape_valid = valid[
        valid["actual_mw"].abs() > 0
    ]

    mape = (
        (
            (
                mape_valid["forecast_mw"]
                - mape_valid["actual_mw"]
            ).abs()
            / mape_valid["actual_mw"].abs()
        ).mean() * 100
        if not mape_valid.empty else np.nan
    )

    metrics = {
        "Matched hours": len(valid),
        "MAE (MW)": mae,
        "RMSE (MW)": rmse,
        "Bias (MW)": bias,
        "WAPE (%)": wape,
        "MAPE (%)": mape
    }

    return metrics


# ==========================================
# 7. MAIN EXECUTION
# ==========================================

def main():

    actuals, forecasts = load_data()

    hourly_actuals = prepare_actuals(actuals)

    prepared_forecasts = prepare_forecasts(
        forecasts
    )

    selected = select_forecasts(
        prepared_forecasts
    )

    comparison = create_comparison(
        selected,
        hourly_actuals
    )

    metrics = calculate_metrics(comparison)

    # Save processed datasets
    hourly_actuals.to_csv(
        OUTPUT_DIR / "hourly_actuals.csv",
        index=False
    )

    selected.to_csv(
        OUTPUT_DIR / "day_ahead_forecasts.csv",
        index=False
    )

    comparison.to_csv(
        OUTPUT_DIR / "forecast_actual_comparison.csv",
        index=False
    )

    pd.DataFrame(
        metrics.items(),
        columns=["Metric", "Value"]
    ).to_csv(
        OUTPUT_DIR / "accuracy_metrics.csv",
        index=False
    )

    # ======================================
    # QUALITY REPORT
    # ======================================

    print("\n========== DATA QUALITY REPORT ==========")

    print("Expected delivery hours:", len(comparison))
    print("Selected forecasts:", len(selected))

    print(
        "Missing forecasts:",
        comparison["forecast_mw"].isna().sum()
    )

    print(
        "Missing actuals:",
        comparison["actual_mw"].isna().sum()
    )

    print(
        "Incomplete actual hours:",
        (comparison["actual_periods"].fillna(0) != 2).sum()
    )

    print(
        "Forecasts published after cutoff:",
        (
            comparison["publish_time"]
            > comparison["decision_cutoff"]
        ).sum()
    )

    print("\n========== ACCURACY METRICS ==========")

    for name, value in metrics.items():
        print(f"{name}: {value:.3f}" if pd.notna(value)
              else f"{name}: N/A")

    print("\n========== COMPLETED ==========")

    print("Output folder:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
