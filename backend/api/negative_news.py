"""Negative News Screening API endpoints."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from screener import NegativeNewsScreener, format_text_report

router = APIRouter(prefix="/api/negative-news", tags=["negative-news"])

_screener: NegativeNewsScreener | None = None
_history: list[dict] = []


def get_screener() -> NegativeNewsScreener:
    global _screener
    if _screener is None:
        _screener = NegativeNewsScreener()
    return _screener


class SubjectProfile(BaseModel):
    full_name: str
    gender: Optional[str] = None
    nationality: Optional[str] = None
    dob: Optional[str] = None
    employer: Optional[str] = None
    job_title: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    aliases: list[str] = Field(default_factory=list)
    notes: Optional[str] = None


class ScreenRequest(BaseModel):
    profile: SubjectProfile
    top_n: int = 10
    min_confidence: float = 0.65


@router.post("/screen")
def screen_subject(request: ScreenRequest):
    """Run negative news screening on a subject."""
    profile_dict = request.profile.model_dump(exclude_none=True)

    if not profile_dict.get("full_name", "").strip():
        raise HTTPException(status_code=400, detail="full_name is required")

    screener = get_screener()
    screener.top_n = request.top_n
    screener.min_confidence = request.min_confidence

    result = screener(profile=profile_dict)

    _history.append(result)
    return result


@router.post("/screen/text")
def screen_subject_text(request: ScreenRequest):
    """Run screening and return formatted text report."""
    profile_dict = request.profile.model_dump(exclude_none=True)

    if not profile_dict.get("full_name", "").strip():
        raise HTTPException(status_code=400, detail="full_name is required")

    screener = get_screener()
    screener.top_n = request.top_n
    screener.min_confidence = request.min_confidence

    result = screener(profile=profile_dict)
    _history.append(result)

    return {"report": format_text_report(result), "data": result}


@router.get("/history")
def get_history():
    """Get all previous screening results."""
    return [
        {
            "screening_id": r.get("screening_id"),
            "screened_at": r.get("screened_at"),
            "subject_name": r.get("subject", {}).get("full_name"),
            "risk_score": r.get("overall_risk_score"),
            "risk_rating": r.get("overall_risk_rating"),
            "recommended_action": r.get("recommended_action"),
            "findings_count": len(r.get("matched_findings", [])),
        }
        for r in _history
    ]


@router.get("/history/{screening_id}")
def get_screening_result(screening_id: str):
    """Get a specific screening result by ID."""
    for r in _history:
        if r.get("screening_id") == screening_id:
            return r
    raise HTTPException(status_code=404, detail="Screening result not found")
