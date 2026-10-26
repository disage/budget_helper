import { body, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getTransactions, toTransactionDTO } from "@/lib/data";
import { isValidMonth, parseDateInput } from "@/lib/month";
import { assertNotBeforeStart, normalizeTx } from "@/lib/tx-rules";
import { TX_TYPES, type TxType } from "@/lib/types";
import { transactionSchema } from "@/lib/validation";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const month = sp.get("month");
  const type = sp.get("type");
  const categoryId = sp.get("categoryId");
  return getTransactions({
    month: isValidMonth(month) ? month : undefined,
    type: TX_TYPES.includes(type as TxType) ? (type as TxType) : undefined,
    categoryId: categoryId === "none" ? null : categoryId ? Number(categoryId) : undefined,
    q: sp.get("q") ?? undefined,
  });
});

export const POST = route(async (req) => {
  const data = await normalizeTx(await body(req, transactionSchema));
  await assertNotBeforeStart(data.date);
  const tx = await prisma.transaction.create({ data: { ...data, date: parseDateInput(data.date) } });
  return toTransactionDTO(tx);
});
