
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path
import pandas as pd
import numpy as np
import json

# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parents[2]

# Locally the app lives under <project>/backend/app, while the Docker image
# places it under /app/app alongside /app/data.
if not (BASE_DIR / "data").exists():
    BASE_DIR = Path(__file__).resolve().parents[1]

DATA_DIR = BASE_DIR / "data" / "processed"
RAW_DIR = BASE_DIR / "data" / "raw"

app = FastAPI(
    title="WindSight API",
    description="UK Wind Forecast Intelligence API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ==========================================
# DATA LOADING
# ==========================================

def load_csv(filename):

    path = DATA_DIR / filename

    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Dataset not found: {filename}"
        )

    return pd.read_csv(path)


def clean_records(df):
    """Convert missing values to JSON-safe nulls."""

    df = df.astype(object).where(
        pd.notna(df),
        None
    )

    return df.to_dict(orient="records")


def filter_dates(df, start_date=None, end_date=None):

    if "delivery_date" in df.columns:

        dates = pd.to_datetime(
            df["delivery_date"],
            errors="coerce"
        )

        if start_date:
            df = df[dates >= pd.Timestamp(start_date)]
            dates = dates.loc[df.index]

        if end_date:
            df = df[dates <= pd.Timestamp(end_date)]

    return df


def calculate_metrics(df):

    valid = df.dropna(
        subset=["forecast_mw", "actual_mw"]
    )

    if valid.empty:
        return {
            "matched_hours": 0,
            "mae_mw": None,
            "rmse_mw": None,
            "bias_mw": None,
            "wape_percent": None,
            "mape_percent": None
        }

    error = (
        valid["forecast_mw"] - valid["actual_mw"]
    )

    total_actual = valid["actual_mw"].abs().sum()

    mape_data = valid[
        valid["actual_mw"].abs() > 0
    ]

    return {
        "matched_hours": int(len(valid)),

        "mae_mw": round(
            error.abs().mean(), 2
        ),

        "rmse_mw": round(
            np.sqrt((error ** 2).mean()), 2
        ),

        "bias_mw": round(
            error.mean(), 2
        ),

        "wape_percent": round(
            error.abs().sum() / total_actual * 100,
            2
        ) if total_actual else None,

        "mape_percent": round(
            (
                (
                    mape_data["forecast_mw"]
                    - mape_data["actual_mw"]
                ).abs()
                / mape_data["actual_mw"].abs()
            ).mean() * 100,
            2
        ) if not mape_data.empty else None
    }


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/api/health")
def health():

    return {
        "status": "healthy",
        "application": "WindSight",
        "version": "1.0.0"
    }


# ==========================================
# DASHBOARD OVERVIEW
# ==========================================

@app.get("/api/overview")
def overview():

    df = load_csv(
        "forecast_actual_comparison.csv"
    )

    metrics = calculate_metrics(df)

    return {
        "period": "January 2026",
        "total_delivery_hours": len(df),

        "average_actual_generation_mw": round(
            df["actual_mw"].mean(), 2
        ),

        "average_forecast_generation_mw": round(
            df["forecast_mw"].mean(), 2
        ),

        "metrics": metrics,

        "missing_actuals": int(
            df["actual_mw"].isna().sum()
        ),

        "missing_forecasts": int(
            df["forecast_mw"].isna().sum()
        )
    }


# ==========================================
# FORECAST VS ACTUAL COMPARISON
# ==========================================

@app.get("/api/comparison")
def comparison(
    start_date: str = Query("2026-01-01"),
    end_date: str = Query("2026-01-31")
):

    df = load_csv(
        "forecast_actual_comparison.csv"
    )

    df = filter_dates(
        df, start_date, end_date
    )

    return {
        "count": len(df),
        "data": clean_records(df)
    }


# ==========================================
# ACTUAL GENERATION
# ==========================================

@app.get("/api/actuals")
def actuals():

    df = load_csv("hourly_actuals.csv")

    return {
        "count": len(df),
        "data": clean_records(df)
    }


# ==========================================
# SELECTED DAY-AHEAD FORECASTS
# ==========================================

@app.get("/api/forecasts")
def forecasts():

    df = load_csv(
        "day_ahead_forecasts.csv"
    )

    return {
        "count": len(df),
        "data": clean_records(df)
    }


# ==========================================
# ACCURACY METRICS
# ==========================================

@app.get("/api/metrics")
def metrics():

    df = load_csv(
        "forecast_actual_comparison.csv"
    )

    return calculate_metrics(df)


# ==========================================
# DAILY PERFORMANCE
# ==========================================

@app.get("/api/daily")
def daily():

    df = load_csv(
        "daily_performance.csv"
    )

    return {
        "count": len(df),
        "data": clean_records(df)
    }


# ==========================================
# FORECAST PUBLICATION EVOLUTION
# ==========================================

@app.get("/api/evolution")
def evolution(
    delivery_time: str = Query(
        ...,
        description="Delivery timestamp in ISO 8601 format"
    )
):

    path = RAW_DIR / (
        "windfor_jan_decision_window.json"
    )

    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail="Raw forecast history not found"
        )

    with open(path, "r") as file:
        records = json.load(file)

    try:
        target = pd.Timestamp(delivery_time)

        if target.tzinfo is None:
            target = target.tz_localize(
                "Europe/London"
            )

        target = target.tz_convert("UTC")

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid delivery timestamp"
        )

    df = pd.DataFrame(records)

    df["startTime"] = pd.to_datetime(
        df["startTime"], utc=True
    )

    df = df[df["startTime"] == target]

    df = df.sort_values("publishTime")

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail="No forecast history found"
        )

    return {
        "delivery_time": target.isoformat(),
        "count": len(df),
        "data": clean_records(df)
    }


# ==========================================
# APPLICATION ENTRY POINT
# ==========================================

@app.get("/")
def root():

    return {
        "message": "Welcome to WindSight API",
        "documentation": "/docs",
        "health": "/api/health"
    }
