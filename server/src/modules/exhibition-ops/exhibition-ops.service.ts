import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  decryptFieldSafe,
  encryptField,
  rowAad,
} from "../../utils/fieldCrypto.js";

/**
 * The operations side of a show.
 *
 * Everything here hangs off ONE ops row per exhibition, and every child table
 * is reached through it. That is what makes the permission check simple: prove
 * the caller may touch this show's operations once, at the top, and every
 * nested list is already covered.
 *
 * Money and weight never become JavaScript numbers anywhere in this file. They
 * arrive as strings, go into Prisma.Decimal, are summed with Decimal
 * arithmetic, and leave as strings. A `Number()` anywhere in this path would
 * reintroduce exactly the rounding this was built to avoid.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/** "" and null both mean "no value". Anything else becomes a Decimal. */
function toDecimal(value?: string | null): Decimal | null {
  if (value === undefined || value === null || value === "") return null;
  return new D(value);
}

/** "" and null both mean "no date". */
function toDate(value?: string | null): Date | null {
  if (value === undefined || value === null || value === "") return null;
  return new Date(value);
}

/**
 * A lead is a named person with a phone number, so those columns are
 * encrypted at rest — see utils/fieldCrypto.ts.
 *
 * The ratings, stages, dates and money stay readable: they are what the
 * report sums and what the list sorts by, and none of them says who anybody
 * is. `estimatedValue` in particular stays a Decimal column, because the
 * report totals it and a ciphertext cannot be added up.
 */
const LEAD_SECRETS = ["name", "company", "phone", "email", "interest", "notes"] as const;

function sealLead(id: string, data: Record<string, unknown>): Record<string, unknown> {
  const aad = rowAad("exhibition_leads", id);
  const out = { ...data };
  for (const field of LEAD_SECRETS) {
    if (field in out) out[field] = encryptField(out[field] as string | null, aad);
  }
  return out;
}

/** Forgiving on read: one damaged row must not empty the whole list. */
function openLead<T extends { id: string }>(row: T): T {
  const aad = rowAad("exhibition_leads", row.id);
  const out: Record<string, unknown> = { ...row };
  for (const field of LEAD_SECRETS) {
    if (field in out) out[field] = decryptFieldSafe(out[field] as string | null, aad);
  }
  return out as T;
}

