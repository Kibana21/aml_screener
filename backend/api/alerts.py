"""Alert management API endpoints."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from models.schemas import Alert, AlertWithResults
from parsers.actimize_parser import parse_alert_xml, parse_all_alerts

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# In-memory store for alerts and screening results
_alerts: dict[str, Alert] = {}
_results: dict[str, list] = {}

DATA_DIR = Path(__file__).parent.parent.parent / "data"


@router.post("/load-all")
def load_all_alerts():
    """Load all alert XML files from the data directory."""
    if not DATA_DIR.exists():
        raise HTTPException(status_code=404, detail="Data directory not found")

    alerts = parse_all_alerts(DATA_DIR)
    for alert in alerts:
        _alerts[alert.alert_id] = alert

    return {"loaded": len(alerts), "alert_ids": list(_alerts.keys())}


@router.post("/upload")
async def upload_alert(file: UploadFile = File(...)):
    """Upload a single alert XML file."""
    if not file.filename or not file.filename.endswith(".xml"):
        raise HTTPException(status_code=400, detail="File must be an XML file")

    content = await file.read()
    # Write to temp file for parsing
    tmp_path = DATA_DIR / file.filename
    tmp_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path.write_bytes(content)

    alert = parse_alert_xml(tmp_path)
    _alerts[alert.alert_id] = alert

    return {"alert_id": alert.alert_id, "party_name": alert.party.name, "hits": len(alert.hits)}


@router.get("/", response_model=list[Alert])
def list_alerts():
    """List all loaded alerts."""
    return list(_alerts.values())


@router.get("/{alert_id}", response_model=AlertWithResults)
def get_alert(alert_id: str):
    """Get a single alert with its screening results."""
    if alert_id not in _alerts:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    return AlertWithResults(
        alert=_alerts[alert_id],
        results=_results.get(alert_id, []),
    )


def get_alerts_store() -> dict[str, Alert]:
    """Access the alerts store from other modules."""
    return _alerts


def get_results_store() -> dict[str, list]:
    """Access the results store from other modules."""
    return _results
