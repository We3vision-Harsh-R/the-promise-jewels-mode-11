import { InquiryStatus, Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";

class DashboardRepository {
  /**
   * ============================
   * Collections
   * ============================
   */

  countCollections() {
    return prisma.collections.count();
  }

  countCollectionsCreatedAfter(date: Date) {
    return prisma.collections.count({
      where: {
        createdAt: {
          gte: date,
        },
      },
    });
  }

  /**
   * ============================
   * Brands
   * ============================
   */

  countBrands() {
    return prisma.brands.count();
  }

  countInactiveBrands() {
    return prisma.brands.count({
      where: {
        isActive: false,
      },
    });
  }

  /**
   * ============================
   * Exhibitions
   * ============================
   */

  countExhibitions() {
    return prisma.exhibitions.count();
  }

  countUpcomingExhibitions(date: Date) {
    return prisma.exhibitions.count({
      where: {
        startDate: {
          gte: date,
        },
      },
    });
  }

  /**
   * ============================
   * Inquiries
   * ============================
   */

  countInquiries() {
    return prisma.inquiries.count({
      where: {
        deletedAt: null,
      },
    });
  }

  countNewInquiries() {
    return prisma.inquiries.count({
      where: {
        deletedAt: null,
        status: InquiryStatus.NEW,
      },
    });
  }

  /**
   * ============================
   * Recent Inquiries
   * ============================
   */

  findRecentInquiries(limit: number) {
    return prisma.inquiries.findMany({
      where: {
        deletedAt: null,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: limit,

      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * ============================
   * Inquiry Trends
   * ============================
   *
   * PostgreSQL is used here because
   * the dashboard needs inquiries
   * grouped by date.
   *
   * We return raw date + count data
   * and let the service format it.
   */

  getInquiryTrend(
    startDate: Date,
    endDate: Date,
  ) {
    return prisma.$queryRaw<
      Array<{
        date: Date;
        count: bigint;
      }>
    >(Prisma.sql`
      SELECT
        DATE_TRUNC('day', "createdAt") AS "date",
        COUNT(*)::bigint AS "count"
      FROM "inquiries"
      WHERE
        "deletedAt" IS NULL
        AND "createdAt" >= ${startDate}
        AND "createdAt" < ${endDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY "date" ASC
    `);
  }
}

export default new DashboardRepository();