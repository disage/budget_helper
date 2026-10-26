import { z } from "zod";
import { isValidDateInput, isValidMonth } from "./month";
import { CATEGORY_KINDS, CURRENCIES, DEBT_TYPES, TX_TYPES } from "./types";

const cents = z.number().int().positive("Сумма должна быть больше нуля").max(1_000_000_000);
const centsOrZero = z.number().int().min(0).max(1_000_000_000);
const id = z.number().int().positive();

export const monthSchema = z.string().refine(isValidMonth, "Месяц в формате YYYY-MM");
export const dateSchema = z.string().refine(isValidDateInput, "Дата в формате YYYY-MM-DD");

export const transactionSchema = z
  .object({
    date: dateSchema,
    amountCents: cents,
    description: z.string().trim().max(200).default(""),
    type: z.enum(TX_TYPES),
    categoryId: id.nullable().default(null),
    debtId: id.nullable().default(null),
    recurringId: id.nullable().default(null),
  })
  .refine((t) => t.type === "SAVING" || t.categoryId != null, {
    message: "Выбери категорию",
    path: ["categoryId"],
  });

export const transactionPatchSchema = z.object({
  date: dateSchema.optional(),
  amountCents: cents.optional(),
  description: z.string().trim().max(200).optional(),
  type: z.enum(TX_TYPES).optional(),
  categoryId: id.nullable().optional(),
  debtId: id.nullable().optional(),
  recurringId: id.nullable().optional(),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #RRGGBB");

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(40),
  kind: z.enum(CATEGORY_KINDS),
  color: hexColor.default("#898781"),
  icon: z.string().max(40).default("circle"),
  isMandatory: z.boolean().default(false),
  isSalary: z.boolean().default(false),
  isDebt: z.boolean().default(false),
});

export const categoryPatchSchema = categorySchema
  .omit({ kind: true })
  .partial()
  .extend({ archived: z.boolean().optional() });

export const reorderSchema = z.object({ ids: z.array(id).min(1) });

export const planSchema = z.object({
  items: z.array(z.object({ categoryId: id, plannedCents: centsOrZero })),
});

export const recurringSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(60),
  amountCents: cents,
  categoryId: id,
  dayOfMonth: z.number().int().min(1).max(31).nullable().default(null),
  debtId: id.nullable().default(null),
  active: z.boolean().default(true),
});

export const debtSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(60),
  type: z.enum(DEBT_TYPES),
  initialCents: cents,
  minPaymentCents: centsOrZero.default(0),
  interestRate: z.number().min(0).max(1000).nullable().default(null),
  note: z.string().trim().max(500).default(""),
});

export const debtPatchSchema = debtSchema.partial().extend({ closed: z.boolean().optional() });

export const settingsSchema = z.object({
  currency: z.enum(CURRENCIES),
  savingsPercent: z.number().int().min(0).max(100),
  carryOverBalance: z.boolean(),
});
