# POPIA Impact Assessment — Student Pro-active Debt Management Tracker

**Ticket:** [#19](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/19)
**Status:** Reviewer identified, sign-off pending (due 2026-09-22) — see Section 8.
Access-scoping (Section 5) and retention (Section 6) recommendations are confirmed;
see Section 7 for what's still open.
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
| No officer portfolio scoping — any officer can view any student's financial position | High (until #18 ships) | High | Caseload-scoped, tiered access **model confirmed** by Finance/Debtors management (Section 5) — implementation still pending | Engineering (#18) | Security Safeguards |
| No defined retention period — case history/audit data could be kept indefinitely or deleted prematurely | Medium (7yr figure now confirmed; drops once #20 ships) | Medium | 7-year retention **confirmed** by BA compliance answer (Section 6) — implementation still pending | Engineering (#20) | Processing Limitation |
| Students not informed their financial data feeds an automated decision system | High (unaddressed today; plan and deadline now set — 2026-09-25) | Medium | Privacy notice across 4 channels, per BA answer (Follow-up item 3) — **no tracking issue filed yet** | Compliance / Registrar | Openness |
| Funding-status weighting effectively penalises a student for a delay outside their control (e.g. NSFAS pending) | Medium (recommendation given; formal sign-off due 2026-09-30) | High | Keep weights, add contextual flags + officer override + monthly fairness audit ("Option B", BA answer, Follow-up item 5); human approval required on every funding-related action during rollout regardless of autonomy level (existing Business Case mitigation) | Student Funding office | Processing Limitation, fairness (not a POPIA condition per se, but adjacent) |
| Autonomy over-reach — an automated action taken without adequate human oversight | Low (mitigated by design) | High | Registration holds and refunds permanently excluded from autonomous action at any level (existing Business Case mitigation, TECHNICAL_SPECIFICATION.md §5.10, implemented in #8) | Engineering | Accountability |
| No named Information Officer / sign-off authority for this specific module | Medium (reviewer body identified — Registrar's Office; named individual and actual sign-off still pending, due 2026-09-22) | Medium (blocks go-live gate, not a live processing risk) | Sign-off scheduled per Section 8 | Compliance | Accountability |

---

## 5. Recommendation → Officer Portfolio Access Scoping (input to #18)

**CONFIRMED by Finance/Debtors management (BA answer, 2026-09-08).** Business Analyst
DembeMakhari98 reviewed this section's original draft (below) against actual
operations and confirmed a **hybrid tiered model**, satisfying #18's "agreed with
Finance/Debtors management" acceptance criterion:

| Level | Scope | Approval needed |
|---|---|---|
| 1 (Narrow, primary) | Officer sees only students on their own caseload | None — default |
| 2 (Medium) | Same-team officers can view peer cases (vacation/absence coverage) | None — same-team access |
| 3 (Broad, override) | Debt manager escalates to full portfolio view (performance monitoring) | Manager approval required; logged |

**Explicitly never permitted:** campus-wide access, programme-wide access, or a
finance officer viewing all students — all ruled too broad / unnecessary exposure by
the BA review.

**Operational confirmation:** caseload assignment already matches how this
institution runs debt recovery today — cases are assigned individually to officers,
who are organised into 3 debt recovery teams, and a supervisor needs the Level 3
portfolio view for performance monitoring. This is not a new operating model; #18 is
building access control around an assignment structure that already exists.

Original privacy-minimisation rationale (still the basis for Level 1 being the
default, narrowest tier): campus- or programme-level scoping would expose an officer
to every student's financial position within a large population, most of whom they
will never actually work a case for. Caseload assignment keeps an officer's default
visible set matching the set they're expected to act on.

---

## 6. Recommendation → Retention Period (input to #20)

**CONFIRMED by BA compliance answer (2026-09-08):** retain case history and
activity-log records for **7 years after the end of a student's final financial
year** — this assessment's original draft figure (below) is correct and #20 can
implement it as the enforced rule, subject only to the institutional-policy
cross-check still pending (Follow-up item 2).

| Phase | Timeline | Action |
|---|---|---|
| Active (enrolled) | Indefinite | Keep all records; full access for officers |
| Post-graduation | 7 years after final financial year | Read-only access; audit/compliance only |
| After retention | Past the 7-year mark | Permanent deletion, with a certificate of destruction |

Rationale (BA-supplied, corroborating the original draft's basis): SARS requires a
5-year minimum on financial records; AGSA sets a 7-year minimum for audit trails;
7 years is the standard post-transaction retention window among South African
financial institutions; students can challenge a decision up to 2 years after; and
typical debt-recovery cycles in South Africa run 3–6 years. 7 years comfortably
covers all of these and satisfies POPIA's Processing Limitation "no longer than
necessary" test by tying retention to a concrete, bounded event rather than
"indefinitely."

Two loose ends remain, tracked as action items in the BA's answer, not blockers to
#20 starting implementation: confirming this doesn't conflict with an existing
institutional records-management policy (owner: Records Management, due 2026-09-10),
and Finance Director confirmation (due 2026-09-12).

---

## 7. Follow-up Items

Status as of the BA's 2026-09-08 answer to this assessment's open questions:

1. **Assign an Information Officer / compliance sign-off authority for this module —
   IN PROGRESS, no longer unowned.** The Registrar's Office (Information
   Officer/Compliance Officer) has been identified as the designated reviewer — they
   hold institutional authority over student records management and POPIA
   compliance. Written sign-off is due **2026-09-22** (blocking — see Section 8) after
   a formal review meeting scheduled for 2026-09-15.
2. **Confirm the institutional records-retention policy — RESOLVED, 7 years
   confirmed** (Section 6). Only the cross-check against any existing institutional
   policy (Records Management, due 2026-09-10) and Finance Director confirmation
   (due 2026-09-12) remain — non-blocking to #20 starting implementation.
3. **Student-facing openness/notification — CONFIRMED AS A GAP, still not done,
   now has an owner and a plan.** No such process exists today. A privacy notice
   (what data, who processes it, how it's used, retention, student rights, contact)
   must go live across four channels — registration privacy notice, student portal,
   first debt SMS, and debt-office website/signage — all due **2026-09-25**. Owner:
   Registrar/Debt Management Office, not engineering. **This is compliance-mandated
   work with no existing GitHub issue tracking it** — recommend filing a new issue
   before 2026-09-25 so it isn't lost.
4. **Re-assess this document** when the SMS/WhatsApp engagement-channel gateway and
   the Adapt Connect hand-over integration are built (Section 2.3) — unchanged,
   still future work, not addressed by the BA's answer.
5. **Funding-status weighting fairness review — AWAITING FORMAL SIGN-OFF.** The BA's
   answer recommends "Option B": keep the existing weights (they're predictively
   sound), but add contextual flags for officers (e.g. "High risk due to NSFAS delay
   — external factor"), allow an officer override/skip when funding is in process,
   and run a monthly fairness audit. Student Funding Director sign-off is due
   2026-09-30; if approved, the contextual-flags work (Engineering, due 2026-09-25)
   is new scope not currently tracked by any issue — likely folds into #7/#8's
   decision-engine and recommendation-display work once confirmed.

---

## 8. Sign-off

**Status: REVIEWER IDENTIFIED, SIGN-OFF STILL PENDING.** The Registrar's Office
Information Officer/Compliance Officer has been designated as the sign-off authority
(BA answer, 2026-09-08 — see Follow-up item 1). Written sign-off is due **2026-09-22**
and is a **blocking** requirement — this module must not process real student data in
production before this section is completed (TECHNICAL_SPECIFICATION.md §7). Deploying
without it is a POPIA violation with institutional exposure up to 10% of annual
revenue, per the BA's risk note.

| Field | Value |
|---|---|
| Reviewer name/role | Registrar's Office — Information Officer/Compliance Officer (named individual TBC — due 2026-09-10) |
| Date reviewed | _Scheduled 2026-09-15 — not yet held_ |
| Decision | _Pending_ |
| Conditions attached to approval, if any | _—_ |

**Pre-launch compliance checklist** (BA answer, 2026-09-08 — all still outstanding):

- [ ] POPIA sign-off — Registrar's Info Officer approval (due 2026-09-22)
- [ ] Retention policy confirmed against institutional policy (due 2026-09-15)
- [ ] Access controls — caseload scoping implemented, #18 (due 2026-10-07)
- [ ] Student privacy notice live (due 2026-09-25)
- [ ] Funding fairness review sign-off (due 2026-09-30)
- [ ] Audit logging of case access and decisions confirmed in place
