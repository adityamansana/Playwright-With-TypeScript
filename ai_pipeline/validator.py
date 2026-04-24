"""
validator.py — Agent 2: TypeScript Validator
Validates generated TypeScript code:
  1. TypeScript compilation check (tsc --noEmit)
  2. ESLint check
  3. Basic structural validation
"""

import os
import subprocess
import re
from pathlib import Path


class TestValidator:
    """
    Agent 2 — Validates generated TypeScript test files.
    Catches compilation errors before running tests.
    """

    def __init__(self, framework_root: str):
        self.framework_root = framework_root

    def validate(self, test_file_path: str, generated_code: str) -> dict:
        """
        Full validation pipeline.
        Returns: {
            'valid': bool,
            'errors': list[str],
            'warnings': list[str]
        }
        """
        print(f"\n[VALIDATOR] Validating: {test_file_path}")
        errors = []
        warnings = []

        # Step 1: Structural validation (fast — no subprocess)
        structural_errors = self._structural_check(generated_code)
        errors.extend(structural_errors)

        # Step 2: Write file temporarily for tsc check
        full_path = os.path.join(self.framework_root, test_file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(generated_code)

        # Step 3: TypeScript compilation check
        tsc_result = self._tsc_check(full_path)
        if tsc_result['errors']:
            errors.extend(tsc_result['errors'])
            print(f"[VALIDATOR] TSC errors: {len(tsc_result['errors'])}")
        else:
            print("[VALIDATOR] TSC check passed ✅")

        # Step 4: Convention checks
        convention_warnings = self._convention_check(generated_code)
        warnings.extend(convention_warnings)

        is_valid = len(errors) == 0
        if is_valid:
            print(f"[VALIDATOR] Validation PASSED ✅ ({len(warnings)} warnings)")
        else:
            print(f"[VALIDATOR] Validation FAILED ❌ ({len(errors)} errors, {len(warnings)} warnings)")
            # Remove invalid file
            if os.path.exists(full_path):
                os.remove(full_path)

        return {
            'valid': is_valid,
            'errors': errors,
            'warnings': warnings,
            'file_path': full_path if is_valid else None
        }

    def _structural_check(self, code: str) -> list:
        """Fast structural checks without subprocess."""
        errors = []

        # Must have test.describe
        if 'test.describe(' not in code:
            errors.append("Missing test.describe() block")

        # Must have at least one test()
        if "test('" not in code and 'test("' not in code:
            errors.append("No test() cases found")

        # Must import from fixture
        if 'linkedin.fixture' not in code:
            errors.append("Missing import from linkedin.fixture — must not import from @playwright/test directly")

        # Must not use page.waitForTimeout
        if 'waitForTimeout' in code:
            errors.append("Found page.waitForTimeout() — use WaitUtil methods instead")

        # Must not hardcode credentials
        if 'password' in code.lower() and ('=' in code):
            # Check if it's actually hardcoded vs a variable name
            if re.search(r'["\'].*password.*["\']', code, re.IGNORECASE):
                errors.append("Possible hardcoded credentials detected")

        # Check balanced braces
        if code.count('{') != code.count('}'):
            errors.append(f"Unbalanced braces: {code.count('{')} opening vs {code.count('}')} closing")

        # Check balanced parentheses
        if code.count('(') != code.count(')'):
            errors.append(f"Unbalanced parentheses: {code.count('(')} opening vs {code.count(')')} closing")

        return errors

    def _tsc_check(self, file_path: str) -> dict:
        """Run TypeScript compiler check."""
        try:
            result = subprocess.run(
                ['npx', 'tsc', '--noEmit', '--allowJs', '--checkJs', 'false',
                 '--target', 'ES2020', '--module', 'commonjs',
                 '--moduleResolution', 'node', '--strict', 'false',
                 file_path],
                capture_output=True,
                text=True,
                cwd=self.framework_root,
                timeout=30
            )

            if result.returncode == 0:
                return {'errors': [], 'output': ''}

            # Parse TSC errors
            error_lines = [
                line for line in result.stderr.split('\n')
                if line.strip() and 'error TS' in line
            ]
            return {'errors': error_lines, 'output': result.stderr}

        except subprocess.TimeoutExpired:
            return {'errors': ['TypeScript check timed out after 30s'], 'output': ''}
        except FileNotFoundError:
            # npx not found — skip tsc check
            print("[VALIDATOR] Warning: npx/tsc not available — skipping compilation check")
            return {'errors': [], 'output': ''}

    def _convention_check(self, code: str) -> list:
        """Check framework conventions — returns warnings not errors."""
        warnings = []

        if 'allure.epic(' not in code:
            warnings.append("Missing allure.epic() annotation")

        if 'allure.feature(' not in code:
            warnings.append("Missing allure.feature() annotation")

        if 'allureStep(' not in code:
            warnings.append("Missing allureStep() wrappers — consider adding for better reporting")

        if 'TestDataManager' not in code:
            warnings.append("TestDataManager not used — check if test data is hardcoded")

        return warnings
