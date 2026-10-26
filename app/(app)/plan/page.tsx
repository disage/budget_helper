import { PlanEditor } from "@/components/PlanEditor";
import { prisma } from "@/lib/db";
import { getSummary } from "@/lib/data";
import { monthOrCurrent, shiftMonth } from "@/lib/month";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const month = monthOrCurrent((await searchParams).month);
  const [plans, prevCount, summary] = await Promise.all([
    prisma.monthPlan.findMany({ where: { month } }),
    prisma.monthPlan.count({ where: { month: shiftMonth(month, -1) } }),
    getSummary(month),
  ]);
  const actual = Object.fromEntries(
    [...summary.expenseRows, ...summary.incomeRows].filter((r) => r.id != null).map((r) => [r.id!, r.actualCents]),
  );
  return (
    <PlanEditor
      key={month}
      month={month}
      initial={Object.fromEntries(plans.map((p) => [p.categoryId, p.plannedCents]))}
      actual={actual}
      hasPrevPlan={prevCount > 0}
    />
  );
}
