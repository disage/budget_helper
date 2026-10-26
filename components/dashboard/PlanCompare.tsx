"use client";

import Link from "next/link";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { useAppData } from "../providers";
import { Card, EmptyState } from "../ui";
import type { Summary } from "@/lib/budget";
import { cx } from "@/lib/client";
import { currentMonth, daysInMonth } from "@/lib/month";

interface Row {
  label: string;
  plan: number;
  fact: number;
  /** true — больше плана хорошо (доход, накопления), false — плохо (расходы). */
  higherIsGood: boolean;
  sub?: boolean;
  note?: string;
}

/** Факт против плана месяца: отклонения по доходу, расходам, свободным деньгам и накоплениям + прогноз остатка. */
export function PlanCompare({ s }: { s: Summary }) {
  const { money } = useAppData();
  const m = (v: number, sign = false) => money(v, { compact: true, sign });
  const p = s.plan;

  if (p.incomeCents === 0 && p.expenseCents === 0) {
    return (
      <Card title="Сравнение с планом">
        <EmptyState
          icon={<Target className="size-5" />}
          title="План на месяц не задан"
          text="Задай плановый доход и расходы по категориям — здесь появятся отклонения факта от плана и прогноз остатка."
          action={
            <Link href={`/plan?month=${s.month}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
              Открыть план месяца →
            </Link>
          }
        />
      </Card>
    );
  }

  const plannedDiscretionary = p.expenseCents - p.mandatoryCents;
  const expenseLeft = p.expenseCents - s.expenseCents;
  const rows: Row[] = [
    { label: "Доход", plan: p.incomeCents, fact: s.incomeCents, higherIsGood: true },
    {
      label: "Расходы",
      plan: p.expenseCents,
      fact: s.expenseCents,
      higherIsGood: false,
      note: expenseLeft > 0 ? `по плану можно потратить ещё ${m(expenseLeft)}` : expenseLeft < 0 ? `перерасход ${m(-expenseLeft)}` : undefined,
    },
    { label: "обязательные", plan: p.mandatoryCents, fact: s.mandatoryCents, higherIsGood: false, sub: true },
    { label: "прочие", plan: plannedDiscretionary, fact: s.discretionaryCents, higherIsGood: false, sub: true },
    { label: "Свободные деньги", plan: p.freeCents, fact: s.freeCents, higherIsGood: true },
    { label: "Отложено", plan: p.savingsPossibleCents, fact: s.savedCents, higherIsGood: true },
  ];

  const tone = (delta: number, higherIsGood: boolean) =>
    delta === 0
      ? "text-gray-400"
      : delta > 0 === higherIsGood
        ? "text-success-600 dark:text-success-500"
        : "text-error-600 dark:text-error-500";

  const forecastDelta = s.forecastLeftCents - s.plannedLeftCents;

  // Темп трат — только для текущего месяца.
  const isCurrent = s.month === currentMonth();
  const monthShare = isCurrent ? Math.round((new Date().getDate() / daysInMonth(s.month)) * 100) : null;
  const spentShare = p.expenseCents > 0 ? Math.round((s.expenseCents / p.expenseCents) * 100) : null;

  return (
    <Card
      title="Сравнение с планом"
      subtitle="Отклонение = факт − план. Зелёное — лучше плана, красное — хуже."
      action={<Link href={`/plan?month=${s.month}`} className="shrink-0 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">План</Link>}
      bodyClassName="!px-0 !pb-0"
    >
      <div className="overflow-x-auto">
      <table className="w-full text-[13px] sm:text-sm">
        <thead>
          <tr className="border-y border-gray-100 text-left text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="py-2.5 pr-1 pl-4 font-medium sm:pr-2 sm:pl-6" />
            <th className="px-1.5 py-2.5 text-right font-medium sm:px-2">План</th>
            <th className="px-1.5 py-2.5 text-right font-medium sm:px-2">Факт</th>
            <th className="py-2.5 pr-4 pl-1.5 text-right font-medium sm:pr-6 sm:pl-2">Отклонение</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => {
            const delta = r.fact - r.plan;
            return (
              <tr key={r.label}>
                <td className={cx("py-2.5 pr-1 pl-4 sm:pr-2 sm:pl-6", r.sub && "pl-7 sm:pl-10")}>
                  <span className={cx(r.sub ? "text-gray-500 dark:text-gray-400" : "font-medium text-gray-800 dark:text-white/90")}>{r.label}</span>
                  {r.note && <span className="block text-xs text-gray-500 dark:text-gray-400">{r.note}</span>}
                </td>
                <td className="num px-1.5 py-2.5 text-right whitespace-nowrap text-gray-500 sm:px-2 dark:text-gray-400">{m(r.plan)}</td>
                <td className={cx("num px-1.5 py-2.5 text-right whitespace-nowrap sm:px-2", r.sub ? "text-gray-600 dark:text-gray-300" : "font-semibold text-gray-900 dark:text-white")}>
                  {m(r.fact)}
                </td>
                <td className={cx("num py-2.5 pr-4 pl-1.5 text-right font-medium whitespace-nowrap sm:pr-6 sm:pl-2", tone(delta, r.higherIsGood))}>
                  {m(delta, true)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="grid min-w-0 gap-4 border-t border-gray-100 bg-gray-50/60 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6 dark:border-gray-800 dark:bg-white/[0.02]">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">Прогноз на конец месяца</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Если дальше тратить по плану: уже случившиеся перерасходы и неоплаченные регулярные платежи учтены.
          </p>
          {monthShare != null && spentShare != null && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Прошло {monthShare}% месяца, потрачено {spentShare}% плана расходов
              {spentShare > monthShare + 10 ? " — тратишь быстрее плана" : ""}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2 sm:justify-end">
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Останется</p>
            <p className={cx("num text-2xl font-semibold", s.forecastLeftCents < 0 ? "text-error-600 dark:text-error-500" : "text-gray-900 dark:text-white")}>
              {m(s.forecastLeftCents)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">По плану</p>
            <p className="num text-base font-medium text-gray-500 dark:text-gray-400">{m(s.plannedLeftCents)}</p>
          </div>
          <div className={cx("flex items-center gap-1 pb-0.5 text-sm font-semibold", tone(forecastDelta, true))}>
            {forecastDelta > 0 ? <TrendingUp className="size-4" /> : forecastDelta < 0 ? <TrendingDown className="size-4" /> : null}
            <span className="num">{forecastDelta === 0 ? "как в плане" : m(forecastDelta, true)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
