# Student Debt Tracker — API

Spring Boot 4 / Java 21 REST API backed by PostgreSQL, with Liquibase creating and seeding every
table on first run — a new team member gets a fully populated, browsable database with nothing
more than the two commands below.

## Running it

```bash
# from the repo root
docker compose up -d               # Postgres 16 on localhost:5432

cd backend
./mvnw spring-boot:run             # http://localhost:8080
```

On startup, Liquibase (via `spring.liquibase.change-log`) applies `db/changelog/db.changelog-master.xml`,
which creates the schema and seeds:

- the funding-status risk-weight lookup table (business case §3.3)
- registered head-count per financial year (2022–2026)
- the autonomy-level setting (defaults to Level 2 · Recommend)
- the same 26-debtor demonstration book the Angular frontend uses, so both projects show
  identical numbers
- one activity-log entry per debtor, so the audit trail isn't empty on a fresh database

No manual `CREATE TABLE` or seed script is ever required — `docker compose up -d` + `mvnw
spring-boot:run` is the whole first-run story.

### Tests

```bash
./mvnw test
```

Tests run against an in-memory H2 database (see `src/test/resources/application.yml`) so they
don't need Postgres running. H2's `TEXT` column reads back as `CLOB`, which trips Hibernate's
schema *validation* even though the same Liquibase changelog is fine against real Postgres — so
`ddl-auto` is `none` for the test profile and `validate` everywhere else.

## Configuration

All overridable via environment variables (see `application.yml`):

| Variable | Default |
|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/student_debt_tracker` |
| `DB_USERNAME` / `DB_PASSWORD` | `debt_tracker` / `debt_tracker` |
| `SERVER_PORT` | `8080` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` (the Angular dev server) |

## API surface

| Endpoint | Purpose | Issue |
|---|---|---|
| `GET /api/meta` | Years on record, funding options, autonomy levels | #16 |
| `GET /api/summary?year=&funding=` | The 5 KPI cards | #10 |
| `GET /api/debtors?year=&funding=&scope=picked\|refunds\|paying\|cases` | Tracker / case-list rows, scored and recommended | #11, #12 |
| `GET /api/debtors/{debtorKey}` | Full case detail — signals, evidence, activity log, last decision | #12 |
| `POST /api/debtors/{debtorKey}/decision` | Approve / amend / decline a recommendation | #13 |
| `GET /api/ageing?year=&funding=` | Ageing bars, funding×bucket matrix, per-student and credit tables | #15 |
| `GET /api/debtors/export?year=&funding=` | CSV export, same columns/filename as the spec | #17 |

`debtorKey` is `{studentId}-{financialYear}`, e.g. `STU-100234-2026` (a student can recur across
financial years, each with its own record).

## Design notes

- **Scores and recommendations are computed on read**, not persisted as a nightly batch (`RiskScoringService`,
  `DecisionEngineService`). This keeps the reference implementation simple and always-current; a
  real nightly job (issue #2) would instead persist `Case` snapshots on a schedule and this service
  layer would read those snapshots. The seam is `RowAssembler` — swap its inputs for a persisted
  `Case` table without touching the controllers.
- **Officer decisions and activity-log entries are the only things actually persisted** beyond the
  raw debtor data, because they're the audit trail (issue #3) — genuinely stateful, and genuinely
  append-only (no update/delete endpoint exists for either).
- **The funding-status risk weights live in a table**, not an enum, per the business case's own
  "Fairness / bias" mitigation: Student Funding needs to be able to review and retune the weighting
  without a code deploy.

## Explicitly out of scope here

Issues #1 (ITS Integrator API availability spike), #18 (officer portfolio access control), #19
(POPIA impact assessment) and #20 (audit-log retention policy) are stakeholder/compliance
decisions the business case and technical spec both flag as prerequisites to go-live — they are
not something a codebase can resolve unilaterally. `CorsConfig` and the decision endpoints are
built so that adding authn/authz and a retention job later doesn't require reshaping the API.
