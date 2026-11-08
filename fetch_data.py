from datetime import date, datetime, timedelta
import json
from pathlib import Path
import time

import requests

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"

RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

session = requests.Session()
session.headers.update({
    "Accept": "application/json",
    "User-Agent": "WindSight-Pilot/1.0",
})


def fetch_api(endpoint, params, retries=3):
    """Fetch JSON data with basic retry handling."""
    url = f"{BASE_URL}/{endpoint}"

    for attempt in range(retries):
        try:
            response = session.get(url, params=params, timeout=90)
            response.raise_for_status()

            data = response.json()
            if not isinstance(data, list):
                raise ValueError(f"Unexpected response format: {type(data)}")

            return data

        except (requests.exceptions.RequestException, ValueError) as error:
            if attempt == retries - 1:
                raise RuntimeError(f"API request failed: {error}") from error

            wait = 2 ** attempt
            print(f"Request failed. Retrying in {wait}s...")
            time.sleep(wait)


def save_json(filename, data):
    """Save raw API response."""
    path = RAW_DIR / filename
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)

    print(f"Saved {len(data)} records -> {path}")


def date_range(start, end):
    """Generate inclusive date ranges."""
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def fetch_actuals():
    print("\n========== FETCHING FUELHH ==========")

    all_records = []

    # Actual generation for January 2026 delivery dates
    for day in date_range(date(2026, 1, 1), date(2026, 1, 31)):
        day_str = day.isoformat()
        print(f"Fetching actual generation: {day_str}")

        records = fetch_api(
            "datasets/FUELHH/stream",
            {
                "settlementDateFrom": day_str,
                "settlementDateTo": day_str,
                "fuelType": "WIND",
            },
        )

        save_json(f"fuelhh_{day_str}.json", records)
        all_records.extend(records)
        time.sleep(0.2)

    # Preserve all publication versions
    all_versions = {
        (r["startTime"], r["fuelType"], r["publishTime"]): r
        for r in all_records
    }

    # Keep the latest published actual for each delivery period
    latest_actuals = {}
    for record in all_versions.values():
        key = (record["startTime"], record["fuelType"])
        if (
            key not in latest_actuals
            or datetime.fromisoformat(record["publishTime"].replace("Z", "+00:00"))
            > datetime.fromisoformat(
                latest_actuals[key]["publishTime"].replace("Z", "+00:00")
            )
        ):
            latest_actuals[key] = record

    # Save all publication versions separately
    save_json("fuelhh_jan_2026_all_versions.json", list(all_versions.values()))

    result = list(latest_actuals.values())
    result.sort(key=lambda r: r["startTime"])

    save_json("fuelhh_jan_2026.json", result)
    return result


def fetch_forecasts():
    print("\n========== FETCHING WINDFOR ==========")

    all_records = []

    # D-1 publication dates for January delivery
    for day in date_range(date(2025, 12, 31), date(2026, 1, 30)):
        day_str = day.isoformat()
        print(f"Fetching forecast publications: {day_str}")

        records = fetch_api(
            "datasets/WINDFOR/stream",
            {
                "publishDateTimeFrom": f"{day_str}T00:00:00Z",
                "publishDateTimeTo": f"{day_str}T23:59:59Z",
            },
        )

        save_json(f"windfor_publish_{day_str}.json", records)
        all_records.extend(records)
        time.sleep(0.2)

    # Preserve different publication versions.
    # Only remove identical delivery/publication pairs.
    unique = {
        (r["startTime"], r["publishTime"]): r
        for r in all_records
    }

    result = list(unique.values())
    result.sort(key=lambda r: (r["publishTime"], r["startTime"]))

    save_json("windfor_jan_decision_window.json", result)
    return result


def main():
    actuals = fetch_actuals()
    forecasts = fetch_forecasts()

    print("\n========== EXTRACTION SUMMARY ==========")
    print("Actual records:", len(actuals))
    print("Forecast records:", len(forecasts))
    print(
        "Unique forecast publication times:",
        len(set(r["publishTime"] for r in forecasts)),
    )
    print(
        "Actual delivery date range:",
        min(r["startTime"] for r in actuals),
        "to",
        max(r["startTime"] for r in actuals),
    )
    print(
        "Forecast delivery date range:",
        min(r["startTime"] for r in forecasts),
        "to",
        max(r["startTime"] for r in forecasts),
    )
    print("\nExtraction completed.")


if __name__ == "__main__":
    main()
