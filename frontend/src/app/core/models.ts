/** Who was meant to be paying the balance — the three funding sources in the book. */
export type FundKey = 'self' | 'gov' | 'private';

/** Ageing bucket keys, oldest to newest independent, Current → 120+ days. */
export type BucketKey = 'current' | 'd30' | 'd60' | 'd90' | 'd120';

export interface Ageing {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d120: number;
}

/** One registered student's debt position for one financial year (technical spec §3.8). */
export interface Debtor {
  id: string;
  name: string;
  funding: FundKey;
  year: number;
  prog: string;
  fundStatus: string;
  missed: number;
  lastPay: string | null;
  arrangement: string | null;
  ageing: Ageing;
  creditSince?: string;
  creditDays?: number;
  creditReason?: string;
}

export type RiskBand = 'Watch' | 'Elevated' | 'High';

export interface Signal {
  t: string;
  hot: boolean;
}

export interface Term {
  k: string;
  v: string;
}

export type RecommendationStatus = 'Needs approval' | 'Agent acting' | 'Monitoring';

export interface Recommendation {
  type: string;
  action: string;
  status: RecommendationStatus;
  rationale: string;
  terms: Term[];
}

export interface ActivityEntry {
  t: string;
  m: string;
}

/** The fully-assembled case behind a Tracker row / case list item / case detail (issues #6, #7, #12). */
export interface CaseView {
  d: Debtor;
  score: number;
  band: RiskBand;
  debt: number;
  credit: number;
  signals: Signal[];
  rec: Recommendation;
  evidence: string[];
  activity: ActivityEntry[];
}

export interface AgeBucketDef {
  key: BucketKey;
  label: string;
  color: string;
}

export interface FundDef {
  label: string;
  color: string;
  pill: string;
}

export interface AutonomyLevelDef {
  name: string;
  hint: string;
}

export interface DebtSummary {
  debtors: Debtor[];
  credits: Debtor[];
  totalDebt: number;
  totalCredit: number;
  o90: number;
  registered: number;
  o90Pct: number;
  avg: number;
}

export type TabKey = 'home' | 'tracker' | 'cases' | 'ageing';
