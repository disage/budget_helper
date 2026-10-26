"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft, ArrowUpRight, Check, CircleCheck, CreditCard, Landmark, PiggyBank, Plus, Repeat, ShieldCheck, Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "../AppShell";
import { MonthSwitcher } from "../MonthSwitcher";
import { useQuickAdd } from "../QuickAdd";
import { CategoryBadgeIcon } from "../icons";
import { useAppData, useConfirm, useToast } from "../providers";
import { Badge, Button, Card, ProgressBar } from "../ui";
import { ExpenseDonut } from "./ExpenseDonut";
import { PlanCompare } from "./PlanCompare";
import { PlanVsActual } from "./PlanVsActual";
import { api, cx } from "@/lib/client";
import { themedColor } from "@/lib/palette";
import { useIsDark } from "../useIsDark";
import { defaultPayDate, monthLabel } from "@/lib/month";
import type { CategoryRow, Summary } from "@/lib/budget";
import type { GoalInfo } from "@/lib/data";
import { DEBT_TYPE_LABELS } from "@/lib/types";

export function Dashboard({ s, goals }: { s: Summary; goals: GoalInfo[] }) {
  const quickAdd = useQuickAdd();
  const empty = s.transactionCount === 0;

  return (
    <>
      <PageHeader title="Дашборд" subtitle={`Бюджет за ${monthLabel(s.month).toLowerCase()}`}>
        <MonthSwitcher month={s.month} />
        <div className="hidden sm:block lg:hidden">
          <Button onClick={() => quickAdd()}>
            <Plus className="size-4" /> Операция
          </Button>
        </div>
      </PageHeader>

      {empty && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-dashed border-brand-300 bg-brand-25 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-brand-800 dark:bg-brand-500/5">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">В этом месяце пока нет операций</p>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Начни с дохода за месяц: зарплата пополнит баланс, а потом отмечай траты по категориям.
            </p>
          </div>
          <Button onClick={() => quickAdd({ type: "INCOME" })} className="shrink-0">
            <Plus className="size-4" /> Добавить доход
          </Button>
        </div>
      )}

      <Kpis s={s} />
      <div className="mt-6">
        <PlanCompare s={s} />
      </div>
      <MoneyFlow s={s} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <SavingsCard s={s} goals={goals} />
        <RecurringCard s={s} />
        <DebtsCard s={s} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Куда ушли деньги" subtitle="Расходы по категориям, нажми на категорию, чтобы увидеть операции">
          <ExpenseDonut rows={s.expenseRows} month={s.month} totalCents={s.expenseCents} />
        </Card>
        <Card
          title="План vs факт"
          subtitle="Серая дорожка — план, полоса — сколько потрачено"
          action={<Link href={`/plan?month=${s.month}`} className="shrink-0 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">План</Link>}
        >
          <PlanVsActual rows={s.expenseRows} month={s.month} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <CategoryTable title="Расходы" rows={s.expenseRows} month={s.month} kind="EXPENSE" />
        <CategoryTable title="Доходы" rows={s.incomeRows} month={s.month} kind="INCOME" />
      </div>
    </>
  );
}

// ---------- KPI ----------

function Kpi({ icon, label, value, hint, tone = "gray", highlight, className }: { icon: ReactNode; label: string; value: string; hint?: ReactNode; tone?: "gray" | "success" | "brand" | "saving" | "error"; highlight?: boolean; className?: string }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
    saving: "bg-saving-50 text-saving-600 dark:bg-saving-500/15 dark:text-[#8f9cff]",
    error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  };
  return (
    <div
      className={cx(
        "min-w-0 rounded-2xl border p-4 sm:p-5",
        className,
        highlight
          ? "border-gray-900 bg-gray-900 text-white dark:border-white/10 dark:bg-white/[0.07]"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
      )}
    >
      <div className={cx("flex size-9 items-center justify-center rounded-xl sm:size-10", highlight ? "bg-white/10 text-white" : tones[tone])}>{icon}</div>
      <p className={cx("mt-3 text-sm sm:mt-4", highlight ? "text-gray-300" : "text-gray-500 dark:text-gray-400")}>{label}</p>
      <p className={cx("mt-1 text-xl font-semibold tracking-tight min-[400px]:text-2xl sm:text-[28px]", highlight ? "text-white" : "text-gray-900 dark:text-white", tone === "error" && !highlight && "text-error-600 dark:text-error-500")}>
        {value}
      </p>
      {hint && <p className={cx("mt-1.5 text-xs leading-snug", highlight ? "text-gray-400" : "text-gray-500 dark:text-gray-400")}>{hint}</p>}
    </div>
  );
}

