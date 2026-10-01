---
name: dev-its-workflow
description: >-
  Portable, config-driven developer workflow pipeline (v1.0) that carries one ticket
  from pick-up to deployment through ten stages — Pre-flight → Estimate → Ticket →
  Dependency Check → Spec → Plan → Develop → Test → Test-review → PR → Deploy →
  Document — pausing for human approval at the spec, plan, and PR gates. Works on ANY
  repo (GitHub or Azure DevOps, auto-detected). Team-specific config (reviewers, org,
  conventions) is read from .dev-its/config.json — a first-run wizard creates it if
  missing. Includes: pre-flight auth/env checks, complexity estimation, dependency
  conflict detection, architecture review, checkpoint persistence, retry limits (max 3
  per stage), diminishing-returns detection on test loops, parallel test execution,
  fast-track mode for bug fixes, rollback planning, auto-documentation, and a
  standalone git-flow + spec-test-suite built in (no external skill dependencies).
  Triggers: "dev-its-workflow", "run dev-its", "work this ticket", "pick up ticket
  #<n>", "start the pipeline".
---

# Dev-ITS Workflow (v1.0)

**A portable, self-contained developer workflow for any team.**

One ticket, carried from pick-up to deployment through ten stages, with a human
in the loop at three gates. The **spec is the source of truth**: every later stage
(plan, code, tests, review) traces back to the spec. You (the orchestrator) do the
cheap glue — routing, gating, reporting — and fan the real work out to the agents.

This skill is **standalone** — it includes its own git-flow and spec-test-suite logic.
No external skill dependencies required. All team-specific configuration lives in
`.dev-its/config.json` at the repo root.

---

## First-Run Setup (Config Wizard)

On first invocation, check for `.dev-its/config.json` in the repo root. If missing,
run the setup wizard:

### Step 1: Detect the basics automatically
```bash
# Detect backend from git remote
git remote -v

# Detect gh/az CLI
which gh 2>/dev/null || where gh 2>/dev/null
which az 2>/dev/null || where az 2>/dev/null

# Detect base branch
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo "main"
```

### Step 2: Ask the user (via AskUserQuestion) for what can't be auto-detected:
1. **Reviewers** — "Who should review PRs? (comma-separated names or usernames)"
2. **Branch naming** — "What branch prefix do you use?" (default: `feature/`)
3. **Commit style** — "Conventional commits?" (default: yes)
4. **PR template** — "Use the built-in PR template, or point to your own?"

### Step 3: Write `.dev-its/config.json`

```json
{
  "$schema": "./config.schema.json",
  "version": "1.0",
  "team": {
    "name": "My Team",
    "reviewers": [
      { "name": "Alice Smith", "github": "alice-gh", "azure": "Alice Smith" },
      { "name": "Bob Jones", "github": "bob-j", "azure": "Bob Jones" }
    ]
  },
  "repo": {
    "backend": "github",
    "org": "my-org",
    "name": "my-repo",
    "base_branch": "main",
    "branch_prefix": "feature/",
    "commit_style": "conventional"
  },
  "tools": {
    "gh_path": "gh",
    "az_path": "az"
  },
  "workflow": {
    "gates": ["spec", "plan", "pr"],
    "fast_track_enabled": true,
    "max_retries_per_stage": 3,
    "max_test_review_loops": 5,
    "parallel_tests": true,
    "auto_document": true
  },
  "pr_template": "built-in"
}
```

### Step 4: Confirm and offer to `.gitignore` the progress file
Add `.dev-its/progress.json` to `.gitignore` (the config itself SHOULD be committed
so the team shares it).

---

## Inputs
Ask for / infer at the start:
- **Ticket** — an issue / work-item id or URL (e.g. `#123`, `AB#58323`), or a pasted body.
- **Repo** — the working tree. Read config from `.dev-its/config.json`. If config missing → wizard.
- **Mode** — default is **hard-pause** at every gate. Only skip a gate if the user
  explicitly says so for this run.

## Backend Routing (auto-detected)

Run `git remote -v` and route based on the origin host:

| Origin contains | Backend | Ticket source |
|---|---|---|
| `github.com` | **GitHub** (`gh`) | `gh issue view <n>` |
| `dev.azure.com` or `visualstudio.com` | **Azure DevOps** (`az`) | `az boards work-item show --id <n>` |

The config file stores the detected backend, org, repo name, and tool paths.
All commands use the paths from config — no hard-coded locations.

