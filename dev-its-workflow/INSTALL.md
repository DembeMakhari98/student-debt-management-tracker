# Dev-ITS Workflow — Installation Guide

A portable, config-driven developer workflow for Claude Code that carries a ticket
from pick-up to deployment through 10 stages with 3 human gates.

## Prerequisites

- **Claude Code** installed and working (CLI, desktop app, or IDE extension)
- **Git** configured with access to your repo
- **One of:**
  - GitHub CLI (`gh`) — for GitHub repos
  - Azure CLI (`az`) with `azure-devops` extension — for Azure DevOps repos

## Installation (2 minutes)

### Step 1: Copy the skill folder

Copy the entire `dev-its-workflow/` folder into your Claude Code skills directory:

```
~/.claude/skills/dev-its-workflow/
```

On Windows:
```
C:\Users\<you>\.claude\skills\dev-its-workflow\
```

The folder structure should look like:
```
.claude/skills/dev-its-workflow/
  SKILL.md                          ← Main orchestration logic
  INSTALL.md                        ← This file
  config.schema.json                ← JSON schema for config validation
  agents/
    spec-agent.md                   ← Writes specifications from tickets
    complexity-estimator-agent.md   ← Sizes tickets before starting
    dependency-check-agent.md       ← Detects conflicts with in-flight work
    architecture-review-agent.md    ← Reviews plan against codebase patterns
    unit-test-agent.md              ← Generates unit tests from spec
    integration-test-agent.md       ← Generates integration tests from spec
    e2e-test-agent.md               ← Generates e2e tests (when applicable)
    adversarial-review-agent.md     ← Hunts test coverage gaps
    adversarial-code-reviewer.md    ← Attacks implementation against spec
    documentation-agent.md          ← Updates docs after deploy
  references/
    spec-mapping.md                 ← How spec sections map to test types
  scripts/
    find-spec.sh                    ← Helper to locate spec files
    setup-wizard.sh                 ← Auto-detects repo environment
  templates/
    PULL_REQUEST_TEMPLATE.github.md ← PR template for GitHub repos
    PULL_REQUEST_TEMPLATE.azure.md  ← PR template for Azure DevOps repos
    config.example.json             ← Example configuration file
```

### Step 2: First run — the config wizard

Navigate to your repo and invoke the workflow:

```
> dev-its-workflow
```

or:

```
> work this ticket #123
```

On first run, it will detect that `.dev-its/config.json` is missing and start the
setup wizard. It will:

1. **Auto-detect** your backend (GitHub/Azure), org, repo name, base branch, and tools
2. **Ask you** for: team reviewers, branch naming convention, commit style
3. **Write** `.dev-its/config.json` in your repo root
4. **Add** `.dev-its/progress.json` to your `.gitignore`

### Step 3: Commit the config (share with your team)

```bash
git add .dev-its/config.json
git commit -m "chore: add dev-its-workflow config for the team"
git push
```

Now anyone on the team with the skill installed will use the same config.

---

## Configuration

The config lives at `.dev-its/config.json` in your repo root. See
`templates/config.example.json` for a full example.

### Key settings:

| Setting | What it controls |
|---------|-----------------|
| `team.reviewers` | Who gets added to PRs (name + platform username) |
| `repo.backend` | `github` or `azure-devops` (auto-detected) |
| `repo.base_branch` | Target branch for PRs (default: `main`) |
| `repo.branch_prefix` | Prefix for new branches (default: `feature/`) |
| `repo.commit_style` | `conventional` or `freeform` |
| `tools.gh_path` | Path to GitHub CLI (default: `gh`) |
| `workflow.gates` | Which gates require human approval |
| `workflow.fast_track_enabled` | Allow fast-track for simple bug fixes |
| `workflow.parallel_tests` | Run unit + integration tests simultaneously |
| `pr_template` | `built-in` or path to your own template |

### Using a custom PR template:

Set `"pr_template": ".github/PULL_REQUEST_TEMPLATE.md"` to use your repo's own template
instead of the built-in one.

---

## Usage

### Start the full pipeline:
```
> dev-its-workflow
> run dev-its
> work this ticket #123
> pick up ticket #45
> start the pipeline
```

### The workflow will:
1. Verify your environment (auth, tools, dependencies)
2. Estimate complexity and suggest fast-track if eligible
3. Pick up the ticket and comment that it's claimed
4. Check for conflicts with in-flight work
5. Write a spec → **pause for your approval** (Gate A)
6. Write a plan + rollback → **pause for your approval** (Gate B)
7. Review the plan against existing architecture
8. Write the code
9. Run tests (unit + integration in parallel, then e2e)
10. Adversarial review of test coverage (loops until good or stalls)
11. Open a PR with reviewers → **pause for your approval** (Gate C)
12. Confirm deployment after merge
13. Update documentation

### Resume after interruption:
The workflow saves progress to `.dev-its/progress.json` after every stage.
If your session restarts, just invoke the workflow again — it will offer to resume.

---

## Troubleshooting

### "gh: command not found"
Set the full path in config: `"gh_path": "/c/Program Files/GitHub CLI/gh.exe"` (Windows)
or install: `brew install gh` (macOS) / `sudo apt install gh` (Linux).

### "az: command not found"
Install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
Then: `az extension add --name azure-devops` and `az login`.

### Config wizard doesn't detect my backend
Ensure `git remote -v` shows your origin. If it's a fresh clone without a remote,
add one first: `git remote add origin <url>`.

### Tests fail but shouldn't
The workflow retries up to 3 times per stage. If tests keep failing, it stops and
asks you what to do. Check if your test dependencies (DB, Docker, etc.) are running.

### Want to skip a gate for this run?
Tell it: "skip the plan gate" or "proceed without plan approval". This is per-run
only — it doesn't change the config.

---

## Updating

To update the skill, replace the `dev-its-workflow/` folder with the new version.
Your `.dev-its/config.json` stays in the repo — it won't be affected.

If the new version introduces new config fields, the wizard will prompt you to add them.

---

## How It Relates to Other Skills

This skill is **fully self-contained**. It includes:
- Its own **git-flow logic** (branch → commit → push → PR → reviewers)
- Its own **spec-test-suite logic** (spec → test agents → coverage report)

You do NOT need to install `git-flow` or `spec-test-suite` separately.
If you already have them for other purposes, they won't conflict — this skill
never calls external skills.