/** "" means "nobody", which is a null foreign key, not an empty string. */
function toId(value?: string | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

/**
 * The ops row for a show, created on first use.
 *
 * Created lazily rather than alongside every exhibition: most shows on the
 * website are historical records nobody will ever run operations for, and a
 * row per show whether or not it is used makes "does this show have
 * operations" unanswerable.
 */
export async function ensureOps(exhibitionId: string) {
  const show = await prisma.exhibitions.findUnique({
    where: { id: exhibitionId },
    select: { id: true, title: true, slug: true, startDate: true, endDate: true, venue: true },
  });

  if (!show) throw new ApiError(404, "That exhibition does not exist.");

  const ops = await prisma.exhibitionOps.upsert({
    where: { exhibitionId },
    create: { exhibitionId },
    update: {},
  });

  return { ops, show };
}

/** Resolves an ops id from an exhibition id, without creating one. */
async function opsIdFor(exhibitionId: string): Promise<string> {
  const ops = await prisma.exhibitionOps.findUnique({
    where: { exhibitionId },
    select: { id: true },
  });

  if (!ops) throw new ApiError(404, "This show has no operations record yet.");
  return ops.id;
}

const USER_PICK = { select: { id: true, name: true, email: true } } as const;

/** Everything about one show's operations, in one request. */
export async function getFull(exhibitionId: string) {
  const { ops, show } = await ensureOps(exhibitionId);

  const [leads, costs, crew, tasks, documents, logs, inventory, appointments, fields] =
    await Promise.all([
      prisma.exhibitionLead.findMany({
        where: { opsId: ops.id },
        orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
        include: { assignedTo: USER_PICK, capturedBy: USER_PICK },
      }),
      prisma.exhibitionCost.findMany({
        where: { opsId: ops.id },
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
      }),
      prisma.exhibitionCrew.findMany({
        where: { opsId: ops.id },
        orderBy: { createdAt: "asc" },
        include: { user: USER_PICK, shifts: { orderBy: [{ onDate: "asc" }, { startTime: "asc" }] } },
      }),
      prisma.exhibitionTask.findMany({
        where: { opsId: ops.id },
        orderBy: [{ stage: "asc" }, { dueAt: "asc" }],
        include: { owner: USER_PICK },
      }),
      prisma.exhibitionDocument.findMany({
        where: { opsId: ops.id },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: USER_PICK },
      }),
      prisma.exhibitionLog.findMany({
        where: { opsId: ops.id },
        orderBy: { onDate: "desc" },
        include: { author: USER_PICK },
      }),
      prisma.exhibitionInventory.findMany({
        where: { opsId: ops.id },
        orderBy: { createdAt: "asc" },
        include: { collection: { select: { id: true, name: true } }, reconciledBy: USER_PICK },
      }),
      prisma.exhibitionAppointment.findMany({
        where: { opsId: ops.id },
        orderBy: { scheduledAt: "asc" },
        include: { lead: { select: { id: true, name: true } } },
      }),
      prisma.exhibitionOpsField.findMany({
        where: { opsId: ops.id },
        orderBy: [{ group: "asc" }, { displayOrder: "asc" }],
      }),
    ]);

  return {
    show,
    ops,
    // The report is built from the ENCRYPTED rows on purpose: it only ever
    // touches ratings, stages and money, none of which are encrypted, so
    // decrypting first would be work done for nothing.
    leads: leads.map(openLead),
    costs,
    crew,
    tasks,
    documents,
    logs,
    inventory,
    appointments,
    fields,
    report: buildReport({ ops, leads, costs, inventory, tasks }),
  };
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

type ReportInput = {
  ops: { budget: Decimal | null; currency: string };
  leads: Array<{ rating: string; stage: string; estimatedValue: Decimal | null }>;
  costs: Array<{ plannedAmount: Decimal | null; actualAmount: Decimal | null; isPaid: boolean }>;
  inventory: Array<{
    piecesOut: number;
    piecesBack: number | null;
    netWeightOut: Decimal | null;
    netWeightBack: Decimal | null;
    valueOut: Decimal | null;
    valueBack: Decimal | null;
    reconciledAt: Date | null;
  }>;
  tasks: Array<{ stage: string }>;
};

/**
 * What the show cost, what it brought in, and what has not been counted.
 *
 * Computed on read rather than stored. These numbers are a function of rows
 * that change all day during a show; a stored total is a total that is wrong
 * between the edit and whatever was supposed to refresh it.
 */
function buildReport(input: ReportInput) {
  const zero = new D(0);

  const plannedCost = input.costs.reduce<Decimal>(
    (sum, c) => sum.plus(c.plannedAmount ?? zero),
    zero,
  );
  const actualCost = input.costs.reduce<Decimal>(
    (sum, c) => sum.plus(c.actualAmount ?? zero),
    zero,
  );
  const unpaidCost = input.costs
    .filter((c) => !c.isPaid)
    .reduce<Decimal>((sum, c) => sum.plus(c.actualAmount ?? c.plannedAmount ?? zero), zero);

  const pipeline = input.leads.reduce<Decimal>(
    (sum, l) => sum.plus(l.estimatedValue ?? zero),
    zero,
  );
  const wonValue = input.leads
    .filter((l) => l.stage === "WON")
    .reduce<Decimal>((sum, l) => sum.plus(l.estimatedValue ?? zero), zero);

  const countBy = <T,>(rows: T[], key: (row: T) => string) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      const k = key(row);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  // Only lines somebody has actually counted back in. Including the uncounted
  // ones would report the whole stall as sold on day one.
  const counted = input.inventory.filter((i) => i.reconciledAt !== null);
  const uncounted = input.inventory.length - counted.length;

  const netOut = counted.reduce<Decimal>((s, i) => s.plus(i.netWeightOut ?? zero), zero);
  const netBack = counted.reduce<Decimal>((s, i) => s.plus(i.netWeightBack ?? zero), zero);
  const valueOut = counted.reduce<Decimal>((s, i) => s.plus(i.valueOut ?? zero), zero);
  const valueBack = counted.reduce<Decimal>((s, i) => s.plus(i.valueBack ?? zero), zero);

  const piecesOut = counted.reduce((s, i) => s + i.piecesOut, 0);
  const piecesBack = counted.reduce((s, i) => s + (i.piecesBack ?? 0), 0);

  return {
    currency: input.ops.currency,

    cost: {
      budget: input.ops.budget?.toString() ?? null,
      planned: plannedCost.toString(),
      actual: actualCost.toString(),
      unpaid: unpaidCost.toString(),
      /** Positive means under budget. Null when no budget was set. */
      remaining: input.ops.budget ? input.ops.budget.minus(actualCost).toString() : null,
    },

    leads: {
      total: input.leads.length,
      byRating: countBy(input.leads, (l) => l.rating),
      byStage: countBy(input.leads, (l) => l.stage),
      pipelineValue: pipeline.toString(),
      wonValue: wonValue.toString(),
      /**
       * What one lead cost to acquire. Null rather than zero when nothing was
       * spent or nobody was met — dividing by nothing is not "free".
       */
      costPerLead:
        input.leads.length > 0 && actualCost.greaterThan(0)
          ? actualCost.dividedBy(input.leads.length).toFixed(2)
          : null,
    },

    stock: {
      linesTotal: input.inventory.length,
      linesCounted: counted.length,
      linesUncounted: uncounted,
      piecesOut,
      piecesBack,
      piecesSold: piecesOut - piecesBack,
      netWeightOut: netOut.toString(),
      netWeightBack: netBack.toString(),
      /** What did not come back. The number the strongroom cares about. */
      netWeightSold: netOut.minus(netBack).toString(),
      valueOut: valueOut.toString(),
      valueBack: valueBack.toString(),
      valueSold: valueOut.minus(valueBack).toString(),
    },

    tasks: {
      total: input.tasks.length,
      byStage: countBy(input.tasks, (t) => t.stage),
    },
  };
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

export async function saveHeader(exhibitionId: string, input: Record<string, unknown>) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionOps.update({
    where: { id: ops.id },
    data: {
      stage: input.stage as never,
      hall: (input.hall as string) ?? null,
      stallNumber: (input.stallNumber as string) ?? null,
      stallSize: (input.stallSize as string) ?? null,
      setupAt: toDate(input.setupAt as string),
      teardownAt: toDate(input.teardownAt as string),
      organiserName: (input.organiserName as string) ?? null,
      organiserPhone: (input.organiserPhone as string) ?? null,
      organiserEmail: (input.organiserEmail as string) || null,
      currency: (input.currency as string) ?? "INR",
      budget: toDecimal(input.budget as string),
      notes: (input.notes as string) ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------
//
// Each of these is the same three moves — create under the show's ops row,
// update by id scoped to that row, delete by id scoped to that row. The
// scoping is what stops an id from one show being edited through another, and
// it is done with updateMany/deleteMany so a mismatch changes nothing rather
// than throwing after the fact.

async function scopedUpdate(
  model: {
    updateMany: (args: never) => Promise<{ count: number }>;
    findFirst: (args: never) => Promise<unknown>;
  },
  opsId: string,
  id: string,
  data: Record<string, unknown>,
) {
  const result = await model.updateMany({ where: { id, opsId }, data } as never);
  if (result.count === 0) throw new ApiError(404, "That entry does not exist.");
  return model.findFirst({ where: { id, opsId } } as never);
}

async function scopedDelete(
  model: { deleteMany: (args: never) => Promise<{ count: number }> },
  opsId: string,
  id: string,
) {
  const result = await model.deleteMany({ where: { id, opsId } } as never);
  if (result.count === 0) throw new ApiError(404, "That entry does not exist.");
}

// ---- Leads ----

export async function createLead(exhibitionId: string, input: Record<string, unknown>, userId: string) {
  const { ops } = await ensureOps(exhibitionId);

  // The id is generated here rather than by the database because it is part
  // of the AAD the values are sealed against — the ciphertext cannot be
  // produced without knowing which row it belongs to.
  const id = randomUUID();

  const row = await prisma.exhibitionLead.create({
    data: sealLead(id, {
      id,
      opsId: ops.id,
      name: input.name as string,
      company: (input.company as string) ?? null,
      city: (input.city as string) ?? null,
      country: (input.country as string) ?? null,
      phone: (input.phone as string) ?? null,
      email: (input.email as string) || null,
      interest: (input.interest as string) ?? null,
      rating: input.rating as never,
      stage: input.stage as never,
      estimatedValue: toDecimal(input.estimatedValue as string),
      assignedToId: toId(input.assignedToId as string),
      followUpAt: toDate(input.followUpAt as string),
      notes: (input.notes as string) ?? null,
      capturedById: userId,
    }) as never,
    include: { assignedTo: USER_PICK, capturedBy: USER_PICK },
  });

  return openLead(row);
}

export async function updateLead(exhibitionId: string, id: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);

  const row = await scopedUpdate(prisma.exhibitionLead as never, opsId, id, sealLead(id, {
    name: input.name,
    company: (input.company as string) ?? null,
    city: (input.city as string) ?? null,
    country: (input.country as string) ?? null,
    phone: (input.phone as string) ?? null,
    email: (input.email as string) || null,
    interest: (input.interest as string) ?? null,
    rating: input.rating,
    stage: input.stage,
    estimatedValue: toDecimal(input.estimatedValue as string),
    assignedToId: toId(input.assignedToId as string),
    followUpAt: toDate(input.followUpAt as string),
    notes: (input.notes as string) ?? null,
  }));

  return openLead(row as { id: string });
}

export async function deleteLead(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionLead as never, await opsIdFor(exhibitionId), id);
}

// ---- Costs ----

export async function createCost(exhibitionId: string, input: Record<string, unknown>) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionCost.create({
    data: {
      opsId: ops.id,
      category: input.category as never,
      label: input.label as string,
      vendor: (input.vendor as string) ?? null,
      plannedAmount: toDecimal(input.plannedAmount as string),
      actualAmount: toDecimal(input.actualAmount as string),
      isPaid: Boolean(input.isPaid),
      paidAt: toDate(input.paidAt as string),
      notes: (input.notes as string) ?? null,
    },
  });
}

export async function updateCost(exhibitionId: string, id: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);

  return scopedUpdate(prisma.exhibitionCost as never, opsId, id, {
    category: input.category,
    label: input.label,
    vendor: (input.vendor as string) ?? null,
    plannedAmount: toDecimal(input.plannedAmount as string),
    actualAmount: toDecimal(input.actualAmount as string),
    isPaid: Boolean(input.isPaid),
    paidAt: toDate(input.paidAt as string),
    notes: (input.notes as string) ?? null,
  });
}

export async function deleteCost(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionCost as never, await opsIdFor(exhibitionId), id);
}

