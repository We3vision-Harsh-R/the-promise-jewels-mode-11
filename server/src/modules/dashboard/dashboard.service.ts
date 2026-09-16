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

class DashboardService {
  /**
   * ============================
   * Public
   * ============================
   */

  async getDashboard(
    period: DashboardPeriod = DASHBOARD_DEFAULTS.PERIOD,
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

    const [
      totalCollections,
      collectionsThisMonth,

      totalBrands,
      inactiveBrands,

      totalExhibitions,
      upcomingExhibitions,

      totalInquiries,
      newInquiries,

      recentInquiries,
      inquiryTrend,
    ] = await Promise.all([
      dashboardRepository.countCollections(),

      dashboardRepository.countCollectionsCreatedAfter(
        monthStart,
      ),

      dashboardRepository.countBrands(),

      dashboardRepository.countInactiveBrands(),

      dashboardRepository.countExhibitions(),

      dashboardRepository.countUpcomingExhibitions(
        now,
      ),

      dashboardRepository.countInquiries(),

      dashboardRepository.countNewInquiries(),

      dashboardRepository.findRecentInquiries(
        DASHBOARD_DEFAULTS.RECENT_INQUIRIES_LIMIT,
      ),

      dashboardRepository.getInquiryTrend(
        trendStartDate,
        trendEndDate,
      ),
    ]);

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