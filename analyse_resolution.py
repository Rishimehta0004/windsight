
import json
from collections import Counter
from datetime import datetime

def load_json(filename):
    with open(filename, "r") as f:
        return json.load(f)


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# Load API responses
actuals = load_json("fuelhh_test.json")
forecasts = load_json("windfor_test.json")

print("\n========== FUELHH ANALYSIS ==========")

actual_times = sorted({
    parse_time(r["startTime"]) for r in actuals
})

actual_intervals = [
    (actual_times[i] - actual_times[i-1]).total_seconds() / 60
    for i in range(1, len(actual_times))
]

print("Unique delivery timestamps:", len(actual_times))
print("Observed intervals (minutes):", Counter(actual_intervals))

print("\n========== WINDFOR ANALYSIS ==========")

forecast_times = sorted({
    parse_time(r["startTime"]) for r in forecasts
})

forecast_intervals = [
    (forecast_times[i] - forecast_times[i-1]).total_seconds() / 60
    for i in range(1, len(forecast_times))
]

print("Unique delivery timestamps:", len(forecast_times))
print("Observed intervals (minutes):", Counter(forecast_intervals))

print("\n========== FORECAST PUBLICATIONS ==========")

publish_times = sorted({
    parse_time(r["publishTime"]) for r in forecasts
})

print("Unique publication timestamps:", len(publish_times))

for p in publish_times:
    count = sum(
        1 for r in forecasts
        if parse_time(r["publishTime"]) == p
    )
    print(p.isoformat(), "->", count, "records")

print("\n========== DUPLICATE CHECK ==========")

keys = [
    (r["startTime"], r["publishTime"])
    for r in forecasts
]

print("Forecast records:", len(keys))
print("Unique delivery/publication pairs:", len(set(keys)))
print("Duplicate pairs:", len(keys) - len(set(keys)))

print("\n========== GENERATION CHECK ==========")

null_actuals = sum(r["generation"] is None for r in actuals)
null_forecasts = sum(r["generation"] is None for r in forecasts)

print("Missing actual generation:", null_actuals)
print("Missing forecast generation:", null_forecasts)
