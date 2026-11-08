
import requests

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"

def test_api(name, endpoint, params):
    url = f"{BASE_URL}/{endpoint}"

    print(f"\nTesting {name} API...")

    try:
        response = requests.get(
            url,
            params=params,
            timeout=60
        )

        print("Status Code:", response.status_code)
        response.raise_for_status()

        data = response.json()

        print("Total records:", len(data))

        if data:
            print("\nFirst record:")
            print(data[0])

            print("\nAvailable fields:")
            print(list(data[0].keys()))
        else:
            print("No records returned.")

    except requests.exceptions.RequestException as e:
        print("API request failed:", e)
    except ValueError:
        print("Invalid JSON response")


# Test actual generation
test_api(
    "FUELHH",
    "datasets/FUELHH/stream",
    {
        "settlementDateFrom": "2026-01-01",
        "settlementDateTo": "2026-01-02",
        "fuelType": "WIND"
    }
)

# Test forecast generation
test_api(
    "WINDFOR",
    "datasets/WINDFOR/stream",
    {
        "publishDateTimeFrom": "2025-12-31T00:00:00Z",
        "publishDateTimeTo": "2026-01-01T23:59:59Z"
    }
)
