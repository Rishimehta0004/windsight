# WindSight — UK Wind Forecast Intelligence & Day-Ahead Analytics

**A full-stack analytics dashboard for evaluating UK wind generation forecasts against actual generation using Elexon BMRS data.**

WindSight analyses January 2026 UK national wind generation data and compares day-ahead forecasts with actual generation. It provides forecast accuracy metrics, daily performance analysis, forecast publication history, and insights into forecast bias.

## Live Demo

- **Live Application:** https://frontend-gamma-liart-44.vercel.app/
- **Backend API:** https://windsight-api-77rh.onrender.com
- **Interactive API Documentation:** https://windsight-api-77rh.onrender.com/docs
- **GitHub Repository:** https://github.com/Rishimehta0004/windsight

The frontend is deployed on Vercel, while the FastAPI backend is containerised with Docker and deployed on Render.

## Project Overview

Wind generation is variable, making forecast accuracy important for electricity system planning and operational decisions.

WindSight helps users investigate:

- How closely day-ahead wind forecasts match actual generation.
- Whether forecasts systematically overestimate or underestimate generation.
- Which delivery days have the highest forecast errors.
- How forecast values change across publication versions.
- Where forecast uncertainty may warrant closer operational attention.

**Scope:** This project analyses wind forecast intelligence. It does not calculate electricity demand, residual demand, procurement volumes, market prices, or financial savings.

## Key Features

- **Forecast vs Actual:** Compare forecast and actual wind generation by delivery hour.
- **Forecast Accuracy:** MAE, RMSE, bias, WAPE and MAPE.
- **Daily Performance:** Identify days with higher and lower forecast errors.
- **Forecast Evolution:** Explore forecast publication versions and the day-ahead selection cutoff.
- **Data Integrity:** Check missing observations and incomplete delivery hours.
- **Procurement Insights:** Highlight forecast bias and its potential operational implications without claiming actual procurement outcomes.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Recharts |
| Backend | Python, FastAPI, Pandas, NumPy |
| Data | Elexon BMRS API, CSV, JSON |
| Deployment | Docker, Vercel, Render |

## Data Sources

Data is sourced from the Elexon Balancing Mechanism Reporting Service (BMRS).

- **FUELHH:** Actual half-hourly generation by fuel type. Wind records are selected.
- **WINDFOR:** Wind generation forecast publication records.

Source: [Elexon BMRS Data Portal](https://bmrs.elexon.co.uk/)

**Analysis period:** 1 January 2026 – 31 January 2026.

## Data Processing Methodology

### 1. Actual Generation

FUELHH provides half-hourly actual generation observations.

The two half-hourly observations within each delivery hour are aggregated using their arithmetic mean to produce hourly average generation in MW.

Only complete hours containing both half-hourly observations are accepted.

### 2. Forecast Selection

WINDFOR contains multiple forecast publications for each delivery period.

To avoid look-ahead bias, WindSight uses a configurable pilot day-ahead decision cutoff of **11:00 UK local time on the day before delivery**.

For each delivery hour, the latest forecast publication available at or before that cutoff is selected.

The cutoff is a project assumption for this analysis, not a confirmed procurement deadline supplied by an electricity market participant.

### 3. Forecast and Actual Matching

Hourly forecasts are matched to hourly actual generation using delivery timestamps.

Forecast error is calculated as:

`Forecast Error = Forecast Generation - Actual Generation`

- Positive error: forecast overestimation.
- Negative error: forecast underestimation.

### 4. Evaluation Metrics

| Metric | Interpretation |
|---|---|
| MAE | Average absolute forecast error |
| RMSE | Error metric that penalises larger deviations |
| Bias | Average signed forecast error |
| WAPE | Total absolute error divided by total actual generation |
| MAPE | Mean absolute percentage error |

MAPE can become unstable when actual values approach zero, so it should be interpreted alongside the other metrics.

## January 2026 Results

| Metric | Result |
|---|---:|
| Matched delivery hours | 744 / 744 |
| Average actual generation | 11,580.74 MW |
| Average day-ahead forecast | 13,421.03 MW |
| MAE | 2,122.81 MW |
| RMSE | 2,616.69 MW |
| Bias | +1,840.30 MW |
| WAPE | 18.33% |
| MAPE | 22.06% |

The positive bias indicates that selected day-ahead forecasts were higher than actual generation on average during the analysis period.

These results describe the selected January 2026 dataset and should not be interpreted as a general forecast-performance benchmark.

## Project Structure

```text
windsight/
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── data/
│   ├── raw/
│   └── processed/
├── fetch_data.py
├── forecast_selector.py
├── audit_forecasts.py
├── daily_analysis.py
├── analyse_resolution.py
├── docker-compose.yml
└── README.md
```

## Run Locally

### Prerequisites

- Python 3.10+
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Rishimehta0004/windsight.git
cd windsight
```

### 2. Start the backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000
```

Backend API: `http://localhost:8000`

Interactive API documentation: `http://localhost:8000/docs`

### 3. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

## Run with Docker

From the project root:

```bash
docker compose up --build
```

The Docker Compose configuration starts the backend API on port 8000.

The React frontend can be run separately using the local instructions above.

## API Endpoints

| Endpoint | Description |
|---|---|
| `/api/health` | Backend health check |
| `/api/overview` | Summary metrics |
| `/api/comparison` | Forecast vs actual comparison |
| `/api/actuals` | Actual generation observations |
| `/api/forecasts` | Selected day-ahead forecasts |
| `/api/metrics` | Forecast accuracy metrics |
| `/api/daily` | Daily performance metrics |
| `/api/evolution` | Forecast publication history |
| `/docs` | Interactive API documentation |

## Limitations and Assumptions

- The analysis is limited to January 2026.
- Forecasts and actuals are evaluated at hourly resolution.
- The day-ahead decision cutoff of 11:00 UK local time is a configurable pilot assumption.
- No electricity demand, market price, balancing price, or procurement transaction data is included.
- Procurement volumes, financial exposure, cost savings, and trading recommendations are outside the scope of this project.
- Historical performance does not guarantee future forecast accuracy.

## Future Enhancements

- Extend the analysis across multiple months and seasons.
- Add configurable forecast decision cutoffs.
- Introduce weather-related explanatory variables.
- Add forecast uncertainty and confidence analysis.
- Integrate demand and market data where appropriately licensed and available.
- Add automated data-quality monitoring and scheduled ingestion.

## AI Assistance Disclosure

AI tools, including ChatGPT, were used to assist with parts of the development process, including coding guidance, debugging, interface development, and documentation.

The data-processing methodology, analytical assumptions, implementation, and project outputs were reviewed and tested as part of the development process.

## Author

**Rishi Mehta**

B.Tech — Computer Science & Engineering

GitHub: [Rishimehta0004](https://github.com/Rishimehta0004)

---

**WindSight — Turning wind forecast data into operational intelligence.**