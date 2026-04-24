"""
pipeline.py — Autonomous Test Generation Pipeline Orchestrator
Ties together all 4 agents:
  Agent 1: Generator   — Claude generates .spec.ts from scenario
  Agent 2: Validator   — TypeScript compile + structural checks
  Agent 3: Executor    — Playwright runs the test
  Agent 4: Healer      — Claude fixes selector failures
  Gate:    Human Review — PR creation or file flagging
"""

import os
import json
import shutil
import datetime
from pathlib import Path

from generator import TestGenerator
from validator import TestValidator
from executor import TestExecutor
from healer import SelectorHealer


class PipelineResult:
    """Tracks the result of one scenario through the pipeline."""
    def __init__(self, scenario_id: str):
        self.scenario_id = scenario_id
        self.status = 'PENDING'  # PENDING | GENERATED | VALIDATED | PASSED | HEALED | HUMAN_REVIEW | FAILED
        self.generated_file = None
        self.generation_attempts = 0
        self.heal_attempts = 0
        self.errors = []
        self.warnings = []
        self.timestamp = datetime.datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            'scenario_id': self.scenario_id,
            'status': self.status,
            'generated_file': self.generated_file,
            'generation_attempts': self.generation_attempts,
            'heal_attempts': self.heal_attempts,
            'errors': self.errors,
            'warnings': self.warnings,
            'timestamp': self.timestamp
        }