// ---- Crew ----

export async function createCrew(exhibitionId: string, input: Record<string, unknown>) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionCrew.create({
    data: {
      opsId: ops.id,
      userId: toId(input.userId as string),
      name: input.name as string,
      role: (input.role as string) ?? null,
      phone: (input.phone as string) ?? null,
      travelFrom: toDate(input.travelFrom as string),
      travelTo: toDate(input.travelTo as string),
      notes: (input.notes as string) ?? null,
    },
    include: { user: USER_PICK, shifts: true },
  });
}

export async function updateCrew(exhibitionId: string, id: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);

  return scopedUpdate(prisma.exhibitionCrew as never, opsId, id, {
    userId: toId(input.userId as string),
    name: input.name,
    role: (input.role as string) ?? null,
    phone: (input.phone as string) ?? null,
    travelFrom: toDate(input.travelFrom as string),
    travelTo: toDate(input.travelTo as string),
    notes: (input.notes as string) ?? null,
  });
}

export async function deleteCrew(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionCrew as never, await opsIdFor(exhibitionId), id);
}

/**
 * Shifts hang off a crew member, not off the ops row, so they are scoped by
 * proving the crew member belongs to this show first.
 */
export async function createShift(exhibitionId: string, crewId: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);

  const crew = await prisma.exhibitionCrew.findFirst({
    where: { id: crewId, opsId },
    select: { id: true },
  });
  if (!crew) throw new ApiError(404, "That person is not on this show.");

  return prisma.exhibitionShift.create({
    data: {
      crewId,
      onDate: new Date(input.onDate as string),
      startTime: input.startTime as string,
      endTime: input.endTime as string,
      notes: (input.notes as string) ?? null,
    },
  });
}

