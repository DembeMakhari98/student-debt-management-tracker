import { Debtor } from './models';

/** Programme names, keyed the same way as the reference prototype. */
const PROGS = {
  elec: 'NC(V) L4 Electrical Infrastructure Construction',
  fin: 'Report 191 N4 Financial Management',
  eng: 'NC(V) L3 Engineering and Related Design',
  off: 'NC(V) L2 Office Administration',
  hosp: 'NC(V) L4 Hospitality',
  mkt: 'Report 191 N5 Marketing Management',
  hr: 'Report 191 N6 Human Resource Management',
  civ: 'NC(V) L3 Civil Engineering and Building Construction',
  bus: 'Report 191 N6 Business Management',
};

/**
 * The same demonstration book as the prototype (2022–2026) — this is placeholder data standing
 * in for a live nightly extract from Debtors / Student Fees / Student Funding / Cashiering
 * (issue #2). Replace this file with a real API-backed data source when the backend is wired up.
 *
 * `assignedOfficer` (issue #18) is round-robined across the 6 mock officers in `officers.ts` —
 * placeholder caseload data, not a real roster.
 */
export const DEBTORS: Debtor[] = [
  /* ---- 2026 ---- */
  { id: 'STU-100234', name: 'Thabo Mokoena', funding: 'self', year: 2026, prog: PROGS.elec, fundStatus: 'Self-funded', missed: 2, lastPay: '12 Jun 2026', arrangement: null, assignedOfficer: 'nomsa-mahlangu', ageing: { current: 12000, d30: 8000, d60: 4000, d90: 0, d120: 0 } },
  { id: 'STU-100251', name: 'Lerato Naidoo', funding: 'gov', year: 2026, prog: PROGS.fin, fundStatus: 'NSFAS pending', missed: 3, lastPay: '04 Feb 2026', arrangement: null, assignedOfficer: 'sibusiso-khoza', ageing: { current: 0, d30: 0, d60: 15200, d90: 9800, d120: 22000 } },
  { id: 'STU-100288', name: 'Kagiso Botha', funding: 'private', year: 2026, prog: PROGS.eng, fundStatus: 'Bursary partial', missed: 1, lastPay: '18 Jul 2026', arrangement: null, assignedOfficer: 'anele-dube', ageing: { current: 6400, d30: 6400, d60: 0, d90: 0, d120: 0 } },
  { id: 'STU-100290', name: 'Sipho Dlamini', funding: 'self', year: 2026, prog: PROGS.off, fundStatus: 'Self-funded', missed: 0, lastPay: '05 Aug 2026', arrangement: null, assignedOfficer: 'priya-naidoo', ageing: { current: 3200, d30: 0, d60: 0, d90: 0, d120: 0 } },
  { id: 'STU-100301', name: 'Refilwe van Wyk', funding: 'gov', year: 2026, prog: PROGS.hosp, fundStatus: 'NSFAS declined', missed: 4, lastPay: null, arrangement: 'Defaulted', assignedOfficer: 'thato-mokoena', ageing: { current: 0, d30: 0, d60: 0, d90: 11500, d120: 33500 } },
  { id: 'STU-100312', name: 'Palesa Khumalo', funding: 'private', year: 2026, prog: PROGS.mkt, fundStatus: 'Bursary confirmed', missed: 0, lastPay: '01 Aug 2026', arrangement: null, assignedOfficer: 'grace-van-rooyen', ageing: { current: 9000, d30: 0, d60: 0, d90: 0, d120: 0 } },
  { id: 'STU-100333', name: 'Ayanda Pillay', funding: 'self', year: 2026, prog: PROGS.hr, fundStatus: 'Self-funded', missed: 3, lastPay: '20 Mar 2026', arrangement: null, assignedOfficer: 'nomsa-mahlangu', ageing: { current: 0, d30: 0, d60: 2600, d90: 2600, d120: 5200 } },
  { id: 'STU-100360', name: 'Naledi Mahlangu', funding: 'gov', year: 2026, prog: PROGS.civ, fundStatus: 'NSFAS pending', missed: 1, lastPay: '10 Jul 2026', arrangement: null, assignedOfficer: 'sibusiso-khoza', ageing: { current: 0, d30: 14000, d60: 0, d90: 0, d120: 0 } },
  { id: 'STU-100341', name: 'Mpho Sithole', funding: 'self', year: 2026, prog: PROGS.elec, fundStatus: 'Self-funded', missed: 0, lastPay: '28 Jul 2026', arrangement: null, assignedOfficer: 'anele-dube', creditSince: '28 Jul 2026', creditDays: 24, creditReason: 'Duplicate EFT receipted twice', ageing: { current: -4200, d30: 0, d60: 0, d90: 0, d120: 0 } },
  { id: 'STU-100355', name: 'Jessica Adams', funding: 'private', year: 2026, prog: PROGS.fin, fundStatus: 'Bursary overpaid', missed: 0, lastPay: '22 Jul 2026', arrangement: null, assignedOfficer: 'priya-naidoo', creditSince: '12 Feb 2026', creditDays: 190, creditReason: 'Bursary award exceeded assessed fees', ageing: { current: -11800, d30: 0, d60: 0, d90: 0, d120: 0 } },

  /* ---- 2025 ---- */
  { id: 'STU-098012', name: 'Dineo Nkosi', funding: 'self', year: 2025, prog: PROGS.eng, fundStatus: 'Self-funded', missed: 4, lastPay: '14 Apr 2025', arrangement: 'Defaulted', assignedOfficer: 'thato-mokoena', ageing: { current: 0, d30: 0, d60: 0, d90: 6200, d120: 18800 } },
  { id: 'STU-098044', name: 'Christo Meyer', funding: 'gov', year: 2025, prog: PROGS.hosp, fundStatus: 'NSFAS lapsed', missed: 5, lastPay: null, arrangement: null, assignedOfficer: 'grace-van-rooyen', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 41200 } },
  { id: 'STU-098077', name: 'Farhana Jacobs', funding: 'private', year: 2025, prog: PROGS.mkt, fundStatus: 'Bursary partial', missed: 2, lastPay: '09 Sep 2025', arrangement: null, assignedOfficer: 'nomsa-mahlangu', ageing: { current: 0, d30: 5000, d60: 5000, d90: 0, d120: 0 } },
  { id: 'STU-098090', name: 'Bongani Zulu', funding: 'self', year: 2025, prog: PROGS.off, fundStatus: 'Self-funded', missed: 3, lastPay: '02 May 2025', arrangement: null, assignedOfficer: 'sibusiso-khoza', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 9600 } },
  { id: 'STU-098111', name: 'Gerrit Petersen', funding: 'gov', year: 2025, prog: PROGS.civ, fundStatus: 'NSFAS pending', missed: 4, lastPay: '17 Mar 2025', arrangement: null, assignedOfficer: 'anele-dube', ageing: { current: 0, d30: 0, d60: 8800, d90: 8800, d120: 15000 } },
  { id: 'STU-098140', name: 'Hlengiwe Maluleke', funding: 'private', year: 2025, prog: PROGS.hr, fundStatus: 'Bursary overpaid', missed: 0, lastPay: '30 Oct 2025', arrangement: null, assignedOfficer: 'priya-naidoo', creditSince: '30 Oct 2025', creditDays: 212, creditReason: 'Sponsor paid after the student had settled', ageing: { current: -7300, d30: 0, d60: 0, d90: 0, d120: 0 } },
  { id: 'STU-098155', name: 'Imraan September', funding: 'self', year: 2025, prog: PROGS.elec, fundStatus: 'Self-funded', missed: 3, lastPay: '21 Jun 2025', arrangement: null, assignedOfficer: 'thato-mokoena', ageing: { current: 0, d30: 0, d60: 0, d90: 3400, d120: 12600 } },

  /* ---- 2024 ---- */
  { id: 'STU-095003', name: 'Oratile Mabaso', funding: 'gov', year: 2024, prog: PROGS.hosp, fundStatus: 'NSFAS declined', missed: 6, lastPay: null, arrangement: 'Defaulted', assignedOfficer: 'grace-van-rooyen', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 52000 } },
  { id: 'STU-095021', name: 'Quinton Fourie', funding: 'self', year: 2024, prog: PROGS.eng, fundStatus: 'Self-funded', missed: 5, lastPay: '08 Feb 2024', arrangement: null, assignedOfficer: 'nomsa-mahlangu', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 23400 } },
  { id: 'STU-095050', name: 'Elias Ngwenya', funding: 'private', year: 2024, prog: PROGS.bus, fundStatus: 'Bursary lapsed', missed: 4, lastPay: '19 Mar 2024', arrangement: null, assignedOfficer: 'sibusiso-khoza', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 14200 } },
  { id: 'STU-095066', name: 'Vanessa Coetzee', funding: 'self', year: 2024, prog: PROGS.off, fundStatus: 'Self-funded', missed: 0, lastPay: '11 Nov 2024', arrangement: null, assignedOfficer: 'anele-dube', creditSince: '11 Nov 2024', creditDays: 168, creditReason: 'Module cancellation credited after payment', ageing: { current: -2100, d30: 0, d60: 0, d90: 0, d120: 0 } },

  /* ---- 2023 ---- */
  { id: 'STU-091009', name: 'Wandile Mthembu', funding: 'gov', year: 2023, prog: PROGS.civ, fundStatus: 'NSFAS lapsed', missed: 6, lastPay: null, arrangement: null, assignedOfficer: 'priya-naidoo', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 38700 } },
  { id: 'STU-091033', name: 'Yolanda Steyn', funding: 'self', year: 2023, prog: PROGS.hr, fundStatus: 'Self-funded', missed: 5, lastPay: '06 Apr 2023', arrangement: null, assignedOfficer: 'thato-mokoena', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 16900 } },
  { id: 'STU-091074', name: 'Zodwa Mokgadi', funding: 'private', year: 2023, prog: PROGS.mkt, fundStatus: 'Bursary lapsed', missed: 4, lastPay: '27 May 2023', arrangement: null, assignedOfficer: 'grace-van-rooyen', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 8100 } },

  /* ---- 2022 ---- */
  { id: 'STU-088002', name: 'Unathi Radebe', funding: 'gov', year: 2022, prog: PROGS.fin, fundStatus: 'NSFAS declined', missed: 6, lastPay: null, arrangement: null, assignedOfficer: 'nomsa-mahlangu', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 27500 } },
  { id: 'STU-088040', name: 'Xolani Booysen', funding: 'self', year: 2022, prog: PROGS.bus, fundStatus: 'Self-funded', missed: 5, lastPay: '15 Mar 2022', arrangement: null, assignedOfficer: 'sibusiso-khoza', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 11200 } },
];

export const YEARS: number[] = [2022, 2023, 2024, 2025, 2026];
