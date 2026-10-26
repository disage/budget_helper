import { z } from "zod";
import { HttpError, notFound, paramId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toTransactionDTO } from "@/lib/data";
import { defaultPayDate, isValidMonth, monthOf, parseDateInput } from "@/lib/month";
import { assertNotBeforeStart } from "@/lib/tx-rules";
import { dateSchema } from "@/lib/validation";

const paySchema = z.object({
  amountCents: z.number().int().positive().optional(),
  date: dateSchema.optional(),
  description: z.string().trim().max(200).optional(),
});

/** Отметить регулярный платёж оплаченным: создаёт расход с нужной категорией и долгом. */
export const POST = route(async (req, ctx) => {
  const id = await paramId(ctx);
  const month = new URL(req.url).searchParams.get("month");
  if (!isValidMonth(month)) throw new HttpError(400, "Укажи month=YYYY-MM");
  const text = await req.text();
  const opts = paySchema.parse(text ? JSON.parse(text) : {});
  const r = await prisma.recurringPayment.findUnique({ where: { id } });
  if (!r) throw notFound("Регулярный платёж");
  const date = opts.date ?? defaultPayDate(month, r.dayOfMonth);
  if (monthOf(parseDateInput(date)) !== month) throw new HttpError(400, "Дата должна быть в выбранном месяце");
  await assertNotBeforeStart(date);
  const tx = await prisma.transaction.create({
    data: {
      date: parseDateInput(date),
      amountCents: opts.amountCents ?? r.amountCents,
      description: opts.description ?? r.name,
      type: "EXPENSE",
      categoryId: r.categoryId,
      debtId: r.debtId,
      recurringId: r.id,
    },
  });
  return toTransactionDTO(tx);
});