export async function deleteShift(exhibitionId: string, shiftId: string) {
  const opsId = await opsIdFor(exhibitionId);

  const result = await prisma.exhibitionShift.deleteMany({
    where: { id: shiftId, crew: { opsId } },
  });
  if (result.count === 0) throw new ApiError(404, "That shift does not exist.");
}

// ---- Tasks ----

export async function createTask(exhibitionId: string, input: Record<string, unknown>) {
  const { ops } = await ensureOps(exhibitionId);
  const stage = input.stage as string;

  return prisma.exhibitionTask.create({
    data: {
      opsId: ops.id,
      title: input.title as string,
      detail: (input.detail as string) ?? null,
      stage: stage as never,
      dueAt: toDate(input.dueAt as string),
      ownerId: toId(input.ownerId as string),
      doneAt: stage === "DONE" ? new Date() : null,
    },
    include: { owner: USER_PICK },
  });
}

export async function updateTask(exhibitionId: string, id: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);
  const stage = input.stage as string;

  const existing = await prisma.exhibitionTask.findFirst({
    where: { id, opsId },
    select: { stage: true, doneAt: true },
  });
  if (!existing) throw new ApiError(404, "That task does not exist.");

  return scopedUpdate(prisma.exhibitionTask as never, opsId, id, {
    title: input.title,
    detail: (input.detail as string) ?? null,
    stage,
    dueAt: toDate(input.dueAt as string),
    ownerId: toId(input.ownerId as string),
    // Stamped when it first becomes DONE and cleared if it is reopened. Not
    // re-stamped on every save, or "finished on" would track the last edit
    // rather than the moment the work was finished.
    doneAt:
      stage === "DONE" ? (existing.doneAt ?? new Date()) : null,
  });
}

