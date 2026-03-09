"""DSPy module for cultural and linguistic name matching."""

import dspy


class NameMatchSignature(dspy.Signature):
    """Evaluate whether two names refer to the same person, considering cultural
    naming conventions, honorific titles, transliteration differences, word order
    variations, hyphenation, spacing, married names, and partial matches.

    Cultures to consider: Chinese (simplified/traditional), Malay (bin/binti),
    Indian (D/O, S/O), Myanmar (U, Daw honorifics), Thai, Korean, Vietnamese,
    Western, and Spanish/Latin naming conventions.
    """

    party_name: str = dspy.InputField(desc="Customer/party name from the bank's records")
    hit_name: str = dspy.InputField(desc="Name from the watchlist hit (may include {GN=...}{SN=...} format)")
    hit_display_name: str = dspy.InputField(desc="Display name of the watchlist entry")
    aliases: str = dspy.InputField(desc="Comma-separated list of known aliases for the watchlist entry")
    culture_hint: str = dspy.InputField(desc="Likely cultural origin based on nationality (e.g., Chinese, Malay, Indian, Korean)")

    match_type: str = dspy.OutputField(desc="One of: Full Match, Partial Match, Cultural Match, Mismatch")
    confidence: float = dspy.OutputField(desc="Confidence score between 0.0 and 1.0")
    reasoning: str = dspy.OutputField(desc="Step-by-step reasoning explaining the match assessment")


class NameMatcher(dspy.Module):
    def __init__(self):
        super().__init__()
        self.matcher = dspy.ChainOfThought(NameMatchSignature)

    def forward(self, party_name: str, hit_name: str, hit_display_name: str,
                aliases: str, culture_hint: str):
        return self.matcher(
            party_name=party_name,
            hit_name=hit_name,
            hit_display_name=hit_display_name,
            aliases=aliases,
            culture_hint=culture_hint,
        )
