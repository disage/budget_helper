import { DebtsView, type DebtInfo } from "@/components/DebtsView";
import { estimatePayoff } from "@/lib/budget";
import { prisma } from "@/lib/db";
import { getDebtPaymentsByMonth, getDebts, toTransactionDTO } from "@/lib/data";
import { currentMonth } from "@/lib/month";

export default async function DebtsPage() {
  const [debts, byMonth, payments] = await Promise.all([
    getDebts(),
    getDebtPaymentsByMonth(),
    prisma.transaction.findMany({ where: { debtId: { not: null } }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
  ]);
  const now = currentMonth();
  const info: DebtInfo[] = debts.map((d) => {
    const months = byMonth[d.id] ?? {};
    const paidCents = Object.values(months).reduce((a, b) => a + b, 0);
    const remainingCents = Math.max(d.initialCents - paidCents, 0);
    const history = Object.keys(months).filter((m) => m <= now).sort();
    return {
      debt: d,
      paidCents,
      remainingCents,
      paidThisMonthCents: months[now] ?? 0,
      payoffMonth: d.closedAt ? null : estimatePayoff(remainingCents, history.map((m) => months[m]), d.minPaymentCents, now),
      payments: payments.filter((p) => p.debtId === d.id).slice(0, 12).map(toTransactionDTO),
      paymentCount: payments.filter((p) => p.debtId === d.id).length,
    };
  });
  return <DebtsView items={info} />;
}
