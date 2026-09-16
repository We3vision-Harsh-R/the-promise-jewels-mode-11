import { z } from "zod";

/**
 * What a vault entry holds.
 *
 * All of it is sealed into one blob (see the SecureNote model), so this shape
 * exists only inside the API and in the browser — the database never sees a
 * field name, let alone a value.
 *
 * The kinds are the four things an owner actually keeps: a note, a login, a
 * card, a bank account. They are not enforced beyond this list because the
 * form changes per kind, and a kind the form does not know about would render
 * as an empty box.
 */
export const NOTE_KINDS = [
  {
    value: "note",
    label: "Note",
    hint: "Anything worth not forgetting.",
  },
  {
    value: "login",
    label: "Login",
    hint: "A website, its username and its password.",
  },
  {
    value: "card",
    label: "Card",
    hint: "A debit or credit card.",
  },
  {
    value: "bank",
    label: "Bank account",
    hint: "Account number, IFSC, customer ID.",
  },
] as const;

const KIND_VALUES = NOTE_KINDS.map((k) => k.value) as [string, ...string[]];

/**
 * A single named secret inside an entry — "Password", "PIN", "Recovery code".
 *
 * Free-form rather than fixed columns, because the things people keep do not
 * fit four fixed slots: a bank entry needs a customer ID and a transaction
 * password, a card needs a CVV and a PIN. `secret: true` is what tells the
 * panel to mask it and offer a copy button rather than showing it.
 */
const fieldSchema = z.object({
  label: z.string().trim().min(1, "Give the field a name").max(60),
  value: z.string().max(2000),
  secret: z.boolean().default(false),
});

export const notePayloadSchema = z.object({
  kind: z.enum(KIND_VALUES).default("note"),
  title: z
    .string()
    .trim()
    .min(1, "Give this a title so you can find it again")
    .max(160),
  /** The long-form part. Line breaks are kept. */
  body: z.string().max(20_000).default(""),
  /** Where a login goes. Shown as a link when it looks like one. */
  url: z.string().trim().max(500).default(""),
  fields: z.array(fieldSchema).max(30, "That is a lot of fields for one entry").default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
});

export type NotePayload = z.infer<typeof notePayloadSchema>;

export const saveNoteSchema = z.object({
  payload: notePayloadSchema,
  pinned: z.boolean().default(false),
});
