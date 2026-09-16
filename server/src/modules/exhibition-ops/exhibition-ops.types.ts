import { z } from "zod";

/**
 * Everything the operations side of a show accepts, in one place.
 *
 * The enums are re-declared here rather than imported from @prisma/client on
 * purpose: these are the values the API will accept, and they should change
 * because somebody decided to change them, not as a side effect of a schema
 * edit. If the two ever drift, `tsc` says so at the call site.
 */

export const STAGES = ["PLANNED", "BOOKED", "LIVE", "CONCLUDED", "CANCELLED"] as const;
export const LEAD_RATINGS = ["HOT", "WARM", "COLD"] as const;
export const LEAD_STAGES = ["NEW", "CONTACTED", "QUOTED", "WON", "LOST"] as const;
export const COST_CATEGORIES = [
  "STALL",
  "TRAVEL",
  "HOTEL",
  "SHIPPING",
  "PRINTING",
  "STAFF",
  "SAMPLES",
  "OTHER",
] as const;
export const TASK_STAGES = ["TODO", "DOING", "DONE"] as const;
export const APPOINTMENT_STAGES = ["SCHEDULED", "MET", "NO_SHOW", "CANCELLED"] as const;

/**
 * Money and weight arrive as strings, not numbers.
 *
 * JSON has one number type and it is a double. `12345678.91` survives; a gold
 * weight carried to three decimals across a few hundred lines does not always.
 * The browser sends what was typed, this checks the shape, and Prisma hands it
 * to Postgres as a `decimal` — so the value never passes through a float at
 * any point between the keyboard and the column.
 */
const decimalString = (label: string, maxIntegerDigits = 11, maxDecimals = 3) =>
  z
    .string()
    .trim()
    .regex(
      new RegExp(`^-?\\d{1,${maxIntegerDigits}}(\\.\\d{1,${maxDecimals}})?$`),
      `${label} must be a number` +
        (maxDecimals ? ` with up to ${maxDecimals} decimal places` : ""),
    );

const money = (label: string) => decimalString(label, 12, 2);
const weight = (label: string) => decimalString(label, 9, 3);

/** An empty string from a cleared input means "no value", not zero. */
const optionalMoney = (label: string) =>
  z.union([money(label), z.literal("")]).optional().nullable();
const optionalWeight = (label: string) =>
  z.union([weight(label), z.literal("")]).optional().nullable();

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();

/** An ISO date string, or nothing. Cleared date inputs send "". */
const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.string().date(), z.literal("")])
  .optional()
  .nullable();

const requiredDate = z.union([
  z.string().datetime({ offset: true }),
  z.string().date(),
]);

// ---- The operations header ----

export const opsHeaderSchema = z.object({
  stage: z.enum(STAGES).default("PLANNED"),
  hall: optionalText(80),
  stallNumber: optionalText(80),
  stallSize: optionalText(80),
  setupAt: optionalDate,
  teardownAt: optionalDate,
  organiserName: optionalText(120),
  organiserPhone: optionalText(40),
  organiserEmail: z.union([z.string().trim().email(), z.literal("")]).optional().nullable(),
  currency: z.string().trim().length(3).default("INR"),
  budget: optionalMoney("Budget"),
  notes: optionalText(5000),
});

// ---- Leads ----

export const leadSchema = z.object({
  name: z.string().trim().min(1, "A lead needs a name").max(120),
  company: optionalText(160),
  city: optionalText(80),
  country: optionalText(80),
  phone: optionalText(40),
  email: z.union([z.string().trim().email(), z.literal("")]).optional().nullable(),
  interest: optionalText(1000),
  rating: z.enum(LEAD_RATINGS).default("WARM"),
  stage: z.enum(LEAD_STAGES).default("NEW"),
  estimatedValue: optionalMoney("Estimated value"),
  assignedToId: z.union([z.string().uuid(), z.literal("")]).optional().nullable(),
  followUpAt: optionalDate,
  notes: optionalText(5000),
});

// ---- Costs ----

