import { HttpError, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { parseMoney } from "@/lib/money";
import { isValidDateInput, parseDateInput } from "@/lib/month";
import { TX_TYPES, type TxType } from "@/lib/types";

/** «29.06.2026» или «2026-06-29» → «2026-06-29». */
function normalizeDate(s: string): string | null {
  const v = s.trim();
  if (isValidDateInput(v)) return v;
  const m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidDateInput(iso) ? iso : null;
}

/**
 * Импорт CSV: Date, Amount, Description, Category, Type[, Debt].
 * Неизвестные категории создаются, долги ищутся по имени; ошибки по строкам возвращаются списком.
 */
export const POST = route(async (req) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Прикрепи CSV-файл");
  const rows = parseCsv(await file.text());
  if (rows.length < 2) throw new HttpError(400, "В файле нет данных");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = { date: col("date"), amount: col("amount"), desc: col("description"), cat: col("category"), type: col("type"), debt: col("debt") };
  if (idx.date < 0 || idx.amount < 0) throw new HttpError(400, "Нужны колонки Date и Amount");

  const categories = await prisma.category.findMany();
  const debts = await prisma.debt.findMany();
  const errors: string[] = [];
  let imported = 0;

  for (const [n, r] of rows.slice(1).entries()) {
    const line = n + 2;
    const date = normalizeDate(r[idx.date] ?? "");
    const rawAmount = parseMoney(r[idx.amount] ?? "");
    if (!date || rawAmount == null || rawAmount === 0) {
      errors.push(`Строка ${line}: неверная дата или сумма`);
      continue;
    }
    const rawType = (r[idx.type] ?? "").trim().toUpperCase();
    const type: TxType = TX_TYPES.includes(rawType as TxType) ? (rawType as TxType) : rawAmount < 0 ? "INCOME" : "EXPENSE";
    const catName = (r[idx.cat] ?? "").trim();
    let categoryId: number | null = null;
    if (type !== "SAVING") {
      const name = catName || "Прочее";
      let cat = categories.find((c) => c.kind === type && c.name.toLowerCase() === name.toLowerCase());
      if (!cat) {
        cat = await prisma.category.create({ data: { name, kind: type, color: "#898781", sortOrder: 999 } });
        categories.push(cat);
      }
      categoryId = cat.id;
    }
    let debtId: number | null = null;
    const debtName = idx.debt >= 0 ? (r[idx.debt] ?? "").trim() : "";
    if (type === "EXPENSE" && debtName) {
      const debt = debts.find((d) => d.name.toLowerCase() === debtName.toLowerCase());
      if (debt) debtId = debt.id;
      else errors.push(`Строка ${line}: долг «${debtName}» не найден — платёж импортирован без привязки`);
    }
    await prisma.transaction.create({
      data: {
        date: parseDateInput(date),
        amountCents: Math.abs(rawAmount),
        description: idx.desc >= 0 ? (r[idx.desc] ?? "").trim().slice(0, 200) : "",
        type,
        categoryId,
        debtId,
      },
    });
    imported++;
  }
  return { imported, errors };
});
