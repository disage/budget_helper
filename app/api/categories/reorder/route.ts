import { body, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reorderSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const { ids } = await body(req, reorderSchema);
  await prisma.$transaction(ids.map((id, i) => prisma.category.update({ where: { id }, data: { sortOrder: i } })));
});
