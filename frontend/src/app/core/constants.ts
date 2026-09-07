import { AgeBucketDef, AutonomyLevelDef, FundDef, FundKey } from './models';

export const RED = 'var(--ai-red)';
export const RED_TEXT = 'var(--red-text)';
export const HONEY = 'var(--ai-honey)';
export const TEAL = 'var(--ai-teal)';
export const MID = 'var(--ai-mid-blue)';
export const BLUSH = 'var(--ai-blush)';
export const NAVY = 'var(--ai-navy)';

export const FUND: Record<FundKey, FundDef> = {
  self: { label: 'Self-funded', color: '#00A1ED', pill: 'self' },
  gov: { label: 'Government (NSFAS)', color: '#009FB0', pill: 'gov' },
  private: { label: 'Private / Bursary', color: '#FF9A00', pill: 'private' },
};

export const FUND_KEYS: FundKey[] = ['self', 'gov', 'private'];

export const AGE_BUCKETS: AgeBucketDef[] = [
  { key: 'current', label: 'Current', color: '#006690' },
  { key: 'd30', label: '30 days', color: '#65C7DE' },
  { key: 'd60', label: '60 days', color: '#FF9A00' },
  { key: 'd90', label: '90 days', color: '#EA3217' },
  { key: 'd120', label: '120+ days', color: '#C00042' },
];

/** Funding-status risk weights — business case §3.3. */
export const FUND_RISK: Record<string, number> = {
  'NSFAS declined': 16,
  'NSFAS lapsed': 15,
  'NSFAS pending': 12,
  'Bursary lapsed': 14,
  'Bursary partial': 8,
  'Bursary confirmed': 0,
  'Bursary overpaid': 0,
  'Self-funded': 4,
};

export const POLICY: Record<string, string> = {
  'Payment arrangement': 'FIN-04.2',
  'Hardship fund': 'FIN-07.1',
  'Registration hold': 'FIN-09.3',
  Refund: 'FIN-02.6',
  'Funding chase': 'FIN-05.4',
  'Reminder cadence': 'FIN-03.1',
  Monitor: 'FIN-01.0',
};

export const AGENTS: Record<string, string> = {
  'Payment arrangement': 'Intervention Planner',
  'Hardship fund': 'Funding Broker',
  'Registration hold': 'Assurance Agent',
  Refund: 'Assurance Agent',
  'Funding chase': 'Funding Broker',
  'Reminder cadence': 'Engagement Agent',
  Monitor: 'Risk Sentinel',
};

export const LEVELS: AutonomyLevelDef[] = [
  { name: '1 · Observe', hint: 'Score and report only' },
  { name: '2 · Recommend', hint: 'Human accepts every action' },
  { name: '3 · Act within policy', hint: 'Low-risk actions automatic' },
  { name: '4 · Act and report', hint: 'Full workflow, post-hoc review' },
];

/** Registered head-count per financial year — from Student Records. */
export const REGISTERED: Record<number, number> = {
  2022: 4210,
  2023: 4388,
  2024: 4562,
  2025: 4703,
  2026: 4812,
};

/** The last reconciliation the ageing is measured against. */
export const AS_AT = '21 Aug 2026';

/** The signed-in officer shown in the brand bar and stamped on every decision (issue #13). */
export const CURRENT_OFFICER = 'Nomsa Mahlangu';
