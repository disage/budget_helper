import { route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { toDateInput } from "@/lib/month";

export const GET = route(async () => {
  const rows = await prisma.transaction.findMany({
    include: { category: true, debt: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  const csv = toCsv([
    ["Date", "Amount", "Description", "Category", "Type", "Debt"],
    ...rows.map((t) => [
      toDateInput(t.date),
      (t.amountCents / 100).toFixed(2),
      t.description,
      t.category?.name ?? "",
      t.type,
      t.debt?.name ?? "",
    ]),
  ]);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="budget-${toDateInput(new Date())}.csv"`,
    },
  });
});
