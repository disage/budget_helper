import { body, paramId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toRecurringDTO } from "@/lib/data";
import { recurringSchema } from "@/lib/validation";

export const PATCH = route(async (req, ctx) => {
  const id = await paramId(ctx);
  const data = await body(req, recurringSchema.partial());
  return toRecurringDTO(await prisma.recurringPayment.update({ where: { id }, data }));
});

/** Операции, созданные по шаблону, остаются — связь просто обнуляется. */
export const DELETE = route(async (_req, ctx) => {
  await prisma.recurringPayment.delete({ where: { id: await paramId(ctx) } });
});
