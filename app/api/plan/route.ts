import { body, HttpError, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isValidMonth } from "@/lib/month";
import { planSchema } from "@/lib/validation";

function monthParam(req: Request): string {
  const month = new URL(req.url).searchParams.get("month");
  if (!isValidMonth(month)) throw new HttpError(400, "Укажи month=YYYY-MM");
  return month;
}

export const GET = route(async (req) => {
  const rows = await prisma.monthPlan.findMany({ where: { month: monthParam(req) } });
  return Object.fromEntries(rows.map((r) => [r.categoryId, r.plannedCents]));
});

export const PUT = route(async (req) => {
  const month = monthParam(req);
  const { items } = await body(req, planSchema);
  await prisma.$transaction(
    items.map(({ categoryId, plannedCents }) =>
      plannedCents === 0
        ? prisma.monthPlan.deleteMany({ where: { month, categoryId } })
        : prisma.monthPlan.upsert({
            where: { month_categoryId: { month, categoryId } },
            update: { plannedCents },
            create: { month, categoryId, plannedCents },
          }),
    ),
  );
});
