
import json
from pathlib import Path

files = ["fuelhh_test.json", "windfor_test.json"]

for filename in files:
    print("\n" + "=" * 60)
    print(f"INSPECTING: {filename}")
    print("=" * 60)

    with open(filename, "r") as f:
        data = json.load(f)

    # Handle both JSON arrays and single JSON objects
    records = data if isinstance(data, list) else [data]

    print("Total records:", len(records))

    if not records:
        print("No records found.")
        continue

    print("\nAvailable fields:")
    print(list(records[0].keys()))

    print("\nFirst 3 records:")
    for record in records[:3]:
        print(json.dumps(record, indent=2))

    print("\nLast record:")
    print(json.dumps(records[-1], indent=2))

    if filename == "fuelhh_test.json":
        wind_records = [
            r for r in records
            if r.get("fuelType") == "WIND"
        ]
        print("\nWIND records:", len(wind_records))

    if filename == "windfor_test.json":
        print("\nForecast publication times:")
        for record in records[:5]:
            print(
                "Delivery:", record.get("startTime"),
                "| Published:", record.get("publishTime"),
                "| Generation:", record.get("generation")
            )