---

## Fast-Track Mode

For **Low-complexity bug fixes**, the full pipeline is overkill. Fast-track
reduces overhead while keeping safety gates.

### Eligibility (ALL must be true):
- Complexity estimator returns **LOW** (score 7-10)
- Ticket is labelled/typed as **bug fix** (not feature, not refactor)
- Files to change: **3 or fewer**
- No database migrations required
- No new public endpoints/APIs
- `workflow.fast_track_enabled` is `true` in config

### Fast-Track Path:
```
Stage 0    Pre-flight       (same)
Stage 0.5  Estimate         (determines eligibility)
Stage 1    Ticket           (same)
Stage 1.5  Dependency Check (same)
Stage 2    Spec       ⛔A   (lightweight bug-spec)
-- SKIP Gate B --
-- SKIP Stage 3.5 --
Stage 4    Develop          (write fix; fail on attempt 1 → escalate to full)
Stage 5    Test             (single pass, no adversarial loop)
-- SKIP Stage 6 --
Stage 7    PR         ⛔C   (same)
Stage 8    Deploy           (same)
-- SKIP Stage 9 --
```

### Rules:
- Gate A (Spec) is ALWAYS required
- Gate C (PR) is ALWAYS required
- Tests fail on first attempt → escalate to full pipeline
- User can override: "run full pipeline" even if fast-track eligible

---

## Retry Policy

**Every stage has a maximum of `workflow.max_retries_per_stage` attempts** (default 3).
After limit reached:
1. STOP
2. Write failure to `.dev-its/progress.json`
3. Present: what failed, error output, suggested alternative
4. Wait for user guidance (new approach resets counter, skip, or abort)

---

## Diminishing-Returns Detection (Test↔Review Loop)

The test↔review loop (Stages 5↔6) has a **budget of `workflow.max_test_review_loops`
iterations** (default 5), but stops early if progress stalls.

### Severity Scoring:
- HIGH = 2 points, MEDIUM = 1 point, LOW = 0 points

### Rules:
1. After each loop, calculate total severity score
2. Score decreased → continue
3. Score same or increased → STALLED → stop immediately
4. Exception: score decreased but NEW high appeared → one more loop
5. On early stop, report remaining gaps with options

---

## Parallel Test Execution

Stage 5 dispatches test agents using parallel execution (when `workflow.parallel_tests`
is `true` in config):

```
  [Unit Tests] ∥ [Integration Tests]    ← run simultaneously
              ↓
        Results merge (both must pass)
              ↓
      [E2E Tests] (only if spec requires it)
```

Rules:
- Unit + Integration run simultaneously (independent)
- E2E runs AFTER both pass
- On retry: only re-run FAILED agent(s)

---

## Checkpoint Persistence

After every stage completion, write to `.dev-its/progress.json`:

```json
{
  "workflow": "dev-its-workflow",
  "version": "1.0",
  "ticket": "#123",
  "repo": "/path/to/repo",
  "backend": "github",
  "mode": "full",
  "fast_track": false,
  "started_at": "2026-07-14T10:00:00Z",
  "last_updated": "2026-07-14T10:45:00Z",
  "current_stage": "5_test",
  "stages": { },
  "retry_counts": { },
  "diminishing_returns": { "loop_scores": [], "stopped_early": false }
}
```

### Resume protocol:
- File exists + matches ticket → offer to resume from last completed stage
- File exists for different ticket → ask if previous run should be abandoned
- File missing → start fresh

---

## The Three Gates (hard-pause)

At each gate the workflow **stops** and waits for explicit human approval:
- **Gate A — Spec** (after stage 2): the spec and open questions
- **Gate B — Plan** (after stage 3): implementation plan + rollback *(skipped in fast-track)*
- **Gate C — PR** (at stage 7): the opened PR, before merge/deploy

Gates can be individually disabled in config (`workflow.gates` array) — but this is
discouraged for production use.

---

## Stages

### Stage 0: Pre-flight Checks

Verify all tools, auth, and environment BEFORE investing time.

**Read config** — load `.dev-its/config.json`. If missing → run wizard first.

**Authentication (based on detected backend):**
```bash
# GitHub
<gh_path> auth status
<gh_path> repo view <org>/<repo> --json name

# Azure DevOps
az account show
az devops project list --org <org_url>
```