export const costSchema = z.object({
  category: z.enum(COST_CATEGORIES).default("OTHER"),
  label: z.string().trim().min(1, "Give the cost a name").max(160),
  vendor: optionalText(160),
  plannedAmount: optionalMoney("Planned amount"),
  actualAmount: optionalMoney("Actual amount"),
  isPaid: z.boolean().default(false),
  paidAt: optionalDate,
  notes: optionalText(2000),
});

// ---- Crew and shifts ----

export const crewSchema = z.object({
  userId: z.union([z.string().uuid(), z.literal("")]).optional().nullable(),
  name: z.string().trim().min(1, "Who is going?").max(120),
  role: optionalText(80),
  phone: optionalText(40),
  travelFrom: optionalDate,
  travelTo: optionalDate,
  notes: optionalText(2000),
});

/** "09:00" to "21:30". Anything else is a typo, not a shift. */
const clockTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 10:00");

export const shiftSchema = z.object({
  onDate: requiredDate,
  startTime: clockTime,
  endTime: clockTime,
  notes: optionalText(500),
});

// ---- Tasks ----

export const taskSchema = z.object({
  title: z.string().trim().min(1, "What needs doing?").max(200),
  detail: optionalText(2000),
  stage: z.enum(TASK_STAGES).default("TODO"),
  dueAt: optionalDate,
  ownerId: z.union([z.string().uuid(), z.literal("")]).optional().nullable(),
});

// ---- Documents ----

export const documentSchema = z.object({
  title: z.string().trim().min(1, "Give the file a name").max(200),
  kind: optionalText(60),
  fileUrl: z.string().trim().min(1, "Upload a file first").max(1000),
  notes: optionalText(1000),
});

// ---- Daily log ----

export const logSchema = z.object({
  onDate: requiredDate,
  note: z.string().trim().min(1, "What happened?").max(5000),
});

// ---- Inventory ----

export const inventorySchema = z.object({
  itemName: z.string().trim().min(1, "What went?").max(200),
  sku: optionalText(80),
  collectionId: z.union([z.string(), z.literal("")]).optional().nullable(),

  piecesOut: z.number().int().min(0).max(1_000_000).default(0),
  grossWeightOut: optionalWeight("Gross weight out"),
  netWeightOut: optionalWeight("Net weight out"),
  valueOut: optionalMoney("Value out"),

  /**
   * Null is meaningful here and is not the same as 0.
   *
   * Null means nobody has counted this line back in yet. Zero means it was
   * counted and none of it returned — every piece sold. Collapsing the two
   * would make an uncounted show look like a sold-out one.
   */
  piecesBack: z.number().int().min(0).max(1_000_000).optional().nullable(),
  grossWeightBack: optionalWeight("Gross weight back"),
  netWeightBack: optionalWeight("Net weight back"),
  valueBack: optionalMoney("Value back"),

  notes: optionalText(2000),
});

// ---- Appointments ----

export const appointmentSchema = z.object({
  leadId: z.union([z.string().uuid(), z.literal("")]).optional().nullable(),
  buyerName: z.string().trim().min(1, "Who are you meeting?").max(120),
  company: optionalText(160),
  phone: optionalText(40),
  scheduledAt: requiredDate,
  durationMins: z.number().int().min(5).max(600).default(30),
  stage: z.enum(APPOINTMENT_STAGES).default("SCHEDULED"),
  notes: optionalText(2000),
});

// ---- Custom fields (the hybrid half) ----

export const opsFieldSchema = z.object({
  group: z.string().trim().min(1).max(60).default("General"),
  label: z.string().trim().min(1, "Give the field a name").max(120),
  value: z.string().trim().max(4000).default(""),
  displayOrder: z.number().int().min(0).max(9999).default(0),
});

/** What the panel is offered, so it cannot show a choice the API refuses. */
export const OPTIONS = {
  stages: STAGES,
  leadRatings: LEAD_RATINGS,
  leadStages: LEAD_STAGES,
  costCategories: COST_CATEGORIES,
  taskStages: TASK_STAGES,
  appointmentStages: APPOINTMENT_STAGES,
} as const;
