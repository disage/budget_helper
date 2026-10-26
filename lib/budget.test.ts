import { describe, expect, it } from "vitest";
import { computeSummary, estimatePayoff, goalProgress, planTotals, type SummaryInput } from "./budget";
import { parseMoney, formatMoney } from "./money";
import { byMonthLabel, defaultPayDate, shiftMonth } from "./month";
import {
  SEED_CATEGORIES,
  SEED_DEBTS,
  SEED_MONTH,
  SEED_PLAN,
  SEED_RECURRING,
  SEED_TRANSACTIONS,
} from "./seed-data";
import type { CategoryDTO } from "./types";

// Повторяет prisma/seed.ts, только id выдаются по порядку.
function seedInput(): SummaryInput {
  const catId = (key: string) => SEED_CATEGORIES.findIndex((c) => c.key === key) + 1;
  const debtId = (key: string) => SEED_DEBTS.findIndex((d) => d.key === key) + 1;
  const recId = (key: string) => SEED_RECURRING.findIndex((r) => r.key === key) + 1;

  const categories: CategoryDTO[] = SEED_CATEGORIES.map((c, i) => ({
    id: i + 1,
    name: c.name,
    kind: c.kind,
    color: c.color,
    icon: c.icon,
    isMandatory: !!c.isMandatory,
    isSalary: !!c.isSalary,
    isDebt: !!c.isDebt,
    sortOrder: i,
    archived: false,
  }));

  return {
    month: SEED_MONTH,
    savingsPercent: 10,
    startBalanceCents: 0,
    categories,
    transactions: SEED_TRANSACTIONS.map((t, i) => ({
      id: i + 1,
      type: t.type,
      amountCents: t.amountCents,
      categoryId: t.category ? catId(t.category) : null,
      debtId: t.debt ? debtId(t.debt) : null,
      recurringId: t.recurring ? recId(t.recurring) : null,
    })),
    plans: Object.entries(SEED_PLAN).map(([key, plannedCents]) => ({ categoryId: catId(key), plannedCents })),
    recurring: SEED_RECURRING.map((r, i) => ({
      id: i + 1,
      name: r.name,
      amountCents: r.amountCents,
      categoryId: catId(r.category),
      debtId: r.debt ? debtId(r.debt) : null,
      dayOfMonth: r.dayOfMonth ?? null,
      active: true,
    })),
    debts: SEED_DEBTS.map((d, i) => ({
      id: i + 1,
      name: d.name,
      type: d.type,
      initialCents: d.initialCents,
      minPaymentCents: d.minPaymentCents,
      closed: false,
    })),
    debtPaidBeforeCents: {},
  };
}

describe("computeSummary — июнь 2026 из таблицы", () => {
  const s = computeSummary(seedInput());

  it("доходы и расходы", () => {
    expect(s.incomeCents).toBe(131_000);
    expect(s.salaryCents).toBe(131_000);
    expect(s.expenseCents).toBe(117_000);
  });

  it("обязательные и свободные деньги", () => {
    expect(s.mandatoryCents).toBe(47_000); // 60 + 60 + 50 + 100 + 200
    expect(s.mandatoryExpectedCents).toBe(0);
    expect(s.freeCents).toBe(84_000);
  });

  it("накопления", () => {
    expect(s.savingsPossibleCents).toBe(13_100);
    expect(s.savedCents).toBe(0);
  });

  it("остатки", () => {
    expect(s.canSpendCents).toBe(14_000); // 840 − 300 − 400
    expect(s.endBalanceCents).toBe(14_000);
  });

  it("долги", () => {
    const byName = Object.fromEntries(s.debts.map((d) => [d.name, d.endCents]));
    expect(byName["Мама"]).toBe(90_000);
    expect(byName["TF Bank card"]).toBe(180_000);
    expect(s.debtTotalCents).toBe(270_000);
    expect(s.debtPaidInMonthCents).toBe(30_000);
  });

  it("план и прогноз на конец месяца", () => {
    expect(s.plan).toMatchObject({ incomeCents: 131_000, expenseCents: 112_000, mandatoryCents: 47_000, freeCents: 84_000, savingsPossibleCents: 13_100 });
    // Еда: max(300, 350) = 350; Прочее: max(400, 300) = 400; остальное по факту = плану.
    expect(s.forecastExpenseCents).toBe(122_000);
    expect(s.forecastIncomeCents).toBe(131_000);
    expect(s.forecastLeftCents).toBe(9_000);
    expect(s.plannedLeftCents).toBe(19_000);
  });

  it("все регулярные платежи оплачены", () => {
    expect(s.recurring.every((r) => r.paid)).toBe(true);
  });

  it("строки категорий: план, факт, разница", () => {
    const food = s.expenseRows.find((r) => r.name === "Еда")!;
    expect(food).toMatchObject({ plannedCents: 35_000, actualCents: 30_000, diffCents: 5_000 });
    const other = s.expenseRows.find((r) => r.name === "Прочее")!;
    expect(other.diffCents).toBe(-10_000);
    expect(s.expenseRows.some((r) => r.id === null)).toBe(false);
  });
});

