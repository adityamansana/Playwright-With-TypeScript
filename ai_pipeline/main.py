"""
main.py — AI Pipeline Entry Point
Run the autonomous test generation pipeline from command line.

Usage:
  # Generate all scenarios
  python main.py

  # Generate single scenario
  python main.py --scenario TC-AI-001

  # Generate from custom scenarios file
  python main.py --scenarios path/to/scenarios.json

  # Skip execution (generate and validate only)
  python main.py --no-execute

  # Dry run (show what would be generated without calling Claude)
  python main.py --dry-run
"""

import argparse
import json
import os
import sys
from pathlib import Path


def check_api_key():
    """Verify ANTHROPIC_API_KEY is set."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("\n❌ ERROR: ANTHROPIC_API_KEY environment variable not set")
        print("\nSet it with:")
        print("  export ANTHROPIC_API_KEY=your-key-here   # Mac/Linux")
        print("  set ANTHROPIC_API_KEY=your-key-here      # Windows CMD")
        print("\nGet your API key from: https://console.anthropic.com")
        sys.exit(1)
    print(f"✅ API key found: sk-...{key[-6:]}")


def main():
    parser = argparse.ArgumentParser(
        description='Autonomous Playwright TypeScript Test Generator'
    )
    parser.add_argument(
        '--scenario', type=str,
        help='Generate a single scenario by ID (e.g. TC-AI-001)'
    )
    parser.add_argument(
        '--scenarios', type=str,
        default='ai_pipeline/scenarios/linkedin_scenarios.json',
        help='Path to scenarios JSON file'
    )
    parser.add_argument(
        '--framework-root', type=str,
        default='.',
        help='Path to Playwright framework root'
    )
    parser.add_argument(
        '--no-execute', action='store_true',
        help='Skip test execution (generate and validate only)'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Show scenarios without generating'
    )

    args = parser.parse_args()

    print("\n" + "="*60)
    print("  AUTONOMOUS PLAYWRIGHT TEST GENERATION PIPELINE")
    print("  Powered by Claude (claude-sonnet-4-5)")
    print("="*60)

    # Validate environment
    check_api_key()

    framework_root = os.path.abspath(args.framework_root)
    print(f"Framework root: {framework_root}")

    # Load scenarios
    scenarios_path = os.path.join(framework_root, args.scenarios)
    if not os.path.exists(scenarios_path):
        print(f"\n❌ Scenarios file not found: {scenarios_path}")
        sys.exit(1)

    with open(scenarios_path, 'r') as f:
        all_scenarios = json.load(f)

    # Filter to single scenario if specified
    if args.scenario:
        scenarios = [s for s in all_scenarios if s['id'] == args.scenario]
        if not scenarios:
            print(f"\n❌ Scenario not found: {args.scenario}")
            print(f"Available scenarios: {[s['id'] for s in all_scenarios]}")
            sys.exit(1)
    else:
        scenarios = all_scenarios

    print(f"\nScenarios to process: {len(scenarios)}")
    for s in scenarios:
        print(f"  • {s['id']}: {s['description']}")

    if args.dry_run:
        print("\n[DRY RUN] No generation performed")
        return

    print("\n" + "-"*60)

    # Import pipeline here (after env check)
    sys.path.insert(0, os.path.join(framework_root, 'ai_pipeline'))
    from pipeline import AutonomousPipeline

    pipeline = AutonomousPipeline(framework_root)

    if len(scenarios) == 1:
        result = pipeline.run_scenario(scenarios[0])
        results = [result.to_dict() if hasattr(result, 'to_dict') else result]
    else:
        results = pipeline.run_all(scenarios_path)

    # Final summary
    print("\n" + "="*60)
    print("  PIPELINE COMPLETE")
    print("="*60)
    passed = sum(1 for r in results if r.get('status') in ('PASSED', 'HEALED'))
    review = sum(1 for r in results if r.get('status') == 'HUMAN_REVIEW')
    failed = sum(1 for r in results if r.get('status') == 'FAILED')

    print(f"\n  Total:        {len(results)}")
    print(f"  ✅ Ready:      {passed} (check ai_pipeline/generated/)")
    print(f"  ⚠️  Review:     {review} (check ai_pipeline/review_queue/)")
    print(f"  ❌ Failed:     {failed}")
    print(f"\n  Logs:         ai_pipeline/logs/")
    print("="*60 + "\n")


if __name__ == '__main__':
    main()
