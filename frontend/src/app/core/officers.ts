import { Officer } from './models';

/**
 * The debt-recovery officers a case can be assigned to (issue #18), matching the
 * BA-confirmed operational structure (3 teams; one manager, `docs/compliance/
 * popia-impact-assessment.md` §5) — placeholder data standing in for a real HR/roster
 * source. `nomsa-mahlangu` is the default signed-in officer, matching the display name
 * this app used before this ticket.
 */
export const OFFICERS: Officer[] = [
  { id: 'nomsa-mahlangu', name: 'Nomsa Mahlangu', team: 'Team A', role: 'officer' },
  { id: 'sibusiso-khoza', name: 'Sibusiso Khoza', team: 'Team A', role: 'officer' },
  { id: 'anele-dube', name: 'Anele Dube', team: 'Team B', role: 'officer' },
  { id: 'priya-naidoo', name: 'Priya Naidoo', team: 'Team B', role: 'officer' },
  { id: 'thato-mokoena', name: 'Thato Mokoena', team: 'Team C', role: 'officer' },
  { id: 'grace-van-rooyen', name: 'Grace van Rooyen', team: 'Team C', role: 'manager' },
];