**Environment:**
```bash
# Git
git status
git remote -v

# Build tools (auto-detect from project files)
# package.json → node --version && npm --version
# *.csproj → dotnet --version
# pyproject.toml → python --version
# go.mod → go version
# Cargo.toml → cargo --version

# Docker (if docker-compose.yml exists)
docker info > /dev/null 2>&1
```

**Decision:** ALL auth must pass → proceed. ANY fails → STOP with fix suggestion.

---

### Stage 0.5: Complexity Estimator

Dispatch **`complexity-estimator-agent`** with the ticket and repo.

| Factor | Low (1) | Medium (2) | High (3) |
|--------|---------|------------|----------|
| Files to change | 1-3 | 4-10 | 11+ |
| New endpoints/pages | 0 | 1-2 | 3+ |
| Database changes | None | Alter existing | New tables |
| Cross-cutting | Single module | 2 modules | Multi-service |
| Test complexity | Unit only | Unit + Integration | Unit + Int + E2E |
| External dependencies | None | Uses existing | New 3rd-party |
| Ambiguity | Clear | Some interpretation | Vague |

**Scoring:** 7-10 LOW, 11-15 MEDIUM, 16-21 HIGH

Report: complexity, estimated agents, friction stages, fast-track eligibility.

---

### Stage 1: Ticket Pick-Up

- Fetch ticket via detected backend CLI
- Post a "picking this up" comment on the ticket
- Summarise and confirm with user

---

### Stage 1.5: Dependency Check

Dispatch **`dependency-check-agent`** to scan for conflicts:
1. Open PRs touching same files
2. Active branches with recent commits in same area
3. Related open tickets targeting same component
4. Base branch freshness

**Decision:** No conflicts → proceed. Warnings → report but proceed. Hard conflicts → STOP.

---

### Stage 2: Spec ⛔ Gate A

- Dispatch **`spec-agent`** with ticket, backend, and repo
- It writes `docs/SDD/<ticket-slug>.spec.md`
- **Fast-track mode:** lightweight bug-spec (Root Cause, Fix, Criteria, Regression Test)
- **PAUSE.** Present spec + open questions. Wait for approval (max 3 revisions).

---

### Stage 3: Plan ⛔ Gate B
*(Skipped in fast-track mode)*

- Produce implementation plan (files, order, migrations, test plan, risks)
- **Include Rollback Plan** (branch to revert, migrations to undo, commands)
- **PAUSE.** Present plan + rollback. Wait for approval (max 3 revisions).

---

### Stage 3.5: Architecture Review
*(Skipped in fast-track mode)*

Dispatch **`architecture-review-agent`** to check the plan against existing code:
- Pattern conformance
- Reuse opportunities
- Layering & separation
- Naming conventions
- Potential conflicts
- Migration safety

High-severity findings → amend plan. Low/medium → report but proceed.

---

### Stage 4: Develop

- Implement against approved spec and plan
- Follow repo conventions (detected from existing code)
- Max retries per config (`workflow.max_retries_per_stage`)
- Fast-track: fail on attempt 1 → escalate to full pipeline

---

### Stage 5: Test (Spec-Test-Suite)

This stage contains the **built-in spec-test-suite** logic:

#### 5.1 Locate the spec
Glob for `**/*.spec.md`, preferring `docs/SDD/`, then `docs/`, then root.

#### 5.2 Extract the test contract
From the spec: Acceptance Criteria, Testing Strategy, API Design, Data Model,
Risks & Mitigations. (See `references/spec-mapping.md` for full mapping.)

#### 5.3 Detect stack and runners
Inspect project files to determine: language, test framework, existing test patterns.

#### 5.4 Dispatch test agents
**Parallel execution** (when enabled in config):
- **`unit-test-agent`** + **`integration-test-agent`** run simultaneously
- **`e2e-test-agent`** runs after both pass (only if spec requires it)

**Fast-track:** single pass, no adversarial loop after.

#### 5.5 Report
Coverage table (criterion → test), pass/fail results, exact commands to reproduce.

---

### Stage 6: Test-Review (Adversarial)
*(Skipped in fast-track mode)*

- Dispatch **`adversarial-review-agent`** on spec + tests
- Optionally dispatch **`adversarial-code-reviewer`** on spec + implementation
- Act on high-severity findings → loop back to Stage 5
- **Diminishing-returns detection** applies (see above)
- Report residual gaps the user accepts

---

### Stage 7: PR ⛔ Gate C (Built-in Git-Flow)

This stage contains the **built-in git-flow** logic:

