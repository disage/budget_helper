import "server-only";
import { prisma } from "./db";
import { HttpError } from "./api";
import type { TxType } from "./types";

interface TxFields {
  type: TxType;
  categoryId: number | null;
  debtId: number | null;
  recurringId: number | null;
}

/** Проверяет связи операции и убирает лишние: у «Отложено» нет категории, долг и регулярный платёж — только у расходов. */
export async function normalizeTx<T extends TxFields>(t: T): Promise<T> {
  if (t.type === "SAVING") return { ...t, categoryId: null, debtId: null, recurringId: null };
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
