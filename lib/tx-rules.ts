import "server-only";
import { prisma } from "./db";
import { HttpError } from "./api";
import { sinceMonthLabel } from "./month";
import type { TxType } from "./types";

interface TxFields {
  type: TxType;
  categoryId: number | null;
  debtId: number | null;
  recurringId: number | null;
  goalId: number | null;
}

/**
 * Проверяет связи операции и убирает лишние: у «Отложено» нет категории, но может быть цель;
 * долг и регулярный платёж — только у расходов.
 */
export async function normalizeTx<T extends TxFields>(t: T): Promise<T> {
  if (t.type === "SAVING") {
    if (t.goalId != null && !(await prisma.savingsGoal.findUnique({ where: { id: t.goalId } }))) {
      throw new HttpError(400, "Цель не найдена");
    }
    return { ...t, categoryId: null, debtId: null, recurringId: null };
  }
  t = { ...t, goalId: null };
  if (t.categoryId == null) throw new HttpError(400, "Выбери категорию");
  const cat = await prisma.category.findUnique({ where: { id: t.categoryId } });
  if (!cat) throw new HttpError(400, "Категория не найдена");
  if (cat.kind !== t.type) throw new HttpError(400, "Категория не подходит к типу операции");
  if (t.type === "INCOME") return { ...t, debtId: null, recurringId: null };
  if (t.debtId != null && !(await prisma.debt.findUnique({ where: { id: t.debtId } }))) {
    throw new HttpError(400, "Долг не найден");
  }
  return t;
}

/** Даты и месяцы раньше начала учёта недоступны. Принимает YYYY-MM-DD или YYYY-MM. */
export async function assertNotBeforeStart(dateOrMonth: string): Promise<void> {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  if (s?.startMonth && dateOrMonth.slice(0, 7) < s.startMonth) {
    throw new HttpError(400, `Учёт ведётся ${sinceMonthLabel(s.startMonth)} — раньше записывать нельзя`);
  }
}
