import { body, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getCategories, toCategoryDTO } from "@/lib/data";
import { categorySchema } from "@/lib/validation";

export const GET = route(async () => getCategories());

export const POST = route(async (req) => {
  const data = await body(req, categorySchema);
  const last = await prisma.category.aggregate({ where: { kind: data.kind }, _max: { sortOrder: true } });
  const cat = await prisma.category.create({
    data: {
      ...data,
      isSalary: data.kind === "INCOME" && data.isSalary,
      isMandatory: data.kind === "EXPENSE" && data.isMandatory,
      isDebt: data.kind === "EXPENSE" && data.isDebt,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  return toCategoryDTO(cat);
});
