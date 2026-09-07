# Spec: Complete a POPIA impact assessment for the module

**Ticket:** [#19](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/19)
**Branch base:** `develop` (branch: `feat/popia-impact-assessment`)
**Spec reference:** TECHNICAL_SPECIFICATION.md §7 (Non-Functional Requirements — POPIA),
Open Item 6 and 7 (§10); Business Case §6 (Risk and Mitigation — "POPIA / privacy")

## Overview / Goals

This module processes special personal information — identifiable students' financial
position and funding status (NSFAS/bursary outcomes, arrears, payment behaviour). The
business case names a POPIA impact assessment as a named mitigation for the
"POPIA / privacy" risk, and the technical spec states it is "a prerequisite to go-live,
not an optional follow-up."

The goal of this ticket is to produce that assessment as a reviewable artifact, get it
signed off by the institution's Information Officer / compliance function, and use its
findings to unblock two downstream tickets that are explicitly waiting on it:
- **#18** (officer portfolio access-control scoping) — needs the assessment's view on
  role-based access / minimum necessary access.
- **#20** (audit log retention policy) — needs the assessment's view on lawful retention
  period for case history and activity logs.

## Non-Goals

- **This ticket does not implement the access-control model.** That's #18. This ticket
  produces the *findings and recommendation* that #18's implementation must follow.
- **This ticket does not implement or enforce a retention period.** That's #20. Same
  relationship as above.
- **No new application code.** The deliverable is a compliance document plus any
  remediation tickets it generates — not a feature, endpoint, or UI change.
- **Not a legal opinion.** This assessment is prepared using the POPIA condition
  structure as a working framework; final legal sign-off authority rests with the
  institution's Information Officer, not with engineering.

## Deliverable → Acceptance Criteria

- [ ] A POPIA Impact Assessment document exists at
      `docs/compliance/popia-impact-assessment.md`, covering (at minimum):
  - Project/processing description (what personal information moves where — see Data
    Model below)
  - An assessment against each of POPIA's 8 conditions for lawful processing
    (Accountability, Processing Limitation, Purpose Specification, Further Processing
    Limitation, Information Quality, Openness, Security Safeguards, Data Subject
    Participation)
  - A risk register (risk, likelihood/impact, mitigation, owner)
  - An explicit recommendation section for portfolio/access scoping (feeds #18) and one
    for retention period (feeds #20)
- [ ] Any risk the assessment flags as unresolved is captured as a follow-up GitHub issue
      (linked from the assessment doc and from #19 itself)
- [ ] Assessment reviewed and signed off by the institution's Information Officer /
      compliance function; sign-off recorded in the document (name/role, date, decision)
      via a dedicated **Sign-off** section
- [ ] The document explicitly states its findings inform #18 and #20, with direct links
- [ ] Sign-off is a precondition of go-live — this is stated in the document itself and
      cross-referenced from TECHNICAL_SPECIFICATION.md §7

## Technical Design → Assessment Structure

Given the deliverable is a document, "technical design" here means the document's
structure and the information-flow mapping it must be built from, rather than code
architecture.

**Information flow to document** (drawn from Business Case §3.8–3.9 and
TECHNICAL_SPECIFICATION.md §3):
- **Collected/read:** Student ID, name, financial year, programme; funding source and
  status; missed-instalment count and last-payment date; arrangement status; ageing
  amounts per bucket; credit-case fields (credit-since date, days owing, reason);
  registered headcount (from Student Records).
- **Sources:** ITS Integrator — Debtors, Student Fees, Student Funding, Student Records,
  Cashiering (read); write-back of every agent action, rationale, and evidence to the
  student's ITS Integrator record.
- **Who sees it:** debt officers (portfolio-scoped, pending #18), the decision engine
  (automated, no human view unless picked up), audit/compliance (activity log).
- **Retention:** case history / activity log — currently `[TO CONFIRM]` in the spec;
  this assessment's job is to produce that recommendation, not invent it in a vacuum —
  it should reflect actual legal minimums (e.g. SARS/education-record retention norms)
  reconciled with audit-trail needs from §7 (Auditability).

**Document sections (draft outline for the assessment itself):**
1. Purpose and scope
2. Information flow diagram/table (as above)
3. Condition-by-condition assessment (8 POPIA conditions)
4. Risk register
5. Recommendation → access scoping (input to #18)
6. Recommendation → retention period (input to #20)
7. Follow-up items (linked issues)
8. Sign-off

## Data Model

No schema change in this ticket. The assessment *documents* the existing data model
(TECHNICAL_SPECIFICATION.md §3) from a privacy lens — it does not add or modify fields.

## API Design

None — no code or endpoint touched by this ticket.

## Testing Strategy

Not applicable in the unit/E2E sense — this is a documentation/compliance deliverable.
"Testing" here means: the document is reviewed by the Information Officer / compliance
function and either signed off or returned with remediation items. Stage 5 of the
workflow (Test agent) for this ticket should verify:
- The four acceptance-criteria checkboxes above are genuinely satisfiable from the
  document as written (i.e. a reviewer could find every required section).
- Links to #18 and #20 resolve and the recommendation text is unambiguous enough for
  those tickets to act on without re-opening this one.

## Metrics & Success Criteria

- Assessment document exists, is complete against the outline above, and carries a
  recorded sign-off before the module's go-live gate.
- #18 and #20 can each start their own spec stage citing a concrete recommendation from
  this document, rather than an open `[TO CONFIRM]`.

## Risks & Mitigations

- **Risk:** sign-off authority (Information Officer) is not yet identified/available,
  blocking completion. **Mitigation:** flag this immediately as an open question (below)
  rather than assuming a name; the assessment content can be drafted and reviewed in
  parallel while sign-off authority is confirmed.
- **Risk:** #18/#20 start before this assessment's recommendations land, and have to be
  reworked. **Mitigation:** this spec explicitly sequences #19 before #18/#20 (per prior
  dependency analysis); PR for this ticket should be merged/findings shared before those
  specs are finalized.
- **Risk:** treating this as a "soft" ticket and skipping real compliance rigor because
  it produces no visible UI change. **Mitigation:** acceptance criteria require an actual
  named sign-off record, not just a document's existence.

## Open Questions

1. **Who is the institution's Information Officer / compliance function for sign-off?**
   Not yet identified in any repo artifact — needed before the sign-off criterion can be
   closed.
2. **Legal minimum retention period for student financial/audit records** — is there an
   existing institutional records-management policy to align with, or does this
   assessment set the precedent? Directly feeds #20.
3. **Portfolio scoping model preference** (campus / programme / caseload) — does the
   assessment recommend one on privacy-minimisation grounds, or defer entirely to #18's
   own stakeholder discussion (Finance/Debtors management, per #18's body)? This spec
   assumes the assessment provides a privacy-lens *recommendation*, and #18 still owns
   the final operational decision.
