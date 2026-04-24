"""
generator.py — Agent 1: Test Script Generator
Uses Claude API to generate Playwright TypeScript test scripts
from scenario definitions and framework context.
"""

import os
import json
import anthropic
from pathlib import Path
from context_loader import load_framework_context, get_active_prompt


class TestGenerator:
    """
    Agent 1 — Generates Playwright TypeScript test scripts using Claude.
    Uses full framework context so generated tests match existing patterns exactly.
    """

    def __init__(self, framework_root: str, prompts_dir: str):
        self.framework_root = framework_root
        self.prompts_dir = prompts_dir
        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        # Load framework context once — reuse across generations
        print("[GENERATOR] Loading framework context...")
        self.framework_context = load_framework_context(framework_root)
        print(f"[GENERATOR] Context loaded: {len(self.framework_context)} chars")

    def generate(self, scenario: dict) -> str:
        """
        Generate a complete .spec.ts file for the given scenario.
        Returns the generated TypeScript code as a string.
        """
        print(f"\n[GENERATOR] Generating test for: {scenario['id']} — {scenario['description']}")

        # Load active prompt version
        prompt_file, system_prompt = get_active_prompt(self.prompts_dir, 'generate_test')

        # Build full system prompt with framework context
        full_system = f"{system_prompt}\n\n{self.framework_context}"

        # Build user message from scenario
        user_message = self._build_user_message(scenario)

        # Call Claude API
        response = self.client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4000,
            system=full_system,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )

        generated_code = response.content[0].text.strip()

        # Strip markdown code fences if Claude added them
        if generated_code.startswith("```typescript"):
            generated_code = generated_code[len("```typescript"):].strip()
        if generated_code.startswith("```"):
            generated_code = generated_code[3:].strip()
        if generated_code.endswith("```"):
            generated_code = generated_code[:-3].strip()

        print(f"[GENERATOR] Generated {len(generated_code)} chars for {scenario['id']}")
        return generated_code

    def generate_with_retry(self, scenario: dict, error_feedback: str = None) -> str:
        """
        Generate with optional error feedback for self-correction.
        Used when first generation fails validation.
        """
        print(f"\n[GENERATOR] Re-generating with error feedback for: {scenario['id']}")

        _, system_prompt = get_active_prompt(self.prompts_dir, 'generate_test')
        full_system = f"{system_prompt}\n\n{self.framework_context}"

        user_message = self._build_user_message(scenario)

        if error_feedback:
            user_message += f"""

PREVIOUS GENERATION FAILED WITH THESE ERRORS:
{error_feedback}

Fix all errors and regenerate the complete corrected TypeScript file.
"""

        response = self.client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4000,
            system=full_system,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )

        generated_code = response.content[0].text.strip()

        # Strip markdown code fences
        if generated_code.startswith("```typescript"):
            generated_code = generated_code[len("```typescript"):].strip()
        if generated_code.startswith("```"):
            generated_code = generated_code[3:].strip()
        if generated_code.endswith("```"):
            generated_code = generated_code[:-3].strip()

        return generated_code

    def _build_user_message(self, scenario: dict) -> str:
        """Build the user message from scenario definition."""
        steps_formatted = "\n".join([
            f"  {i+1}. {step['action'].title()}: {step.get('value', step.get('target', ''))}"
            for i, step in enumerate(scenario['steps'])
        ])

        return f"""Generate a complete Playwright TypeScript test file for this scenario.

TEST SCENARIO:
- Test ID: {scenario['id']}
- User Story: {scenario['user_story']}
- Feature: {scenario['feature']}
- Epic: {scenario['epic']}
- Severity: {scenario['severity']}
- Description: {scenario['description']}

PRECONDITIONS:
{chr(10).join(['- ' + p for p in scenario['preconditions']])}

TEST STEPS:
{steps_formatted}

EXPECTED RESULT:
{scenario['expected_result']}

TEST DATA KEY: Use TestDataManager.getSearchKeyword('{scenario.get('test_data_key', 'SOFTWARE_ENGINEER')}')

OUTPUT FILE PATH: {scenario['output_file']}

Generate the complete .spec.ts file. Follow ALL rules from the system prompt exactly.
Import path must be relative to the output file location shown above.
"""
