from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Decision(str, Enum):
    TRUE_POSITIVE = "True Positive"
    FALSE_POSITIVE = "False Positive"
    FALSE_POSITIVE_RISK = "False Positive (Risk-Based)"
    HOLD = "Hold"


class MatchType(str, Enum):
    FULL_MATCH = "Full Match"
    PARTIAL_MATCH = "Partial Match"
    CULTURAL_MATCH = "Cultural Match"
    MISMATCH = "Mismatch"
    UNKNOWN = "Unknown"


class FactorResult(str, Enum):
    MATCH = "Match"
    MISMATCH = "Mismatch"
    UNKNOWN = "Unknown"


class HitCategory(str, Enum):
    SANCTIONS = "Sanctions"
    TERRORISM = "Terrorism"
    MAS = "MAS"
    PEP = "PEP"
    ADVERSE_MEDIA = "Adverse Media"
    OTHER = "Other"


TERROR_SANCTION_LISTS = {
    "OFAC_SDN", "UN_CONSOLIDATED", "EU_CONSOLIDATED", "UK_HMT",
    "MAS_TF", "MAS_LIST",
}


class PartyAddress(BaseModel):
    line1: str = ""
    line2: str = ""
    city: str = ""
    postal_code: str = ""
    state_province: str = ""
    country: str = ""


class PartyId(BaseModel):
    id_type: str = ""
    id_number: str = ""
    id_country: str = ""


class Party(BaseModel):
    party_key: str = ""
    name: str = ""
    dob: Optional[str] = None
    yob: Optional[int] = None
    birth_country: str = ""
    birth_location: str = ""
    gender: str = ""
    party_type: str = "Person"
    ids: list[PartyId] = Field(default_factory=list)
    nationalities: list[str] = Field(default_factory=list)
    addresses: list[PartyAddress] = Field(default_factory=list)


class HitAlias(BaseModel):
    display_name: str = ""
    matched_name: str = ""
    match_strength: str = ""


class HitInfo(BaseModel):
    list_id: str = ""
    entry_id: str = ""
    entry_type: str = ""
    matched_name: str = ""
    display_name: str = ""
    aliases: list[HitAlias] = Field(default_factory=list)
    nationalities: list[str] = Field(default_factory=list)
    age: Optional[str] = None
    categories: list[str] = Field(default_factory=list)
    title: str = ""
    position: str = ""
    gender: str = ""
    is_deceased: bool = False
    deceased_date: Optional[str] = None
    additional_info: dict[str, str] = Field(default_factory=dict)
    score: float = 0.0
    match_type: str = ""

    @property
    def hit_category(self) -> HitCategory:
        list_upper = self.list_id.upper()
        if list_upper in TERROR_SANCTION_LISTS:
            return HitCategory.SANCTIONS
        for cat in self.categories:
            cat_lower = cat.lower()
            if "sanction" in cat_lower:
                return HitCategory.SANCTIONS
            if "terror" in cat_lower:
                return HitCategory.TERRORISM
            if "mas" in cat_lower:
                return HitCategory.MAS
            if "pep" in cat_lower or "politically exposed" in cat_lower:
                return HitCategory.PEP
            if "adverse" in cat_lower:
                return HitCategory.ADVERSE_MEDIA
        return HitCategory.OTHER

    @property
    def is_terror_sanction(self) -> bool:
        return self.hit_category in {
            HitCategory.SANCTIONS, HitCategory.TERRORISM, HitCategory.MAS,
        }


class Alert(BaseModel):
    alert_id: str = ""
    alert_date: str = ""
    score: float = 0.0
    job_name: str = ""
    job_type: str = ""
    number_of_hits: int = 0
    source_file: str = ""
    party: Party = Field(default_factory=Party)
    hits: list[HitInfo] = Field(default_factory=list)


class FactorEvaluation(BaseModel):
    factor_name: str
    result: FactorResult
    reasoning: str = ""


class ScreeningResult(BaseModel):
    alert_id: str
    hit_entry_id: str
    hit_list_id: str
    decision: Decision
    rule_applied: str = ""
    is_terror_sanction: bool = False
    name_match_type: MatchType = MatchType.UNKNOWN
    name_match_reasoning: str = ""
    primary_factors: list[FactorEvaluation] = Field(default_factory=list)
    secondary_factors: list[FactorEvaluation] = Field(default_factory=list)
    overall_reasoning: str = ""
    info_request: Optional[str] = None


class AlertWithResults(BaseModel):
    alert: Alert
    results: list[ScreeningResult] = Field(default_factory=list)
