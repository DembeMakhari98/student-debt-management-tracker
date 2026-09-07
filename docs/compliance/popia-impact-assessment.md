# POPIA Impact Assessment — Student Pro-active Debt Management Tracker

**Ticket:** [#19](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/19)
**Status:** Draft — pending Information Officer / compliance sign-off (see Section 8)
**Spec reference:** TECHNICAL_SPECIFICATION.md §7 (Non-Functional Requirements — POPIA);
Business Case §6 (Risk and Mitigation — "POPIA / privacy")

> This assessment is prepared using the POPIA condition structure as a working
> framework for engineering and product decisions. It is not a legal opinion. Final
> sign-off authority rests with the institution's Information Officer / compliance
> function (Section 8), not with engineering.

---

## 1. Purpose and Scope

The Student Pro-active Debt Management Tracker is an agentic AI module built on top of
ITS Integrator. Each night it reads student debt, fee, and funding data, computes a
risk score per registered student with an outstanding balance, and — for students who
are "picked up" — drafts a recommended, policy-referenced action for a human debt
officer to approve, amend, or decline.

Because the module processes **special personal information** as defined by POPIA
(identifiable students' financial position and funding status, which can reveal
socio-economic circumstances), a POPIA impact assessment is a prerequisite to
processing real student data in production. This assessment:

- Maps what personal information the module processes and how it flows (Section 2)
- Assesses that processing against POPIA's eight conditions for lawful processing
  (Section 3)
- Registers privacy-relevant risks and their mitigations (Section 4)
- Produces draft recommendations that two other tickets depend on directly:
  officer portfolio access-control scoping
  ([#18](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/18),
  Section 5) and audit-log/case-history retention
  ([#20](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/20),
  Section 6)
- Lists what remains open and needs a named owner (Section 7)
- Records sign-off once a reviewer is assigned (Section 8)

**Out of scope:** implementing the access-control model itself (#18) or enforcing a
retention period (#20) — this document produces the recommendation those tickets act
on, not the implementation.

---

## 2. Information Flow

### 2.1 What is collected/read

Per TECHNICAL_SPECIFICATION.md §3 and Business Case §3.8, the module reads or derives,
per debtor record:

| Field group | Examples |
|---|---|
| Identity | Student ID, name, financial year, programme |
| Funding | Funding source (self / government-NSFAS / private-bursary); funding status (e.g. NSFAS pending/declined/lapsed, Bursary partial/confirmed/overpaid/lapsed, Self-funded) |
| Payment behaviour | Missed-instalment count, last-payment date, existing arrangement status |
| Balance/ageing | Amounts in current / 30 / 60 / 90 / 120+ day buckets |
| Credit cases | Credit-since date, days owing, reason for credit |
| Aggregate | Registered headcount per financial year (from Student Records, for coverage calculations only — not personal information at the aggregate level) |

Funding status in particular can reveal a student's socio-economic circumstances
(e.g. NSFAS reliance) and is the field most likely to be considered sensitive beyond
ordinary financial data.

### 2.2 Sources (read) and write-back

- **Read:** ITS Integrator — Debtors, Student Fees, Student Funding, Student Records,
  Cashiering (reconciliation only).
- **Write-back:** every agent action, its rationale, and its evidence is written to the
  student's ITS Integrator record. This write-back *is* the audit trail
  (TECHNICAL_SPECIFICATION.md §4.6, §7 Auditability) and must itself be treated as
  personal information subject to the same conditions as the source data.

### 2.3 Who sees it

- **Decision engine (automated):** reads all fields nightly to score every debtor;
  no human view unless a debtor is "picked up."
- **Debt officers:** view picked-up cases and take engagement actions. Scope of what
  an individual officer can see is **not yet enforced** — this is exactly the gap #18
  is opening to close, and Section 5 below is this assessment's input to that design.
- **Compliance/audit:** view the activity log and officer decision fields as the audit
  trail.
- **Downstream/external:** Section 3.9 of the Business Case notes future engagement
  channels (SMS/WhatsApp gateway) and a hand-over integration to Adapt Connect
  (collections) for registration-hold cases — both are out of scope for this
  assessment's data-flow mapping until those integrations are built, but should be
  re-assessed under this same framework when they are (flagged in Section 7).

### 2.4 Retention (today)

No retention period is currently defined or enforced anywhere in the system
(TECHNICAL_SPECIFICATION.md §7, Open Item 7). Section 6 below is this assessment's
draft recommendation to close that gap.

---

## 3. Assessment Against POPIA's Eight Conditions

| # | Condition | Assessment |
|---|---|---|
| 1 | **Accountability** | The module operates within ITS Integrator, an existing system of record; this assessment is itself part of demonstrating accountability for a new automated-decision use case layered on top of it. **Gap:** no named accountable owner (Information Officer sign-off) yet exists for this specific module — see Section 7. |
| 2 | **Processing Limitation** | Processing is limited to fields necessary to score debt risk and recommend an action (Section 2.1) — no additional personal information beyond what Debtors/Fees/Funding/Records/Cashiering already hold is introduced. Processing is not excessive relative to the stated purpose (proactive debt management), consistent with POPIA's minimality principle. |
| 3 | **Purpose Specification** | Purpose is explicit and narrow: risk-score every registered student with a balance, and recommend a policy-referenced action for human review. This is documented in the Business Case and Technical Specification, both of which predate this assessment and are available for a data subject request context. |
| 4 | **Further Processing Limitation** | The write-back of agent actions to the student's ITS Integrator record is compatible with the original purpose (debt collection / student finance administration) — it does not repurpose data for an unrelated use (e.g. marketing, academic performance profiling). No further-processing risk identified beyond what the "Downstream/external" note in Section 2.3 already flags for future re-assessment. |
| 5 | **Information Quality** | The Business Case's own Risk & Mitigation table names data quality as a risk in its own right ("the risk score is only as reliable as the ageing and funding-status data") with a named mitigation (pre-go-live reconciliation pass, nightly reconciliation-exceptions report). From a POPIA lens, inaccurate funding-status data could drive a wrong, higher-impact automated recommendation (e.g. a registration hold on a student who is not actually in default) — this raises the stakes of that existing mitigation and it should be treated as a POPIA-relevant control, not purely a data-quality one. |
| 6 | **Openness** | **Gap, currently open.** There is no documented process yet for how a student is informed that their financial/funding data feeds an automated risk-scoring and recommendation system (a POPIA/PAIA notification obligation). This should be captured as a follow-up item (Section 7) — likely a addition to existing student communications (e.g. registration terms, a privacy notice update) rather than new engineering work. |
| 7 | **Security Safeguards** | Existing ITS Integrator access controls apply, but this module introduces a new access surface (the debt officer worklist and case view) that has **no scoping today** — any officer can see any debtor. This is the core gap #18 exists to close, and this assessment's position is in Section 5. Audit logging of every access and action (§7 Auditability) is a named control already in the technical spec and should remain non-negotiable regardless of autonomy level. |
| 8 | **Data Subject Participation** | No new mechanism is introduced or required beyond a student's existing right to query their own Debtors/Fees/Funding record through existing institutional channels — the automated recommendation and its rationale, once write-backed to the student's record (§4.6), should be retrievable through the same existing subject-access channels. No gap identified here beyond ensuring the write-back format itself is intelligible if ever surfaced to a student (a documentation note for whoever builds the write-back, not a new process). |

---

## 4. Risk Register

Extends the Business Case's Risk & Mitigation table (§6) with a privacy-specific lens;
rows already named there are carried through, with POPIA-condition references added.

| Risk | Likelihood | Impact | Mitigation | Owner | POPIA condition(s) |
|---|---|---|---|---|---|
| Data quality drives a wrong automated recommendation (e.g. incorrect registration hold) | Medium | High | Pre-go-live reconciliation pass; nightly reconciliation-exceptions report (existing Business Case mitigation) | Engineering / Debtors | Information Quality |
| No officer portfolio scoping — any officer can view any student's financial position | High (until #18 ships) | High | Implement caseload-scoped access per Section 5 recommendation | Engineering (#18) | Security Safeguards |
| No defined retention period — case history/audit data could be kept indefinitely or deleted prematurely | High (until #20 ships) | Medium | Implement retention per Section 6 recommendation | Engineering (#20) | Processing Limitation |
| Students not informed their financial data feeds an automated decision system | High (unaddressed today) | Medium | Update student-facing privacy notice / communications (follow-up, Section 7) | Compliance / Registrar | Openness |
| Funding-status weighting effectively penalises a student for a delay outside their control (e.g. NSFAS pending) | Medium | High | Student Funding office review/sign-off of weighting table; human approval required on every funding-related action during rollout regardless of autonomy level (existing Business Case mitigation) | Student Funding office | Processing Limitation, fairness (not a POPIA condition per se, but adjacent) |
| Autonomy over-reach — an automated action taken without adequate human oversight | Low (mitigated by design) | High | Registration holds and refunds permanently excluded from autonomous action at any level (existing Business Case mitigation, TECHNICAL_SPECIFICATION.md §5.10) | Engineering | Accountability |
| No named Information Officer / sign-off authority for this specific module | High (currently true) | Medium (blocks go-live gate, not a live processing risk) | Assign a named reviewer (follow-up issue, Section 7) | Compliance | Accountability |

---

## 5. Recommendation → Officer Portfolio Access Scoping (input to #18)

**Draft recommendation:** scope officer portfolio access by **explicit caseload
assignment** — the narrowest of the options TECHNICAL_SPECIFICATION.md §7 lists
(campus / programme / caseload assignment).

Rationale (privacy-minimisation lens, per Processing Limitation and Security
Safeguards, Section 3): campus- or programme-level scoping still exposes an officer to
every student's financial position within a large population, most of whom they will
never actually work a case for. A caseload-assignment model means an officer's default
visible set already matches the set they are expected to act on, so no unnecessary
individual can access financial and funding information belonging to a student they
have no role in serving.

**This is a draft, privacy-lens position, not a final decision.** #18's own acceptance
criteria call for the scoping model to be "agreed with Finance/Debtors management" —
that operational conversation (workload balancing, coverage during officer absence,
how a caseload gets assigned in the first place) is #18's to own. This assessment's
role is to ensure the privacy-minimisation option is on the table and its rationale is
recorded, not to pre-empt that discussion.

---

## 6. Recommendation → Retention Period (input to #20)

**Draft recommendation:** retain case history and activity-log records for
**7 years after the student's last financial-year record with the institution**,
pending confirmation against an actual institutional records-management policy — none
was available to this assessment (unconfirmed either way at time of writing).

Rationale: 7 years is a commonly used general default for financial/audit records
under South African record-keeping norms (e.g. aligned with typical tax/financial
record retention practice) and satisfies POPIA's Processing Limitation condition's
"no longer than necessary" test by tying retention to a concrete, bounded event (last
financial-year record) rather than "indefinitely." It also comfortably covers
TECHNICAL_SPECIFICATION.md §7's requirement that the activity log and decision fields
be "immutable and permanently retained" as the audit trail **for the period the
institution needs to defend a decision** — which in practice is not truly "forever"
but bounded by applicable prescription/limitation periods.

**This is explicitly a placeholder pending compliance confirmation** — the user
confirmed no institutional retention policy is currently known to exist or has been
located. #20 should not treat this figure as settled; it should be validated against
the institution's actual records-management policy (or against legal advice, if no
such policy exists yet) before being implemented as an enforced retention rule.

---

## 7. Follow-up Items

The following gaps surfaced by this assessment are not resolved here and need a named
owner and their own tracking:

1. **Assign an Information Officer / compliance sign-off authority for this module.**
   Blocks closing this assessment's sign-off (Section 8) and, by extension, the
   module's go-live gate. No owner identified yet — needs a decision from whoever
   holds that role for the institution before this can move forward.
2. **Confirm (or establish) an institutional records-retention policy** to validate or
   correct the draft 7-year recommendation in Section 6. No existing policy confirmed
   at time of writing — needs input from compliance/records-management before #20
   treats this figure as final.
3. **Student-facing openness/notification** — update the relevant privacy
   notice/student communications to disclose that financial and funding data feeds an
   automated risk-scoring and recommendation system (Section 3, condition 6). Owner:
   Compliance / Registrar, not engineering — raised here as a gap, not filed as an
   engineering issue.
4. **Re-assess this document** when the SMS/WhatsApp engagement-channel gateway and
   the Adapt Connect hand-over integration are built (Section 2.3) — both introduce
   new external data recipients not covered by this assessment's scope.

---

## 8. Sign-off

**Status: PENDING.** No Information Officer / compliance reviewer has been identified
for this module yet (see Follow-up item 1). This section is a placeholder to be
completed once a reviewer is assigned — it must be completed before the module
processes real student data in production (TECHNICAL_SPECIFICATION.md §7).

| Field | Value |
|---|---|
| Reviewer name/role | _Not yet assigned_ |
| Date reviewed | _—_ |
| Decision | _—_ |
| Conditions attached to approval, if any | _—_ |
