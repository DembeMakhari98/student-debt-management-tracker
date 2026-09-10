# Dev-ITS Workflow — Getting Started Guide

## "Address Book" Tutorial: Your First AI-Assisted Project from Zero to Deployed

This guide takes you from an empty GitHub repo to a fully working Address Book app
(Angular frontend + .NET/Node backend) using the dev-its-workflow — Claude Code's
AI-assisted development pipeline.

**Who is this for?** Anyone starting with Claude Code who wants to see the full
AI workflow in action. No prior Claude Code experience needed.

**What you'll build:** A simple Address Book with Name, Surname, Cell Number, and
Email — full CRUD (Create, Read, Update, Delete) via an Angular frontend backed by
a REST API.

**What you'll learn:** How to let AI carry a ticket from idea → spec → code → tests
→ PR → deploy, with you approving at each gate.

---

## Part 1: Setup Your Playground

### 1.1 Create a New GitHub Repository

We're creating a brand new repo so nothing you do here affects last week's work.

**In your browser:**

1. Go to [https://github.com/new](https://github.com/new)
2. Fill in:
  - **Repository name:** `address-book-app`
  - **Description:**
    ```
    A full-stack Address Book application (Angular + REST API) for managing contacts.
    Supports CRUD operations for contacts with name, surname, cell number, and email.
    Built as a learning project for AI-assisted development with Claude Code.
    ```
  - **Visibility:** Public (so colleagues can see it) or Private (your choice)
  - **Initialize with:** Check "Add a README file"
  - **Add .gitignore:** Select `Node` (we'll add more ignores later)
  - **License:** MIT (or your preference)
3. Click **"Create repository"**

You now have a fresh, empty playground at `https://github.com/<your-username>/address-book-app`.

---

### 1.2 Clone It Locally

Open a terminal (Git Bash on Windows, Terminal on Mac/Linux):

```bash
# Pick a location that's separate from your work projects
cd C:\Projects\Learning
# (or ~/Projects/Learning on Mac/Linux)

git clone https://github.com/<your-username>/address-book-app.git
cd address-book-app
```

You now have an empty project folder with just a README and .gitignore.

---

### 1.3 Create the "Ticket" (GitHub Issue)

The dev-its-workflow starts with a **ticket** — a GitHub issue that describes what
you want to build. Let's create one.

**In your browser**, go to your new repo → **Issues** → **New Issue**.

**Title:**

```
Build a full-stack Address Book with CRUD functionality
```

**Body** (paste this exactly — it gives the AI enough detail to work with):

```markdown
## Description
Build a full-stack Address Book application that allows users to manage their contacts.

## Requirements

### Backend (REST API)
- Create a REST API with the following endpoints:
  - `GET /api/contacts` — List all contacts
  - `GET /api/contacts/:id` — Get a single contact by ID
  - `POST /api/contacts` — Create a new contact
  - `PUT /api/contacts/:id` — Update an existing contact
  - `DELETE /api/contacts/:id` — Delete a contact
- Each contact has these fields:
  - `id` (auto-generated UUID)
  - `firstName` (string, required, max 50 chars)
  - `lastName` (string, required, max 50 chars)
  - `cellNumber` (string, required, format: valid phone number)
  - `email` (string, required, format: valid email address)
  - `createdAt` (datetime, auto-set)
  - `updatedAt` (datetime, auto-set on modification)
- Use an in-memory data store (JSON file or SQLite) for simplicity
- Include input validation with meaningful error messages
- Return proper HTTP status codes (200, 201, 400, 404, 500)

### Frontend (Angular)
- Create an Angular application with:
  - A contacts list page showing all contacts in a table
  - A "Add Contact" form with validation
  - An "Edit Contact" form (pre-populated)
  - A "Delete" button with confirmation dialog
  - Search/filter functionality on the list
  - Responsive design (works on mobile)
- Use Angular Material or Bootstrap for styling
- Show loading states and error messages
- Form validation matching the backend rules

### Tech Stack
- Backend: Node.js with Express (or .NET Web API — developer's choice)
- Frontend: Angular 17+ with standalone components
- Storage: SQLite or JSON file (no external database required)
- Testing: Jest/Vitest for backend, Jasmine/Karma for Angular

## Acceptance Criteria
- [ ] I can view a list of all my contacts
- [ ] I can add a new contact with name, surname, cell number, and email
- [ ] I can edit an existing contact's details
- [ ] I can delete a contact (with confirmation)
- [ ] I see validation errors when I enter invalid data
- [ ] I can search/filter the contact list by name or email
- [ ] The app works on both desktop and mobile screens
- [ ] The API returns proper error codes and messages
- [ ] All CRUD operations persist (survive a page refresh)

## Labels
Enhancement
```

Click **"Submit new issue"**. Note the issue number (probably `#1`).

**Add the label** "enhancement" to the issue (right sidebar → Labels → enhancement).

---

### 1.4 Assign the Issue to Yourself

On the issue page → right sidebar → **Assignees** → assign yourself.

This isn't strictly required by the workflow, but it's good practice and the
dependency-check agent will see that you're the owner.

---

## Part 2: Install the Dev-ITS Workflow

### 2.1 Copy the Skill Folder

The dev-its-workflow skill needs to be in your Claude Code skills directory.

**Windows:**

```bash
# If you received the skill as a zip/folder, copy it to:
# C:\Users\<your-username>\.claude\skills\dev-its-workflow\

# If you're copying from a colleague's machine:
xcopy /E /I "\\colleague\path\dev-its-workflow" "%USERPROFILE%\.claude\skills\dev-its-workflow"
```

**Mac/Linux:**

```bash
cp -r /path/to/dev-its-workflow ~/.claude/skills/dev-its-workflow
```

**Verify it's in place:**

```bash
ls ~/.claude/skills/dev-its-workflow/SKILL.md
# Should show the file exists
```

### 2.2 Verify Claude Code Can See It

Open Claude Code (in your terminal, VS Code, or the desktop app):

```bash
# Navigate to your project
cd C:\Projects\Learning\address-book-app

# Start Claude Code
claude
```

Type:

```
> What skills do you have available?
```

You should see `dev-its-workflow` in the list. If not, check that the folder is in
the correct location (`.claude/skills/` under your home directory).

---

## Part 3: Run the Workflow (The Fun Part)

### 3.1 Initialize the Workflow

In Claude Code, with your terminal pointed at the `address-book-app` folder:

```
> dev-its-workflow
```

**What happens next:** The workflow detects that `.dev-its/config.json` doesn't exist
and starts the **setup wizard**.

It will:

1. Auto-detect that this is a GitHub repo
2. Auto-detect your org/username and repo name
3. Ask you a few questions:

**When it asks "Who should review PRs?"** — enter your own username (since this is
a learning project): `<your-github-username>`

**When it asks "Branch prefix?"** — accept the default: `feature/`

**When it asks "Commit style?"** — accept: `conventional`

**When it asks "PR template?"** — accept: `built-in`

The wizard writes `.dev-its/config.json`. You'll see something like:

```
Config written to .dev-its/config.json
Added .dev-its/progress.json to .gitignore
Ready to go!
```

### 3.2 Commit the Config

The workflow may ask if you want to commit the config. Say yes, or do it manually:

```
> Please commit the config file
```

This is so that if a colleague clones your repo, the workflow config is already there.

---

### 3.3 Start Working the Ticket

Now, tell the workflow to pick up your ticket:

```
> work this ticket #1
```

**What happens now — the 10-stage pipeline begins:**

---

#### Stage 0: Pre-flight Checks

The workflow verifies:

- GitHub CLI (`gh`) is authenticated
- Git is configured
- Node.js is available (since it will detect your project needs it later)

**You'll see:** A checklist of pass/fail items. If something fails, it tells you
how to fix it (e.g., "Run `gh auth login` to authenticate").

**What to do:** If everything passes, it moves on automatically. If something fails,
fix it and say "continue" or "retry pre-flight".

---

#### Stage 0.5: Complexity Estimate

The AI reads your ticket and estimates:

- **Complexity:** Likely MEDIUM (4-10 files, Unit + Integration tests, 2 layers)
- **Fast-track eligible:** No (this is a feature, not a bug fix)
- **Estimated time:** ~60-90 minutes

**You'll see:**

```
COMPLEXITY ESTIMATE
Ticket: #1 — "Build a full-stack Address Book with CRUD functionality"
Complexity: MEDIUM (score: 13/21)
Fast-track eligible: No (feature, not bug fix)
Recommendation: PROCEED as single ticket
```

**What to do:** It asks "Proceed with this estimate?" — say **yes**.

---

#### Stage 1: Ticket Pick-Up

The AI:

- Fetches the full issue from GitHub
- Posts a comment on the issue: "Working on this — #1 (via dev-its-workflow)"
- Summarises the ticket back to you

**You'll see:** A summary of the ticket and "Is this the correct ticket?"

**What to do:** Confirm: **yes, that's the one**.

---

#### Stage 1.5: Dependency Check

The AI scans for conflicts:

- Any open PRs touching the same files? (No — repo is empty)
- Any active branches? (No — just main)
- Base branch up to date? (Yes — just cloned)

**You'll see:**

```
DEPENDENCY CHECK
Conflicts: 0
Warnings: 0
Recommendation: PROCEED
```

**What to do:** Nothing — it proceeds automatically since no conflicts found.

---

#### Stage 2: Spec ⛔ GATE A — This Is Where YOU Approve

The AI writes a detailed specification at `docs/SDD/address-book-crud.spec.md`.

**You'll see:** The full spec presented to you, including:

- Goals and Non-Goals
- User Stories with Acceptance Criteria (checkboxes)
- Technical Design (architecture, data model, API design)
- Testing Strategy
- Risks & Mitigations
- Open Questions (if any)

**THIS IS GATE A — THE WORKFLOW STOPS HERE AND WAITS FOR YOU.**

**What to do:**

- **Read the spec carefully.** Does it match what you want?
- If something's wrong: "Change the backend to .NET instead of Node" or "Add a
notes field to the contact"
- If it looks good: **"Approved"** or **"Looks good, proceed"**
- The AI may ask about Open Questions — answer them

**Tips for reviewing the spec:**

- Check the Acceptance Criteria match your issue's checkboxes
- Check the API endpoints are correct (paths, methods, status codes)
- Check the Data Model has all your fields
- Check the Testing Strategy is realistic (don't demand E2E if you can't run a browser)

---

#### Stage 3: Plan ⛔ GATE B — Approve the Implementation Plan

After you approve the spec, the AI writes an implementation plan:

- Which files to create, in what order
- The project structure (folders, naming)
- Dependencies to install
- A Rollback Plan (how to undo if things go wrong)

**You'll see:** The plan + rollback, and the workflow pauses again.

**THIS IS GATE B — APPROVE THE PLAN.**

**What to do:**

- Does the file structure make sense?
- Are the dependencies reasonable? (no bloated frameworks for a simple app)
- Is the order logical? (backend first, then frontend, then integration)
- If good: **"Approved"** or **"Go ahead"**

---

#### Stage 3.5: Architecture Review

The AI checks the plan against the (empty) repo. Since this is a new project,
it will mostly confirm there are no conflicts. For existing projects, this is
where it catches things like "you're reinventing a utility that already exists."

**You'll see:** "No findings — PROCEED" (or minor suggestions).

**What to do:** Nothing — moves on automatically unless there are high-severity issues.

---

#### Stage 4: Develop

**This is where the AI writes code.** It implements the entire plan:

- Creates the backend (API routes, models, validation, data store)
- Creates the Angular frontend (components, services, forms, routing)
- Sets up configuration, package.json, etc.

**You'll see:** Progress updates as files are created. This is the longest stage.

**What to do:** Wait. If it fails (build error, type error), it retries up to 3 times.
If it can't figure it out after 3 tries, it asks you for help.

---

#### Stage 5: Test (Parallel)

The AI dispatches test agents:

- **Unit tests** (testing individual functions) — runs in parallel with:
- **Integration tests** (testing components working together)
- **E2E tests** (if applicable — testing the full running app)

**You'll see:**

```
TEST RESULTS (parallel execution):
  Unit tests:        8 passed, 0 failed  ✓  (15s)
  Integration tests: 5 passed, 0 failed  ✓  (22s)
```

**What to do:** If tests pass, it moves on. If tests fail, it retries (fixes the code
or the tests). After 3 failures it asks you for guidance.

---

#### Stage 6: Test-Review (Adversarial)

The AI sends a "hostile reviewer" to attack the test suite:

- Are there acceptance criteria with no test?
- Are there weak assertions that would pass even if the code was broken?
- Are there missing edge cases (empty strings, invalid emails, etc.)?

It loops: find gaps → fix them → re-review. Stops when:

- All high-severity gaps are addressed, OR
- Diminishing returns detected (same issues persist after 2 attempts), OR
- Max 5 loops reached

**You'll see:** Each loop's findings and what was fixed.

**What to do:** Watch and wait. When it stops (pass or stall), it reports the final state.

---

#### Stage 7: PR ⛔ GATE C — Your Final Approval

The AI:

1. Creates a branch: `feature/address-book-crud`
2. Commits all the code
3. Pushes to GitHub
4. Opens a Pull Request with a filled template
5. Adds your reviewers

**You'll see:** The PR number, URL, and a summary of what's included.

**THIS IS GATE C — THE FINAL GATE.**

**What to do:**

- Click the PR link and review the code on GitHub
- If it looks good: **"Approved — merge it"** or go to GitHub and approve/merge
- If something needs changing: tell the AI what to fix
- If you are teh only reviewer, you cannot review the PR if you are the Author
- Just tell Claude to Merge the PR, Afterwards, tell claude to continue to stage 8

---

#### Stage 8: Deploy

After the PR is merged, the workflow:

- Detects the merge
- Reports the deploy status
- Comments on the issue that it's shipped
- Closes the issue (or moves it to Done)

**You'll see:** A final summary of the entire journey.

---

#### Stage 9: Documentation

The AI updates docs:

- README.md (how to run the project, API endpoints, setup steps)
- Any other relevant docs

**You'll see:** "Docs updated" or "No doc changes needed."

---

## Part 4: After the Workflow Completes

### 4.1 Run Your App!

The AI should have included setup instructions in the README, but typically:

```bash
# Install backend dependencies
cd api
npm install

# Start the backend
npm run dev

# In another terminal — install frontend dependencies
cd web
npm install

# Start the Angular frontend
ng serve
```

Or Just tell claude to "start it"  


Open [http://localhost:4200](http://localhost:4200) and you should see your Address Book!

### 4.2 Try the CRUD Operations

1. **Create:** Click "Add Contact" → fill in the form → save
2. **Read:** See the contact appear in the list
3. **Update:** Click a contact → edit the details → save
4. **Delete:** Click delete → confirm → see it disappear
5. **Search:** Type in the search box → list filters

### 4.3 Review What the AI Built

Look at the project structure:

```bash
ls -la
# You'll see something like:
# api/          ← Backend
# web/          ← Angular frontend
# docs/SDD/     ← The spec
# .dev-its/     ← Workflow config + progress
# README.md     ← Updated with setup instructions
```

---

## Part 5: What Just Happened? (The Big Picture)

Here's what the dev-its-workflow did for you:

```
YOU wrote:              A GitHub issue (5 minutes)
YOU approved:           A spec, a plan, and a PR (3 decisions)
THE AI did:             Everything else:
                        - Sized the work
                        - Checked for conflicts
                        - Wrote a detailed specification
                        - Planned the implementation
                        - Reviewed the plan against architecture
                        - Wrote all the code (backend + frontend)
                        - Wrote all the tests
                        - Had an adversarial reviewer attack the tests
                        - Fixed the gaps
                        - Created a branch, committed, pushed, opened a PR
                        - Updated documentation
```

**Your role was the decision-maker at 3 gates.** You said "yes, that spec is right",
"yes, that plan makes sense", and "yes, that code is good enough to merge." The AI
did the mechanical work between those decisions.

---

## Part 6: Common Commands During the Workflow

Here's a cheat sheet for talking to the workflow:


| What you want               | What to say                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| Start the workflow          | `dev-its-workflow` or `work this ticket #1`                            |
| Approve a gate              | `approved` / `looks good` / `proceed`                                  |
| Request changes at a gate   | `change X to Y` / `add Z` / `remove the notes field`                   |
| Skip a gate (use sparingly) | `skip the plan gate`                                                   |
| See current status          | `where are we?` / `what stage?`                                        |
| Resume after a break        | `dev-its-workflow` (it detects the progress file and offers to resume) |
| Abort the workflow          | `abort` / `stop the workflow`                                          |
| Force full pipeline         | `run full pipeline` (when fast-track is offered but you want thorough) |
| Get help                    | `explain this stage` / `what does this mean?`                          |


---

## Part 7: Giving This to Colleagues

When sharing this with your team:

### What to give them:

1. **This guide** (GETTING_STARTED_GUIDE.md)
2. **The skill folder** (`dev-its-workflow/`) — they copy it to their `~/.claude/skills/`
3. **Access to Claude Code** (they need their own license/access)

### What they need beforehand:

- Claude Code installed
- GitHub CLI installed and authenticated (`gh auth login`)
- Git configured (`git config --global user.name` / `user.email`)
- Node.js installed (for this tutorial project — other projects may need different tools)

### The learning path:

1. Follow this guide end-to-end (builds understanding of each stage)
2. Try modifying the ticket mid-workflow (e.g., "add a birthday field" at the spec gate)
3. Try a second ticket on the same repo (e.g., "add export to CSV functionality")
4. Try it on a real work project (create a real ticket, point at a real repo)

---

## Part 8: Troubleshooting

### "The workflow doesn't start"

- Check Claude Code can see the skill: look in `~/.claude/skills/dev-its-workflow/SKILL.md`
- Make sure you're in the repo directory (`cd address-book-app`)
- Try the exact trigger: `dev-its-workflow`

### "Pre-flight fails on gh auth"

```bash
# Run this in your regular terminal (not inside Claude Code):
gh auth login
# Follow the prompts (browser auth is easiest)
# Then go back to Claude Code and say "retry"
```

### "It's stuck at a gate"

The workflow is waiting for YOUR approval. Say `approved` or tell it what to change.

### "Tests keep failing"

After 3 retries, the workflow will ask you for help. Common fixes:

- "The test database isn't running — skip integration tests for now"
- "Try using a different assertion approach"
- "The port is in use — change to 3001"

### "I lost my session / context overflow"

Just start Claude Code again in the same directory and say `dev-its-workflow`.
It will find `.dev-its/progress.json` and offer to resume from where you left off.

### "I want to start over"

```bash
# Delete the progress file to reset the workflow
rm .dev-its/progress.json
# Then start again
> dev-its-workflow
```

---

## Appendix: What Each File in the Skill Does


| File                                        | Purpose                                 |
| ------------------------------------------- | --------------------------------------- |
| `SKILL.md`                                  | The brain — orchestrates all 10 stages  |
| `agents/spec-agent.md`                      | Writes specs from tickets               |
| `agents/complexity-estimator-agent.md`      | Sizes tickets (Low/Medium/High)         |
| `agents/dependency-check-agent.md`          | Finds conflicts with in-flight work     |
| `agents/architecture-review-agent.md`       | Reviews plan against existing code      |
| `agents/unit-test-agent.md`                 | Writes fast, isolated unit tests        |
| `agents/integration-test-agent.md`          | Writes tests for component interactions |
| `agents/e2e-test-agent.md`                  | Writes end-to-end tests (if applicable) |
| `agents/adversarial-review-agent.md`        | Hunts for test coverage gaps            |
| `agents/adversarial-code-reviewer.md`       | Tries to break the code                 |
| `agents/documentation-agent.md`             | Updates project docs after deploy       |
| `references/spec-mapping.md`                | Rules for turning spec into tests       |
| `scripts/find-spec.sh`                      | Helper to locate spec files             |
| `scripts/setup-wizard.sh`                   | Auto-detects your environment           |
| `templates/PULL_REQUEST_TEMPLATE.github.md` | PR template (GitHub)                    |
| `templates/PULL_REQUEST_TEMPLATE.azure.md`  | PR template (Azure DevOps)              |
| `templates/config.example.json`             | Example config for reference            |
| `config.schema.json`                        | Validates your config file              |


---

## Quick Summary (The 5-Year-Old Version)

1. **You write a wish** (the GitHub issue) — "I want an address book"
2. **You install the helper** (copy the skill folder)
3. **You say "go"** (`dev-its-workflow`)
4. **The helper sets up its desk** (config wizard — asks you a few questions)
5. **The helper reads your wish** and writes a detailed recipe (the spec)
6. **You check the recipe** — "Yes, that's what I want" ⛔ Gate A
7. **The helper writes a shopping list** (the plan) — "Here's what I'll build"
8. **You check the list** — "Looks right, go ahead" ⛔ Gate B
9. **The helper builds it** (writes all the code + tests)
10. **A grumpy inspector checks the work** (adversarial reviewer)
11. **The helper packages it up** (creates a PR)
12. **You check the package** — "Ship it!" ⛔ Gate C
13. **Done!** Your app exists and is documented.

You made 3 decisions. The helper did 10 stages of work. That's the dev-its-workflow.