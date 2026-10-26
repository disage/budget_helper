import { body, paramId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toDebtDTO } from "@/lib/data";
import { debtPatchSchema } from "@/lib/validation";

export const PATCH = route(async (req, ctx) => {
  const id = await paramId(ctx);
  const { closed, ...data } = await body(req, debtPatchSchema);
  const debt = await prisma.debt.update({
    where: { id },
    data: { ...data, ...(closed !== undefined ? { closedAt: closed ? new Date() : null } : {}) },
  });
  return toDebtDTO(debt);
});

/** Платежи по долгу остаются расходами, просто без привязки. */
export const DELETE = route(async (_req, ctx) => {
  await prisma.debt.delete({ where: { id: await paramId(ctx) } });
});
