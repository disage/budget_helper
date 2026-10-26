"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { PageHeader } from "./AppShell";
import { CategoryBadgeIcon } from "./icons";
import { useAppData, useConfirm, useToast } from "./providers";
import { Badge, Button, Card, EmptyState, Field, Modal, Toggle, inputClass, selectClass } from "./ui";
import { api, cx } from "@/lib/client";
import { centsToInput, parseMoney } from "@/lib/money";
import type { RecurringDTO } from "@/lib/types";

export function RecurringView({ items }: { items: RecurringDTO[] }) {
  const { money, category, debt } = useAppData();
  const [form, setForm] = useState<RecurringDTO | "new" | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const total = items.filter((r) => r.active).reduce((a, r) => a + r.amountCents, 0);

  async function toggle(r: RecurringDTO) {
    try {
      await api(`/api/recurring/${r.id}`, { method: "PATCH", body: { active: !r.active } });
      toast(r.active ? `«${r.name}» на паузе` : `«${r.name}» снова активен`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(r: RecurringDTO) {
    const ok = await confirm({
      title: `Удалить «${r.name}»?`,
      text: "Уже созданные по нему операции останутся. Чтобы временно не учитывать платёж, поставь его на паузу.",
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/recurring/${r.id}`, { method: "DELETE" });
      toast("Удалено");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Регулярные платежи"
        subtitle="Обязательные траты каждый месяц. Пока платёж не оплачен, его сумма уже вычитается из свободных денег."
      >
        <Button onClick={() => setForm("new")}>
          <Plus className="size-4" /> Добавить
        </Button>
      </PageHeader>

      <Card bodyClassName="!p-0">
        {items.length === 0 ? (
          <EmptyState
            icon={<Repeat className="size-5" />}
            title="Регулярных платежей нет"
            text="Связь, коммуналка, проезд, подписки, платежи по кредиткам — всё, что уходит каждый месяц."
            action={<Button onClick={() => setForm("new")}><Plus className="size-4" /> Добавить платёж</Button>}
          />
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((r) => {
                const c = category(r.categoryId);
                const d = debt(r.debtId);
                return (
                  <li key={r.id} className={cx("flex items-center gap-3 px-4 py-3.5 sm:px-6", !r.active && "opacity-60")}>
                    {c && <CategoryBadgeIcon icon={c.icon} color={c.color} />}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90">
                        {r.name}
                        {!r.active && <Badge>на паузе</Badge>}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {c?.name ?? "—"}
                        {d && ` · долг «${d.name}»`}
                        {r.dayOfMonth && ` · до ${r.dayOfMonth}-го числа`}
                      </p>
                    </div>
                    <span className="num text-sm font-semibold text-gray-900 dark:text-white">{money(r.amountCents, { compact: true })}</span>
                    <div className="flex items-center gap-1">
                      <span className="hidden sm:block">
                        <Toggle checked={r.active} onChange={() => toggle(r)} label="" />
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => setForm(r)} aria-label="Редактировать"><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r)} aria-label="Удалить" className="hover:!text-error-600"><Trash2 className="size-4" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between border-t border-gray-100 px-4 py-4 text-sm sm:px-6 dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">Итого активных в месяц</span>
              <span className="num font-semibold text-gray-900 dark:text-white">{money(total, { compact: true })}</span>
            </div>
          </>
        )}
      </Card>

      {form && <RecurringForm item={form === "new" ? null : form} onClose={() => setForm(null)} />}
    </>
  );
}

function RecurringForm({ item, onClose }: { item: RecurringDTO | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { activeCategories, category, openDebts, debts } = useAppData();
  const expenseCats = activeCategories("EXPENSE");
  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? centsToInput(item.amountCents) : "");
  const [categoryId, setCategoryId] = useState<number | "">(item?.categoryId ?? expenseCats.find((c) => c.isMandatory)?.id ?? "");
  const [day, setDay] = useState(item?.dayOfMonth ? String(item.dayOfMonth) : "");
  const [debtId, setDebtId] = useState<number | "">(item?.debtId ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDebtCat = !!category(categoryId || null)?.isDebt;
  const debtOptions = debts.filter((d) => !d.closedAt || d.id === item?.debtId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseMoney(amount);
    const dayOfMonth = day ? Number(day) : null;
    if (!name.trim()) return setError("Укажи название");
    if (!amountCents || amountCents <= 0) return setError("Укажи сумму");
    if (!categoryId) return setError("Выбери категорию");
    if (dayOfMonth != null && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) return setError("День месяца от 1 до 31");
    setSaving(true);
    try {
      const body = { name, amountCents, categoryId, dayOfMonth, debtId: isDebtCat && debtId ? debtId : null, active };
      await api(item ? `/api/recurring/${item.id}` : "/api/recurring", { method: item ? "PATCH" : "POST", body });
      toast(item ? "Сохранено" : "Платёж добавлен");
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
      title={item ? "Регулярный платёж" : "Новый регулярный платёж"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" form="recurring-form" disabled={saving}>{saving ? "Сохраняю…" : "Сохранить"}</Button>
        </>
      }
    >
      <form id="recurring-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Название"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Например, O2" className={inputClass} /></Field>
          <Field label="Сумма"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={cx(inputClass, "num")} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Категория">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")} className={selectClass}>
              <option value="">Выбери</option>
              {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="День месяца" hint="Необязательно"><input value={day} onChange={(e) => setDay(e.target.value)} inputMode="numeric" placeholder="—" className={cx(inputClass, "num")} /></Field>
        </div>
        {isDebtCat && (
          <Field label="Долг" hint={openDebts.length === 0 ? "Сначала добавь долг на странице «Долги»" : "Платёж будет уменьшать остаток этого долга"}>
            <select value={debtId} onChange={(e) => setDebtId(e.target.value ? Number(e.target.value) : "")} className={selectClass}>
              <option value="">Без привязки</option>
              {debtOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <Toggle checked={active} onChange={setActive} label="Активен" description="На паузе платёж не учитывается в свободных деньгах" />
        {error && <p className="text-sm text-error-600">{error}</p>}
      </form>
    </Modal>
  );
}
