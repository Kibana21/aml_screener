"""End-to-end screening pipeline: parse alert → evaluate factors → decide."""

import json
from pathlib import Path

import dspy

from models.schemas import (
    Alert,
    Decision,
    FactorEvaluation,
    FactorResult,
    HitInfo,
    MatchType,
    Party,
    ScreeningResult,
)
from dspy_modules.name_matcher import NameMatcher
from dspy_modules.factor_evaluator import FactorEvaluator
from dspy_modules.decision_engine import DecisionEngine


# Map nationality codes to cultural hints for name matching
CULTURE_MAP = {
    "CN": "Chinese", "TW": "Chinese", "HK": "Chinese",
    "MY": "Malay", "BN": "Malay", "ID": "Malay",
    "IN": "Indian", "LK": "Indian", "BD": "Indian",
    "MM": "Myanmar", "TH": "Thai",
    "KR": "Korean", "KP": "Korean",
    "VN": "Vietnamese", "JP": "Japanese",
    "SA": "Arabic", "AE": "Arabic", "QA": "Arabic",
    "PK": "Arabic", "SD": "Arabic",
    "RU": "Russian", "UA": "Russian",
}


def _infer_culture(party: Party, hit: HitInfo) -> str:
    """Infer cultural naming convention from nationalities."""
    for code in party.nationalities:
        if code in CULTURE_MAP:
            return CULTURE_MAP[code]
    for country in hit.nationalities:
        country_upper = country.upper()
        for code, culture in CULTURE_MAP.items():
            if code.lower() in country_upper.lower() or culture.lower() in country_upper.lower():
                return culture
    return "Western"


def _party_to_json(party: Party) -> str:
    """Convert party data to a JSON string for DSPy input."""
    return json.dumps({
        "name": party.name,
        "dob": party.dob,
        "yob": party.yob,
        "gender": party.gender,
        "birth_country": party.birth_country,
        "birth_location": party.birth_location,
        "nationalities": party.nationalities,
        "ids": [{"type": pid.id_type, "number": pid.id_number} for pid in party.ids],
        "addresses": [
            {"line1": a.line1, "line2": a.line2, "city": a.city,
             "country": a.country, "postal_code": a.postal_code}
            for a in party.addresses
        ],
    })


def _hit_to_json(hit: HitInfo) -> str:
    """Convert hit data to a JSON string for DSPy input."""
    return json.dumps({
        "name": hit.display_name,
        "matched_name": hit.matched_name,
        "aliases": [a.display_name for a in hit.aliases],
        "nationalities": hit.nationalities,
        "gender": hit.gender,
        "age": hit.age,
        "categories": hit.categories,
        "position": hit.position,
        "is_deceased": hit.is_deceased,
        "deceased_date": hit.deceased_date,
        "list_id": hit.list_id,
        "additional_info": hit.additional_info,
        "score": hit.score,
    })


def _parse_factors_json(factors_json: str) -> list[FactorEvaluation]:
    """Parse the JSON array of factor evaluations from DSPy output."""
    try:
        factors = json.loads(factors_json)
    except json.JSONDecodeError:
        # Try to extract JSON from the string
        start = factors_json.find("[")
        end = factors_json.rfind("]") + 1
        if start >= 0 and end > start:
            factors = json.loads(factors_json[start:end])
        else:
            return []

    result = []
    for f in factors:
        factor_result = f.get("result", "Unknown")
        if factor_result not in ("Match", "Mismatch", "Unknown"):
            factor_result = "Unknown"
        result.append(FactorEvaluation(
            factor_name=f.get("factor_name", "Unknown"),
            result=FactorResult(factor_result),
            reasoning=f.get("reasoning", ""),
        ))
    return result


def _parse_match_type(match_type_str: str) -> MatchType:
    """Parse match type string to enum."""
    mt = match_type_str.strip().lower()
    if "full" in mt:
        return MatchType.FULL_MATCH
    if "partial" in mt:
        return MatchType.PARTIAL_MATCH
    if "cultural" in mt:
        return MatchType.CULTURAL_MATCH
    if "mismatch" in mt:
        return MatchType.MISMATCH
    return MatchType.UNKNOWN


def _parse_decision(decision_str: str) -> Decision:
    """Parse decision string to enum."""
    d = decision_str.strip().lower()
    if "hold" in d:
        return Decision.HOLD
    if "risk" in d:
        return Decision.FALSE_POSITIVE_RISK
    if "true" in d:
        return Decision.TRUE_POSITIVE
    return Decision.FALSE_POSITIVE


class ScreeningPipeline:
    """Orchestrates the full screening flow for an alert."""

    def __init__(self):
        self.name_matcher = NameMatcher()
        self.factor_evaluator = FactorEvaluator()
        self.decision_engine = DecisionEngine()

    def screen_hit(self, party: Party, hit: HitInfo, alert_id: str) -> ScreeningResult:
        """Screen a single hit against the party data."""
        # Step 1: Name matching
        culture_hint = _infer_culture(party, hit)
        aliases_str = ", ".join(a.display_name for a in hit.aliases)

        name_result = self.name_matcher(
            party_name=party.name,
            hit_name=hit.matched_name,
            hit_display_name=hit.display_name,
            aliases=aliases_str or "None",
            culture_hint=culture_hint,
        )

        name_match_summary = (
            f"match_type={name_result.match_type}, "
            f"confidence={name_result.confidence}, "
            f"reasoning={name_result.reasoning}"
        )

        # Step 2: Factor evaluation
        party_json = _party_to_json(party)
        hit_json = _hit_to_json(hit)

        factor_result = self.factor_evaluator(
            party_data=party_json,
            hit_data=hit_json,
            name_match_result=name_match_summary,
        )

        primary_factors = _parse_factors_json(factor_result.primary_factors_json)
        secondary_factors = _parse_factors_json(factor_result.secondary_factors_json)

        # Step 3: Decision
        decision_result = self.decision_engine(
            primary_factors=factor_result.primary_factors_json,
            secondary_factors=factor_result.secondary_factors_json,
            is_terror_sanction=hit.is_terror_sanction,
            hit_category=hit.hit_category.value,
        )

        return ScreeningResult(
            alert_id=alert_id,
            hit_entry_id=hit.entry_id,
            hit_list_id=hit.list_id,
            decision=_parse_decision(decision_result.decision),
            rule_applied=decision_result.rule_applied,
            is_terror_sanction=hit.is_terror_sanction,
            name_match_type=_parse_match_type(name_result.match_type),
            name_match_reasoning=name_result.reasoning,
            primary_factors=primary_factors,
            secondary_factors=secondary_factors,
            overall_reasoning=decision_result.reasoning,
            info_request=decision_result.info_request if decision_result.info_request else None,
        )

    def screen_alert(self, alert: Alert) -> list[ScreeningResult]:
        """Screen all hits in an alert."""
        results = []
        for hit in alert.hits:
            result = self.screen_hit(alert.party, hit, alert.alert_id)
            results.append(result)
        return results
