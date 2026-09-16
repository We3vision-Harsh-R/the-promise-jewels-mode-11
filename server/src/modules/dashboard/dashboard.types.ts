/**
 * ============================
 * Dashboard Summary
 * ============================
 */

export interface DashboardSummary {
  collections: {
    total: number;
    thisMonth: number;
  };

  brands: {
    total: number;
    inactive: number;
  };

  exhibitions: {
    total: number;
    upcoming: number;
  };

  inquiries: {
    total: number;
    new: number;
  };
}

/**
 * ============================
 * Inquiry Trend
 * ============================
 */

export interface InquiryTrend {
  date: string;
  count: number;
}

/**
 * ============================
 * Recent Inquiry
 * ============================
 *
 * These fields are based only on the
 * current Prisma inquiries model.
 *
 * NOTE:
 * The current database does NOT contain
 * type/reference fields.
 */

export interface RecentInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  message: string;
  status: string;
  createdAt: string;
}

/**
 * ============================
 * Dashboard Response
 * ============================
 */

export interface DashboardData {
  summary: DashboardSummary;

  inquiryTrends: InquiryTrend[];

  recentInquiries: RecentInquiry[];
}

/**
 * ============================
 * Inquiry Trend Period
 * ============================
 */

export type DashboardPeriod =
  | "week"
  | "month"
  | "year";

/**
 * ============================
 * Dashboard Query
 * ============================
 */

export interface DashboardQuery {
  period: DashboardPeriod;
}