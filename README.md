# Student Pro-active Debt Management Tracker

An AI-agent-assisted debt management module for ITS Integrator. Every night the agent reads
Debtors, Student Fees, Student Funding and Cashiering, scores every registered student's debt
risk, and drafts a policy-referenced recommended action — a payment arrangement, a hardship-fund
referral, a registration hold, a refund, or a reminder — for a debt officer to approve, amend or
decline.

This repository contains two independently runnable projects:

| Project | What it is | Docs |
|---|---|---|
| [`frontend/`](frontend) | Angular 19 app reproducing the approved prototype's look exactly, wired to an in-memory mock dataset | [frontend/README.md](frontend/README.md) |
| [`backend/`](backend) | Spring Boot 4 API with PostgreSQL + Liquibase — creates and seeds every table on first run | [backend/README.md](backend/README.md) |

## Source material

This build was produced from, and should stay traceable to:

- **The prototype** — `student-proactive-debt-management-tracker.html` — the reference implementation
  for look, business rules and copy. The Angular app's global stylesheet and business-logic service
  are direct ports of it.
- **The business case** (`Student-Debt-Tracker-Business-Case.docx`) — problem statement, the risk
  scoring model (§3.3), the decision engine (§3.4), autonomy levels (§3.6), stakeholder value, success
  metrics and risk/mitigation.
- **22 GitHub issues** on [DembeMakhari98/student-debt-management-tracker](https://github.com/DembeMakhari98/student-debt-management-tracker/issues) —
  one Epic (#22) plus 21 child issues carrying the full acceptance criteria this build implements.
  Issue numbers are cited throughout the code (`// issue #7`, etc.) so a reviewer can trace any
  function back to its ticket.

## What's implemented vs. what's still an open item

Issues #2–#17 (data model, scoring, decision engine, autonomy gating, all four workspaces, the
approve/amend/decline flow, CSV export, audit logging) are implemented in both projects — the
Angular app against mock data, the API against a seeded Postgres database with the identical
dataset.

Issues #1, #18, #19, #20, #21 are **organisational/integration decisions, not code** — they need a
real integration spike against ITS Integrator, a POPIA impact assessment, a portfolio
access-control model, a retention policy, and platform/browser alignment, all signed off by the
relevant stakeholders before go-live. Nothing in this codebase should be read as pre-empting those
decisions; see each issue for what's still open.

## Quick start

```bash
# 1. Frontend — mock data, no backend required
cd frontend
npm install
npm start                    # http://localhost:4200

# 2. Backend — Postgres + Liquibase
docker compose up -d         # starts Postgres on 5432
cd backend
./mvnw spring-boot:run       # http://localhost:8080, schema + demo data created automatically
```

See each project's own README for configuration, testing and API details.
