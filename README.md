# AML Screener

An Anti-Money Laundering name screening and negative news screening web application. Built with React (frontend) and FastAPI + DSPy (backend), powered by Azure OpenAI.

## Features

- **Name Screening** — Parse Nice Actimize XML alert files, evaluate matches against watchlists using DSPy-powered factor evaluation and a decision matrix
- **Negative News Screening** — Search for adverse media about subjects using SerpAPI + DSPy pipeline (query generation, evidence extraction, deduplication, risk scoring)

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Azure OpenAI account (with a GPT-4o deployment)
- SerpAPI key (for negative news screening)

## Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd aml_screener
```

### 2. Backend setup

```bash
cd backend

# Create a virtual environment
python -m venv .venv

# Activate it
# macOS / Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file inside the `backend/` folder:

```env
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
SERPAPI_API_KEY=your-serpapi-key
```

### 4. Frontend setup

```bash
cd frontend
npm install
```

## Running the Application

### Start the backend

```bash
cd backend
source .venv/bin/activate   # if not already activated
uvicorn main:app --reload --port 8000
```

### Start the frontend

In a separate terminal:

```bash
cd frontend
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000). The backend API runs at [http://localhost:8000](http://localhost:8000).

## Project Structure

```
aml_screener/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── api/
│   │   ├── alerts.py            # Alert management endpoints
│   │   ├── screening.py         # Name screening endpoints
│   │   └── negative_news.py     # Negative news endpoints
│   ├── dspy_modules/
│   │   ├── name_matcher.py      # Cultural name matching
│   │   ├── factor_evaluator.py  # Primary/secondary factor evaluation
│   │   ├── decision_engine.py   # Decision matrix (TP/FP/Hold)
│   │   └── screening_pipeline.py# Orchestration pipeline
│   ├── models/
│   │   └── schemas.py           # Pydantic models & enums
│   ├── parsers/
│   │   └── actimize_parser.py   # Nice Actimize XML parser
│   ├── screener.py              # Negative news screening pipeline
│   ├── requirements.txt
│   └── .env                     # Environment variables (not committed)
├── frontend/
│   ├── src/
│   │   ├── App.js               # Main React dashboard
│   │   └── App.css              # AIA-themed styles
│   └── package.json
└── data/                        # Nice Actimize XML alert files
```

## Usage

1. **Name Screening** — Select the "Name Screening" tab. Alerts are loaded automatically from the `data/` folder. Click an alert to view details, then screen individual hits or all hits at once.

2. **Negative News** — Select the "Negative News" tab. Fill in the subject profile form, choose how many articles per query, and click "Run Screening". Results are shown in three tabs: Summary, Findings, and Audit Trail.