describe("computeSummary — начало месяца", () => {
  it("прогноз учитывает неоплаченные регулярные платежи и ещё не пришедший доход", () => {
    const input = seedInput();
    input.transactions = [];
    const s = computeSummary(input);
    // Доход по плану 1310; расходы: план по категориям 1120, регулярные платежи покрыты планом.
    expect(s.forecastIncomeCents).toBe(131_000);
    expect(s.forecastExpenseCents).toBe(112_000);
    expect(s.forecastLeftCents).toBe(19_000);
  });

  it("неоплаченные регулярные платежи уже уменьшают свободные деньги", () => {
    const input = seedInput();
    input.transactions = input.transactions.filter((t) => t.type === "INCOME");
    const s = computeSummary(input);
    expect(s.mandatoryPaidCents).toBe(0);
    expect(s.mandatoryExpectedCents).toBe(47_000);
    expect(s.freeCents).toBe(84_000);
    expect(s.canSpendCents).toBe(84_000);
    expect(s.endBalanceCents).toBe(131_000);
  });

  it("можно отложить не больше свободных денег", () => {
    const input = seedInput();
    input.transactions = [{ id: 1, type: "INCOME", amountCents: 50_000, categoryId: 13, debtId: null, recurringId: null }];
    const s = computeSummary(input);
    expect(s.freeCents).toBe(3_000);
    expect(s.savingsPossibleCents).toBe(3_000);
  });

  it("отложенное уменьшает остаток и баланс", () => {
    const input = seedInput();
    input.startBalanceCents = 5_000;
    input.transactions.push({ id: 99, type: "SAVING", amountCents: 10_000, categoryId: null, debtId: null, recurringId: null });
    const s = computeSummary(input);
    expect(s.savedCents).toBe(10_000);
    expect(s.canSpendCents).toBe(4_000);
    expect(s.endBalanceCents).toBe(9_000);
  });

  it("расход без категории показывается отдельной строкой", () => {
    const input = seedInput();
    input.transactions.push({ id: 99, type: "EXPENSE", amountCents: 1_500, categoryId: null, debtId: null, recurringId: null });
    const s = computeSummary(input);
    expect(s.uncategorizedCents).toBe(1_500);
    expect(s.expenseRows.at(-1)).toMatchObject({ id: null, name: "Без категории", actualCents: 1_500 });
  });
});

describe("planTotals", () => {
  it("считает плановые свободные деньги", () => {
    const input = seedInput();
    const planned = Object.fromEntries(input.plans.map((p) => [p.categoryId, p.plannedCents]));
    const t = planTotals(input.categories, planned, 10);
    expect(t.incomeCents).toBe(131_000);
    expect(t.mandatoryCents).toBe(47_000);
    expect(t.freeCents).toBe(84_000);
    expect(t.savingsPossibleCents).toBe(13_100);
  });
});

describe("estimatePayoff", () => {
  it("по среднему последних платежей", () => {
    expect(estimatePayoff(90_000, [0, 5_000, 10_000, 15_000], 1_000, "2026-06")).toBe(shiftMonth("2026-06", 9));
  });
  it("без истории — по минимальному платежу", () => {
    expect(estimatePayoff(180_000, [], 20_000, "2026-06")).toBe("2027-03");
  });
  it("без темпа — неизвестно", () => {
    expect(estimatePayoff(1_000, [], 0, "2026-06")).toBeNull();
  });
});

describe("goalProgress", () => {
  it("цель с дедлайном: сколько откладывать в месяц", () => {
    // Машина за 10 000 €, отложено 600 €, до декабря 2027 включительно — 15 месяцев с октября 2026.
    const g = goalProgress(1_000_000, { "2026-08": 20_000, "2026-09": 20_000, "2026-10": 20_000 }, "2027-12", "2026-10");
    expect(g.savedCents).toBe(60_000);
    expect(g.remainingCents).toBe(940_000);
    expect(g.percent).toBeCloseTo(6);
    expect(g.savedThisMonthCents).toBe(20_000);
    expect(g.monthsLeft).toBe(15);
    expect(g.monthlyNeededCents).toBe(62_667);
    expect(g.overdue).toBe(false);
    expect(g.etaMonth).toBe("2030-09"); // 940 000 / 20 000 = 47 месяцев
  });

  it("без дедлайна и без взносов", () => {
    const g = goalProgress(100_000, {}, null, "2026-10");
    expect(g).toMatchObject({ savedCents: 0, monthsLeft: null, monthlyNeededCents: null, etaMonth: null, overdue: false });
  });

  it("дедлайн прошёл", () => {
    const g = goalProgress(100_000, { "2026-01": 10_000 }, "2026-05", "2026-10");
    expect(g.monthsLeft).toBe(0);
    expect(g.overdue).toBe(true);
    expect(g.monthlyNeededCents).toBeNull();
  });

  it("цель достигнута", () => {
    const g = goalProgress(100_000, { "2026-09": 120_000 }, "2026-12", "2026-10");
    expect(g.remainingCents).toBe(0);
    expect(g.percent).toBe(100);
    expect(g.etaMonth).toBeNull();
    expect(g.monthlyNeededCents).toBe(0);
  });
});

describe("деньги и даты", () => {
  it("parseMoney", () => {
    expect(parseMoney("1 310,50")).toBe(131_050);
    expect(parseMoney("1310.5")).toBe(131_050);
    expect(parseMoney("1.310,50")).toBe(131_050);
    expect(parseMoney("60")).toBe(6_000);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
  it("formatMoney", () => {
    expect(formatMoney(131_000, "EUR").replace(/\s/g, " ")).toBe("1 310,00 €");
    expect(formatMoney(131_000, "EUR", { compact: true }).replace(/\s/g, " ")).toBe("1 310 €");
  });
  it("byMonthLabel", () => {
    expect(byMonthLabel("2027-12")).toBe("к декабрю 2027");
    expect(byMonthLabel("2026-05")).toBe("к маю 2026");
  });
  it("defaultPayDate", () => {
    const now = new Date(2026, 9, 26);
    expect(defaultPayDate("2026-10", 5, now)).toBe("2026-10-26");
    expect(defaultPayDate("2026-02", 31, now)).toBe("2026-02-28");
    expect(defaultPayDate("2026-06", null, now)).toBe("2026-06-01");
  });
});
