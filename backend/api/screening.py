"""Screening API endpoints."""

from fastapi import APIRouter, HTTPException

from models.schemas import ScreeningResult
from api.alerts import get_alerts_store, get_results_store
from dspy_modules.screening_pipeline import ScreeningPipeline

router = APIRouter(prefix="/api/screening", tags=["screening"])

_pipeline: ScreeningPipeline | None = None


def get_pipeline() -> ScreeningPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = ScreeningPipeline()
    return _pipeline


@router.post("/{alert_id}", response_model=list[ScreeningResult])
def screen_alert(alert_id: str):
    """Run screening on all hits in an alert."""
    alerts = get_alerts_store()
    results_store = get_results_store()

    if alert_id not in alerts:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert = alerts[alert_id]
    pipeline = get_pipeline()
    results = pipeline.screen_alert(alert)

    results_store[alert_id] = results
    return results


@router.post("/{alert_id}/hit/{entry_id}", response_model=ScreeningResult)
def screen_single_hit(alert_id: str, entry_id: str):
    """Run screening on a single hit within an alert."""
    alerts = get_alerts_store()
    results_store = get_results_store()

    if alert_id not in alerts:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert = alerts[alert_id]
    hit = next((h for h in alert.hits if h.entry_id == entry_id), None)
    if hit is None:
        raise HTTPException(status_code=404, detail=f"Hit {entry_id} not found in alert {alert_id}")

    pipeline = get_pipeline()
    result = pipeline.screen_hit(alert.party, hit, alert_id)

    # Store result
    if alert_id not in results_store:
        results_store[alert_id] = []
    # Replace existing result for this hit if any
    results_store[alert_id] = [
        r for r in results_store[alert_id] if r.hit_entry_id != entry_id
    ]
    results_store[alert_id].append(result)

    return result


@router.get("/{alert_id}/results", response_model=list[ScreeningResult])
def get_screening_results(alert_id: str):
    """Get screening results for an alert."""
    results_store = get_results_store()
    return results_store.get(alert_id, [])
