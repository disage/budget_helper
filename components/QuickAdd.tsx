"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, PiggyBank } from "lucide-react";
import { Button, Field, Modal, inputClass } from "./ui";
import { CategoryIcon } from "./icons";
import { useAppData, useToast } from "./providers";
import { api, cx } from "@/lib/client";
import { centsToInput, currencySymbol, parseMoney } from "@/lib/money";
import { defaultPayDate, isValidMonth, todayInput } from "@/lib/month";
import { TX_TYPE_LABELS, type TxType } from "@/lib/types";

export interface QuickAddPreset {
  type?: TxType;
  categoryId?: number | null;
  debtId?: number | null;
  recurringId?: number | null;
  goalId?: number | null;
  amountCents?: number;
  description?: string;
  date?: string;
  title?: string;
}

const QuickAddContext = createContext<(preset?: QuickAddPreset) => void>(() => {});
export const useQuickAdd = () => useContext(QuickAddContext);

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<QuickAddPreset | null>(null);
  const [session, setSession] = useState(0);
  const open = useCallback((p: QuickAddPreset = {}) => {
    setPreset(p);
    setSession((s) => s + 1);
  }, []);
  return (
    <QuickAddContext.Provider value={open}>
      {children}
      {preset && <QuickAddModal key={session} preset={preset} onClose={() => setPreset(null)} />}
    </QuickAddContext.Provider>
  );
}

const TYPES: TxType[] = ["EXPENSE", "INCOME", "SAVING"];
const TYPE_BUTTON: Record<TxType, string> = {
  EXPENSE: "Расход",
  INCOME: "Доход",
  SAVING: "Отложить",
};

