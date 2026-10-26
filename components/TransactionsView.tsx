"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Pencil, Plus, Receipt, Search, Trash2, X } from "lucide-react";
import { PageHeader } from "./AppShell";
import { MonthSwitcher } from "./MonthSwitcher";
import { useQuickAdd } from "./QuickAdd";
import { CategoryBadgeIcon } from "./icons";
import { useAppData, useConfirm, useToast } from "./providers";
import { Badge, Button, Card, EmptyState, Field, Modal, inputClass, selectClass } from "./ui";
import { api, cx } from "@/lib/client";
import { centsToInput, parseMoney } from "@/lib/money";
import { formatDate } from "@/lib/month";
import { TX_TYPE_LABELS, type TransactionDTO, type TxType } from "@/lib/types";

const TABS: { value: TxType | ""; label: string }[] = [
  { value: "", label: "Все" },
  { value: "EXPENSE", label: "Расходы" },
  { value: "INCOME", label: "Доходы" },
  { value: "SAVING", label: "Накопления" },
];

interface Props {
  month: string;
  type: TxType | "";
  categoryId: string;
  q: string;
  items: TransactionDTO[];
}

export function TransactionsView({ month, type, categoryId, q, items }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const quickAdd = useQuickAdd();
  const { money, categories } = useAppData();
  const [search, setSearch] = useState(q);
  const [editing, setEditing] = useState<number | null>(null);
  const [mobileEdit, setMobileEdit] = useState<TransactionDTO | null>(null);

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    if (key === "type") p.delete("categoryId");
    router.replace(`${pathname}?${p}`, { scroll: false });
  };

  // Поиск с задержкой, чтобы не дёргать сервер на каждую букву.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParam("q", search.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filterCategories = categories.filter((c) => !type || c.kind === type);
  const totals = useMemo(() => {
    const t = { INCOME: 0, EXPENSE: 0, SAVING: 0 };
    for (const i of items) t[i.type] += i.amountCents;
    return t;
  }, [items]);

  return (
    <>
      <PageHeader title="Операции" subtitle="Все доходы, расходы и накопления за месяц">
        <MonthSwitcher month={month} />
        <div className="hidden sm:block lg:hidden">
          <Button onClick={() => quickAdd(type ? { type } : {})}>
            <Plus className="size-4" /> Операция
          </Button>
        </div>
      </PageHeader>

      <Card bodyClassName="!p-0">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800">
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setParam("type", t.value)}
                className={cx(
                  "h-9 shrink-0 rounded-lg px-3.5 text-sm font-medium transition-colors",
                  type === t.value
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={categoryId}
              onChange={(e) => setParam("categoryId", e.target.value)}
              className={cx(selectClass, "sm:w-56")}
              aria-label="Категория"
            >
              <option value="">Все категории</option>
              {filterCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!type ? ` (${c.kind === "INCOME" ? "доход" : "расход"})` : ""}
                  {c.archived ? " — в архиве" : ""}
                </option>
              ))}
              <option value="none">Без категории</option>
            </select>
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по описанию"
                className={cx(inputClass, "pl-9")}
                aria-label="Поиск"
              />
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title={q || categoryId || type ? "Ничего не найдено" : "Операций за месяц пока нет"}
            text={q || categoryId || type ? "Попробуй изменить фильтры." : "Добавь доход или первую трату — кнопка «+» всегда под рукой."}
            action={
              q || categoryId || type ? (
                <Link href={`${pathname}?month=${month}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
                  Сбросить фильтры
                </Link>
              ) : (
                <Button onClick={() => quickAdd({ type: "INCOME" })}>
                  <Plus className="size-4" /> Добавить доход
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Десктоп: таблица с редактированием в строке */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="py-3 pr-3 pl-5 font-medium">Дата</th>
                    <th className="px-3 py-3 text-right font-medium">Сумма</th>
                    <th className="px-3 py-3 font-medium">Описание</th>
                    <th className="px-3 py-3 font-medium">Категория</th>
                    <th className="px-3 py-3 font-medium">Долг</th>
                    <th className="w-24 py-3 pr-5 pl-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((t) =>
                    editing === t.id ? (
                      <EditRow key={t.id} tx={t} onDone={() => setEditing(null)} />
                    ) : (
                      <ViewRow key={t.id} tx={t} onEdit={() => setEditing(t.id)} />
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* Мобильный: список, редактирование в окне */}
            <ul className="divide-y divide-gray-100 md:hidden dark:divide-gray-800">
              {items.map((t) => (
                <MobileRow key={t.id} tx={t} onEdit={() => setMobileEdit(t)} />
              ))}
            </ul>

            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-gray-100 px-5 py-4 text-sm dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">{items.length} операций</span>
              {totals.INCOME > 0 && (
                <span>
                  Доходы <b className="num font-semibold text-success-600 dark:text-success-500">+{money(totals.INCOME, { compact: true })}</b>
                </span>
              )}
              {totals.EXPENSE > 0 && (
                <span>
                  Расходы <b className="num font-semibold text-gray-900 dark:text-white">−{money(totals.EXPENSE, { compact: true })}</b>
                </span>
              )}
              {totals.SAVING > 0 && (
                <span>
                  Отложено <b className="num font-semibold text-saving-600 dark:text-[#8f9cff]">{money(totals.SAVING, { compact: true })}</b>
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      {mobileEdit && <EditModal tx={mobileEdit} onClose={() => setMobileEdit(null)} />}
    </>
  );
}

function Amount({ tx }: { tx: TransactionDTO }) {
  const { money } = useAppData();
  const cls = tx.type === "INCOME" ? "text-success-600 dark:text-success-500" : tx.type === "SAVING" ? "text-saving-600 dark:text-[#8f9cff]" : "text-gray-900 dark:text-white";
  const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "−" : "";
  return <span className={cx("num font-semibold", cls)}>{sign}{money(tx.amountCents)}</span>;
}

function CategoryCell({ tx }: { tx: TransactionDTO }) {
  const { category, goal } = useAppData();
  if (tx.type === "SAVING") {
    const g = goal(tx.goalId);
    return <Badge tone="saving">{g ? `Цель: ${g.name}` : "Накопления"}</Badge>;
  }
  const c = category(tx.categoryId);
  if (!c) return <Badge tone="warning">Без категории</Badge>;
  return (
    <span className="inline-flex items-center gap-2">
      <CategoryBadgeIcon icon={c.icon} color={c.color} size="sm" />
      <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
    </span>
  );
}

function useDelete() {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const { money } = useAppData();
  return async (tx: TransactionDTO) => {
    const ok = await confirm({
      title: "Удалить операцию?",
      text: `${TX_TYPE_LABELS[tx.type]} ${money(tx.amountCents)} от ${formatDate(tx.date)}${tx.description ? ` «${tx.description}»` : ""}. Это нельзя отменить.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return false;
    try {
      await api(`/api/transactions/${tx.id}`, { method: "DELETE" });
      toast("Операция удалена");
      router.refresh();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    }
  };
}

function ViewRow({ tx, onEdit }: { tx: TransactionDTO; onEdit: () => void }) {
  const { debt } = useAppData();
  const del = useDelete();
  return (
    <tr className="group hover:bg-gray-50 dark:hover:bg-white/[0.02]" onDoubleClick={onEdit}>
      <td className="num py-3 pr-3 pl-5 whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDate(tx.date)}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap"><Amount tx={tx} /></td>
      <td className="max-w-[260px] truncate px-3 py-3 text-gray-800 dark:text-white/90">{tx.description || <span className="text-gray-400">—</span>}</td>
      <td className="px-3 py-3"><CategoryCell tx={tx} /></td>
      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{debt(tx.debtId)?.name ?? ""}</td>
      <td className="py-3 pr-5 pl-3">
        <div className="flex justify-end gap-1 text-gray-400">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Редактировать">
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => del(tx)} aria-label="Удалить" className="hover:!text-error-600">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MobileRow({ tx, onEdit }: { tx: TransactionDTO; onEdit: () => void }) {
  const { category, debt, goal } = useAppData();
  const c = category(tx.categoryId);
  return (
    <li>
      <button type="button" onClick={onEdit} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-white/5">
        {tx.type === "SAVING" ? (
          <CategoryBadgeIcon icon={goal(tx.goalId)?.icon ?? "piggy-bank"} color={goal(tx.goalId)?.color ?? "#465fff"} />
        ) : (
          <CategoryBadgeIcon icon={c?.icon ?? "circle-help"} color={c?.color ?? "#98a2b3"} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">
            {tx.description || (tx.type === "SAVING" ? goal(tx.goalId)?.name : c?.name) || TX_TYPE_LABELS[tx.type]}
          </span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {formatDate(tx.date)} · {tx.type === "SAVING" ? (goal(tx.goalId) ? `Цель: ${goal(tx.goalId)!.name}` : "Накопления") : (c?.name ?? "Без категории")}
            {tx.debtId ? ` · ${debt(tx.debtId)?.name ?? ""}` : ""}
          </span>
        </span>
        <span className="text-sm"><Amount tx={tx} /></span>
      </button>
    </li>
  );
}

// ---------- Редактирование ----------

function useTxForm(tx: TransactionDTO) {
  const [amount, setAmount] = useState(centsToInput(tx.amountCents));
  const [date, setDate] = useState(tx.date);
  const [description, setDescription] = useState(tx.description);
  const [categoryId, setCategoryId] = useState<number | null>(tx.categoryId);
  const [debtId, setDebtId] = useState<number | null>(tx.debtId);
  const [goalId, setGoalId] = useState<number | null>(tx.goalId);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const { category } = useAppData();

  const save = async (): Promise<boolean> => {
    const cents = parseMoney(amount);
    if (cents == null || cents <= 0) {
      toast(cents == null ? "Не понял сумму — пример: 12,50" : "Введи сумму больше нуля", "error");
      return false;
    }
    setSaving(true);
    try {
      await api(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        body: {
          amountCents: cents,
          date,
          description,
          categoryId: tx.type === "SAVING" ? null : categoryId,
          debtId: category(categoryId)?.isDebt ? debtId : null,
          goalId: tx.type === "SAVING" ? goalId : null,
        },
      });
      toast("Сохранено");
      router.refresh();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { amount, setAmount, date, setDate, description, setDescription, categoryId, setCategoryId, debtId, setDebtId, goalId, setGoalId, saving, save };
}

function GoalSelect({ value, onChange, className }: { value: number | null; onChange: (v: number | null) => void; className?: string }) {
  const { goals } = useAppData();
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={cx(selectClass, className)} aria-label="Цель">
      <option value="">Без цели</option>
      {goals.filter((g) => !g.achievedAt || g.id === value).map((g) => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}

function CategorySelect({ tx, value, onChange, className }: { tx: TransactionDTO; value: number | null; onChange: (v: number | null) => void; className?: string }) {
  const { activeCategories, category } = useAppData();
  if (tx.type === "SAVING") return <Badge tone="saving">Накопления</Badge>;
  const list = activeCategories(tx.type);
  const current = category(value);
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={cx(selectClass, className)} aria-label="Категория">
      {!value && <option value="">Выбери категорию</option>}
      {current?.archived && <option value={current.id}>{current.name} (архив)</option>}
      {list.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}

function DebtSelect({ value, onChange, className }: { value: number | null; onChange: (v: number | null) => void; className?: string }) {
  const { debts } = useAppData();
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={cx(selectClass, className)} aria-label="Долг">
      <option value="">Без долга</option>
      {debts.filter((d) => !d.closedAt || d.id === value).map((d) => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );
}

function EditRow({ tx, onDone }: { tx: TransactionDTO; onDone: () => void }) {
  const f = useTxForm(tx);
  const { category, minDate } = useAppData();
  const small = "!h-9 text-sm";
  const submit = async () => (await f.save()) && onDone();
  return (
    <tr
      className="bg-brand-25 dark:bg-brand-500/5"
      onKeyDown={(e) => {
        if (e.key === "Enter") void submit();
        if (e.key === "Escape") onDone();
      }}
    >
      <td className="py-2 pr-2 pl-5"><input type="date" min={minDate} value={f.date} onChange={(e) => f.setDate(e.target.value)} className={cx(inputClass, small, "w-[150px]")} /></td>
      <td className="px-2 py-2"><input value={f.amount} onChange={(e) => f.setAmount(e.target.value)} inputMode="decimal" autoFocus className={cx(inputClass, small, "num w-28 text-right")} aria-label="Сумма" /></td>
      <td className="px-2 py-2"><input value={f.description} onChange={(e) => f.setDescription(e.target.value)} className={cx(inputClass, small)} aria-label="Описание" /></td>
      <td className="px-2 py-2">
        {tx.type === "SAVING" ? (
          <GoalSelect value={f.goalId} onChange={f.setGoalId} className={cx(small, "min-w-[160px]")} />
        ) : (
          <CategorySelect tx={tx} value={f.categoryId} onChange={f.setCategoryId} className={cx(small, "min-w-[160px]")} />
        )}
      </td>
      <td className="px-2 py-2">{category(f.categoryId)?.isDebt ? <DebtSelect value={f.debtId} onChange={f.setDebtId} className={cx(small, "min-w-[140px]")} /> : null}</td>
      <td className="py-2 pr-5 pl-2">
        <div className="flex justify-end gap-1">
          <Button size="icon" onClick={submit} disabled={f.saving} aria-label="Сохранить"><Check className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDone} aria-label="Отмена"><X className="size-4" /></Button>
        </div>
      </td>
    </tr>
  );
}

function EditModal({ tx, onClose }: { tx: TransactionDTO; onClose: () => void }) {
  const f = useTxForm(tx);
  const del = useDelete();
  const { category, minDate } = useAppData();
  return (
    <Modal
      open
      onClose={onClose}
      title={`${TX_TYPE_LABELS[tx.type]}: редактирование`}
      footer={
        <>
          <Button variant="ghost" className="mr-auto !text-error-600" onClick={async () => (await del(tx)) && onClose()}>
            <Trash2 className="size-4" /> Удалить
          </Button>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={async () => (await f.save()) && onClose()} disabled={f.saving}>Сохранить</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Сумма"><input value={f.amount} onChange={(e) => f.setAmount(e.target.value)} inputMode="decimal" className={cx(inputClass, "num text-lg font-semibold")} /></Field>
        {tx.type === "SAVING" ? (
          <Field label="Цель"><GoalSelect value={f.goalId} onChange={f.setGoalId} /></Field>
        ) : (
          <Field label="Категория"><CategorySelect tx={tx} value={f.categoryId} onChange={f.setCategoryId} /></Field>
        )}
        {category(f.categoryId)?.isDebt && <Field label="Долг"><DebtSelect value={f.debtId} onChange={f.setDebtId} /></Field>}
        <Field label="Дата"><input type="date" min={minDate} value={f.date} onChange={(e) => f.setDate(e.target.value)} className={inputClass} /></Field>
        <Field label="Описание"><input value={f.description} onChange={(e) => f.setDescription(e.target.value)} className={inputClass} /></Field>
      </div>
    </Modal>
  );
}
