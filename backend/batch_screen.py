"""
Batch negative news screening for all profiles in alerts.json.

Reads profiles from data/alerts.json, runs screening with 2 articles per query,
and saves the full results to data/screening_results.json.

Usage:
    cd backend
    source .venv/bin/activate
    python batch_screen.py
"""

import json
import os
import sys
import time
from pathlib import Path

import dspy
from dotenv import load_dotenv

from screener import NegativeNewsScreener

load_dotenv()

DATA_DIR = Path(__file__).parent.parent / "data"
ALERTS_FILE = DATA_DIR / "alerts.json"
RESULTS_FILE = DATA_DIR / "screening_results.json"
TOP_N = 2  # 2 articles per query


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
    print(f"DSPy configured: azure/{deployment}")


def main():
    # Load profiles
    if not ALERTS_FILE.exists():
        print(f"ERROR: {ALERTS_FILE} not found")
        sys.exit(1)

    with open(ALERTS_FILE) as f:
        profiles = json.load(f)

    print(f"Loaded {len(profiles)} profiles from {ALERTS_FILE}")

    # Load existing results (to resume if interrupted)
    existing_results = {}
    if RESULTS_FILE.exists():
        with open(RESULTS_FILE) as f:
            existing_results = json.load(f)
        print(f"Found {len(existing_results)} existing results (will skip)")

    # Configure DSPy
    configure_dspy()

    # Create screener
    screener = NegativeNewsScreener(top_n=TOP_N, min_confidence=0.65)

    results = dict(existing_results)  # start from existing
    total = len(profiles)

    for idx, (alert_key, profile) in enumerate(profiles.items(), 1):
        # Skip if already screened
        if alert_key in results:
            print(f"[{idx}/{total}] SKIP {alert_key} ({profile['full_name']}) — already screened")
            continue

        name = profile["full_name"]
        print(f"\n[{idx}/{total}] Screening: {name} ({alert_key})")
        print(f"  Profile: nationality={profile.get('nationality', '')}, "
              f"country={profile.get('country', '')}, gender={profile.get('gender', '')}")

        # Build profile dict (remove empty fields)
        profile_dict = {k: v for k, v in profile.items() if v}
        if "aliases" in profile_dict and isinstance(profile_dict["aliases"], str):
            aliases = [a.strip() for a in profile_dict["aliases"].split(",") if a.strip()]
            if aliases:
                profile_dict["aliases"] = aliases
            else:
                del profile_dict["aliases"]

        # Ensure full_name is always present
        profile_dict["full_name"] = name

        try:
            start = time.time()
            result = screener(profile=profile_dict)
            elapsed = time.time() - start

            results[alert_key] = result
            print(f"  Done in {elapsed:.1f}s — Risk: {result.get('overall_risk_rating', 'N/A')} "
                  f"(score: {result.get('overall_risk_score', 'N/A')}), "
                  f"findings: {len(result.get('matched_findings', []))}")

            # Save after each screening (so we don't lose progress)
            with open(RESULTS_FILE, "w") as f:
                json.dump(results, f, indent=2, ensure_ascii=False, default=str)

        except Exception as e:
            print(f"  ERROR: {e}")
            # Save error placeholder so we can retry later
            results[alert_key] = {"error": str(e), "full_name": name}
            with open(RESULTS_FILE, "w") as f:
                json.dump(results, f, indent=2, ensure_ascii=False, default=str)

        # Small delay between screenings to avoid rate limits
        if idx < total:
            time.sleep(2)

    print(f"\nBatch complete. {len(results)} results saved to {RESULTS_FILE}")

    # Print summary
    print("\n--- Summary ---")
    for key, result in results.items():
        if "error" in result:
            print(f"  {key}: ERROR — {result['error']}")
        else:
            rating = result.get("overall_risk_rating", "N/A")
            score = result.get("overall_risk_score", "N/A")
            findings = len(result.get("matched_findings", []))
            print(f"  {key}: {result.get('subject', {}).get('full_name', '?')} — "
                  f"{rating} ({score}), {findings} findings")


if __name__ == "__main__":
    main()
