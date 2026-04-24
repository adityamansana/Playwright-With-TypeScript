"""
healer.py — Agent 4: Selector Self-Healer
Uses Claude to analyse failed selectors and suggest replacements.
Reads current page HTML to find the element using semantic strategies.
"""

import os
import re
import json
import anthropic
from context_loader import get_active_prompt


class SelectorHealer:
    """
    Agent 4 — Self-healing selector engine using Claude.

    Unlike Healenium (which works at WebDriver level with pre-stored baselines),
    this healer:
    - Works at source code level
    - Understands WHY a selector failed
    - Generates semantically correct Playwright-native replacements
    - Fixes selectors in page object files, not just generated test files
    - Uses captured page HTML for accurate replacement suggestions
    """

    def __init__(self, prompts_dir: str):
        self.prompts_dir = prompts_dir
        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )

    def can_heal(self, failure: dict) -> bool:
        """Determine if this failure is healable (selector issue)."""
        error = failure.get('error', '').lower()
        selector_indicators = [
            'locator', 'element', 'selector', 'not found',
            'not visible', 'not attached', 'timeout exceeded',
            'strict mode violation', 'elementhandle'
        ]
        return any(indicator in error for indicator in selector_indicators)

    def heal(self, failed_code: str, failure: dict,
             page_html: str = None, framework_root: str = None) -> dict:
        """
        Attempt to heal a selector failure.

        Returns: {
            'healed': bool,
            'updated_code': str,
            'old_selector': str,
            'new_selector': str,
            'confidence': float,
            'reasoning': str
        }
        """
        print(f"\n[HEALER] Attempting to heal selector failure...")
        print(f"[HEALER] Error: {failure.get('error', '')[:150]}")

        # Extract failed selector from error message
        failed_selector = self._extract_failed_selector(failure.get('error', ''))
        if not failed_selector:
            failed_selector = failure.get('selector', '')

        print(f"[HEALER] Failed selector: {failed_selector}")

        if not failed_selector:
            print("[HEALER] Could not identify failed selector — cannot heal")
            return {
                'healed': False,
                'updated_code': failed_code,
                'old_selector': '',
                'new_selector': '',
                'confidence': 0.0,
                'reasoning': 'Could not identify failed selector from error message'
            }

        # Load page HTML from captured file if not provided directly
        if not page_html and framework_root:
            test_id = failure.get('title', '').replace(' ', '_')
            page_html = self._get_page_html(test_id, framework_root)
            if page_html:
                print(f"[HEALER] Loaded page HTML ({len(page_html)} chars) for context")

        # Ask Claude for replacement selector
        healing_result = self._ask_claude_for_replacement(
            failed_selector=failed_selector,
            error_message=failure.get('error', ''),
            page_html=page_html,
            test_context=self._extract_test_context(failed_code, failed_selector)
        )

        print(f"[HEALER] Claude suggestion: {healing_result.get('new_selector', 'none')} "
              f"(confidence: {healing_result.get('confidence', 0):.0%})")

        if healing_result.get('confidence', 0) < 0.6:
            print(f"[HEALER] Low confidence — not applying heal")
            return {
                'healed': False,
                'updated_code': failed_code,
                'old_selector': failed_selector,
                'new_selector': healing_result.get('new_selector', ''),
                'confidence': healing_result.get('confidence', 0),
                'reasoning': healing_result.get('reasoning', '')
            }

        # Step 1 — Try to fix in the generated test file
        updated_code = self._apply_fix(
            failed_code,
            failed_selector,
            healing_result.get('new_selector', ''),
            healing_result.get('full_locator', '')
        )
        healed = updated_code != failed_code

        if healed:
            print(f"[HEALER] Fixed in test file ✅")
            return {
                'healed': True,
                'updated_code': updated_code,
                'old_selector': failed_selector,
                'new_selector': healing_result.get('new_selector', ''),
                'confidence': healing_result.get('confidence', 0),
                'reasoning': healing_result.get('reasoning', '')
            }

        # Step 2 — Test file fix failed, try page object files
        if framework_root:
            print("[HEALER] Test file fix failed — trying page object files...")
            page_object_result = self._heal_page_object(
                framework_root, failed_selector, healing_result
            )
            if page_object_result:
                return page_object_result

        print(f"[HEALER] Could not apply fix to any file")
        return {
            'healed': False,
            'updated_code': failed_code,
            'old_selector': failed_selector,
            'new_selector': healing_result.get('new_selector', ''),
            'confidence': healing_result.get('confidence', 0),
            'reasoning': healing_result.get('reasoning', '')
        }

    def _get_page_html(self, test_id: str, framework_root: str) -> str:
        """Load captured page HTML from failed test."""
        # Sanitise test_id to match what base.fixture.ts saves
        safe_id = re.sub(r'[^a-z0-9]', '_', test_id, flags=re.IGNORECASE)
        html_path = os.path.join(framework_root, 'reports', 'html', f'{safe_id}.html')
        if os.path.exists(html_path):
            with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()[:5000]  # First 5000 chars keeps token cost low
        return ''

    def _heal_page_object(self, framework_root: str,
                          failed_selector: str,
                          healing_result: dict):
        """
        Search page object files for the failed selector and fix there.
        This is the primary fix path — selectors live in page objects, not test files.
        """
        page_object_files = [
            'src/pages/linkedin/SearchPage.ts',
            'src/pages/linkedin/SearchResultsPage.ts',
            'src/pages/linkedin/LoginPage.ts',
            'src/components/SearchBar.ts',
            'src/components/NavigationBar.ts',
            'src/components/ResultCard.ts',
            'src/components/FilterPanel.ts',
        ]

        for relative_path in page_object_files:
            full_path = os.path.join(framework_root, relative_path)
            if not os.path.exists(full_path):
                continue

            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check if this file contains the failed selector
            if failed_selector not in content:
                continue

            new_selector = healing_result.get('new_selector', '')
            if not new_selector:
                continue

            # Try replacing with single quotes first, then double quotes
            updated = content.replace(
                f"'{failed_selector}'", f"'{new_selector}'"
            )
            if updated == content:
                updated = content.replace(
                    f'"{failed_selector}"', f'"{new_selector}"'
                )

            if updated != content:
                # Backup original before modifying
                backup_path = full_path + '.backup'
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"[HEALER] Backup saved: {backup_path}")

                # Write fixed version
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(updated)

                print(f"[HEALER] Fixed selector in: {relative_path} ✅")
                print(f"[HEALER] '{failed_selector}' → '{new_selector}'")

                return {
                    'healed': True,
                    'updated_code': '',  # Page object fixed, not test file
                    'old_selector': failed_selector,
                    'new_selector': new_selector,
                    'confidence': healing_result.get('confidence', 0.8),
                    'reasoning': f"Fixed in {relative_path}",
                    'fixed_file': relative_path
                }

        print(f"[HEALER] Selector '{failed_selector}' not found in any page object file")
        return None

    def _ask_claude_for_replacement(self, failed_selector: str,
                                     error_message: str,
                                     page_html: str,
                                     test_context: str) -> dict:
        """Ask Claude for the best replacement selector."""

        _, system_prompt = get_active_prompt(self.prompts_dir, 'heal_selector')

        html_section = ""
        if page_html:
            html_section = f"\nRELEVANT PAGE HTML:\n{page_html[:3000]}"

        user_message = f"""
A Playwright selector has failed in a TypeScript test.

FAILED SELECTOR: {failed_selector}

ERROR MESSAGE: {error_message}

TEST CONTEXT (surrounding code):
{test_context}
{html_section}

Find the best Playwright TypeScript replacement selector.

Return ONLY this JSON:
{{
    "new_selector": "the selector value only e.g. Search or button",
    "full_locator": "complete Playwright locator e.g. page.getByRole('button', {{name: 'Search'}})",
    "strategy": "getByRole|getByLabel|getByPlaceholder|getByTestId|css",
    "confidence": 0.85,
    "reasoning": "brief explanation"
}}
"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=500,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}]
            )

            response_text = response.content[0].text.strip()

            # Strip markdown fences if present
            if response_text.startswith("```json"):
                response_text = response_text[7:].strip()
            if response_text.startswith("```"):
                response_text = response_text[3:].strip()
            if response_text.endswith("```"):
                response_text = response_text[:-3].strip()

            result = json.loads(response_text)
            return result

        except (json.JSONDecodeError, Exception) as e:
            print(f"[HEALER] Claude response parsing error: {e}")
            return {
                'new_selector': '',
                'full_locator': '',
                'strategy': 'unknown',
                'confidence': 0.0,
                'reasoning': f'Parse error: {str(e)}'
            }

    def _extract_failed_selector(self, error_message: str) -> str:
        """Extract the failed selector string from an error message."""
        patterns = [
            r"locator\(['\"]([^'\"]+)['\"]\)",
            r"getBy\w+\(['\"]([^'\"]+)['\"]\)",
            r"selector ['\"]([^'\"]+)['\"]",
            r"'([^']+)'\s+to be visible",
            r"\"([^\"]+)\"\s+to be visible",
            # Handle comma-separated selectors
            r"locator\('([^']+)'\)",
        ]
        for pattern in patterns:
            match = re.search(pattern, error_message)
            if match:
                return match.group(1)
        return ''

    def _extract_test_context(self, code: str, selector: str) -> str:
        """Extract the lines around the failed selector for context."""
        lines = code.split('\n')
        context_lines = []
        for i, line in enumerate(lines):
            if selector in line:
                start = max(0, i - 3)
                end = min(len(lines), i + 4)
                context_lines = lines[start:end]
                break
        return '\n'.join(context_lines) if context_lines else code[:500]

    def _apply_fix(self, code: str, old_selector: str,
                   new_selector: str, full_locator: str) -> str:
        """Apply the healed selector to the test code."""
        if not new_selector:
            return code

        # Skip if full locator already exists in code
        if full_locator and full_locator in code:
            return code

        # Replace with single quotes first, then double quotes
        updated = code.replace(f"'{old_selector}'", f"'{new_selector}'")
        if updated == code:
            updated = code.replace(f'"{old_selector}"', f'"{new_selector}"')

        return updated