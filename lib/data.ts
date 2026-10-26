// Серверный слой: загрузка из БД и приведение к DTO. Расчёты — в lib/budget.ts.
import "server-only";
import type { Category, Debt, RecurringPayment, SavingsGoal, Transaction } from "@prisma/client";
import { prisma } from "./db";
import { computeSummary, goalProgress, type GoalProgress, type Summary } from "./budget";
import { currentMonth, monthOf, monthOrCurrent, monthRange, toDateInput } from "./month";
import { SEED_CATEGORIES } from "./seed-data";
import type {
  CategoryDTO,
  CategoryKind,
  DebtDTO,
  DebtType,
  GoalDTO,
  RecurringDTO,
  SettingsDTO,
  TransactionDTO,
  TxType,
} from "./types";

export const toCategoryDTO = (c: Category): CategoryDTO => ({
  id: c.id,
  name: c.name,
  kind: c.kind as CategoryKind,
  color: c.color,
  icon: c.icon,
  isMandatory: c.isMandatory,
  isSalary: c.isSalary,
  isDebt: c.isDebt,
  sortOrder: c.sortOrder,
  archived: c.archived,
});

export const toDebtDTO = (d: Debt): DebtDTO => ({
  id: d.id,
  name: d.name,
  type: d.type as DebtType,
  initialCents: d.initialCents,
  minPaymentCents: d.minPaymentCents,
  interestRate: d.interestRate,
  note: d.note,
  closedAt: d.closedAt ? d.closedAt.toISOString() : null,
});

export const toTransactionDTO = (t: Transaction): TransactionDTO => ({
  id: t.id,
  date: toDateInput(t.date),
  amountCents: t.amountCents,
  description: t.description,
  type: t.type as TxType,
  categoryId: t.categoryId,
  debtId: t.debtId,
  recurringId: t.recurringId,
  goalId: t.goalId,
});

export const toGoalDTO = (g: SavingsGoal): GoalDTO => ({
  id: g.id,
  name: g.name,
  targetCents: g.targetCents,
  icon: g.icon,
  color: g.color,
  deadline: g.deadline,
  note: g.note,
  achievedAt: g.achievedAt ? g.achievedAt.toISOString() : null,
});

export const toRecurringDTO = (r: RecurringPayment): RecurringDTO => ({
  id: r.id,
  name: r.name,
  amountCents: r.amountCents,
  categoryId: r.categoryId,
  dayOfMonth: r.dayOfMonth,
  debtId: r.debtId,
  active: r.active,
});

export async function getSettings(): Promise<SettingsDTO> {
  const s = await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return { currency: s.currency, savingsPercent: s.savingsPercent, carryOverBalance: s.carryOverBalance, startMonth: s.startMonth };
}

/** Месяц из URL: по умолчанию текущий, но не раньше начала учёта. */
export async function resolveMonth(param: unknown): Promise<string> {
  const month = monthOrCurrent(param);
  const { startMonth } = await getSettings();
  return startMonth && month < startMonth ? startMonth : month;
}

/** Пустая БД (первый запуск) получает категории по умолчанию — без демо-операций. */
export async function ensureDefaults(): Promise<void> {
  if ((await prisma.category.count()) > 0) return;
  // Учёт начинается с месяца первого запуска.
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { startMonth: currentMonth() },
    create: { id: 1, startMonth: currentMonth() },
  });
  await prisma.category.createMany({
    data: SEED_CATEGORIES.map(({ key, ...c }, i) => ({ ...c, sortOrder: i })),
  });
}

export async function getCategories(includeArchived = true): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.map(toCategoryDTO);
}

export async function getDebts(): Promise<DebtDTO[]> {
  const rows = await prisma.debt.findMany({ orderBy: [{ closedAt: "asc" }, { createdAt: "asc" }] });
  return rows.map(toDebtDTO);
}

export async function getGoals(): Promise<GoalDTO[]> {
  const rows = await prisma.savingsGoal.findMany({ orderBy: [{ achievedAt: "asc" }, { createdAt: "asc" }] });
  return rows.map(toGoalDTO);
}

export interface GoalInfo {
  goal: GoalDTO;
  progress: GoalProgress;
  /** Последние взносы, новые сверху. */
  contributions: TransactionDTO[];
  contributionCount: number;
}

