import { body, paramId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toCategoryDTO } from "@/lib/data";
import { categoryPatchSchema } from "@/lib/validation";

export const PATCH = route(async (req, ctx) => {
  const id = await paramId(ctx);
  const data = await body(req, categoryPatchSchema);
  return toCategoryDTO(await prisma.category.update({ where: { id }, data }));
});

/** Категорию с историей только архивируем, пустую — удаляем. */
export const DELETE = route(async (_req, ctx) => {
  const id = await paramId(ctx);
  const [tx, rec] = await Promise.all([
    prisma.transaction.count({ where: { categoryId: id } }),
    prisma.recurringPayment.count({ where: { categoryId: id } }),
  ]);
  if (tx > 0 || rec > 0) {
    await prisma.category.update({ where: { id }, data: { archived: true } });
    return { archived: true };
  }
  await prisma.category.delete({ where: { id } });
  return { archived: false, deleted: true };
});
