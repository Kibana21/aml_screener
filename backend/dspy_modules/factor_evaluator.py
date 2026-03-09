"""DSPy module for evaluating primary and secondary screening factors."""

import dspy


class PrimaryFactorSignature(dspy.Signature):
    """Evaluate primary screening factors between a customer (party) and a watchlist hit.

    Primary factors are critical identifying attributes. Evaluate each factor as
    Match, Mismatch, or Unknown based on available data.

    Primary factors to evaluate:
    1. Name token count match/mismatch
    2. Name match/mismatch (considering cultural conventions)
    3. Cultural name match/mismatch
    4. Unique ID match/mismatch (passport, NRIC)
    5. Gender match/mismatch
    6. Date of Birth match/mismatch
    7. Year of Birth match/mismatch
    8. Nationality match/mismatch
    9. Deceased status match/mismatch
    10. Customer category match/mismatch
    11. Address match
    12. Related party match/mismatch
    13. Photo image match/mismatch (mark Unknown if no photo data)
    """

    party_data: str = dspy.InputField(desc="JSON string of customer/party data including name, DOB, gender, nationality, IDs, addresses")
    hit_data: str = dspy.InputField(desc="JSON string of watchlist hit data including name, aliases, nationality, gender, categories, position")
    name_match_result: str = dspy.InputField(desc="Result from name matching module: match_type, confidence, reasoning")

    factors_json: str = dspy.OutputField(desc='JSON array of objects with keys: factor_name, result (Match/Mismatch/Unknown), reasoning. One object per primary factor evaluated.')


class SecondaryFactorSignature(dspy.Signature):
    """Evaluate secondary screening factors between a customer and a watchlist hit.

    Secondary factors provide additional supporting validation.

    Secondary factors to evaluate:
    1. Full name match
    2. Partial name match
    3. Year of Birth match
    4. Occupation match/mismatch
    5. Place of birth match/mismatch
    """

    party_data: str = dspy.InputField(desc="JSON string of customer/party data")
    hit_data: str = dspy.InputField(desc="JSON string of watchlist hit data")
    name_match_result: str = dspy.InputField(desc="Result from name matching module")

    factors_json: str = dspy.OutputField(desc='JSON array of objects with keys: factor_name, result (Match/Mismatch/Unknown), reasoning. One object per secondary factor evaluated.')


class FactorEvaluator(dspy.Module):
    def __init__(self):
        super().__init__()
        self.primary_evaluator = dspy.ChainOfThought(PrimaryFactorSignature)
        self.secondary_evaluator = dspy.ChainOfThought(SecondaryFactorSignature)

    def forward(self, party_data: str, hit_data: str, name_match_result: str):
        primary = self.primary_evaluator(
            party_data=party_data,
            hit_data=hit_data,
            name_match_result=name_match_result,
        )
        secondary = self.secondary_evaluator(
            party_data=party_data,
            hit_data=hit_data,
            name_match_result=name_match_result,
        )
        return dspy.Prediction(
            primary_factors_json=primary.factors_json,
            secondary_factors_json=secondary.factors_json,
        )