#### 7.1 Pre-ship gate
Re-run spec-test-suite (Stage 5 logic) as verification. Must pass before PR.

#### 7.2 Create branch
```bash
git fetch origin
git checkout -b <branch_prefix><topic> origin/<base_branch>
```

Branch prefix from config (default `feature/`).

#### 7.3 Stage and commit
Generate commit message from diff. Style from config (`conventional` or `freeform`).
Always end with `Co-Authored-By: Claude <noreply@anthropic.com>`.

#### 7.4 Push
```bash
git push -u origin <branch>
```

#### 7.5 Open PR
**GitHub:**
```bash
<gh_path> pr create --base <base_branch> --head <branch> \
  --title "<title>" --body "<filled template>"
```

**Azure DevOps:**
```bash
az repos pr create \
  --org "<org_url>" --project "<project>" --repository "<repo>" \
  --source-branch "<branch>" --target-branch "<base_branch>" \
  --title "<title>" --description @<template_file> \
  --work-items <id>
```

#### 7.6 Add reviewers (from config)
**GitHub:** Loop through `team.reviewers[].github` using the REST endpoint.
**Azure:** Pass `team.reviewers[].azure` names to `--reviewers`.

Never add the PR author as a reviewer.

#### 7.7 PAUSE
Present PR number + URL + confirmed reviewers. Wait for user approval.

---

### Stage 8: Deploy (Confirm & Report)

- Detect merge and report deploy status
- Close the loop on the ticket (comment/move state)
- Final summary: ticket → spec → PR → deploy

---

### Stage 9: Documentation
*(Skipped in fast-track mode unless public API changed)*

Dispatch **`documentation-agent`** with spec, files changed, test results, PR description.
Updates: README, API docs, architecture docs, changelog. Non-blocking.

---

## Final Report

When pipeline completes or pauses:
- Full chain: Ticket → Complexity → Dependencies → Spec → Plan → Arch Review →
  Tests (parallel timing) → Adversarial findings → PR → Deploy → Docs
- Mode: [FULL PIPELINE] or [FAST-TRACK]
- Retry counts, diminishing-returns status
- Current gate + what's needed from user to proceed

## Principles
- **Gates are hard.** Never advance without approval.
- **Retry limits are hard.** Escalate to human after limit.
- **Diminishing returns respected.** Stop stalled loops early.
- **Parallelism where safe.** Unit + Integration simultaneously.
- **Fast-track is earned.** Only LOW bug fixes qualify.
- **Dependencies checked early.** Before spec investment.
- **Checkpoints mandatory.** `.dev-its/progress.json` after every stage.
- **Trace to spec.** Every test and code line anchors to the spec.
- **Config-driven.** No hard-coded repos, paths, or reviewers.
- **Auto-detect what you can.** Ask only for what you can't infer.
- **Both backends.** GitHub and Azure DevOps, detected per repo.
- **Report honestly.** Include failures, skips, and retry counts.

---

## Quick-Reference Stage Map

### Full Pipeline:
```
Stage 0    Pre-flight         Auth + env + config check
Stage 0.5  Estimate           Complexity sizing + fast-track check
Stage 1    Ticket             Pick up + confirm
Stage 1.5  Dependency Check   Detect conflicts with in-flight work
Stage 2    Spec         ⛔A   spec-agent writes spec → HUMAN APPROVAL
Stage 3    Plan         ⛔B   Plan + Rollback → HUMAN APPROVAL
Stage 3.5  Arch Review        Check plan against existing patterns
Stage 4    Develop            Write code (max 3 retries)
Stage 5    Test               Unit ∥ Integration → E2E (parallel)
Stage 6    Test-Review        Adversarial gaps (max 5 loops, diminishing-returns)
Stage 7    PR           ⛔C   Branch → Push → PR → Reviewers → HUMAN APPROVAL
Stage 8    Deploy             Confirm merge + report
Stage 9    Document           Update docs (non-blocking)
```

### Fast-Track (bug fixes only):
```
Stage 0    Pre-flight
Stage 0.5  Estimate           Confirms LOW + bug fix → fast-track
Stage 1    Ticket
Stage 1.5  Dependency Check
Stage 2    Spec         ⛔A   Lightweight bug-spec → HUMAN APPROVAL
Stage 4    Develop            (fail attempt 1 → escalate)
Stage 5    Test               Single pass, no adversarial
Stage 7    PR           ⛔C   → HUMAN APPROVAL
Stage 8    Deploy
```
