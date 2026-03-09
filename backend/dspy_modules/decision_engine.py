"""DSPy module for applying the decision matrix rules."""

import dspy


class DecisionSignature(dspy.Signature):
    """Apply the AML Name Screening decision matrix to determine if a watchlist hit
    is a True Positive, False Positive, or Hold.

    Decision Rules:
    Rule 1: If ANY primary factor MISMATCHES → False Positive
    Rule 2: If ANY primary factor MATCHES → True Positive
    Rule 3: If 3+ secondary factors MATCH → True Positive
    Rule 4: If 2+ secondary factors MISMATCH → False Positive

    For TERROR/SANCTIONS/MAS hits (stricter rules):
    - 2 secondary match + 1 secondary mismatch → True Positive
    - 2 secondary match + 0 primary mismatch → True Positive
    - 1 secondary match + 1 secondary mismatch → True Positive
    - 1 secondary match + 0 primary mismatch → True Positive

    For NON-TERROR hits (PEP, Adverse Media, etc.):
    - 2 secondary match + 1 secondary mismatch → False Positive (Risk-Based)
    - 2 secondary match + 0 primary mismatch → False Positive (Risk-Based)
    - 1 secondary match + 0 primary mismatch → False Positive
    - 1 secondary match + 1 secondary mismatch → False Positive

    If insufficient information → Hold (specify what info is needed).
    """

    primary_factors: str = dspy.InputField(desc="JSON array of primary factor evaluations with factor_name, result, reasoning")
    secondary_factors: str = dspy.InputField(desc="JSON array of secondary factor evaluations with factor_name, result, reasoning")
    is_terror_sanction: bool = dspy.InputField(desc="Whether the hit is from a terror/sanctions/MAS list")
    hit_category: str = dspy.InputField(desc="Category of the hit: Sanctions, Terrorism, MAS, PEP, Adverse Media, Other")

    decision: str = dspy.OutputField(desc="One of: True Positive, False Positive, False Positive (Risk-Based), Hold")
    rule_applied: str = dspy.OutputField(desc="Which decision rule was applied (e.g., Rule 1, Rule 2, Terror Rule, Non-Terror Rule)")
    reasoning: str = dspy.OutputField(desc="Step-by-step explanation of how the decision was reached, citing specific factors")
    info_request: str = dspy.OutputField(desc="If decision is Hold, specify what additional information is needed. Otherwise empty string.")


class DecisionEngine(dspy.Module):
    def __init__(self):
        super().__init__()
        self.decide = dspy.ChainOfThought(DecisionSignature)

    def forward(self, primary_factors: str, secondary_factors: str,
                is_terror_sanction: bool, hit_category: str):
        return self.decide(
            primary_factors=primary_factors,
            secondary_factors=secondary_factors,
            is_terror_sanction=is_terror_sanction,
            hit_category=hit_category,
        )
