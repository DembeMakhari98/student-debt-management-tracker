# Spec → Test Mapping

How to turn a `*.spec.md` (SDD-style) into tests. Section names below follow the
common spec template; match on meaning, not exact headings, since specs vary.

## Section-by-section

| Spec section | What to produce | Which agent |
|---|---|---|
| **Overview / Goals** | The behaviours that must exist end to end. Frame the suite's scope. | all |
| **Non-Goals** | An explicit "do NOT test" list. Record as out-of-scope in the report. | all |
| **User Stories → Acceptance Criteria** | One (or more) test per checkbox. This is the backbone of coverage. | unit (behaviour) + e2e (flows) |
| **Technical Design → Architecture** | The seams to mock (unit) vs. drive (e2e). Identifies I/O boundaries. | unit + e2e |
| **Technical Design → Data Model** | Invariant assertions: enum/code tables match seeds, uniqueness, FK/relationship rules. | unit + adversarial |
| **API Design** | Per endpoint: happy path, each documented status code, request/response shape, auth. | e2e (or unit with mocked transport) |
| **Testing Strategy** | The author's own plan — implement it directly; it names the exact fixtures/paths. | all (routes work to agents) |
| **Metrics & Success Criteria** | Assertable guarantees. Turn measurable ones into tests. | unit + adversarial |
| **Risks & Mitigations** | The adversarial hit-list: each risk is an attack; each mitigation is a claim to falsify. | adversarial |
| **Open Questions** | Unresolved behaviour — do not assert; note as coverage caveat. | report only |

## Turning a criterion into a test

For a checkbox like *"Within seconds I see a decision of approved/denied/escalated with a written reason"*:
1. **Unit**: the decision function, given a fixture, returns one of the allowed labels
   and a non-empty reason; malformed inputs fall back safely.
2. **Integration**: the service layer, wired to a real (test) DB, persists the decision
   correctly and returns it via the repository.
3. **E2E**: submit through the real entry point and observe a valid decision state.
4. **Adversarial**: can it return a state outside the allowed set? an empty reason?

## Determinism rules

- Unit tests mock every boundary named in the Architecture.
- For LLM/agent output, assert the **contract** (schema, allowed enum, non-empty fields,
  safe fallback) — never the exact wording.
- E2E that needs a live stack must **skip cleanly** (env-var gate) when it is down.

## Coverage report shape

```
Acceptance criterion                                  | Covered by
------------------------------------------------------|--------------------------------
Submit amount/currency/...                            | test_x, e2e:test_submit
Decision is approved|denied|escalated + reason        | test_clear_approve, test_ambiguous
Timeout auto-resolves per policy                      | test_escalation_times_out
Upload supersedes previous, keeps history             | GAP — no test yet
```

Every criterion gets a row. Gaps are stated, not hidden.