function QuickAddModal({ preset, onClose }: { preset: QuickAddPreset; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { activeCategories, openDebts, activeGoals, category, goal, money, settings, minDate } = useAppData();
  // Если смотрим другой месяц, операция по умолчанию попадает в него.
  const viewedMonth = useSearchParams().get("month");
  const defaultDate = isValidMonth(viewedMonth) ? defaultPayDate(viewedMonth, null) : todayInput();

  const [type, setType] = useState<TxType>(preset.type ?? "EXPENSE");
  const [amount, setAmount] = useState(preset.amountCents ? centsToInput(preset.amountCents) : "");
  const [categoryId, setCategoryId] = useState<number | null>(preset.categoryId ?? null);
  const [debtId, setDebtId] = useState<number | null>(preset.debtId ?? null);
  const [goalId, setGoalId] = useState<number | null>(preset.goalId ?? null);
  const [date, setDate] = useState(preset.date ?? defaultDate);
  const [description, setDescription] = useState(preset.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const addAnother = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const cats = type === "SAVING" ? [] : activeCategories(type);
  const selected = category(categoryId);
  const showDebts = type === "EXPENSE" && !!selected?.isDebt;

  const switchType = (t: TxType) => {
    setType(t);
    if (category(categoryId)?.kind !== t) setCategoryId(null);
    setDebtId(null);
    setError(null);
  };

  const pickDebt = (id: number) => {
    setDebtId(id);
    const d = openDebts.find((x) => x.id === id);
    if (d && !amount && d.minPaymentCents > 0) setAmount(centsToInput(d.minPaymentCents));
    if (d && !description) setDescription(d.name);
  };

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const cents = parseMoney(amount);
    if (cents == null) return setError("Не понял сумму — пример: 12,50");
    if (cents <= 0) return setError("Введи сумму больше нуля");
    if (type !== "SAVING" && !categoryId) return setError("Выбери категорию");
    if (minDate && date < minDate) return setError("Дата раньше начала учёта");
    setSaving(true);
    setError(null);
    try {
      await api("/api/transactions", {
        body: {
          type,
          amountCents: cents,
          categoryId: type === "SAVING" ? null : categoryId,
          debtId: showDebts ? debtId : null,
          recurringId: preset.recurringId ?? null,
          goalId: type === "SAVING" ? goalId : null,
          date,
          description: description.trim(),
        },
      });
      const label = type === "SAVING" ? (goal(goalId)?.name ?? "Отложено") : (selected?.name ?? TX_TYPE_LABELS[type]);
      toast(`${type === "EXPENSE" ? "−" : "+"}${money(cents, { compact: true })} · ${label}`);
      router.refresh();
      if (addAnother.current && !preset.recurringId && !preset.goalId) {
        setAmount("");
        setDescription("");
        setDebtId(null);
        amountRef.current?.focus();
      } else {
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      addAnother.current = false;
    }
  }

  const accent = type === "INCOME" ? "text-success-600" : type === "SAVING" ? "text-saving-600 dark:text-[#8f9cff]" : "text-gray-900 dark:text-white";

  return (
    <Modal
      open
      onClose={onClose}
      title={preset.title ?? "Новая операция"}
      footer={
        <>
          {!preset.recurringId && !preset.goalId && (
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                addAnother.current = true;
                void submit();
              }}
              className="flex-1 sm:flex-none"
            >
              Сохранить и ещё
            </Button>
          )}
          <Button type="submit" form="quick-add" disabled={saving} className="flex-1 sm:flex-none">
            {saving ? "Сохраняю…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <form id="quick-add" onSubmit={submit} className="space-y-4 sm:space-y-5">
        {!preset.recurringId && !preset.goalId && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                className={cx(
                  "h-9 rounded-lg text-sm font-medium transition-colors",
                  type === t
                    ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                {TYPE_BUTTON[t]}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Сумма</span>
          <div className="flex items-baseline gap-2">
            <input
              ref={amountRef}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              aria-label="Сумма"
              className={cx("num w-full bg-transparent text-4xl font-semibold outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600", accent)}
            />
            <span className="text-2xl font-medium text-gray-400">{currencySymbol(settings.currency)}</span>
          </div>
        </div>

        {type !== "SAVING" ? (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Категория</p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {cats.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(c.id);
                      setError(null);
                      if (!c.isDebt) setDebtId(null);
                    }}
                    aria-pressed={active}
                    className={cx(
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-medium transition-all sm:gap-1.5 sm:py-2.5 sm:text-xs",
                      active
                        ? "border-transparent text-gray-900 dark:text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]",
                    )}
                    style={active ? { boxShadow: `0 0 0 2px ${c.color}`, backgroundColor: `${c.color}14` } : undefined}
                  >
                    <span
                      className="flex size-7 items-center justify-center rounded-lg sm:size-8"
                      style={{ backgroundColor: `${c.color}1f`, color: c.color }}
                    >
                      <CategoryIcon name={c.icon} className="size-4" />
                    </span>
                    <span className="line-clamp-2 leading-tight">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeGoals.length > 0 && !preset.goalId && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">На какую цель?</p>
                <div className="flex flex-wrap gap-2">
                  {[null, ...activeGoals].map((g) => {
                    const active = (g?.id ?? null) === goalId;
                    return (
                      <button
                        key={g?.id ?? "none"}
                        type="button"
                        onClick={() => setGoalId(g?.id ?? null)}
                        aria-pressed={active}
                        className={cx(
                          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
                          active
                            ? "border-saving-500 bg-saving-50 text-saving-700 dark:bg-saving-500/15 dark:text-[#a9b3ff]"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5",
                        )}
                      >
                        {g ? <CategoryIcon name={g.icon} className="size-3.5" /> : <PiggyBank className="size-3.5" />}
                        {g ? g.name : "Без цели"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="rounded-xl bg-saving-50 px-4 py-3 text-sm text-saving-700 dark:bg-saving-500/10 dark:text-[#a9b3ff]">
              {goal(goalId)
                ? `Взнос в цель «${goal(goalId)!.name}». Уменьшает остаток месяца и засчитывается в «Отложено по факту».`
                : "Деньги уходят в накопления: уменьшают остаток месяца и засчитываются в «Отложено по факту»."}
            </p>
          </div>
        )}

        {showDebts && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Какой долг гасишь?</p>
            {openDebts.length === 0 ? (
              <p className="text-sm text-gray-500">Открытых долгов нет — добавь их на странице «Долги».</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {openDebts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => (debtId === d.id ? setDebtId(null) : pickDebt(d.id))}
                    aria-pressed={debtId === d.id}
                    className={cx(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
                      debtId === d.id
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5",
                    )}
                  >
                    <CreditCard className="size-3.5" />
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,140px)_1fr] gap-3 sm:grid-cols-[160px_1fr] sm:gap-4">
          <Field label="Дата">
            <input type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Описание">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Необязательно"
              maxLength={200}
              className={inputClass}
            />
          </Field>
        </div>

        {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-500">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