export async function deleteTask(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionTask as never, await opsIdFor(exhibitionId), id);
}

// ---- Documents ----

export async function createDocument(exhibitionId: string, input: Record<string, unknown>, userId: string) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionDocument.create({
    data: {
      opsId: ops.id,
      title: input.title as string,
      kind: (input.kind as string) ?? null,
      fileUrl: input.fileUrl as string,
      notes: (input.notes as string) ?? null,
      uploadedById: userId,
    },
    include: { uploadedBy: USER_PICK },
  });
}

export async function deleteDocument(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionDocument as never, await opsIdFor(exhibitionId), id);
}

// ---- Daily log ----

export async function createLog(exhibitionId: string, input: Record<string, unknown>, userId: string) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionLog.create({
    data: {
      opsId: ops.id,
      onDate: new Date(input.onDate as string),
      note: input.note as string,
      authorId: userId,
    },
    include: { author: USER_PICK },
  });
}

export async function updateLog(exhibitionId: string, id: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);

  return scopedUpdate(prisma.exhibitionLog as never, opsId, id, {
    onDate: new Date(input.onDate as string),
    note: input.note,
  });
}

export async function deleteLog(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionLog as never, await opsIdFor(exhibitionId), id);
}

// ---- Inventory ----

/**
 * A line is "reconciled" the moment any of the back figures is filled in.
 *
 * Derived rather than a button somebody has to remember to press: the act of
 * typing what came back IS the count, and a line that has been counted but not
 * marked would be left out of the report's totals without anyone noticing.
 */
function reconciliationFor(input: Record<string, unknown>, previouslyAt: Date | null, userId: string) {
  const counted =
    input.piecesBack !== undefined && input.piecesBack !== null
      ? true
      : Boolean(input.grossWeightBack || input.netWeightBack || input.valueBack);

  if (!counted) return { reconciledAt: null, reconciledById: null };
  return { reconciledAt: previouslyAt ?? new Date(), reconciledById: userId };
}

