import { body, notFound, paramId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toTransactionDTO } from "@/lib/data";
import { parseDateInput } from "@/lib/month";
import { assertNotBeforeStart, normalizeTx } from "@/lib/tx-rules";
import type { TxType } from "@/lib/types";
import { transactionPatchSchema } from "@/lib/validation";

export const PATCH = route(async (req, ctx) => {
  const id = await paramId(ctx);
  const patch = await body(req, transactionPatchSchema);
  if (patch.date) await assertNotBeforeStart(patch.date);
  const current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) throw notFound("Операция");
  const merged = await normalizeTx({
    type: (patch.type ?? current.type) as TxType,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : current.categoryId,
    debtId: patch.debtId !== undefined ? patch.debtId : current.debtId,
    recurringId: patch.recurringId !== undefined ? patch.recurringId : current.recurringId,
    goalId: patch.goalId !== undefined ? patch.goalId : current.goalId,
  });
  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      ...merged,
      ...(patch.date ? { date: parseDateInput(patch.date) } : {}),
      ...(patch.amountCents ? { amountCents: patch.amountCents } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
    },
  });
  return toTransactionDTO(tx);
});

export const DELETE = route(async (_req, ctx) => {
  await prisma.transaction.delete({ where: { id: await paramId(ctx) } });
});
