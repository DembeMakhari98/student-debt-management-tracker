/**
 * Debt Tracker Type Definitions
 *
 * Comprehensive type definitions for the Debt Management Tracker workspace.
 * These types align with the SDD_Issue_11 specification.
 */

/**
 * Represents a single student debt case
 */
export interface Case {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  debtAmount: number;
  fundingSource: 'NSFAS' | 'PRIVATE' | 'OTHER';
  riskBand: RiskBand;
  riskScore: number; // 0-100, used for sorting picked-up cases
  status: 'PICKED_UP' | 'REFUND_QUEUE' | 'NOT_PICKED_UP';
  actionTaken: string; // e.g., "Payment Plan Established", "Contact Attempted"
  actionDate: string; // ISO 8601 date string
  lastContactDate: string | null; // ISO 8601 date string or null
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  notes?: string;
  creditAmount?: number; // For refund queue items
  refundStatus?: 'PENDING' | 'PROCESSED' | 'FAILED';
}

/**
 * Risk band classification for debt cases
 * Determines priority level for debt collection
 */
export type RiskBand = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Represents the risk level with score range
 */
export interface RiskBandInfo {
  band: RiskBand;
  minScore: number;
  maxScore: number;
  label: string;
  color: string;
}

/**
 * Filter options for the workspace
 */
export interface DebtTrackerFilter {
  yearFrom?: number;
  yearTo?: number;
  fundingSource?: 'NSFAS' | 'PRIVATE' | 'OTHER' | 'ALL';
  riskBand?: RiskBand | 'ALL';
  status?: 'PICKED_UP' | 'REFUND_QUEUE' | 'NOT_PICKED_UP' | 'ALL';
  searchQuery?: string; // Student name or ID search
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Partitioned cases organized by status
 * Used for rendering three separate lists
 */
export interface PartitionedCases {
  pickedUp: Case[];
  refundQueue: Case[];
  notPickedUp: Case[];
  totalCases: number;
  pickedUpCount: number;
  refundQueueCount: number;
  notPickedUpCount: number;
}

/**
 * Paginated partitioned cases
 * Includes pagination info for each status group
 */
export interface PaginatedPartitionedCases extends PartitionedCases {
  pagination: {
    pickedUp: PaginationInfo;
    refundQueue: PaginationInfo;
    notPickedUp: PaginationInfo;
  };
}

/**
 * Debt Tracker Redux State
 * Complete state tree for the debt tracker feature
 */
export interface DebtTrackerState {
  // Data
  cases: Case[];
  partitionedCases: PartitionedCases | null;
  paginatedCases: PaginatedPartitionedCases | null;

  // Filters
  filters: DebtTrackerFilter;

  // Pagination
  pagination: {
    pickedUp: PaginationInfo;
    refundQueue: PaginationInfo;
    notPickedUp: PaginationInfo;
  };

  // Loading and error states
  loading: boolean;
  error: string | null;

  // Async operation states
  fetchStatus: 'idle' | 'loading' | 'succeeded' | 'failed';

  // Selected items (for batch operations if needed)
  selectedCaseIds: string[];
}

/**
 * API Request/Response Types
 */
export interface FetchCasesRequest {
  yearFrom?: number;
  yearTo?: number;
  fundingSource?: string;
  page?: number;
  pageSize?: number;
}

export interface FetchCasesResponse {
  data: Case[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  timestamp: string;
}

/**
 * Workspace statistics for dashboard
 */
export interface WorkspaceStats {
  totalCases: number;
  pickedUpCount: number;
  refundQueueCount: number;
  notPickedUpCount: number;
  totalDebtAmount: number;
  criticalRiskCount: number;
  averageRiskScore: number;
}

/**
 * Component Props Types
 */
export interface DebtTrackerWorkspaceProps {
  // Optional initial filters
  initialFilters?: DebtTrackerFilter;
}

export interface WorkspaceHeaderProps {
  stats?: WorkspaceStats;
  onRefresh?: () => void;
}

export interface PickedUpListProps {
  cases: Case[];
  isLoading?: boolean;
  error?: string | null;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}

export interface PickedUpListRowProps {
  case: Case;
  onSelect?: (caseId: string) => void;
  isSelected?: boolean;
}

export interface RefundQueueListProps {
  cases: Case[];
  isLoading?: boolean;
  error?: string | null;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}

export interface RefundQueueListRowProps {
  case: Case;
  onSelect?: (caseId: string) => void;
  isSelected?: boolean;
}

export interface NotPickedUpTableProps {
  cases: Case[];
  isLoading?: boolean;
  error?: string | null;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}

export interface NotPickedUpTableRowProps {
  case: Case;
  onSelect?: (caseId: string) => void;
  isSelected?: boolean;
}

export interface RiskBadgeProps {
  riskBand: RiskBand;
  riskScore: number;
  showScore?: boolean;
}

export interface StudentInfoProps {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
}

export interface FundingPillProps {
  fundingSource: 'NSFAS' | 'PRIVATE' | 'OTHER';
}

export interface SignalChipsProps {
  riskBand: RiskBand;
  daysNoContact?: number;
}

export interface ActionInfoProps {
  actionTaken: string;
  actionDate: string;
}

export interface StatusPillProps {
  status: 'PICKED_UP' | 'REFUND_QUEUE' | 'NOT_PICKED_UP';
  refundStatus?: 'PENDING' | 'PROCESSED' | 'FAILED';
}

export interface AmountDisplayProps {
  amount: number;
  label?: string;
  variant?: 'debt' | 'credit';
}

export interface CreditAmountDisplayProps {
  creditAmount: number;
  refundStatus?: 'PENDING' | 'PROCESSED' | 'FAILED';
}

export interface FiltersSectionProps {
  filters: DebtTrackerFilter;
  onFilterChange: (filters: DebtTrackerFilter) => void;
  isLoading?: boolean;
}

export interface PaginationControlProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  variant?: 'default' | 'compact';
}

/**
 * Hook return types
 */
export interface UseDebtTrackerFiltersReturn {
  filters: DebtTrackerFilter;
  setYearFilter: (yearFrom?: number, yearTo?: number) => void;
  setFundingFilter: (fundingSource?: string) => void;
  setRiskBandFilter: (riskBand?: RiskBand | string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

export interface UseCasesReturn {
  cases: Case[];
  partitionedCases: PartitionedCases | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseResponsiveBreakpointReturn {
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  isXxl: boolean;
  width: number;
}

/**
 * Const values for risk bands
 */
export const RISK_BANDS: Record<RiskBand, RiskBandInfo> = {
  CRITICAL: {
    band: 'CRITICAL',
    minScore: 80,
    maxScore: 100,
    label: 'Critical',
    color: '#d32f2f',
  },
  HIGH: {
    band: 'HIGH',
    minScore: 60,
    maxScore: 79,
    label: 'High',
    color: '#f57c00',
  },
  MEDIUM: {
    band: 'MEDIUM',
    minScore: 40,
    maxScore: 59,
    label: 'Medium',
    color: '#fbc02d',
  },
  LOW: {
    band: 'LOW',
    minScore: 0,
    maxScore: 39,
    label: 'Low',
    color: '#388e3c',
  },
};

/**
 * Responsive breakpoints (px)
 * Used in CSS media queries and JavaScript responsive logic
 */
export const BREAKPOINTS = {
  xs: 0,
  sm: 820,
  md: 900,
  lg: 1040,
  xl: 1240,
  xxl: 1500,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Funding sources
 */
export const FUNDING_SOURCES = ['NSFAS', 'PRIVATE', 'OTHER'] as const;

/**
 * Page sizes for pagination
 */
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
