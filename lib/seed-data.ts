// Стартовые данные: категории по умолчанию и июнь 2026 из исходной таблицы.
// Используются и сидом (prisma/seed.ts), и тестами формул (lib/budget.test.ts).
import type { CategoryKind, DebtType, TxType } from "./types";

export interface SeedCategory {
  key: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  isMandatory?: boolean;
  isSalary?: boolean;
  isDebt?: boolean;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { key: "home", name: "Жильё", kind: "EXPENSE", color: "#2a78d6", icon: "house", isMandatory: true },
  { key: "food", name: "Еда", kind: "EXPENSE", color: "#eb6834", icon: "utensils" },
  { key: "transport", name: "Транспорт", kind: "EXPENSE", color: "#1baf7a", icon: "bus", isMandatory: true },
  { key: "utilities", name: "Коммуналка", kind: "EXPENSE", color: "#eda100", icon: "zap", isMandatory: true },
  { key: "gifts", name: "Подарки", kind: "EXPENSE", color: "#e87ba4", icon: "gift" },
  { key: "health", name: "Здоровье", kind: "EXPENSE", color: "#008300", icon: "heart-pulse" },
  { key: "phone", name: "Связь/интернет", kind: "EXPENSE", color: "#6250d6", icon: "wifi", isMandatory: true },
  { key: "debts", name: "Долги", kind: "EXPENSE", color: "#e34948", icon: "credit-card", isMandatory: true, isDebt: true },
  { key: "personal", name: "Личное", kind: "EXPENSE", color: "#898781", icon: "user" },
  { key: "pets", name: "Питомцы", kind: "EXPENSE", color: "#898781", icon: "paw-print" },
  { key: "travel", name: "Путешествия", kind: "EXPENSE", color: "#898781", icon: "plane" },
  { key: "other", name: "Прочее", kind: "EXPENSE", color: "#5d5c58", icon: "ellipsis" },
  { key: "salary", name: "Зарплата", kind: "INCOME", color: "#1baf7a", icon: "briefcase", isSalary: true },
  { key: "bonus", name: "Бонус", kind: "INCOME", color: "#2a78d6", icon: "award" },
  { key: "interest", name: "Проценты", kind: "INCOME", color: "#6250d6", icon: "percent" },
  { key: "otherIncome", name: "Прочее", kind: "INCOME", color: "#5d5c58", icon: "ellipsis" },
];

export interface SeedDebt {
  key: string;
  name: string;
  type: DebtType;
  initialCents: number;
  minPaymentCents: number;
}

export const SEED_DEBTS: SeedDebt[] = [
  { key: "mama", name: "Мама", type: "PERSONAL", initialCents: 100_000, minPaymentCents: 10_000 },
  { key: "tf", name: "TF Bank card", type: "CREDIT_CARD", initialCents: 200_000, minPaymentCents: 20_000 },
];

export interface SeedRecurring {
  key: string;
  name: string;
  amountCents: number;
  category: string;
  debt?: string;
  dayOfMonth?: number;
}

export const SEED_RECURRING: SeedRecurring[] = [
  { key: "o2", name: "O2", amountCents: 6_000, category: "phone" },
  { key: "db", name: "DB", amountCents: 6_000, category: "transport" },
  { key: "strom", name: "Strom", amountCents: 5_000, category: "utilities" },
  { key: "mama", name: "Мама", amountCents: 10_000, category: "debts", debt: "mama" },
  { key: "tf", name: "TF", amountCents: 20_000, category: "debts", debt: "tf" },
];

export interface SeedGoal {
  key: string;
  name: string;
  targetCents: number;
  icon: string;
  color: string;
  deadline?: string;
}

export const SEED_GOALS: SeedGoal[] = [
  { key: "car", name: "Машина", targetCents: 1_000_000, icon: "car", color: "#2a78d6", deadline: "2027-12" },
];

export interface SeedTransaction {
  date: string;
  amountCents: number;
  description: string;
  type: TxType;
  category?: string;
  debt?: string;
  recurring?: string;
  goal?: string;
}

export const SEED_MONTH = "2026-06";

export const SEED_TRANSACTIONS: SeedTransaction[] = [
  { date: "2026-06-29", amountCents: 38_000, description: "TI", type: "INCOME", category: "salary" },
  { date: "2026-06-29", amountCents: 93_000, description: "Aplora", type: "INCOME", category: "salary" },
  { date: "2026-06-29", amountCents: 6_000, description: "O2", type: "EXPENSE", category: "phone", recurring: "o2" },
  { date: "2026-06-29", amountCents: 6_000, description: "DB", type: "EXPENSE", category: "transport", recurring: "db" },
  { date: "2026-06-29", amountCents: 5_000, description: "Strom", type: "EXPENSE", category: "utilities", recurring: "strom" },
  { date: "2026-06-29", amountCents: 30_000, description: "Food", type: "EXPENSE", category: "food" },
  { date: "2026-06-29", amountCents: 10_000, description: "Мама", type: "EXPENSE", category: "debts", debt: "mama", recurring: "mama" },
  { date: "2026-06-29", amountCents: 20_000, description: "TF", type: "EXPENSE", category: "debts", debt: "tf", recurring: "tf" },
  { date: "2026-06-29", amountCents: 40_000, description: "Mono", type: "EXPENSE", category: "other" },
];

/** Демо-план на июнь, чтобы на дашборде было видно «план vs факт». */
export const SEED_PLAN: Record<string, number> = {
  food: 35_000,
  transport: 6_000,
  utilities: 5_000,
  phone: 6_000,
  debts: 30_000,
  other: 30_000,
  salary: 131_000,
};