class AutonomousPipeline:
    """
    Autonomous test generation, validation, execution, and self-healing pipeline.
    
    Flow:
    Scenario → Generate → Validate → Execute → [Heal if selector fails] → Commit/Review
    
    Max retries:
    - Generation: 2 attempts (with error feedback)
    - Healing: 2 attempts (different selector strategy each time)
    """

    MAX_GENERATION_RETRIES = 2
    MAX_HEAL_RETRIES = 2

    def __init__(self, framework_root: str):
        self.framework_root = os.path.abspath(framework_root)
        self.pipeline_dir = os.path.join(self.framework_root, 'ai_pipeline')
        self.prompts_dir = os.path.join(self.pipeline_dir, 'prompts')
        self.generated_dir = os.path.join(self.pipeline_dir, 'generated')
        self.logs_dir = os.path.join(self.pipeline_dir, 'logs')

        os.makedirs(self.generated_dir, exist_ok=True)
        os.makedirs(self.logs_dir, exist_ok=True)

        print("[PIPELINE] Initialising agents...")
        self.generator = TestGenerator(self.framework_root, self.prompts_dir)
        self.validator = TestValidator(self.framework_root)
        self.executor = TestExecutor(self.framework_root)
        self.healer = SelectorHealer(self.prompts_dir)
        print("[PIPELINE] All agents ready ✅")

    def run_scenario(self, scenario: dict) -> PipelineResult:
        """
        Run the complete pipeline for a single scenario.
        """
        result = PipelineResult(scenario['id'])
        print(f"\n{'='*60}")
        print(f"[PIPELINE] Starting: {scenario['id']}")
        print(f"{'='*60}")

        # ── AGENT 1: GENERATE ──────────────────────────────────────
        generated_code = self._generate_with_retry(scenario, result)
        if not generated_code:
            result.status = 'FAILED'
            self._save_log(result)
            return result

        result.status = 'GENERATED'

        # ── AGENT 2: VALIDATE ──────────────────────────────────────
        validation = self.validator.validate(scenario['output_file'], generated_code)
        result.warnings.extend(validation.get('warnings', []))

        if not validation['valid']:
            print(f"[PIPELINE] Validation failed — retrying generation with error feedback")
            error_feedback = '\n'.join(validation['errors'])
            generated_code = self._generate_with_retry(
                scenario, result, error_feedback=error_feedback
            )
            if not generated_code:
                result.status = 'FAILED'
                result.errors.extend(validation['errors'])
                self._save_log(result)
                return result

            # Re-validate
            validation = self.validator.validate(scenario['output_file'], generated_code)
            if not validation['valid']:
                result.status = 'HUMAN_REVIEW'
                result.errors.extend(validation['errors'])
                self._flag_for_review(scenario, generated_code, 'Validation failed after retry')
                self._save_log(result)
                return result

        result.status = 'VALIDATED'
        result.generated_file = scenario['output_file']
        print(f"[PIPELINE] Validation passed ✅")

        # ── AGENT 3: EXECUTE ───────────────────────────────────────
        execution = self.executor.execute(
            scenario['output_file'],
            project='chromium'
        )

        if execution['passed']:
            result.status = 'PASSED'
            print(f"[PIPELINE] Test PASSED ✅ — {scenario['id']} ready to commit")
            self._save_to_generated(scenario, generated_code, result)
            self._save_log(result)
            return result

        # ── AGENT 4: SELF-HEAL ─────────────────────────────────────
        failures = execution.get('failures', [])
        healed_code = self._heal_with_retry(
            scenario, generated_code, failures, result
        )

        if healed_code and healed_code != generated_code:
            # Re-execute healed code
            self.validator.validate(scenario['output_file'], healed_code)
            rerun = self.executor.execute(
                scenario['output_file'],
                project='chromium-no-auth'
            )
            if rerun['passed']:
                result.status = 'HEALED'
                print(f"[PIPELINE] Healed and PASSING ✅ — {scenario['id']}")
                self._save_to_generated(scenario, healed_code, result)
                self._save_log(result)
                return result

        # Could not heal — send to human review
        result.status = 'HUMAN_REVIEW'
        failure_summary = '; '.join([
            f.get('error', '')[:100] for f in failures[:3]
        ])
        result.errors.append(failure_summary)
        print(f"[PIPELINE] Sending to human review — {scenario['id']}")
        self._flag_for_review(scenario, generated_code, failure_summary)
        self._save_log(result)
        return result

    def run_all(self, scenarios_file: str) -> list:
        """Run the pipeline for all scenarios in a JSON file."""
        with open(scenarios_file, 'r') as f:
            scenarios = json.load(f)

        print(f"\n[PIPELINE] Running {len(scenarios)} scenarios")
        results = []

        for scenario in scenarios:
            result = self.run_scenario(scenario)
            results.append(result.to_dict())
            self._print_summary(results)

        # Save final report
        self._save_pipeline_report(results)
        return results

    def _generate_with_retry(self, scenario: dict, result: PipelineResult,
                              error_feedback: str = None) -> str:
        """Generate test with retry on failure."""
        for attempt in range(1, self.MAX_GENERATION_RETRIES + 1):
            result.generation_attempts = attempt
            try:
                if error_feedback and attempt > 1:
                    code = self.generator.generate_with_retry(scenario, error_feedback)
                else:
                    code = self.generator.generate(scenario)
                if code and len(code) > 100:
                    return code
            except Exception as e:
                print(f"[PIPELINE] Generation attempt {attempt} failed: {e}")
                result.errors.append(f"Generation error attempt {attempt}: {str(e)}")

        print(f"[PIPELINE] All generation attempts failed for {scenario['id']}")
        return None

    def _heal_with_retry(self, scenario: dict, code: str,
                          failures: list, result: PipelineResult) -> str:
        """Attempt to heal selector failures."""
        current_code = code

        for failure in failures:
            if not self.healer.can_heal(failure):
                print(f"[PIPELINE] Failure is not a selector issue — skipping heal")
                continue

            for attempt in range(1, self.MAX_HEAL_RETRIES + 1):
                result.heal_attempts += 1
                print(f"[PIPELINE] Heal attempt {attempt} for failure: {failure.get('title', '')}")

                # heal_result = self.healer.heal(current_code, failure)
                heal_result = self.healer.heal(
                    current_code, 
                    failure,
                    framework_root=self.framework_root
                )

                if heal_result['healed']:
                    current_code = heal_result['updated_code']
                    print(f"[PIPELINE] Heal applied: {heal_result['old_selector']} → {heal_result['new_selector']}")
                    break
                else:
                    print(f"[PIPELINE] Heal attempt {attempt} unsuccessful")

        return current_code

    def _save_to_generated(self, scenario: dict, code: str, result: PipelineResult):
        """Save successfully generated test to the generated directory."""
        filename = os.path.basename(scenario['output_file'])
        generated_path = os.path.join(self.generated_dir, filename)
        with open(generated_path, 'w', encoding='utf-8') as f:
            f.write(code)
        print(f"[PIPELINE] Saved to generated: {generated_path}")

    def _flag_for_review(self, scenario: dict, code: str, reason: str):
        """Flag a test for human review."""
        review_dir = os.path.join(self.pipeline_dir, 'review_queue')
        os.makedirs(review_dir, exist_ok=True)

        filename = f"{scenario['id']}_REVIEW.spec.ts"
        review_path = os.path.join(review_dir, filename)

        review_header = f"""// ⚠️  HUMAN REVIEW REQUIRED
// Scenario: {scenario['id']}
// Reason: {reason}
// Generated: {datetime.datetime.now().isoformat()}
// Review and fix before adding to test suite
// ─────────────────────────────────────────────

"""
        with open(review_path, 'w', encoding='utf-8') as f:
            f.write(review_header + code)
        print(f"[PIPELINE] Flagged for review: {review_path}")

    def _save_log(self, result: PipelineResult):
        """Save pipeline execution log."""
        log_file = os.path.join(
            self.logs_dir,
            f"{result.scenario_id}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, indent=2)

    def _save_pipeline_report(self, results: list):
        """Save final pipeline report."""
        report_path = os.path.join(
            self.logs_dir,
            f"pipeline_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        summary = {
            'total': len(results),
            'passed': sum(1 for r in results if r['status'] == 'PASSED'),
            'healed': sum(1 for r in results if r['status'] == 'HEALED'),
            'human_review': sum(1 for r in results if r['status'] == 'HUMAN_REVIEW'),
            'failed': sum(1 for r in results if r['status'] == 'FAILED'),
            'results': results
        }
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)
        print(f"\n[PIPELINE] Report saved: {report_path}")
        return report_path

    def _print_summary(self, results: list):
        """Print running summary."""
        total = len(results)
        passed = sum(1 for r in results if r['status'] in ('PASSED', 'HEALED'))
        review = sum(1 for r in results if r['status'] == 'HUMAN_REVIEW')
        failed = sum(1 for r in results if r['status'] == 'FAILED')
        print(f"\n[SUMMARY] {total} processed | ✅ {passed} ready | ⚠️  {review} review | ❌ {failed} failed")
