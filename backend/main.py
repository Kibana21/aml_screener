import os

import dspy
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.alerts import router as alerts_router
from api.screening import router as screening_router

load_dotenv()

app = FastAPI(title="AML Name Screening System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts_router)
app.include_router(screening_router)


@app.on_event("startup")
def configure_dspy():
    """Configure DSPy with Azure OpenAI."""
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-01")

    lm = dspy.LM(
        f"azure/{deployment}",
        api_key=api_key,
        api_base=endpoint,
        api_version=api_version,
    )
    dspy.configure(lm=lm)


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI!"}
