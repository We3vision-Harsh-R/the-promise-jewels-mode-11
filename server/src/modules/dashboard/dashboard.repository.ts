import { InquiryStatus, Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";

class DashboardRepository {
  /**
   * The eight headline counts in ONE round trip. They used to be eight
   * separate count queries; with the database a network hop away and a small
   * connection pool, the dashboard spent most of its time queueing for a
   * connection. Same filters as the individual counters below.
   */
  async countSummary(monthStart: Date, now: Date) {
    const [row] = await prisma.$queryRaw<
      Array<Record<
        | "collections" | "collectionsThisMonth" | "brands" | "inactiveBrands"
        | "exhibitions" | "upcomingExhibitions" | "inquiries" | "newInquiries",
        bigint
      >>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM "collections")::bigint AS "collections",
        (SELECT COUNT(*) FROM "collections" WHERE "createdAt" >= ${monthStart})::bigint AS "collectionsThisMonth",
        (SELECT COUNT(*) FROM "brands")::bigint AS "brands",
        (SELECT COUNT(*) FROM "brands" WHERE "isActive" = false)::bigint AS "inactiveBrands",
        (SELECT COUNT(*) FROM "exhibitions")::bigint AS "exhibitions",
        (SELECT COUNT(*) FROM "exhibitions" WHERE "startDate" >= ${now})::bigint AS "upcomingExhibitions",
        (SELECT COUNT(*) FROM "inquiries" WHERE "deletedAt" IS NULL)::bigint AS "inquiries",
        (SELECT COUNT(*) FROM "inquiries" WHERE "deletedAt" IS NULL AND "status" = 'NEW')::bigint AS "newInquiries"
    `);
    return row;
  }

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