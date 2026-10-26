// Чистые функции расчёта бюджета. Никакого доступа к БД — только данные на входе.
import type { CategoryDTO, CategoryKind, DebtType, TxType } from "./types";
import { monthDiff, shiftMonth } from "./month";

export interface TxLite {
  id: number;
  type: TxType;
  amountCents: number;
  categoryId: number | null;
  debtId: number | null;
  recurringId: number | null;
}

export interface RecurringLite {
  id: number;
  name: string;
  amountCents: number;
  categoryId: number;
  debtId: number | null;
  dayOfMonth: number | null;
  active: boolean;
}

export interface DebtLite {
  id: number;
  name: string;
  type: DebtType;
  initialCents: number;
  minPaymentCents: number;
  closed: boolean;
}

export interface SummaryInput {
  month: string;
  savingsPercent: number;
  startBalanceCents: number;
  categories: CategoryDTO[];
  /** Только операции выбранного месяца. */
  transactions: TxLite[];
  plans: { categoryId: number; plannedCents: number }[];
  recurring: RecurringLite[];
  debts: DebtLite[];
  /** Сумма платежей по каждому долгу до начала месяца. */
  debtPaidBeforeCents: Record<number, number>;
}

export interface CategoryRow {
  id: number | null; // null — «Без категории»
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  isMandatory: boolean;
  plannedCents: number;
  actualCents: number;
  /** Расходы: план − факт (минус = перерасход). Доходы: факт − план. */
  diffCents: number;
  /** Факт в % от плана, null если плана нет. */
  percent: number | null;
  count: number;
}

export interface RecurringRow extends RecurringLite {
  paid: boolean;
  paidCents: number;
  transactionIds: number[];
}

export interface DebtRow extends DebtLite {
  startCents: number;
  endCents: number;
  paidInMonthCents: number;
}

