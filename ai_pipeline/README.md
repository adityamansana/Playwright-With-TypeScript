# AI Pipeline — Autonomous Test Generation

Built on top of the Playwright TypeScript Framework.
Powered by Claude (claude-sonnet-4-5).

---

## What This Does

This pipeline autonomously:

1. **Generates** Playwright TypeScript test scripts from JSON scenario definitions using Claude
2. **Validates** generated code — TypeScript compilation + structural checks
3. **Executes** tests via Playwright
4. **Heals** selector failures using Claude — finds semantic replacements automatically
5. **Routes** passing tests to `generated/` and unresolved failures to `review_queue/`

---

## Architecture — 4 Agents

```
Scenario (JSON)
      ↓
Agent 1: Generator (generator.py)
  └── Claude generates .spec.ts using full framework context
      ↓
Agent 2: Validator (validator.py)
  └── TypeScript compile check + structural rules
      ↓
Agent 3: Executor (executor.py)
  └── npx playwright test — runs generated spec
      ↓
   PASS → generated/ folder
   FAIL (selector) ↓
Agent 4: Healer (healer.py)
  └── Claude finds semantic replacement selector
  └── Re-runs test
      ↓
   PASS → generated/ folder
   FAIL → review_queue/ with explanation
```

---

## Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- Playwright framework installed (`npm install` in framework root)
- Anthropic API key

### Install Python dependencies

```bash
cd ai_pipeline
pip install -r requirements.txt
```

### Set API key

```bash
# Mac/Linux
export ANTHROPIC_API_KEY=your-key-here

# Windows CMD
set ANTHROPIC_API_KEY=your-key-here

# Or create .env file
cp ai_pipeline/.env.example ai_pipeline/.env
# Then edit .env and add your key
```

---

## Usage

### Run all scenarios

```bash
cd playwright-ts-framework
python ai_pipeline/main.py
```

### Run single scenario

```bash
python ai_pipeline/main.py --scenario TC-AI-001
```

### Run without executing tests (generate + validate only)

```bash
python ai_pipeline/main.py --no-execute
```

### Dry run (see scenarios without generating)

```bash
python ai_pipeline/main.py --dry-run
```

### Custom scenarios file

```bash
python ai_pipeline/main.py --scenarios path/to/my_scenarios.json
```

---

## Adding Your Own Scenarios

Edit `ai_pipeline/scenarios/linkedin_scenarios.json` or create a new file:

```json
[
  {
    "id": "TC-AI-010",
    "user_story": "As a user I want to...",
    "feature": "My Feature",
    "epic": "My Epic",
    "severity": "critical",
    "description": "Short description of what is tested",
    "preconditions": ["user is logged in"],
    "steps": [
      {"action": "navigate", "target": "feed"},
      {"action": "search", "value": "keyword"},
      {"action": "verify", "target": "results loaded"}
    ],
    "expected_result": "What should happen",
    "test_data_key": "SOFTWARE_ENGINEER",
    "output_file": "tests/linkedin/search/TC_AI_010_my_test.spec.ts"
  }
]
```

---

## Output Locations

| Location | Contents |
|----------|----------|
| `ai_pipeline/generated/` | Tests that passed — ready to review and commit |
| `ai_pipeline/review_queue/` | Tests that need human attention |
| `ai_pipeline/logs/` | Per-scenario JSON logs and pipeline reports |
| `tests/linkedin/search/` | Where validated tests are written during execution |

---

## Prompt Versioning

Prompts live in `ai_pipeline/prompts/` as versioned text files:

```
prompts/
├── generate_test_v1_claude3sonnet.txt   ← active generation prompt
└── heal_selector_v1_claude3sonnet.txt   ← active healing prompt
```

**To update a prompt:**
1. Create a new version file: `generate_test_v2_claude3sonnet.txt`
2. The pipeline automatically picks the latest version (sorted by filename)
3. Old version is kept — rollback by deleting or renaming the new file

**Why this matters:**
When Claude model updates, output quality can change. Versioning lets you:
- Test new prompts before promoting
- Roll back instantly if accuracy drops
- Track which prompt was active during each pipeline run (logged)

---

## Pipeline Status Codes

| Status | Meaning |
|--------|---------|
| `PASSED` | Test generated, validated, executed — all green |
| `HEALED` | Selector failed, Claude healed it, now passing |
| `HUMAN_REVIEW` | Could not auto-resolve — in review_queue/ with explanation |
| `FAILED` | Generation or validation failed completely |

---

## How Self-Healing Works (vs Healenium)

| | Healenium | This Pipeline |
|--|-----------|---------------|
| Works on | Existing Selenium tests | Generated Playwright TS tests |
| Healing level | WebDriver proxy | Source code |
| Baseline | Postgres DB of past locators | Claude reads live page HTML |
| Strategy | LLM-based locator rebuild | Semantic Playwright strategies |
| Environments | Dev/Staging only | Dev/Staging only |
| Transparency | Limited | Full reasoning logged |

---

## Cost Estimate

Claude claude-sonnet-4-5 pricing (approximate):
- Generation per test: ~$0.01-0.03
- Healing per attempt: ~$0.005-0.01
- 10 tests: ~$0.10-0.40

---

## Files Overview

```
ai_pipeline/
├── main.py              ← Entry point — run this
├── pipeline.py          ← Orchestrator tying all agents together
├── generator.py         ← Agent 1: Claude generates .spec.ts
├── validator.py         ← Agent 2: TypeScript + structural checks
├── executor.py          ← Agent 3: Playwright test runner
├── healer.py            ← Agent 4: Claude heals selector failures
├── context_loader.py    ← Loads framework files as Claude context
├── requirements.txt     ← Python dependencies
├── .env.example         ← Environment variable template
├── prompts/
│   ├── generate_test_v1_claude3sonnet.txt
│   └── heal_selector_v1_claude3sonnet.txt
├── scenarios/
│   └── linkedin_scenarios.json
├── generated/           ← Tests that passed pipeline
├── review_queue/        ← Tests needing human review
└── logs/                ← Execution logs and reports
```
