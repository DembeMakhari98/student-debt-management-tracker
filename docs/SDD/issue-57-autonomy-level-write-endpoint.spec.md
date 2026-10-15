# Spec: API — change the agent autonomy level (manager/admin only)

**Ticket:** [#57](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/57)
**Branch base:** `develop` (branch: `feature/57-autonomy-level-write-endpoint`)
**Spec reference:** TECHNICAL_SPECIFICATION.md §5.10; `docs/SDD/issue-8-autonomy-level-gating.spec.md`

## Overview / Goals

`system_setting.autonomy_level` is read-only today — `GET /api/meta` exposes it, but
nothing can change it, and the frontend's autonomy `<select>` (`app.component.html`)
writes only to `DebtService.autonomy`, a local signal that resets on reload (issue #8's
Open Question 2, explicitly deferred). This ticket adds the write path: a
manager/admin-only `PUT /api/settings/autonomy`, an audit trail of who changed it and
when, and wires the existing dropdown to call it.

**What already exists, read from the code rather than assumed:**
- Real JWT auth landed on `develop` since this spec was last touched (PR #54,
  `feature/jwt-login`): `AppUser`/`UserRole` (OFFICER/MANAGER/ADMIN), stateless JWT via
  `SecurityConfig`, `CurrentUser.displayName(Authentication)` for actor attribution, and
  an established `/api/admin/**` → `hasAnyRole("ADMIN","MANAGER")` path rule
  (`AdminExtractController`, `WriteBackAdminController`).
- `AuthService.canSeeAdminJobs()` (frontend) already computes exactly the
  manager-or-admin condition this ticket needs for the dropdown.
- `MetaController.meta()` already reads `system_setting` and will reflect a changed
  value with no further change — AC4 ("GET /api/meta returns the new level afterwards")
  is satisfied automatically once the write path persists correctly.

## Non-Goals

- **No change to the autonomy *behaviour*** (issue #8's gating rules) — this ticket only
  adds the ability to persist a new level.
- **No new `UserRole`** — ADMIN already exists (added for the extract/write-back admin
  endpoints), so "manager/admin only" maps directly onto the existing role model, no
  schema change needed beyond the new audit table.
- **No generic settings framework.** One endpoint, one setting. A `key`-generic
  `PUT /api/settings/{key}` was considered and rejected — `system_setting` currently has
  exactly one row and YAGNI applies; generalise when a second setting shows up.

## Acceptance Criteria (from the ticket, mapped to implementation)

- [ ] `PUT /api/settings/autonomy` with `{ "level": 1-4 }` updates
      `system_setting.autonomy_level` — `AutonomySettingService.update()`.
- [ ] MANAGER/ADMIN only (403 for OFFICER) — new `SecurityConfig` matcher:
      `requestMatchers(HttpMethod.PUT, "/api/settings/autonomy").hasAnyRole("ADMIN","MANAGER")`,
      placed before the generic `/api/**` authenticated rule. Enforced by the filter
      chain, not application code — consistent with how `/api/admin/**` is already
      gated, and untestable-around (a 403 is returned before the controller runs).
- [ ] Level outside 1–4 → 400 — `ValidationException` in the service, same pattern as
      `DecisionService`'s action/amendedTerms/reason checks.
- [ ] The change is audited (who, old level, new level, when) — new
      `autonomy_level_audit` table / `AutonomyLevelAudit` entity, one immutable row per
      change, written in the same transaction as the `system_setting` update. "Who" is
      `CurrentUser.displayName(authentication)` from the JWT, never a request-body field
      (same rule `DebtorController.decide()` already enforces for `decidedBy`).
- [ ] `GET /api/meta` returns the new level afterwards — no code change needed (see
      above); covered by an integration test that PUTs then GETs.
- [ ] Frontend autonomy dropdown is read-only for officers and calls this endpoint for
      managers/admins — `[disabled]="!auth.canSeeAdminJobs()"` on the `<select>`; a new
      `AutonomySettingsService` (mirrors `ExtractStatusService`'s shape, the app's other
      direct-HTTP integration point) calls the endpoint and the app hydrates
      `DebtService.autonomy` from `GET /api/meta` once at sign-in so a manager's change
      is visible to every signed-in user, not just whoever made it.

## Technical Design

### Backend

- `AutonomyLevelAudit` (`domain`): `id` (UUID), `oldLevel`, `newLevel` (int),
  `changedBy` (varchar — display name), `changedAt` (Instant). Append-only, same spirit
  as `ActivityLogEntry` — no update/delete endpoint.
- `AutonomyLevelAuditRepository extends JpaRepository<AutonomyLevelAudit, UUID>`.
- `AutonomyUpdateRequestDto(@NotNull @Min(1) @Max(4) Integer level)` — bean-validated so
  a non-integer or out-of-range value 400s before the service even runs (`@Valid` on the
  controller param, same as `DecisionRequestDto`).
- `AutonomyLevelResponseDto(int level)` — the PUT response body, so the frontend doesn't
  need a second round trip to confirm the write.
- `AutonomySettingService.update(int level, String changedBy)`: reads the current
  `system_setting` row (defaulting to 2 if absent, matching `MetaController`), writes
  the new value, inserts the audit row, returns the new level. `@Transactional` so the
  setting and its audit row never diverge.
- `SettingsController`: `PUT /api/settings/autonomy`, `@Valid @RequestBody
  AutonomyUpdateRequestDto`, `Authentication` param for `CurrentUser.displayName()`.
- `SecurityConfig`: one new matcher line (see AC2 above). `hasAnyRole` checks the
  `ROLE_MANAGER`/`ROLE_ADMIN` authority the JWT converter already derives from the
  token's `role` claim — no new auth plumbing.
- Liquibase `009-autonomy-level-audit.xml` (next free number after `008-app-user.xml`),
  included in the master changelog.

### Frontend

- `core/autonomy-settings.service.ts` (new, mirrors `extract-status.service.ts`):
  `fetchLevel(): Observable<number>` (GET `/api/meta`, maps `autonomyLevel`) and
  `updateLevel(level): Observable<number>` (PUT `/api/settings/autonomy`, maps
  `.level`).
- `AppComponent`: in the existing sign-in `effect()` (where `extractStatus.refresh()`
  is already conditionally called), unconditionally call
  `autonomySettings.fetchLevel()` and `debt.setAutonomy()` the result — every signed-in
  role may *see* the level, only managers/admins may change it.
- `onAutonomyChange()`: now calls `autonomySettings.updateLevel(level)` and sets
  `debt.autonomy` from the response; the `<select>` gains
  `[disabled]="!auth.canSeeAdminJobs()"` so an officer physically cannot open it
  (belt-and-braces alongside the backend 403 — the backend is the real gate).
- `runAutonomousExecution()` / `autoEligible()` (issue #8) are untouched — they already
  read `DebtService.autonomy`, whatever its source.

## Testing Strategy

**Backend:**
- `AutonomySettingServiceTest` (unit, mocked repos, mirrors `DecisionServiceTest`):
  happy path persists the new value and an audit row with correct old/new/who; level 0
  and 5 both rejected; audit row still records old=2 on first-ever change (no prior
  row).
- `SettingsControllerTest` (`@SpringBootTest @AutoConfigureMockMvc`, real JWTs via
  `AuthControllerTest`'s `tokenFor()` pattern): OFFICER token → 403; MANAGER and ADMIN
  tokens → 200 and the value sticks; a subsequent `GET /api/meta` reflects it; level 5
  → 400; no `Authorization` header → 401 (falls out of the existing `/api/**` rule, but
  worth asserting explicitly for this endpoint).

**Frontend:** new spec for `AutonomySettingsService` (HttpTestingController, same
pattern as other services' specs) plus an `AppComponent` assertion that the autonomy
`<select>` is `disabled` for an OFFICER-role session and enabled for MANAGER/ADMIN.

## Metrics & Success Criteria

- All 5 acceptance-criteria checkboxes backed by a passing test.
- `./mvnw test` and `ng test` both pass.
- Manually verified against the seeded users (`docs/.../008-app-user.xml`): sign in as
  `anele.dube` (OFFICER) → dropdown disabled; sign in as `grace.vanrooyen` (MANAGER) →
  change it, reload, still reflects the change (proves persistence, not just the local
  signal).

## Risks & Mitigations

- **Risk:** hydrating `debt.autonomy` from the backend on every sign-in could race with
  `runAutonomousExecution()` if a case run fires before the fetch resolves, briefly
  using the stale default. **Mitigation:** low-stakes (same default of 2 the signal
  already starts at) and the existing scoring-run flow is already an explicit,
  user-triggered action, not something that fires at app boot.
- **Risk:** disabling the `<select>` client-side is cosmetic only — the real control is
  the 403. Noted so a future reviewer doesn't mistake the `disabled` attribute for the
  security boundary.