export interface Summary {
  month: string;
  startBalanceCents: number;
  incomeCents: number;
  salaryCents: number;
  expenseCents: number;
  /** Уже оплаченные обязательные траты. */
  mandatoryPaidCents: number;
  /** Ещё не оплаченные регулярные платежи (по плановой сумме). */
  mandatoryExpectedCents: number;
  mandatoryCents: number;
  freeCents: number;
  savingsPossibleCents: number;
  savedCents: number;
  /** Необязательные расходы. */
  discretionaryCents: number;
  canSpendCents: number;
  endBalanceCents: number;
  plannedIncomeCents: number;
  plannedExpenseCents: number;
  uncategorizedCents: number;
  expenseRows: CategoryRow[];
  incomeRows: CategoryRow[];
  recurring: RecurringRow[];
  debts: DebtRow[];
  debtTotalCents: number;
  debtPaidInMonthCents: number;
  transactionCount: number;
  /** Плановые итоги месяца (по плану категорий). */
  plan: PlanTotals;
  /**
   * Прогноз «если дальше всё пойдёт по плану»: по каждой категории берётся
   * max(факт + неоплаченные регулярные платежи, план).
   */
  forecastIncomeCents: number;
  forecastExpenseCents: number;
  /** Прогноз остатка на конец месяца: доход − расходы − отложено. */
  forecastLeftCents: number;
  /** Плановый остаток: плановый доход − плановые расходы. */
  plannedLeftCents: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function computeSummary(input: SummaryInput): Summary {
  const cats = new Map(input.categories.map((c) => [c.id, c]));
  const txs = input.transactions;
  const ofType = (t: TxType) => txs.filter((tx) => tx.type === t);

  const expenses = ofType("EXPENSE");
  const incomes = ofType("INCOME");
  const savings = ofType("SAVING");

  const incomeCents = sum(incomes.map((t) => t.amountCents));
  const salaryCents = sum(
    incomes.filter((t) => t.categoryId != null && cats.get(t.categoryId)?.isSalary).map((t) => t.amountCents),
  );
  const expenseCents = sum(expenses.map((t) => t.amountCents));
  const savedCents = sum(savings.map((t) => t.amountCents));

  // Обязательная трата — в обязательной категории или оплата регулярного платежа.
  const isMandatory = (t: TxLite) =>
    t.recurringId != null || (t.categoryId != null && !!cats.get(t.categoryId)?.isMandatory);
  const mandatoryPaidCents = sum(expenses.filter(isMandatory).map((t) => t.amountCents));

  const recurring: RecurringRow[] = input.recurring
    .map((r) => {
      const paidTx = expenses.filter((t) => t.recurringId === r.id);
      return {
        ...r,
        paid: paidTx.length > 0,
        paidCents: sum(paidTx.map((t) => t.amountCents)),
        transactionIds: paidTx.map((t) => t.id),
      };
    })
    .filter((r) => r.active || r.paid);

  const mandatoryExpectedCents = sum(recurring.filter((r) => r.active && !r.paid).map((r) => r.amountCents));
  const mandatoryCents = mandatoryPaidCents + mandatoryExpectedCents;
  const freeCents = incomeCents - mandatoryCents;
  const savingsPossibleCents = Math.max(
    0,
    Math.min(Math.round((salaryCents * input.savingsPercent) / 100), freeCents),
  );
  const discretionaryCents = expenseCents - mandatoryPaidCents;
  const canSpendCents = freeCents - discretionaryCents - savedCents;
  const endBalanceCents = input.startBalanceCents + incomeCents - expenseCents - savedCents;

  const plans = new Map(input.plans.map((p) => [p.categoryId, p.plannedCents]));
  const rowsFor = (kind: CategoryKind, list: TxLite[]): CategoryRow[] =>
    input.categories
      .filter((c) => c.kind === kind)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((c) => {
        const own = list.filter((t) => t.categoryId === c.id);
        const plannedCents = plans.get(c.id) ?? 0;
        const actualCents = sum(own.map((t) => t.amountCents));
        const row: CategoryRow = {
          id: c.id,
          name: c.name,
          kind,
          color: c.color,
          icon: c.icon,
          isMandatory: c.isMandatory,
          plannedCents,
          actualCents,
          diffCents: kind === "EXPENSE" ? plannedCents - actualCents : actualCents - plannedCents,
          percent: plannedCents > 0 ? (actualCents / plannedCents) * 100 : null,
          count: own.length,
        };
        return { archived: c.archived, row };
      })
      // Архивные категории показываем, только если в этом месяце по ним что-то есть.
      .filter(({ archived, row }) => !archived || row.count > 0 || row.plannedCents > 0)
      .map(({ row }) => row);

  const expenseRows = rowsFor("EXPENSE", expenses);
  const uncategorized = expenses.filter((t) => t.categoryId == null || cats.get(t.categoryId)?.kind !== "EXPENSE");
  const uncategorizedCents = sum(uncategorized.map((t) => t.amountCents));
  if (uncategorized.length > 0) {
    expenseRows.push({
      id: null,
      name: "Без категории",
      kind: "EXPENSE",
      color: "#98A2B3",
      icon: "circle-help",
      isMandatory: false,
      plannedCents: 0,
      actualCents: uncategorizedCents,
      diffCents: -uncategorizedCents,
      percent: null,
      count: uncategorized.length,
    });
  }
  const incomeRows = rowsFor("INCOME", incomes);

  const debts: DebtRow[] = input.debts
    .map((d) => {
      const paidInMonthCents = sum(expenses.filter((t) => t.debtId === d.id).map((t) => t.amountCents));
      const startCents = d.initialCents - (input.debtPaidBeforeCents[d.id] ?? 0);
      return { ...d, startCents, endCents: startCents - paidInMonthCents, paidInMonthCents };
    })
    .filter((d) => !d.closed || d.paidInMonthCents > 0);

  // Прогноз: факт по категории, но не меньше плана; неоплаченные регулярные платежи — к своей категории.
  const unpaidByCategory = new Map<number, number>();
  for (const r of recurring.filter((x) => x.active && !x.paid)) {
    unpaidByCategory.set(r.categoryId, (unpaidByCategory.get(r.categoryId) ?? 0) + r.amountCents);
  }
  const forecastExpenseCents = sum(
    expenseRows.map((r) => Math.max(r.actualCents + (r.id != null ? (unpaidByCategory.get(r.id) ?? 0) : 0), r.plannedCents)),
  );
  // Регулярные платежи в категориях, которых нет среди строк (например, архивных).
  const shownIds = new Set(expenseRows.map((r) => r.id));
  const unpaidOutside = sum([...unpaidByCategory].filter(([id]) => !shownIds.has(id)).map(([, v]) => v));
  const forecastIncomeCents = sum(incomeRows.map((r) => Math.max(r.actualCents, r.plannedCents)));
  const plan = planTotals(input.categories, Object.fromEntries(plans), input.savingsPercent);

  return {
    month: input.month,
    startBalanceCents: input.startBalanceCents,
    incomeCents,
    salaryCents,
    expenseCents,
    mandatoryPaidCents,
    mandatoryExpectedCents,
    mandatoryCents,
    freeCents,
    savingsPossibleCents,
    savedCents,
    discretionaryCents,
    canSpendCents,
    endBalanceCents,
    plannedIncomeCents: sum(incomeRows.map((r) => r.plannedCents)),
    plannedExpenseCents: sum(expenseRows.map((r) => r.plannedCents)),
    uncategorizedCents,
    expenseRows,
    incomeRows,
    recurring,
    debts,
    debtTotalCents: sum(debts.filter((d) => !d.closed).map((d) => Math.max(d.endCents, 0))),
    debtPaidInMonthCents: sum(debts.map((d) => d.paidInMonthCents)),
    transactionCount: txs.length,
    plan,
    forecastIncomeCents,
    forecastExpenseCents: forecastExpenseCents + unpaidOutside,
    forecastLeftCents: forecastIncomeCents - forecastExpenseCents - unpaidOutside - savedCents,
    plannedLeftCents: plan.leftoverCents,
  };
}

export interface PlanTotals {
  incomeCents: number;
  salaryCents: number;
  expenseCents: number;
  mandatoryCents: number;
  freeCents: number;
  savingsPossibleCents: number;
  leftoverCents: number;
}

/** Плановые итоги месяца — для живого пересчёта на странице «План». */
export function planTotals(
  categories: CategoryDTO[],
  planned: Record<number, number>,
  savingsPercent: number,
): PlanTotals {
  const pick = (f: (c: CategoryDTO) => boolean) =>
    sum(categories.filter(f).map((c) => planned[c.id] ?? 0));
  const incomeCents = pick((c) => c.kind === "INCOME");
  const salaryCents = pick((c) => c.kind === "INCOME" && c.isSalary);
  const expenseCents = pick((c) => c.kind === "EXPENSE");
  const mandatoryCents = pick((c) => c.kind === "EXPENSE" && c.isMandatory);
  const freeCents = incomeCents - mandatoryCents;
  return {
    incomeCents,
    salaryCents,
    expenseCents,
    mandatoryCents,
    freeCents,
    savingsPossibleCents: Math.max(0, Math.min(Math.round((salaryCents * savingsPercent) / 100), freeCents)),
    leftoverCents: incomeCents - expenseCents,
  };
}

/**
 * Примерный месяц полного погашения долга.
 * Темп — среднее по последним трём месяцам с платежами, иначе минимальный платёж.
 * @param monthlyPaid суммы платежей по месяцам, от старых к новым
 */
export function estimatePayoff(
  remainingCents: number,
  monthlyPaid: number[],
  minPaymentCents: number,
  fromMonth: string,
): string | null {
  if (remainingCents <= 0) return fromMonth;
  const recent = monthlyPaid.filter((v) => v > 0).slice(-3);
  const pace = recent.length > 0 ? sum(recent) / recent.length : minPaymentCents;
  if (pace <= 0) return null;
  return shiftMonth(fromMonth, Math.ceil(remainingCents / pace));
}

export interface GoalProgress {
  savedCents: number;
  remainingCents: number;
  percent: number;
  savedThisMonthCents: number;
  /** Сколько месяцев осталось до дедлайна, включая текущий. null — дедлайна нет. */
  monthsLeft: number | null;
  /** Сколько нужно откладывать в месяц, чтобы успеть к дедлайну. */
  monthlyNeededCents: number | null;
  overdue: boolean;
  /** Примерный месяц достижения цели при текущем темпе. */
  etaMonth: string | null;
}

/**
 * Прогресс цели накоплений.
 * @param monthly суммы взносов по месяцам: { "2026-06": 10000 }
 */
export function goalProgress(
  targetCents: number,
  monthly: Record<string, number>,
  deadline: string | null,
  currentMonth: string,
): GoalProgress {
  const savedCents = sum(Object.values(monthly));
  const remainingCents = Math.max(targetCents - savedCents, 0);
  const monthsLeft = deadline ? Math.max(monthDiff(currentMonth, deadline) + 1, 0) : null;
  const overdue = monthsLeft === 0 && remainingCents > 0;
  const history = Object.keys(monthly)
    .filter((m) => m <= currentMonth)
    .sort()
    .map((m) => monthly[m]);
  return {
    savedCents,
    remainingCents,
    percent: targetCents > 0 ? Math.min(100, (savedCents / targetCents) * 100) : 0,
    savedThisMonthCents: monthly[currentMonth] ?? 0,
    monthsLeft,
    monthlyNeededCents: monthsLeft ? Math.ceil(remainingCents / monthsLeft) : null,
    overdue,
    etaMonth: remainingCents === 0 ? null : estimatePayoff(remainingCents, history, 0, currentMonth),
  };
}
