"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleCheck, CreditCard, HandCoins, Landmark, Pencil, Plus, RotateCcw, Trash2, User } from "lucide-react";
import { PageHeader } from "./AppShell";
import { useQuickAdd } from "./QuickAdd";
import { useAppData, useConfirm, useToast } from "./providers";
import { Badge, Button, Card, EmptyState, Field, Modal, ProgressBar, inputClass, selectClass } from "./ui";
import { api, cx } from "@/lib/client";
import { centsToInput, parseMoney } from "@/lib/money";
import { formatDate, monthLabel } from "@/lib/month";
import { DEBT_TYPES, DEBT_TYPE_LABELS, type DebtDTO, type DebtType, type TransactionDTO } from "@/lib/types";

export interface DebtInfo {
  debt: DebtDTO;
  paidCents: number;
  remainingCents: number;
  paidThisMonthCents: number;
  payoffMonth: string | null;
  payments: TransactionDTO[];
  paymentCount: number;
}

const TYPE_ICON: Record<DebtType, typeof CreditCard> = { CREDIT_CARD: CreditCard, PERSONAL: User, LOAN: Landmark };

export function DebtsView({ items }: { items: DebtInfo[] }) {
  const { money } = useAppData();
  const [form, setForm] = useState<DebtDTO | "new" | null>(null);
  const open = items.filter((i) => !i.debt.closedAt);
  const closed = items.filter((i) => i.debt.closedAt);
  const total = open.reduce((a, i) => a + i.remainingCents, 0);
  const initial = open.reduce((a, i) => a + i.debt.initialCents, 0);
  const paidMonth = items.reduce((a, i) => a + i.paidThisMonthCents, 0);
  const minTotal = open.reduce((a, i) => a + i.debt.minPaymentCents, 0);

  return (
    <>
      <PageHeader title="Долги" subtitle="Кредитки, кредиты и личные долги. Платёж с категорией «Долги» уменьшает остаток.">
        <Button onClick={() => setForm("new")}>
          <Plus className="size-4" /> Добавить долг
        </Button>
      </PageHeader>

      {items.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Всего долгов" value={money(total, { compact: true })} hint={initial > 0 ? `Погашено ${Math.round(((initial - total) / initial) * 100)}% от ${money(initial, { compact: true })}` : undefined} />
          <Stat label="Погашено в этом месяце" value={money(paidMonth, { compact: true })} tone="success" />
          <Stat label="Минимальные платежи" value={`${money(minTotal, { compact: true })}/мес`} hint="Сумма минимальных платежей по открытым долгам" />
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<HandCoins className="size-5" />}
            title="Долгов пока нет"
            text="Добавь кредитки и личные долги, чтобы видеть остаток и примерную дату погашения."
            action={<Button onClick={() => setForm("new")}><Plus className="size-4" /> Добавить долг</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {open.map((i) => <DebtCard key={i.debt.id} info={i} onEdit={() => setForm(i.debt)} />)}
          {open.length === 0 && (
            <Card className="lg:col-span-2">
              <EmptyState icon={<CircleCheck className="size-5" />} title="Все долги закрыты" text="Отличная работа!" />
            </Card>
          )}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Закрытые</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {closed.map((i) => <DebtCard key={i.debt.id} info={i} onEdit={() => setForm(i.debt)} />)}
          </div>
        </>
      )}

      {form && <DebtForm debt={form === "new" ? null : form} onClose={() => setForm(null)} />}
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cx("num mt-1 text-2xl font-semibold", tone === "success" ? "text-success-600 dark:text-success-500" : "text-gray-900 dark:text-white")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

function DebtCard({ info, onEdit }: { info: DebtInfo; onEdit: () => void }) {
  const { debt: d } = info;
  const { money, activeCategories } = useAppData();
  const quickAdd = useQuickAdd();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const Icon = TYPE_ICON[d.type];
  const closed = !!d.closedAt;
  const pct = d.initialCents > 0 ? Math.min(100, Math.round((info.paidCents / d.initialCents) * 100)) : 0;
  const debtCategory = activeCategories("EXPENSE").find((c) => c.isDebt);

  async function patch(body: object, msg: string) {
    try {
      await api(`/api/debts/${d.id}`, { method: "PATCH", body });
      toast(msg);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Удалить долг «${d.name}»?`,
      text: info.paymentCount > 0 ? `${info.paymentCount} платежей останутся расходами, но без привязки к долгу. Лучше закрыть долг, а не удалять.` : "Это нельзя отменить.",
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/debts/${d.id}`, { method: "DELETE" });
      toast("Долг удалён");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <Card className={cx(closed && "opacity-75")}>
      <div className="flex items-start gap-4">
        <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl", closed ? "bg-success-50 text-success-600 dark:bg-success-500/15" : "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400")}>
          {closed ? <CircleCheck className="size-5" /> : <Icon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">{d.name}</h3>
            <Badge>{DEBT_TYPE_LABELS[d.type]}</Badge>
            {closed && <Badge tone="success">Закрыт</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {d.minPaymentCents > 0 && `Мин. платёж ${money(d.minPaymentCents, { compact: true })}`}
            {d.interestRate != null && ` · ${String(d.interestRate).replace(".", ",")}% годовых`}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Редактировать"><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={remove} aria-label="Удалить" className="hover:!text-error-600"><Trash2 className="size-4" /></Button>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Осталось</p>
          <p className="num text-3xl font-semibold text-gray-900 dark:text-white">{money(info.remainingCents, { compact: true })}</p>
        </div>
        <p className="num pb-1 text-right text-sm text-gray-500 dark:text-gray-400">
          погашено <b className="font-semibold text-gray-800 dark:text-white/90">{money(info.paidCents, { compact: true })}</b>
          <br />из {money(d.initialCents, { compact: true })}
        </p>
      </div>
      <ProgressBar value={info.paidCents} max={d.initialCents} tone="success" className="mt-3 h-2.5" />
      <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{pct}% погашено</span>
        {!closed && info.payoffMonth && info.remainingCents > 0 && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" /> при текущем темпе ≈ {monthLabel(info.payoffMonth).toLowerCase()}
          </span>
        )}
      </div>

      {d.note && <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">{d.note}</p>}

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">История платежей</p>
        {info.payments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Платежей ещё не было.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {info.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="num">{formatDate(p.date)}</span>
                  {p.description && p.description !== d.name && <span className="ml-2 text-gray-400">{p.description}</span>}
                </span>
                <span className="num font-medium text-success-600 dark:text-success-500">−{money(p.amountCents)}</span>
              </li>
            ))}
            {info.paymentCount > info.payments.length && (
              <li className="pt-2 text-xs text-gray-400">и ещё {info.paymentCount - info.payments.length}…</li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {!closed && (
          <Button
            onClick={() =>
              quickAdd({
                type: "EXPENSE",
                categoryId: debtCategory?.id ?? null,
                debtId: d.id,
                amountCents: Math.min(d.minPaymentCents || info.remainingCents, info.remainingCents) || undefined,
                description: d.name,
                title: `Платёж: ${d.name}`,
              })
            }
          >
            <HandCoins className="size-4" /> Внести платёж
          </Button>
        )}
        <Button variant="secondary" onClick={() => patch({ closed: !closed }, closed ? "Долг снова открыт" : "Долг закрыт")}>
          {closed ? <><RotateCcw className="size-4" /> Открыть снова</> : <><CircleCheck className="size-4" /> Закрыть долг</>}
        </Button>
      </div>
    </Card>
  );
}

function DebtForm({ debt, onClose }: { debt: DebtDTO | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(debt?.name ?? "");
  const [type, setType] = useState<DebtType>(debt?.type ?? "CREDIT_CARD");
  const [initial, setInitial] = useState(debt ? centsToInput(debt.initialCents) : "");
  const [minPay, setMinPay] = useState(debt?.minPaymentCents ? centsToInput(debt.minPaymentCents) : "");
  const [rate, setRate] = useState(debt?.interestRate != null ? String(debt.interestRate).replace(".", ",") : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const initialCents = parseMoney(initial);
    const minPaymentCents = minPay ? parseMoney(minPay) : 0;
    const interestRate = rate ? Number(rate.replace(",", ".")) : null;
    if (!name.trim()) return setError("Укажи название");
    if (!initialCents || initialCents <= 0) return setError("Укажи сумму долга");
    if (minPaymentCents == null || minPaymentCents < 0) return setError("Неверный минимальный платёж");
    if (interestRate != null && Number.isNaN(interestRate)) return setError("Неверная ставка");
    setSaving(true);
    try {
      const body = { name, type, initialCents, minPaymentCents, interestRate, note };
      await api(debt ? `/api/debts/${debt.id}` : "/api/debts", { method: debt ? "PATCH" : "POST", body });
      toast(debt ? "Долг обновлён" : "Долг добавлен");
      router.refresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={debt ? "Редактировать долг" : "Новый долг"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" form="debt-form" disabled={saving}>{saving ? "Сохраняю…" : "Сохранить"}</Button>
        </>
      }
    >
      <form id="debt-form" onSubmit={submit} className="space-y-4">
        <Field label="Название"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Например, TF Bank card" className={inputClass} /></Field>
        <Field label="Тип">
          <select value={type} onChange={(e) => setType(e.target.value as DebtType)} className={selectClass}>
            {DEBT_TYPES.map((t) => <option key={t} value={t}>{DEBT_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Сумма долга" hint="Сколько было должно на старте"><input value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="decimal" className={cx(inputClass, "num")} /></Field>
          <Field label="Мин. платёж в месяц"><input value={minPay} onChange={(e) => setMinPay(e.target.value)} inputMode="decimal" placeholder="0" className={cx(inputClass, "num")} /></Field>
        </div>
        <Field label="Ставка, % годовых" hint="Необязательно"><input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={cx(inputClass, "num")} /></Field>
        <Field label="Заметка"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={cx(inputClass, "h-auto py-2.5")} /></Field>
        {error && <p className="text-sm text-error-600">{error}</p>}
      </form>
    </Modal>
  );
}
