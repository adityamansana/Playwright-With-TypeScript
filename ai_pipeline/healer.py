"""
healer.py — Agent 4: Selector Self-Healer
Uses Claude to analyse failed selectors and suggest replacements.

Supports both:
  - CSS string constants: private readonly INPUT = 'input[...]'
  - Role-based getter methods: private get INPUT(): Locator { return this.page.getByRole(...) }

Healing flow:
  1. Extract failed selector from error message
  2. Load captured page HTML for context
  3. Ask Claude for semantic replacement
  4. Try fix in generated test file (CSS approach)
  5. Try fix in page object files (CSS string or getter method)
  6. Return healed=True if any fix applied
"""

import os
import re
import json
import anthropic
from context_loader import get_active_prompt


class SelectorHealer:

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
            'strict mode violation', 'elementhandle',
            'getbyrole', 'getbyplaceholder', 'getbylabel',
            'getbytext', 'getbytestid'
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

        # Load captured page HTML if not provided
        if not page_html and framework_root:
            test_title = failure.get('title', '')
            page_html = self._get_page_html(test_title, framework_root)
            if page_html:
                print(f"[HEALER] Loaded page HTML ({len(page_html)} chars)")
            else:
                print(f"[HEALER] No page HTML available — Claude will work from error only")

        # Ask Claude for replacement
        healing_result = self._ask_claude_for_replacement(
            failed_selector=failed_selector,
            error_message=failure.get('error', ''),
            page_html=page_html,
            test_context=self._extract_test_context(failed_code, failed_selector)
        )

        confidence = healing_result.get('confidence', 0)
        print(f"[HEALER] Claude suggestion: {healing_result.get('new_selector', 'none')} "
              f"(confidence: {confidence:.0%}, strategy: {healing_result.get('strategy', 'unknown')})")

        if confidence < 0.6:
            print(f"[HEALER] Confidence too low ({confidence:.0%}) — not applying")
            return {
                'healed': False,
                'updated_code': failed_code,
                'old_selector': failed_selector,
                'new_selector': healing_result.get('new_selector', ''),
                'confidence': confidence,
                'reasoning': healing_result.get('reasoning', '')
            }

        # Step 1 — Try fix in generated test file (CSS approach)
        updated_code = self._apply_fix(
            failed_code,
            failed_selector,
            healing_result.get('new_selector', ''),
            healing_result.get('full_locator', '')
        )
        if updated_code != failed_code:
            print(f"[HEALER] Fixed in test file ✅")
            return {
                'healed': True,
                'updated_code': updated_code,
                'old_selector': failed_selector,
                'new_selector': healing_result.get('new_selector', ''),
                'confidence': confidence,
                'reasoning': healing_result.get('reasoning', '')
            }

        # Step 2 — Try fix in page object files
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
            'confidence': confidence,
            'reasoning': healing_result.get('reasoning', '')
        }

    # ─────────────────────────────────────────────────────────────────────────
    # PAGE OBJECT HEALING
    # ─────────────────────────────────────────────────────────────────────────

    def _heal_page_object(self, framework_root: str,
                          failed_selector: str,
                          healing_result: dict):
        """
        Search page object and component files for the failing selector.
        Handles both CSS string constants and role-based getter methods.
        """
        page_object_files = [
            'src/components/SearchBar.ts',
            'src/pages/linkedin/SearchPage.ts',
            'src/pages/linkedin/SearchResultsPage.ts',
            'src/pages/linkedin/LoginPage.ts',
            'src/components/NavigationBar.ts',
            'src/components/ResultCard.ts',
            'src/components/FilterPanel.ts',
        ]

        new_selector = healing_result.get('new_selector', '')
        new_strategy = healing_result.get('strategy', 'css')
        full_locator = healing_result.get('full_locator', '')

        for relative_path in page_object_files:
            full_path = os.path.join(framework_root, relative_path)
            if not os.path.exists(full_path):
                continue

            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Approach A — CSS string constant
            if failed_selector in content:
                updated = self._replace_css_selector(
                    content, failed_selector, new_selector
                )
                if updated != content:
                    self._write_with_backup(full_path, content, updated)
                    print(f"[HEALER] Fixed CSS selector in: {relative_path} ✅")
                    return self._build_result(
                        True, failed_selector, new_selector,
                        healing_result, relative_path
                    )

            # Approach B — Role-based getter method
            has_getter = bool(re.search(r'private get \w+\(\): Locator', content))
            has_role_call = any(m in content for m in [
                'getByRole', 'getByPlaceholder', 'getByLabel',
                'getByText', 'getByTestId'
            ])

            if has_getter and has_role_call:
                updated = self._replace_role_selector(
                    content, failed_selector,
                    full_locator, new_selector, new_strategy
                )
                if updated != content:
                    self._write_with_backup(full_path, content, updated)
                    print(f"[HEALER] Fixed role selector in: {relative_path} ✅")
                    return self._build_result(
                        True, failed_selector, new_selector,
                        healing_result, relative_path
                    )

        print(f"[HEALER] Selector not found in any page object file")
        return None

    def _replace_css_selector(self, content: str,
                               old_sel: str, new_sel: str) -> str:
        """Replace CSS string constant."""
        updated = content.replace(f"'{old_sel}'", f"'{new_sel}'")
        if updated == content:
            updated = content.replace(f'"{old_sel}"', f'"{new_sel}"')
        return updated

    def _replace_role_selector(self, content: str, failed_selector: str,
                                full_locator: str, new_selector: str,
                                new_strategy: str) -> str:
        """
        Replace a failing role-based call inside a getter method.
        Adds the new locator as the first option in the .or() chain.

        Before:
          private get INPUT(): Locator {
            return this.page.getByRole('combobox', { name: /search/i })
              .or(this.page.getByPlaceholder('Search'))
          }

        After:
          private get INPUT(): Locator {
            return this.page.getByRole('textbox', { name: /search/i })
              .or(this.page.getByRole('combobox', { name: /search/i }))
              .or(this.page.getByPlaceholder('Search'))
          }
        """
        # Find all getter methods in the file
        getter_pattern = r'(private get \w+\(\): Locator \{.*?\})'
        getters = re.findall(getter_pattern, content, re.DOTALL)

        for getter in getters:
            # Check if this getter contains the failing selector
            selector_present = (
                failed_selector in getter or
                any(call in getter for call in [
                    'getByRole', 'getByPlaceholder',
                    'getByLabel', 'getByText'
                ])
            )

            if not selector_present:
                continue

            # Build the new locator call
            new_locator_call = self._build_locator_call(
                new_selector, new_strategy, full_locator
            )

            if not new_locator_call:
                continue

            # Find the return statement and prepend new locator
            updated_getter = re.sub(
                r'(return\s+)(this\.page\.)',
                f'return {new_locator_call}\n      .or(this.page.',
                getter,
                count=1
            )

            if updated_getter != getter:
                print(f"[HEALER] Prepending '{new_locator_call}' to getter")
                return content.replace(getter, updated_getter)

        return content

    def _build_locator_call(self, new_selector: str,
                             strategy: str, full_locator: str) -> str:
        """Build a this.page.getBy*() call string."""
        # Use full_locator from Claude if provided and valid
        if full_locator and 'this.page.' in full_locator:
            return full_locator.strip().rstrip(';')

        # Build from strategy + selector
        strategy_map = {
            'getByRole':        f"this.page.getByRole('{new_selector}')",
            'getByPlaceholder': f"this.page.getByPlaceholder('{new_selector}')",
            'getByLabel':       f"this.page.getByLabel('{new_selector}')",
            'getByText':        f"this.page.getByText('{new_selector}')",
            'getByTestId':      f"this.page.getByTestId('{new_selector}')",
            'css':              f"this.page.locator('{new_selector}')",
        }

        return strategy_map.get(strategy, f"this.page.locator('{new_selector}')")

    # ─────────────────────────────────────────────────────────────────────────
    # CLAUDE API
    # ─────────────────────────────────────────────────────────────────────────

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
    "new_selector": "the selector value e.g. textbox or Search LinkedIn",
    "full_locator": "this.page.getByRole('textbox', {{ name: /search/i }})",
    "strategy": "getByRole|getByLabel|getByPlaceholder|getByTestId|css",
    "confidence": 0.85,
    "reasoning": "brief explanation of why this selector will work"
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

    # ─────────────────────────────────────────────────────────────────────────
    # UTILITIES
    # ─────────────────────────────────────────────────────────────────────────

    def _get_page_html(self, test_title: str, framework_root: str) -> str:
        """Load captured page HTML from failed test."""
        # Try sanitised test title as filename
        safe_id = re.sub(r'[^a-z0-9]', '_', test_title, flags=re.IGNORECASE)
        html_dir = os.path.join(framework_root, 'reports', 'html')

        if not os.path.exists(html_dir):
            return ''

        # Try exact match first
        exact_path = os.path.join(html_dir, f'{safe_id}.html')
        if os.path.exists(exact_path):
            with open(exact_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()[:5000]

        # Try finding most recent HTML file
        html_files = [
            f for f in os.listdir(html_dir)
            if f.endswith('.html')
        ]
        if html_files:
            # Sort by modification time — get most recent
            html_files.sort(
                key=lambda f: os.path.getmtime(os.path.join(html_dir, f)),
                reverse=True
            )
            latest = os.path.join(html_dir, html_files[0])
            print(f"[HEALER] Using most recent HTML: {html_files[0]}")
            with open(latest, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()[:5000]

        return ''

    def _extract_failed_selector(self, error_message: str) -> str:
        """
        Extract failed selector from error message.
        Handles both CSS locator strings and role-based calls.
        """
        patterns = [
            # Role-based patterns — getByRole('combobox')
            r"getByRole\((['\"][^'\"]+['\"](?:,\s*\{[^}]*\})?)\)",
            r"getByPlaceholder\((['\"][^'\"]+['\"])\)",
            r"getByLabel\((['\"][^'\"]+['\"])\)",
            r"getByText\((['\"][^'\"]+['\"])\)",
            # CSS locator patterns
            r"locator\(['\"]([^'\"]+)['\"]\)",
            r"waiting for locator\('([^']+)'\)",
            r"waiting for locator\(\"([^\"]+)\"\)",
            # Simple string patterns
            r"'([^']+)'\s+to be visible",
            r"\"([^\"]+)\"\s+to be visible",
        ]

        for pattern in patterns:
            match = re.search(pattern, error_message)
            if match:
                result = match.group(1).strip()
                # Clean up quotes from role patterns
                result = result.strip("'\"")
                return result

        return ''

    def _extract_test_context(self, code: str, selector: str) -> str:
        """Extract lines around the failed selector for context."""
        if not selector or not code:
            return code[:500] if code else ''

        lines = code.split('\n')
        for i, line in enumerate(lines):
            if selector in line:
                start = max(0, i - 3)
                end = min(len(lines), i + 4)
                return '\n'.join(lines[start:end])

        return code[:500]

    def _apply_fix(self, code: str, old_selector: str,
                   new_selector: str, full_locator: str) -> str:
        """Apply healed selector to test file code."""
        if not new_selector:
            return code

        # Skip if full locator already present
        if full_locator and full_locator in code:
            return code

        # Try single quotes then double quotes
        updated = code.replace(f"'{old_selector}'", f"'{new_selector}'")
        if updated == code:
            updated = code.replace(f'"{old_selector}"', f'"{new_selector}"')

        return updated

    def _write_with_backup(self, full_path: str,
                            original: str, updated: str):
        """Write updated file with backup of original."""
        backup_path = full_path + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(original)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(updated)
        print(f"[HEALER] Backup saved: {os.path.basename(backup_path)}")

    def _build_result(self, healed: bool, old_sel: str,
                       new_sel: str, healing_result: dict,
                       fixed_file: str) -> dict:
        """Build standardised result dict."""
        return {
            'healed': healed,
            'updated_code': '',
            'old_selector': old_sel,
            'new_selector': new_sel,
            'confidence': healing_result.get('confidence', 0.8),
            'reasoning': healing_result.get('reasoning', f"Fixed in {fixed_file}"),
            'fixed_file': fixed_file
        }