import { PrismaClient } from "@prisma/client";
import {
  SEED_CATEGORIES,
  SEED_DEBTS,
  SEED_GOALS,
  SEED_MONTH,
  SEED_PLAN,
  SEED_RECURRING,
  SEED_TRANSACTIONS,
} from "../lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  // Сид перезаписывает БД целиком.
  await prisma.transaction.deleteMany();
  await prisma.monthPlan.deleteMany();
  await prisma.recurringPayment.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.savingsGoal.deleteMany();
  await prisma.category.deleteMany();
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { startMonth: SEED_MONTH },
    create: { id: 1, startMonth: SEED_MONTH },
  });

  const cat: Record<string, number> = {};
  for (const [i, c] of SEED_CATEGORIES.entries()) {
    const { key, ...data } = c;
    cat[key] = (await prisma.category.create({ data: { ...data, sortOrder: i } })).id;
  }

  const debt: Record<string, number> = {};
  for (const { key, ...data } of SEED_DEBTS) {
    debt[key] = (await prisma.debt.create({ data })).id;
  }

  const goal: Record<string, number> = {};
  for (const { key, ...data } of SEED_GOALS) {
    goal[key] = (await prisma.savingsGoal.create({ data })).id;
  }

  const rec: Record<string, number> = {};
  for (const r of SEED_RECURRING) {
    rec[r.key] = (
      await prisma.recurringPayment.create({
        data: {
          name: r.name,
          amountCents: r.amountCents,
          categoryId: cat[r.category],
          debtId: r.debt ? debt[r.debt] : null,
          dayOfMonth: r.dayOfMonth ?? null,
        },
      })
    ).id;
  }

  for (const t of SEED_TRANSACTIONS) {
    await prisma.transaction.create({
      data: {
        date: new Date(`${t.date}T00:00:00Z`),
        amountCents: t.amountCents,
        description: t.description,
        type: t.type,
        categoryId: t.category ? cat[t.category] : null,
        debtId: t.debt ? debt[t.debt] : null,
        recurringId: t.recurring ? rec[t.recurring] : null,
        goalId: t.goal ? goal[t.goal] : null,
      },
    });
  }

  for (const [key, plannedCents] of Object.entries(SEED_PLAN)) {
    await prisma.monthPlan.create({ data: { month: SEED_MONTH, categoryId: cat[key], plannedCents } });
  }

  console.log("Seed: категорий %d, операций %d", SEED_CATEGORIES.length, SEED_TRANSACTIONS.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
