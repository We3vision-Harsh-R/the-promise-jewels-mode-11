import dashboardRepository from "./dashboard.repository.js";

import {
  DASHBOARD_DEFAULTS,
} from "./dashboard.constants.js";

import type {
  DashboardData,
  DashboardPeriod,
  InquiryTrend,
  RecentInquiry,
} from "./dashboard.types.js";

// The dashboard's answer, held for a short while. It is the same for everyone
// who may open it, and it costs a trip to a distant database. Cleared the
// moment anything is written through the API (see app.ts), so a count never
// lags behind something you just did; the time limit only covers changes made
// outside the API.
const DASHBOARD_TTL_MS = 30_000;
const dashboardCache = new Map<string, { data: DashboardData; expiresAt: number }>();

export function clearDashboardCache(): void {
  dashboardCache.clear();
}

class DashboardService {
  /**
   * ============================
   * Public
   * ============================
   */

  async getDashboard(
    period: DashboardPeriod = DASHBOARD_DEFAULTS.PERIOD,
  ): Promise<DashboardData> {
    const hit = dashboardCache.get(period);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const data = await this.loadDashboard(period);
    dashboardCache.set(period, { data, expiresAt: Date.now() + DASHBOARD_TTL_MS });
    return data;
  }

  private async loadDashboard(
    period: DashboardPeriod,
  ): Promise<DashboardData> {
    const now = new Date();

    /**
     * --------------------------------
     * Date ranges
     * --------------------------------
     */

    const {
      trendStartDate,
      trendEndDate,
    } = this.getTrendDateRange(
      period,
      now,
    );

    /**
     * --------------------------------
     * Collections month calculation
     * --------------------------------
     *
     * "This month" always means the
     * current calendar month.
     */

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

    /**
     * --------------------------------
     * Run independent queries together
     * --------------------------------
     *
     * These queries do not depend on
     * each other, so Promise.all()
     * reduces unnecessary waiting.
     */

    const overview = await dashboardRepository.overview(
      monthStart,
      now,
      DASHBOARD_DEFAULTS.RECENT_INQUIRIES_LIMIT,
      trendStartDate,
      trendEndDate,
    );

    const counts = overview.counts;
    const totalCollections = Number(counts.collections);
    const collectionsThisMonth = Number(counts.collectionsThisMonth);
    const totalBrands = Number(counts.brands);
    const inactiveBrands = Number(counts.inactiveBrands);
    const totalExhibitions = Number(counts.exhibitions);
    const upcomingExhibitions = Number(counts.upcomingExhibitions);
    const totalInquiries = Number(counts.inquiries);
    const newInquiries = Number(counts.newInquiries);

    // json_agg hands dates back as text; the formatting below wants Dates.
    const recentInquiries = overview.recent.map((r) => ({ ...r, createdAt: new Date(r.createdAt + (r.createdAt.endsWith("Z") ? "" : "Z")) }));
    const inquiryTrend = overview.trend.map((t) => ({ date: new Date(t.date + (t.date.endsWith("Z") ? "" : "Z")), count: t.count }));

    /**
     * --------------------------------
     * Format inquiry trends
     * --------------------------------
     */

    const formattedInquiryTrend: InquiryTrend[] =
      inquiryTrend.map((item) => ({
        date: this.formatDate(item.date),

        count: Number(item.count),
      }));

    /**
     * --------------------------------
     * Format recent inquiries
     * --------------------------------
     */

    const formattedRecentInquiries: RecentInquiry[] =
      recentInquiries.map((inquiry) => ({
        id: inquiry.id,

        name: inquiry.name,

        email: inquiry.email,

        phone: inquiry.phone,

        company: inquiry.company,

        message: inquiry.message,

        status: inquiry.status,

        createdAt:
          inquiry.createdAt.toISOString(),
      }));

    /**
     * --------------------------------
     * Final dashboard response
     * --------------------------------
     */

    return {
      summary: {
        collections: {
          total: totalCollections,

          thisMonth: collectionsThisMonth,
        },

        brands: {
          total: totalBrands,

          inactive: inactiveBrands,
        },

        exhibitions: {
          total: totalExhibitions,

          upcoming: upcomingExhibitions,
        },

        inquiries: {
          total: totalInquiries,

          new: newInquiries,
        },
      },

      inquiryTrends:
        formattedInquiryTrend,

      recentInquiries:
        formattedRecentInquiries,
    };
  }

  /**
   * ============================
   * Trend Date Range
   * ============================
   *
   * Determines the date range used
   * for the Inquiry Trends chart.
   */

  private getTrendDateRange(
    period: DashboardPeriod,
    now: Date,
  ): {
    trendStartDate: Date;
    trendEndDate: Date;
  } {
    const trendEndDate = new Date(now);

    let trendStartDate: Date;

    switch (period) {
      /**
       * ----------------------------
       * This Week
       * ----------------------------
       *
       * Last 7 calendar days,
       * including today.
       */

      case "week": {
        trendStartDate = new Date(now);

        trendStartDate.setDate(
          trendStartDate.getDate() - 6,
        );

        trendStartDate.setHours(
          0,
          0,
          0,
          0,
        );

        break;
      }

      /**
       * ----------------------------
       * This Month
       * ----------------------------
       */

      case "month": {
        trendStartDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        );

        break;
      }

      /**
       * ----------------------------
       * This Year
       * ----------------------------
       */

      case "year": {
        trendStartDate = new Date(
          now.getFullYear(),
          0,
          1,
        );

        break;
      }
    }

    return {
      trendStartDate,
      trendEndDate,
    };
  }

  /**
   * ============================
   * Date Formatter
   * ============================
   */

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}

export default new DashboardService();