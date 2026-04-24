"""
executor.py — Agent 3: Test Executor
Runs generated Playwright TypeScript tests and captures results.
"""

import os
import subprocess
import json
import re
from pathlib import Path

_nodejs_path = r'C:\Program Files\nodejs'
if _nodejs_path not in os.environ.get('PATH', ''):
    os.environ['PATH'] = _nodejs_path + os.pathsep + os.environ.get('PATH', '')

# finds npx automatically
def find_npx():
    """Find npx executable — handles Windows PATH issues."""
    import shutil
    # Try shutil first
    npx = shutil.which('npx')
    if npx:
        return npx
    # Common Windows locations
    candidates = [
        r'C:\Program Files\nodejs\npx.cmd',
        r'C:\Program Files (x86)\nodejs\npx.cmd',
        os.path.expanduser(r'~\AppData\Roaming\npm\npx.cmd'),
        r'C:\nvm\nodejs\npx.cmd',
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return 'npx'  # fallback

class TestExecutor:
    """
    Agent 3 — Executes generated Playwright tests and captures results.
    Provides structured output for the failure analyser.
    """

    def __init__(self, framework_root: str):
        self.framework_root = framework_root

    def execute(self, test_file_path: str, project: str = 'chromium',
                headed: bool = False, timeout: int = 120) -> dict:
        """
        Execute a test file and return structured results.
        Returns: {
            'passed': bool,
            'exit_code': int,
            'stdout': str,
            'stderr': str,
            'failures': list[dict],
            'duration_ms': int
        }
        """
        print(f"\n[EXECUTOR] Running: {test_file_path}")
        print(f"[EXECUTOR] Project: {project}")
        npx_cmd = find_npx()
        cmd = [
            npx_cmd, 'playwright', 'test',
            test_file_path,
            f'--project={project}',
            '--reporter=json',
            '--retries=0',  # No retries — we handle failures ourselves
        ]

        if headed:
            cmd.append('--headed')

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.framework_root,
                timeout=timeout,
                shell=True
            )

            # Parse JSON output from Playwright reporter
            failures = self._parse_failures(result.stdout, result.stderr)

            passed = result.returncode == 0
            if passed:
                print(f"[EXECUTOR] Tests PASSED ✅")
            else:
                print(f"[EXECUTOR] Tests FAILED ❌ — {len(failures)} failure(s)")
                for f in failures:
                    print(f"  - {f.get('title', 'unknown')}: {f.get('error', '')[:100]}")

            return {
                'passed': passed,
                'exit_code': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'failures': failures,
                'raw_output': result.stdout + result.stderr
            }

        except subprocess.TimeoutExpired:
            print(f"[EXECUTOR] Test execution timed out after {timeout}s")
            return {
                'passed': False,
                'exit_code': -1,
                'stdout': '',
                'stderr': f'Execution timed out after {timeout}s',
                'failures': [{'title': 'TIMEOUT', 'error': f'Timed out after {timeout}s'}],
                'raw_output': f'Execution timed out after {timeout}s',
            }
        except FileNotFoundError:
            print("[EXECUTOR] Error: npx not found — is Node.js installed?")
            return {
                'passed': False,
                'exit_code': -1,
                'stdout': '',
                'stderr': 'npx not found',
                'failures': [{'title': 'SETUP_ERROR', 'error': 'npx not found'}],
                'raw_output': 'npx not found'
            }

    def dry_run(self, test_file_path: str) -> dict:
        """
        Run Playwright in dry-run mode to check test discovery without executing.
        """
        print(f"\n[EXECUTOR] Dry run: {test_file_path}")

        try:
            result = subprocess.run(
                [find_npx(), 'playwright', 'test', test_file_path, '--list'],
                capture_output=True,
                text=True,
                cwd=self.framework_root,
                timeout=30,
                shell=True
            )

            tests_found = result.stdout.count('•') + result.stdout.count('·')
            print(f"[EXECUTOR] Dry run found {tests_found} test(s)")

            return {
                'success': result.returncode == 0,
                'tests_found': tests_found,
                'output': result.stdout
            }
        except Exception as e:
            return {'success': False, 'tests_found': 0, 'output': str(e)}

    def _parse_failures(self, stdout: str, stderr: str) -> list:
        """Parse Playwright JSON reporter output for failure details."""
        failures = []

        # Try parsing JSON output
        try:
            # Find JSON in output (Playwright JSON reporter outputs JSON)
            json_match = re.search(r'\{.*"suites".*\}', stdout, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                failures = self._extract_failures_from_json(data)
                return failures
        except (json.JSONDecodeError, AttributeError):
            pass

        # Fallback: parse text output for error patterns
        failures = self._parse_text_failures(stdout + stderr)
        return failures

    def _extract_failures_from_json(self, data: dict) -> list:
        """Extract failure details from Playwright JSON reporter output."""
        failures = []

        def process_suite(suite):
            for spec in suite.get('specs', []):
                for test in spec.get('tests', []):
                    if test.get('status') == 'failed' or test.get('status') == 'unexpected':
                        error_msg = ''
                        selector_info = ''
                        for result in test.get('results', []):
                            for error in result.get('errors', []):
                                error_msg = error.get('message', '')
                                # Extract selector from error
                                selector_match = re.search(
                                    r"locator\(['\"](.*?)['\"]\)|getBy\w+\(['\"]?(.*?)['\"]?\)",
                                    error_msg
                                )
                                if selector_match:
                                    selector_info = selector_match.group()

                        failures.append({
                            'title': spec.get('title', 'Unknown test'),
                            'error': error_msg,
                            'selector': selector_info,
                            'is_selector_failure': 'locator' in error_msg.lower() or
                                                   'element' in error_msg.lower() or
                                                   'selector' in error_msg.lower()
                        })

            for child_suite in suite.get('suites', []):
                process_suite(child_suite)

        for suite in data.get('suites', []):
            process_suite(suite)

        return failures

    def _parse_text_failures(self, output: str) -> list:
        """Parse text output when JSON parsing fails."""
        failures = []
        lines = output.split('\n')

        current_failure = None
        for line in lines:
            if '● ' in line or 'FAILED' in line:
                if current_failure:
                    failures.append(current_failure)
                current_failure = {
                    'title': line.strip(),
                    'error': '',
                    'selector': '',
                    'is_selector_failure': False
                }
            elif current_failure and ('Error:' in line or 'locator' in line.lower()):
                current_failure['error'] += line.strip() + ' '
                if 'locator' in line.lower() or 'element' in line.lower():
                    current_failure['is_selector_failure'] = True
                    # Try to extract selector
                    selector_match = re.search(r"'([^']+)'|\"([^\"]+)\"", line)
                    if selector_match:
                        current_failure['selector'] = selector_match.group(1) or selector_match.group(2)

        if current_failure:
            failures.append(current_failure)

        return failures
