/**
 * ============================
 * Dashboard Messages
 * ============================
 */

export const DASHBOARD_MESSAGES = {
  FETCHED: "Dashboard data fetched successfully.",
} as const;

/**
 * ============================
 * Dashboard Defaults
 * ============================
 */

export const DASHBOARD_DEFAULTS = {
  PERIOD: "week",
  RECENT_INQUIRIES_LIMIT: 5,
} as const;

/**
 * ============================
 * Dashboard Periods
 * ============================
 */

export const DASHBOARD_PERIODS = [
  "week",
  "month",
  "year",
] as const;

/**
 * ============================
 * Dashboard Period Labels
 * ============================
 */

export const DASHBOARD_PERIOD_LABELS = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
} as const;