export async function createInventory(exhibitionId: string, input: Record<string, unknown>, userId: string) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionInventory.create({
    data: {
      opsId: ops.id,
      itemName: input.itemName as string,
      sku: (input.sku as string) ?? null,
      collectionId: toId(input.collectionId as string),
      piecesOut: (input.piecesOut as number) ?? 0,
      grossWeightOut: toDecimal(input.grossWeightOut as string),
      netWeightOut: toDecimal(input.netWeightOut as string),
      valueOut: toDecimal(input.valueOut as string),
      piecesBack: (input.piecesBack as number) ?? null,
      grossWeightBack: toDecimal(input.grossWeightBack as string),
      netWeightBack: toDecimal(input.netWeightBack as string),
      valueBack: toDecimal(input.valueBack as string),
      notes: (input.notes as string) ?? null,
      ...reconciliationFor(input, null, userId),
    },
    include: { collection: { select: { id: true, name: true } }, reconciledBy: USER_PICK },
  });
}

export async function updateInventory(
  exhibitionId: string,
  id: string,
  input: Record<string, unknown>,
  userId: string,
) {
  const opsId = await opsIdFor(exhibitionId);

  const existing = await prisma.exhibitionInventory.findFirst({
    where: { id, opsId },
    select: { reconciledAt: true },
  });
  if (!existing) throw new ApiError(404, "That stock line does not exist.");

  return scopedUpdate(prisma.exhibitionInventory as never, opsId, id, {
    itemName: input.itemName,
    sku: (input.sku as string) ?? null,
    collectionId: toId(input.collectionId as string),
    piecesOut: (input.piecesOut as number) ?? 0,
    grossWeightOut: toDecimal(input.grossWeightOut as string),
    netWeightOut: toDecimal(input.netWeightOut as string),
    valueOut: toDecimal(input.valueOut as string),
    piecesBack: (input.piecesBack as number) ?? null,
    grossWeightBack: toDecimal(input.grossWeightBack as string),
    netWeightBack: toDecimal(input.netWeightBack as string),
    valueBack: toDecimal(input.valueBack as string),
    notes: (input.notes as string) ?? null,
    ...reconciliationFor(input, existing.reconciledAt, userId),
  });
}

export async function deleteInventory(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionInventory as never, await opsIdFor(exhibitionId), id);
}

// ---- Appointments ----

export async function createAppointment(exhibitionId: string, input: Record<string, unknown>) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionAppointment.create({
    data: {
      opsId: ops.id,
      leadId: toId(input.leadId as string),
      buyerName: input.buyerName as string,
      company: (input.company as string) ?? null,
      phone: (input.phone as string) ?? null,
      scheduledAt: new Date(input.scheduledAt as string),
      durationMins: (input.durationMins as number) ?? 30,
      stage: input.stage as never,
      notes: (input.notes as string) ?? null,
    },
    include: { lead: { select: { id: true, name: true } } },
  });
}

export async function updateAppointment(exhibitionId: string, id: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);

  return scopedUpdate(prisma.exhibitionAppointment as never, opsId, id, {
    leadId: toId(input.leadId as string),
    buyerName: input.buyerName,
    company: (input.company as string) ?? null,
    phone: (input.phone as string) ?? null,
    scheduledAt: new Date(input.scheduledAt as string),
    durationMins: (input.durationMins as number) ?? 30,
    stage: input.stage,
    notes: (input.notes as string) ?? null,
  });
}

export async function deleteAppointment(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionAppointment as never, await opsIdFor(exhibitionId), id);
}

// ---- Custom fields ----

export async function createField(exhibitionId: string, input: Record<string, unknown>) {
  const { ops } = await ensureOps(exhibitionId);

  return prisma.exhibitionOpsField.create({
    data: {
      opsId: ops.id,
      group: (input.group as string) ?? "General",
      label: input.label as string,
      value: (input.value as string) ?? "",
      displayOrder: (input.displayOrder as number) ?? 0,
    },
  });
}

export async function updateField(exhibitionId: string, id: string, input: Record<string, unknown>) {
  const opsId = await opsIdFor(exhibitionId);

  return scopedUpdate(prisma.exhibitionOpsField as never, opsId, id, {
    group: (input.group as string) ?? "General",
    label: input.label,
    value: (input.value as string) ?? "",
    displayOrder: (input.displayOrder as number) ?? 0,
  });
}

export async function deleteField(exhibitionId: string, id: string) {
  await scopedDelete(prisma.exhibitionOpsField as never, await opsIdFor(exhibitionId), id);
}
