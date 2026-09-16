import { InquiryStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "../../database/prisma.js";
import { decryptRow, encryptForCreate, rowMatches } from "./inquiry.crypto.js";

interface FindManyParams {
  skip: number;
  take: number;
  search?: string;
  status?: InquiryStatus;
  sortBy?: keyof Prisma.inquiriesOrderByWithRelationInput;
  sortOrder?: Prisma.SortOrder;
}

interface FindAllParams {
  search?: string;
  status?: InquiryStatus;
  sortBy?: keyof Prisma.inquiriesOrderByWithRelationInput;
  sortOrder?: Prisma.SortOrder;
}

/**
 * Enquiries, with their personal data encrypted at rest.
 *
 * The shape of this repository changed when the columns did. `name`, `email`,
 * `phone`, `company` and `message` are ciphertext in the database, so:
 *
 *   - `WHERE name ILIKE '%…%'` cannot work and searching happens in Node
 *   - sorting by one of those columns would sort by ciphertext, so it is also
 *     done in Node
 *   - paging has to come after filtering, so LIMIT/OFFSET move in with them
 *
 * Only `status`, `deletedAt` and `createdAt` are still filtered and sorted by
 * the database, which is the whole point: the queryable columns are the ones
 * that say nothing about who the person is.
 *
 * See inquiry.crypto.ts for the scale at which this should be revisited.
 */
class InquiryRepository {
  /** Only the parts of a query the database can still answer. */
  private buildWhere(status?: InquiryStatus): Prisma.inquiriesWhereInput {
    return {
      deletedAt: null,
      ...(status && { status }),
    };
  }

  /** Columns the database can still sort by, because they are not encrypted. */
  private sortableInSql(field: string): field is "createdAt" | "updatedAt" | "status" {
    return field === "createdAt" || field === "updatedAt" || field === "status";
  }

  /**
   * Every enquiry this filter allows, decrypted, sorted and searched.
   *
   * One place, so `findMany`, `findAll` and `count` cannot disagree about what
   * matches — which they would if each rebuilt the filter itself.
   */
  private async resolve({
    search,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  }: FindAllParams) {
    const rows = await prisma.inquiries.findMany({
      where: this.buildWhere(status),
      // Sort in SQL when the column is readable; otherwise take a stable order
      // and re-sort below. Sorting by an encrypted column in SQL would order
      // by ciphertext, which is to say at random.
      orderBy: this.sortableInSql(sortBy as string)
        ? { [sortBy]: sortOrder }
        : { createdAt: "desc" },
    });

    let out = rows.map(decryptRow);

    if (search) out = out.filter((row) => rowMatches(row, search));

    if (!this.sortableInSql(sortBy as string)) {
      const dir = sortOrder === "asc" ? 1 : -1;
      out = [...out].sort((a, b) =>
        String(a[sortBy as keyof typeof a] ?? "").localeCompare(
          String(b[sortBy as keyof typeof b] ?? ""),
        ) * dir,
      );
    }

    return out;
  }

  /**
   * Creates an enquiry with its personal fields sealed.
   *
   * The id is generated here rather than by the database because it is part of
   * the AAD the values are bound to — the ciphertext cannot be produced
   * without knowing which row it belongs to.
   */
  async create(data: Prisma.inquiriesCreateInput) {
    const id = randomUUID();

    const row = await prisma.inquiries.create({
      data: { ...encryptForCreate(id, data), id },
    });

    // Decrypted on the way back out. Not for secrecy — the visitor just typed
    // these values — but because a create that answers with ciphertext is a
    // create whose response nothing can use, and the caller would have to know
    // this table is encrypted to make sense of it.
    return decryptRow(row);
  }

  async findById(id: string) {
    const row = await prisma.inquiries.findFirst({
      where: { id, deletedAt: null },
    });

    return row ? decryptRow(row) : null;
  }

  async findMany({ skip, take, ...rest }: FindManyParams) {
    // Paging after filtering, not in SQL: the filter is applied in Node, so a
    // database LIMIT would page through the wrong set.
    const all = await this.resolve(rest);
    return all.slice(skip, skip + take);
  }

  /** Used for the Excel export. Everything that matches, unpaged. */
  findAll(params: FindAllParams) {
    return this.resolve(params);
  }

  async count(search?: string, status?: InquiryStatus) {
    // Counts the SAME set findMany pages through. A SQL count() here would
    // ignore the search and report a total the list does not contain.
    const all = await this.resolve({ search, status });
    return all.length;
  }

  updateStatus(id: string, status: InquiryStatus) {
    return prisma.inquiries.update({ where: { id }, data: { status } });
  }

  softDelete(id: string) {
    return prisma.inquiries.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export default new InquiryRepository();
