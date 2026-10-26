import { HttpError, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isValidMonth } from "@/lib/month";
import { assertNotBeforeStart } from "@/lib/tx-rules";

export const POST = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!isValidMonth(from) || !isValidMonth(to)) throw new HttpError(400, "Укажи from и to в формате YYYY-MM");
  await assertNotBeforeStart(to);
  const source = await prisma.monthPlan.findMany({ where: { month: from } });
  if (source.length === 0) throw new HttpError(404, "В прошлом месяце нет плана");
  await prisma.$transaction([
    prisma.monthPlan.deleteMany({ where: { month: to } }),
    ...source.map((p) =>
      prisma.monthPlan.create({ data: { month: to, categoryId: p.categoryId, plannedCents: p.plannedCents } }),
    ),
  ]);
  return { copied: source.length };
});
