"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Save } from "lucide-react";
import { PageHeader } from "./AppShell";
import { MonthSwitcher } from "./MonthSwitcher";
import { CategoryBadgeIcon } from "./icons";
import { useAppData, useConfirm, useToast } from "./providers";
import { Badge, Button, Card, inputClass } from "./ui";
import { planTotals } from "@/lib/budget";
import { api, cx } from "@/lib/client";
import { centsToInput, parseMoney } from "@/lib/money";
import { monthLabel, shiftMonth } from "@/lib/month";
import type { CategoryDTO } from "@/lib/types";

interface Props {
  month: string;
  initial: Record<number, number>;
  actual: Record<number, number>;
  hasPrevPlan: boolean;
}

export function PlanEditor({ month, initial, actual, hasPrevPlan }: Props) {
  const { activeCategories, money, settings } = useAppData();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const toText = (src: Record<number, number>) =>
    Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v ? centsToInput(v) : ""]));
  const [values, setValues] = useState<Record<string, string>>(() => toText(initial));
  const [saving, setSaving] = useState(false);

  const expense = activeCategories("EXPENSE");
  const income = activeCategories("INCOME");
  const all = [...income, ...expense];

  const planned = useMemo(() => {
    const out: Record<number, number> = {};
    for (const c of all) out[c.id] = parseMoney(values[c.id] ?? "") ?? 0;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);
  const invalid = all.filter((c) => (values[c.id] ?? "").trim() && parseMoney(values[c.id]) == null).map((c) => c.id);
  const totals = planTotals(all, planned, settings.savingsPercent);
  const dirty = all.some((c) => (planned[c.id] ?? 0) !== (initial[c.id] ?? 0));

  async function save() {
    if (invalid.length) return toast("Проверь суммы, отмеченные красным", "error");
    setSaving(true);
    try {
      await api(`/api/plan?month=${month}`, {
        method: "PUT",
        body: { items: all.map((c) => ({ categoryId: c.id, plannedCents: Math.max(planned[c.id] ?? 0, 0) })) },
      });
      toast("План сохранён");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrev() {
    const prev = shiftMonth(month, -1);
    if (Object.keys(initial).length > 0 || dirty) {
      const ok = await confirm({ title: "Заменить план?", text: `Текущий план за ${monthLabel(month).toLowerCase()} заменится планом за ${monthLabel(prev).toLowerCase()}.`, confirmText: "Заменить" });
      if (!ok) return;
    }
    try {
      await api(`/api/plan/copy?from=${prev}&to=${month}`, { method: "POST" });
      const fresh = await api<Record<number, number>>(`/api/plan?month=${month}`);
      setValues(toText(fresh));
      toast("План скопирован");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const section = (title: string, cats: CategoryDTO[], kind: "INCOME" | "EXPENSE") => (
    <Card title={title} bodyClassName="!px-0 !pb-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-gray-100 text-left text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="py-2.5 pr-2 pl-5 font-medium sm:pl-6">Категория</th>
            <th className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Факт</th>
            <th className="w-36 py-2.5 pr-5 pl-2 text-right font-medium sm:w-44 sm:pr-6">План</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {cats.map((c) => (
            <tr key={c.id}>
              <td className="py-2 pr-2 pl-5 sm:pl-6">
                <span className="flex items-center gap-2.5">
                  <CategoryBadgeIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="font-medium text-gray-800 dark:text-white/90">{c.name}</span>
                  {kind === "EXPENSE" && c.isMandatory && <Badge className="hidden sm:inline-flex">обяз.</Badge>}
                  {kind === "INCOME" && c.isSalary && <Badge tone="success" className="hidden sm:inline-flex">зарплата</Badge>}
                </span>
              </td>
              <td className="num hidden px-2 py-2 text-right text-gray-500 sm:table-cell dark:text-gray-400">{actual[c.id] ? money(actual[c.id], { compact: true }) : "—"}</td>
              <td className="py-2 pr-5 pl-2 sm:pr-6">
                <input
                  value={values[c.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`План: ${c.name}`}
                  className={cx(inputClass, "num !h-9 text-right", invalid.includes(c.id) && "!border-error-500")}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );

  return (
    <>
      <PageHeader title="План месяца" subtitle="Сколько планируешь получить и потратить по каждой категории">
        <MonthSwitcher month={month} />
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {section("Доходы", income, "INCOME")}
          {section("Расходы", expense, "EXPENSE")}
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <Card title="Итоги плана" subtitle="Пересчитываются по мере ввода">
            <dl className="space-y-3 text-sm">
              <Row label="Плановый доход" value={money(totals.incomeCents, { compact: true })} />
              <Row label="Обязательные платежи" value={`−${money(totals.mandatoryCents, { compact: true })}`} />
              <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
                <Row label="Свободные деньги" value={money(totals.freeCents, { compact: true })} strong tone={totals.freeCents < 0 ? "error" : undefined} />
              </div>
              <Row label={`Можно отложить (${settings.savingsPercent}% от зарплаты)`} value={money(totals.savingsPossibleCents, { compact: true })} tone="saving" />
              <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
                <Row label="Все плановые расходы" value={money(totals.expenseCents, { compact: true })} />
                <Row label="Остаток после всех трат" value={money(totals.leftoverCents, { compact: true, sign: true })} strong tone={totals.leftoverCents < 0 ? "error" : "success"} />
              </div>
            </dl>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={save} disabled={saving || !dirty}>
                <Save className="size-4" /> {saving ? "Сохраняю…" : dirty ? "Сохранить план" : "Сохранено"}
              </Button>
              <Button variant="secondary" onClick={copyPrev} disabled={!hasPrevPlan} title={hasPrevPlan ? undefined : "В прошлом месяце плана нет"}>
                <Copy className="size-4" /> Скопировать план за {monthLabel(shiftMonth(month, -1)).toLowerCase()}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "error" | "success" | "saving" }) {
  const toneCls = tone === "error" ? "text-error-600 dark:text-error-500" : tone === "success" ? "text-success-600 dark:text-success-500" : tone === "saving" ? "text-saving-600 dark:text-[#8f9cff]" : "text-gray-900 dark:text-white";
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={cx("num shrink-0", strong ? "text-base font-semibold" : "font-medium", toneCls)}>{value}</dd>
    </div>
  );
}