/** Цели с прогрессом. `month` — относительно какого месяца считать «в этом месяце» и сроки. */
export async function getGoalInfos(month: string): Promise<GoalInfo[]> {
  const [goals, txs] = await Promise.all([
    getGoals(),
    prisma.transaction.findMany({
      where: { goalId: { not: null }, type: "SAVING" },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
  ]);
  return goals.map((goal) => {
    const own = txs.filter((t) => t.goalId === goal.id);
    const monthly: Record<string, number> = {};
    for (const t of own) monthly[monthOf(t.date)] = (monthly[monthOf(t.date)] ?? 0) + t.amountCents;
    return {
      goal,
      progress: goalProgress(goal.targetCents, monthly, goal.deadline, month),
      contributions: own.slice(0, 12).map(toTransactionDTO),
      contributionCount: own.length,
    };
  });
}

export async function getRecurring(): Promise<RecurringDTO[]> {
  const rows = await prisma.recurringPayment.findMany({ orderBy: [{ active: "desc" }, { dayOfMonth: "asc" }, { id: "asc" }] });
  return rows.map(toRecurringDTO);
}

export interface TransactionFilter {
  month?: string;
  type?: TxType;
  categoryId?: number | null; // null — без категории
  debtId?: number;
  q?: string;
}

export async function getTransactions(f: TransactionFilter = {}): Promise<TransactionDTO[]> {
  const range = f.month ? monthRange(f.month) : null;
  const rows = await prisma.transaction.findMany({
    where: {
      ...(range ? { date: { gte: range.start, lt: range.end } } : {}),
      ...(f.type ? { type: f.type } : {}),
      ...(f.categoryId !== undefined ? { categoryId: f.categoryId } : {}),
      ...(f.debtId ? { debtId: f.debtId } : {}),
      // SQLite contains регистрозависим для кириллицы — фильтруем ниже.
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const q = f.q?.trim().toLowerCase();
  return rows.filter((t) => !q || t.description.toLowerCase().includes(q)).map(toTransactionDTO);
}

/** Баланс на начало месяца: всё, что пришло, минус потрачено и отложено раньше. */
async function startBalance(month: string, carryOver: boolean): Promise<number> {
  if (!carryOver) return 0;
  const { start } = monthRange(month);
  const groups = await prisma.transaction.groupBy({
    by: ["type"],
    where: { date: { lt: start } },
    _sum: { amountCents: true },
  });
  return groups.reduce((acc, g) => {
    const v = g._sum.amountCents ?? 0;
    return g.type === "INCOME" ? acc + v : acc - v;
  }, 0);
}

export async function getSummary(month: string): Promise<Summary> {
  const { start, end } = monthRange(month);
  const [settings, categories, transactions, plans, recurring, debts, paidBefore] = await Promise.all([
    getSettings(),
    getCategories(),
    prisma.transaction.findMany({ where: { date: { gte: start, lt: end } } }),
    prisma.monthPlan.findMany({ where: { month } }),
    prisma.recurringPayment.findMany({ orderBy: [{ dayOfMonth: "asc" }, { id: "asc" }] }),
    prisma.debt.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.transaction.groupBy({
      by: ["debtId"],
      where: { debtId: { not: null }, date: { lt: start } },
      _sum: { amountCents: true },
    }),
  ]);

  return computeSummary({
    month,
    savingsPercent: settings.savingsPercent,
    startBalanceCents: await startBalance(month, settings.carryOverBalance),
    categories,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type as TxType,
      amountCents: t.amountCents,
      categoryId: t.categoryId,
      debtId: t.debtId,
      recurringId: t.recurringId,
    })),
    plans,
    recurring: recurring.map(toRecurringDTO),
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type as DebtType,
      initialCents: d.initialCents,
      minPaymentCents: d.minPaymentCents,
      // Долг закрыт, если его закрыли до конца выбранного месяца.
      closed: !!d.closedAt && d.closedAt < end,
    })),
    debtPaidBeforeCents: Object.fromEntries(paidBefore.map((g) => [g.debtId!, g._sum.amountCents ?? 0])),
  });
}

/** Платежи по долгу, сгруппированные по месяцам: { "2026-06": 30000 }. */
export async function getDebtPaymentsByMonth(): Promise<Record<number, Record<string, number>>> {
  const rows = await prisma.transaction.findMany({
    where: { debtId: { not: null } },
    select: { debtId: true, date: true, amountCents: true },
  });
  const out: Record<number, Record<string, number>> = {};
  for (const r of rows) {
    const m = monthOf(r.date);
    out[r.debtId!] ??= {};
    out[r.debtId!][m] = (out[r.debtId!][m] ?? 0) + r.amountCents;
  }
  return out;
}