function Kpis({ s }: { s: Summary }) {
  const { money } = useAppData();
  const m = (v: number) => money(v, { compact: true });
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
      <Kpi
        icon={<ArrowDownLeft className="size-5" />}
        tone="success"
        label="Доход"
        value={m(s.incomeCents)}
        hint={s.plannedIncomeCents > 0 ? `План ${m(s.plannedIncomeCents)}` : "Всё, что пришло за месяц"}
      />
      <Kpi
        icon={<ArrowUpRight className="size-5" />}
        tone="brand"
        label="Расходы"
        value={m(s.expenseCents)}
        hint={
          s.plan.expenseCents > 0
            ? `План ${m(s.plan.expenseCents)} · ${s.expenseCents > s.plan.expenseCents ? `перерасход ${m(s.expenseCents - s.plan.expenseCents)}` : `осталось ${m(s.plan.expenseCents - s.expenseCents)}`}`
            : `Обязательные ${m(s.mandatoryPaidCents)} · прочие ${m(s.discretionaryCents)}`
        }
      />
      <Kpi
        icon={<ShieldCheck className="size-5" />}
        tone={s.freeCents < 0 ? "error" : "gray"}
        label="Свободные деньги"
        value={m(s.freeCents)}
        hint={
          s.mandatoryExpectedCents > 0
            ? `Доход − обязательные ${m(s.mandatoryCents)} (ещё не оплачено ${m(s.mandatoryExpectedCents)})`
            : `Доход − обязательные ${m(s.mandatoryCents)}`
        }
      />
      <Kpi
        icon={<Wallet className="size-5" />}
        tone={s.canSpendCents < 0 ? "error" : "gray"}
        highlight
        className="order-first col-span-2 md:order-none md:col-span-1"
        label="Ещё можно потратить"
        value={m(s.canSpendCents)}
        hint={
          s.incomeCents === 0 && s.mandatoryCents > 0
            ? `Дохода пока нет, а обязательные ${m(s.mandatoryCents)} уже учтены`
            : s.canSpendCents < 0
              ? "Траты больше свободных денег"
              : "Свободные − прочие траты − отложено"
        }
      />
      <Kpi
        icon={<Landmark className="size-5" />}
        tone={s.endBalanceCents < 0 ? "error" : "gray"}
        label="Баланс на конец"
        value={m(s.endBalanceCents)}
        hint={`На начало месяца ${m(s.startBalanceCents)}`}
      />
    </div>
  );
}

// ---------- Поток денег: доход → обязательные / прочие / отложено / остаток ----------

