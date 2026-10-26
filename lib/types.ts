export const TX_TYPES = ["EXPENSE", "INCOME", "SAVING"] as const;
export type TxType = (typeof TX_TYPES)[number];

export const CATEGORY_KINDS = ["EXPENSE", "INCOME"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const DEBT_TYPES = ["CREDIT_CARD", "PERSONAL", "LOAN"] as const;
export type DebtType = (typeof DEBT_TYPES)[number];

export const TX_TYPE_LABELS: Record<TxType, string> = {
  EXPENSE: "Расход",
  INCOME: "Доход",
  SAVING: "Отложено",
};

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  CREDIT_CARD: "Кредитка",
  PERSONAL: "Личный долг",
  LOAN: "Кредит",
};

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "PLN", "CZK", "UAH", "RUB"] as const;

// Плоские DTO, которые сервер отдаёт клиентским компонентам.
export interface CategoryDTO {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  isMandatory: boolean;
  isSalary: boolean;
  isDebt: boolean;
  sortOrder: number;
  archived: boolean;
}

export interface DebtDTO {
  id: number;
  name: string;
  type: DebtType;
  initialCents: number;
  minPaymentCents: number;
  interestRate: number | null;
  note: string;
  closedAt: string | null;
}

export interface TransactionDTO {
  id: number;
  date: string; // YYYY-MM-DD
  amountCents: number;
  description: string;
  type: TxType;
  categoryId: number | null;
  debtId: number | null;
  recurringId: number | null;
  goalId: number | null;
}

export interface GoalDTO {
  id: number;
  name: string;
  targetCents: number;
  icon: string;
  color: string;
  deadline: string | null; // YYYY-MM
  note: string;
  achievedAt: string | null;
}

export interface RecurringDTO {
  id: number;
  name: string;
  amountCents: number;
  categoryId: number;
  dayOfMonth: number | null;
  debtId: number | null;
  active: boolean;
}

export interface SettingsDTO {
  currency: string;
  savingsPercent: number;
  carryOverBalance: boolean;
  /** Первый месяц учёта (YYYY-MM). Раньше него месяцев и операций нет. */
  startMonth: string | null;
}
