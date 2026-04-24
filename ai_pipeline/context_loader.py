"""
context_loader.py
Loads Playwright TypeScript framework files as context for Claude.
Reads actual framework source files to provide accurate context.
"""

import os
from pathlib import Path


FRAMEWORK_FILES = [
    "src/fixtures/linkedin.fixture.ts",
    "src/fixtures/base.fixture.ts",
    "src/pages/linkedin/SearchPage.ts",
    "src/pages/linkedin/SearchResultsPage.ts",
    "src/pages/base/BasePage.ts",
    "src/components/SearchBar.ts",
    "src/components/ResultCard.ts",
    "src/utils/WaitUtil.ts",
    "src/utils/Logger.ts",
    "src/data/TestDataManager.ts",
    "src/data/linkedin/searchData.ts",
    "src/types/index.ts",
    "tests/linkedin/search/linkedinSearch.spec.ts",  # example test
]


def load_framework_context(framework_root: str) -> str:
    """
    Load all framework files into a single context string.
    Each file is prefixed with its path for Claude to understand structure.
    """
    context_parts = []
    context_parts.append("=== PLAYWRIGHT TYPESCRIPT FRAMEWORK CONTEXT ===\n")
    context_parts.append("Use these exact imports, fixtures, classes, and methods.\n\n")

    for relative_path in FRAMEWORK_FILES:
        full_path = os.path.join(framework_root, relative_path)
        if os.path.exists(full_path):
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            context_parts.append(f"\n// ===== FILE: {relative_path} =====\n")
            context_parts.append(content)
            context_parts.append("\n")
        else:
            print(f"  [WARNING] Context file not found: {full_path}")

    return "".join(context_parts)


def load_prompt(prompt_file: str, prompts_dir: str) -> str:
    """Load a versioned prompt file."""
    prompt_path = os.path.join(prompts_dir, prompt_file)
    if not os.path.exists(prompt_path):
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    with open(prompt_path, 'r', encoding='utf-8') as f:
        return f.read()


def get_active_prompt(prompts_dir: str, prompt_type: str) -> tuple[str, str]:
    """
    Find the active prompt file for a given type.
    Returns (filename, content).
    Picks the latest version by filename sort.
    """
    prompt_files = [
        f for f in os.listdir(prompts_dir)
        if f.startswith(prompt_type) and f.endswith('.txt')
    ]
    if not prompt_files:
        raise FileNotFoundError(f"No prompt files found for type: {prompt_type}")

    # Sort to get latest version
    prompt_files.sort(reverse=True)
    active_file = prompt_files[0]
    content = load_prompt(active_file, prompts_dir)
    print(f"  [PROMPT] Using: {active_file}")
    return active_file, content