function MoneyFlow({ s }: { s: Summary }) {
  const { money } = useAppData();
  if (s.incomeCents <= 0 && s.expenseCents <= 0) return null;
  const left = s.incomeCents - s.expenseCents - s.savedCents;
  const parts = [
    { key: "m", label: "Обязательные", value: s.mandatoryPaidCents, cls: "bg-gray-700 dark:bg-gray-300" },
    { key: "d", label: "Прочие траты", value: s.discretionaryCents, cls: "bg-brand-500" },
    { key: "s", label: "Отложено", value: s.savedCents, cls: "bg-saving-500" },
    { key: "l", label: "Осталось", value: Math.max(left, 0), cls: "bg-success-500" },
  ].filter((p) => p.value > 0);
  const total = Math.max(s.incomeCents, s.expenseCents + s.savedCents);
  return (
    <Card className="mt-6" bodyClassName="!pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Пришло {money(s.incomeCents, { compact: true })} — вот как оно разошлось</h2>
        {left < 0 && <Badge tone="error">Потрачено больше, чем пришло: {money(-left, { compact: true })}</Badge>}
      </div>
      <div className="mt-4 flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {parts.map((p) => (
          <div key={p.key} className={cx("h-full first:rounded-l-full last:rounded-r-full", p.cls)} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${money(p.value)}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {[
          { label: "Обязательные", value: s.mandatoryPaidCents, cls: "bg-gray-700 dark:bg-gray-300" },
          { label: "Прочие траты", value: s.discretionaryCents, cls: "bg-brand-500" },
          { label: "Отложено", value: s.savedCents, cls: "bg-saving-500" },
          { label: "Осталось", value: left, cls: "bg-success-500" },
        ].map((p) => (
          <li key={p.label}>
            <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className={cx("size-2.5 rounded-sm", p.cls)} /> {p.label}
            </span>
            <span className={cx("num mt-0.5 block text-sm font-semibold", p.value < 0 ? "text-error-600" : "text-gray-800 dark:text-white/90")}>
              {money(p.value, { compact: true })}
              {s.incomeCents > 0 && p.value > 0 && (
                <span className="ml-1.5 font-normal text-gray-400">{Math.round((p.value / s.incomeCents) * 100)}%</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- Накопления ----------

function SavingsCard({ s, goals }: { s: Summary; goals: GoalInfo[] }) {
  const { money, settings } = useAppData();
  const dark = useIsDark();
  const quickAdd = useQuickAdd();
  const target = s.savingsPossibleCents;
  const done = target > 0 && s.savedCents >= target;
  const remaining = Math.max(target - s.savedCents, 0);
  return (
    <Card
      title="Накопления"
      subtitle={`До ${settings.savingsPercent}% от зарплаты, но не больше свободных денег`}
      action={done ? <Badge tone="success"><Check className="size-3" /> Цель выполнена</Badge> : undefined}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Отложено по факту</p>
          <p className="num mt-1 text-3xl font-semibold text-saving-600 dark:text-[#8f9cff]">{money(s.savedCents, { compact: true })}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Можно было</p>
          <p className="num mt-1 text-xl font-semibold text-gray-800 dark:text-white/90">{money(target, { compact: true })}</p>
        </div>
      </div>
      <ProgressBar value={s.savedCents} max={target || 1} tone="saving" className="mt-4 h-2.5" />
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        {s.salaryCents === 0
          ? "Зарплаты в этом месяце ещё нет, поэтому лимит пока 0."
          : done
            ? `Отложено ${Math.round((s.savedCents / s.salaryCents) * 100)}% от зарплаты.`
            : `Осталось отложить ${money(remaining, { compact: true })}. Это ${settings.savingsPercent}% от зарплаты ${money(s.salaryCents, { compact: true })}${target < Math.round((s.salaryCents * settings.savingsPercent) / 100) ? ", урезано до свободных денег" : ""}.`}
      </p>
      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={() => quickAdd({ type: "SAVING", amountCents: remaining || undefined, description: "Накопления" })}
      >
        <PiggyBank className="size-4" /> Отложить
      </Button>

      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Цели</p>
          <Link href="/goals" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
            {goals.length ? "Все цели" : "Добавить цель"}
          </Link>
        </div>
        {goals.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Поставь цель — например, машину — и откладывай прямо в неё.</p>
        ) : (
          <ul className="space-y-3">
            {goals.map(({ goal: g, progress: p }) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() =>
                    quickAdd({
                      type: "SAVING",
                      goalId: g.id,
                      amountCents: p.monthlyNeededCents ? Math.min(p.monthlyNeededCents, p.remainingCents) || undefined : undefined,
                      title: `В копилку: ${g.name}`,
                    })
                  }
                  className="group flex w-full items-center gap-3 rounded-lg text-left"
                  title="Пополнить"
                >
                  <CategoryBadgeIcon icon={g.icon} color={g.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-gray-800 group-hover:underline dark:text-white/90">{g.name}</span>
                      <span className="num shrink-0 text-gray-500 dark:text-gray-400">
                        <b className="font-semibold text-gray-800 dark:text-white/90">{money(p.savedCents, { compact: true })}</b> из {money(g.targetCents, { compact: true })}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <span className="block h-full rounded-full" style={{ width: `${p.percent}%`, backgroundColor: themedColor(g.color, dark) }} />
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {p.savedThisMonthCents > 0 ? `+${money(p.savedThisMonthCents, { compact: true })} в этом месяце` : "в этом месяце ещё не пополняли"}
                      {p.monthlyNeededCents ? ` · нужно ${money(p.monthlyNeededCents, { compact: true })}/мес` : ""}
                    </span>
                  </span>
                  <Plus className="size-4 shrink-0 text-gray-400 group-hover:text-saving-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ---------- Регулярные платежи ----------

function RecurringCard({ s }: { s: Summary }) {
  const { money, category } = useAppData();
  const quickAdd = useQuickAdd();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const total = s.recurring.reduce((a, r) => a + r.amountCents, 0);
  const paidCount = s.recurring.filter((r) => r.paid).length;

  async function unpay(ids: number[], name: string) {
    const ok = await confirm({
      title: `Отменить оплату «${name}»?`,
      text: "Связанная операция расхода будет удалена.",
      confirmText: "Отменить оплату",
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => api(`/api/transactions/${id}`, { method: "DELETE" })));
      toast("Оплата отменена");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <Card
      title="Регулярные платежи"
      subtitle={s.recurring.length ? `Оплачено ${paidCount} из ${s.recurring.length} · осталось ${money(s.mandatoryExpectedCents, { compact: true })}` : undefined}
      action={<Link href="/recurring" className="shrink-0 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">Настроить</Link>}
    >
      {s.recurring.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <Repeat className="mx-auto mb-2 size-5" />
          Добавь связь, коммуналку, проезд и платежи по долгам — они будут вычитаться из свободных денег.
        </div>
      ) : (
        <>
          <ProgressBar value={paidCount} max={s.recurring.length} tone="success" className="mb-3" />
          <ul className="-mx-2 divide-y divide-gray-100 dark:divide-gray-800">
            {s.recurring.map((r) => {
              const cat = category(r.categoryId);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() =>
                      r.paid
                        ? unpay(r.transactionIds, r.name)
                        : quickAdd({
                            type: "EXPENSE",
                            categoryId: r.categoryId,
                            debtId: r.debtId,
                            recurringId: r.id,
                            amountCents: r.amountCents,
                            description: r.name,
                            date: defaultPayDate(s.month, r.dayOfMonth),
                            title: `Оплата: ${r.name}`,
                          })
                    }
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <span
                      className={cx(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                        r.paid ? "border-success-500 bg-success-500 text-white" : "border-gray-300 dark:border-gray-600",
                      )}
                      aria-hidden
                    >
                      {r.paid && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    {cat && <CategoryBadgeIcon icon={cat.icon} color={cat.color} size="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-sm font-medium", r.paid ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-800 dark:text-white/90")}>
                        {r.name}
                      </span>
                      {r.dayOfMonth && !r.paid && <span className="block text-xs text-gray-400">до {r.dayOfMonth}-го</span>}
                    </span>
                    <span className={cx("num text-sm font-medium", r.paid ? "text-success-600 dark:text-success-500" : "text-gray-700 dark:text-gray-300")}>
                      {money(r.paid ? r.paidCents : r.amountCents, { compact: true })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">Итого в месяц</span>
            <span className="num font-semibold text-gray-800 dark:text-white/90">{money(total, { compact: true })}</span>
          </p>
        </>
      )}
    </Card>
  );
}

// ---------- Долги ----------

function DebtsCard({ s }: { s: Summary }) {
  const { money } = useAppData();
  const open = s.debts.filter((d) => !d.closed);
  return (
    <Card
      title="Долги"
      subtitle={open.length ? `Осталось ${money(s.debtTotalCents, { compact: true })} · погашено в этом месяце ${money(s.debtPaidInMonthCents, { compact: true })}` : undefined}
      action={<Link href="/debts" className="shrink-0 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">Все долги</Link>}
    >
      {open.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <CircleCheck className="mx-auto mb-2 size-5 text-success-500" />
          Долгов нет. Так держать!
        </div>
      ) : (
        <ul className="space-y-4">
          {open.map((d) => {
            const paid = d.initialCents - Math.max(d.endCents, 0);
            return (
              <li key={d.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <CreditCard className="size-4 shrink-0 text-gray-400" />
                    <span className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{d.name}</span>
                    <span className="hidden text-xs text-gray-400 sm:inline">{DEBT_TYPE_LABELS[d.type]}</span>
                  </span>
                  <span className="num shrink-0 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-800 dark:text-white/90">{money(Math.max(d.endCents, 0), { compact: true })}</span>
                    {" "}из {money(d.initialCents, { compact: true })}
                  </span>
                </div>
                <ProgressBar value={paid} max={d.initialCents} tone="success" />
                {d.paidInMonthCents > 0 && (
                  <p className="mt-1 text-xs text-success-600 dark:text-success-500">−{money(d.paidInMonthCents, { compact: true })} в этом месяце</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- Таблица категорий (как в исходной таблице) ----------

function CategoryTable({ title, rows, month, kind }: { title: string; rows: CategoryRow[]; month: string; kind: "EXPENSE" | "INCOME" }) {
  const { money } = useAppData();
  const totals = rows.reduce(
    (a, r) => ({ p: a.p + r.plannedCents, f: a.f + r.actualCents, d: a.d + r.diffCents }),
    { p: 0, f: 0, d: 0 },
  );
  const diffCls = (v: number) =>
    v > 0 ? "text-success-600 dark:text-success-500" : v < 0 ? "text-error-600 dark:text-error-500" : "text-gray-400";
  const visible = rows.filter((r) => r.plannedCents > 0 || r.actualCents > 0);
  const hidden = rows.length - visible.length;

  return (
    <Card title={title} bodyClassName="!px-0 !pb-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-y border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="py-3 pr-2 pl-5 font-medium sm:pl-6">Категория</th>
              <th className="px-2 py-3 text-right font-medium">План</th>
              <th className="px-2 py-3 text-right font-medium">Факт</th>
              <th className="py-3 pr-5 pl-2 text-right font-medium sm:pr-6">Разница</th>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50/60 text-xs dark:border-gray-800 dark:bg-white/[0.02]">
              <td className="py-2 pr-2 pl-5 italic text-gray-500 sm:pl-6">Итого</td>
              <td className="num px-2 py-2 text-right text-gray-600 dark:text-gray-400">{money(totals.p, { compact: true })}</td>
              <td className="num px-2 py-2 text-right font-semibold text-gray-800 dark:text-white/90">{money(totals.f, { compact: true })}</td>
              <td className={cx("num py-2 pr-5 pl-2 text-right font-medium sm:pr-6", diffCls(totals.d))}>{money(totals.d, { compact: true, sign: true })}</td>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Пока пусто
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id ?? "none"} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="py-2.5 pr-2 pl-5 sm:pl-6">
                  <Link
                    href={`/transactions?month=${month}&${r.id == null ? "categoryId=none" : `categoryId=${r.id}`}&type=${kind}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <CategoryBadgeIcon icon={r.icon} color={r.color} size="sm" />
                    <span className="font-medium text-gray-800 dark:text-white/90">{r.name}</span>
                    {r.isMandatory && <Badge className="hidden sm:inline-flex">обяз.</Badge>}
                    {r.id == null && <Badge tone="warning">проверь</Badge>}
                  </Link>
                </td>
                <td className="num px-2 py-2.5 text-right text-gray-600 dark:text-gray-400">{r.plannedCents ? money(r.plannedCents, { compact: true }) : "—"}</td>
                <td className="num px-2 py-2.5 text-right font-medium text-gray-800 dark:text-white/90">{money(r.actualCents, { compact: true })}</td>
                <td className={cx("num py-2.5 pr-5 pl-2 text-right sm:pr-6", diffCls(r.diffCents))}>{money(r.diffCents, { compact: true, sign: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 && <p className="px-5 pt-2 pb-2 text-xs text-gray-400 sm:px-6">Ещё {hidden} категорий без плана и трат скрыто</p>}
    </Card>
  );
}
