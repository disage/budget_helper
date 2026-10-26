"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Download, GripVertical, Pencil, Plus, Upload } from "lucide-react";
import { PageHeader } from "./AppShell";
import { CategoryBadgeIcon, CategoryIcon, ICON_NAMES } from "./icons";
import { useAppData, useConfirm, useToast } from "./providers";
import { Badge, Button, Card, Field, Modal, Toggle, inputClass, selectClass } from "./ui";
import { api, cx } from "@/lib/client";
import { PALETTE } from "@/lib/palette";
import { CURRENCIES, type CategoryDTO, type CategoryKind } from "@/lib/types";

export function SettingsView() {
  return (
    <>
      <PageHeader title="Настройки" subtitle="Категории, накопления, валюта и данные" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <CategoriesCard />
        <div className="space-y-6">
          <GeneralCard />
          <DataCard />
        </div>
      </div>
    </>
  );
}

// ---------- Общие ----------

function GeneralCard() {
  const { settings } = useAppData();
  const router = useRouter();
  const toast = useToast();
  const [currency, setCurrency] = useState(settings.currency);
  const [percent, setPercent] = useState(String(settings.savingsPercent));
  const [carry, setCarry] = useState(settings.carryOverBalance);
  const [startMonth, setStartMonth] = useState(settings.startMonth ?? "");
  const [saving, setSaving] = useState(false);
  const dirty =
    currency !== settings.currency ||
    Number(percent) !== settings.savingsPercent ||
    carry !== settings.carryOverBalance ||
    startMonth !== (settings.startMonth ?? "");

  async function save() {
    const p = Number(percent);
    if (!Number.isInteger(p) || p < 0 || p > 100) return toast("Процент — целое число от 0 до 100", "error");
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", body: { currency, savingsPercent: p, carryOverBalance: carry, startMonth: startMonth || null } });
      toast("Настройки сохранены");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Общие">
      <div className="space-y-5">
        <Field label="Можно отложить, % от зарплаты" hint="Лимит накоплений: этот процент от доходов в категориях «зарплата», но не больше свободных денег.">
          <div className="relative">
            <input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="numeric" className={cx(inputClass, "num pr-9")} />
            <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-gray-400">%</span>
          </div>
        </Field>
        <Field label="Начало учёта" hint="Первый месяц в приложении. Раньше него месяцев нет, и операции туда не записываются.">
          <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Валюта">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Toggle checked={carry} onChange={setCarry} label="Переносить остаток на следующий месяц" description="Баланс на начало месяца = баланс на конец прошлого" />
        <Button onClick={save} disabled={!dirty || saving} className="w-full">{saving ? "Сохраняю…" : "Сохранить"}</Button>
      </div>
    </Card>
  );
}

// ---------- Данные ----------

function DataCard() {
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  async function upload(f: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const r = await api<{ imported: number; errors: string[] }>("/api/import", { form });
      setResult(r);
      toast(`Импортировано операций: ${r.imported}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <Card title="Данные" subtitle="CSV с колонками Date, Amount, Description, Category, Type, Debt, Goal">
      <div className="flex flex-col gap-2">
        <a href="/api/export.csv" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]">
          <Download className="size-4" /> Экспорт всех операций
        </a>
        <Button variant="secondary" onClick={() => file.current?.click()} disabled={busy}>
          <Upload className="size-4" /> {busy ? "Импортирую…" : "Импорт из CSV"}
        </Button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Type: EXPENSE, INCOME или SAVING. Дата 2026-06-29 или 29.06.2026. Новые категории создадутся сами.
      </p>
      {result && result.errors.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-warning-50 p-3 text-xs text-warning-600 dark:bg-warning-500/10">
          {result.errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}
    </Card>
  );
}

// ---------- Категории ----------

function CategoriesCard() {
  const { categories } = useAppData();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [kind, setKind] = useState<CategoryKind>("EXPENSE");
  const [form, setForm] = useState<CategoryDTO | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [order, setOrder] = useState<number[] | null>(null);
  const dragId = useRef<number | null>(null);

  const list = categories.filter((c) => c.kind === kind && !c.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const ordered = order ? order.map((id) => list.find((c) => c.id === id)!).filter(Boolean) : list;
  const archived = categories.filter((c) => c.kind === kind && c.archived);

  async function saveOrder(ids: number[]) {
    setOrder(ids);
    try {
      await api("/api/categories/reorder", { body: { ids } });
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setOrder(null);
    }
  }

  const move = (id: number, delta: number) => {
    const ids = ordered.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void saveOrder(ids);
  };

  async function archive(c: CategoryDTO) {
    const ok = await confirm({
      title: `Убрать «${c.name}»?`,
      text: "Если по категории есть операции, она уйдёт в архив и история сохранится. Пустая категория удалится.",
      confirmText: "Убрать",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await api<{ archived: boolean }>(`/api/categories/${c.id}`, { method: "DELETE" });
      toast(r.archived ? "Категория в архиве" : "Категория удалена");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function restore(c: CategoryDTO) {
    try {
      await api(`/api/categories/${c.id}`, { method: "PATCH", body: { archived: false } });
      toast("Категория восстановлена");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <Card
      title="Категории"
      subtitle="Перетащи, чтобы поменять порядок. «Обязательные» вычитаются из свободных денег."
      action={<Button size="sm" onClick={() => setForm("new")}><Plus className="size-4" /> Добавить</Button>}
      bodyClassName="!px-0"
    >
      <div className="mb-3 flex gap-1 px-5 sm:px-6">
        {(["EXPENSE", "INCOME"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cx("h-9 rounded-lg px-3.5 text-sm font-medium", kind === k ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5")}
          >
            {k === "EXPENSE" ? "Расходы" : "Доходы"}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800 dark:border-gray-800">
        {ordered.map((c, i) => (
          <li
            key={c.id}
            draggable
            onDragStart={() => (dragId.current = c.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = dragId.current;
              dragId.current = null;
              if (from == null || from === c.id) return;
              const ids = ordered.map((x) => x.id).filter((id) => id !== from);
              ids.splice(ids.indexOf(c.id) + (ordered.findIndex((x) => x.id === from) < i ? 1 : 0), 0, from);
              void saveOrder(ids);
            }}
            className="group flex items-center gap-3 bg-white px-3 py-2.5 sm:px-4 dark:bg-transparent"
          >
            <GripVertical className="hidden size-4 shrink-0 cursor-grab text-gray-300 sm:block dark:text-gray-600" />
            <CategoryBadgeIcon icon={c.icon} color={c.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{c.name}</p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {c.isMandatory && <Badge>обязательная</Badge>}
                {c.isDebt && <Badge tone="brand">долги</Badge>}
                {c.isSalary && <Badge tone="success">зарплата</Badge>}
              </div>
            </div>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => move(c.id, -1)} disabled={i === 0} aria-label="Выше" className="disabled:opacity-30"><ChevronUp className="size-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => move(c.id, 1)} disabled={i === ordered.length - 1} aria-label="Ниже" className="disabled:opacity-30"><ChevronDown className="size-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setForm(c)} aria-label="Редактировать"><Pencil className="size-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => archive(c)} aria-label="В архив" className="hover:!text-error-600"><Archive className="size-4" /></Button>
            </div>
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <div className="px-5 pt-4 sm:px-6">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            {showArchived ? "Скрыть архив" : `Архив (${archived.length})`}
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1.5 opacity-70">
                  <CategoryBadgeIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{c.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => restore(c)}><ArchiveRestore className="size-4" /> Вернуть</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {form && <CategoryForm kind={kind} category={form === "new" ? null : form} onClose={() => setForm(null)} />}
    </Card>
  );
}

function CategoryForm({ kind, category, onClose }: { kind: CategoryKind; category: CategoryDTO | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const k = category?.kind ?? kind;
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? PALETTE[0].light);
  const [icon, setIcon] = useState(category?.icon ?? "circle");
  const [isMandatory, setMandatory] = useState(category?.isMandatory ?? false);
  const [isDebt, setDebt] = useState(category?.isDebt ?? false);
  const [isSalary, setSalary] = useState(category?.isSalary ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Укажи название");
    setSaving(true);
    try {
      const flags = k === "EXPENSE" ? { isMandatory, isDebt, isSalary: false } : { isSalary, isMandatory: false, isDebt: false };
      await api(category ? `/api/categories/${category.id}` : "/api/categories", {
        method: category ? "PATCH" : "POST",
        body: { name, color, icon, ...flags, ...(category ? {} : { kind: k }) },
      });
      toast(category ? "Категория сохранена" : "Категория добавлена");
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
      title={category ? "Категория" : `Новая категория ${k === "EXPENSE" ? "расходов" : "доходов"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" form="category-form" disabled={saving}>{saving ? "Сохраняю…" : "Сохранить"}</Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-5">
        <div className="flex items-end gap-3">
          <CategoryBadgeIcon icon={icon} color={color} size="lg" />
          <Field label="Название" className="flex-1"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40} className={inputClass} /></Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Цвет</p>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((p) => (
              <button
                key={p.light}
                type="button"
                onClick={() => setColor(p.light)}
                aria-label={p.name}
                title={p.name}
                className={cx("size-8 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-gray-900", color.toLowerCase() === p.light && "ring-2 ring-gray-900 dark:ring-white")}
                style={{ backgroundColor: p.light }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Иконка</p>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
            {ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIcon(n)}
                aria-label={n}
                className={cx("flex aspect-square items-center justify-center rounded-lg border", icon === n ? "border-transparent" : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5")}
                style={icon === n ? { backgroundColor: `${color}1f`, color, boxShadow: `0 0 0 2px ${color}` } : undefined}
              >
                <CategoryIcon name={n} className="size-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
          {k === "EXPENSE" ? (
            <>
              <Toggle checked={isMandatory} onChange={setMandatory} label="Обязательная" description="Регулярные обязательные траты: жильё, связь, проезд, долги" />
              <Toggle checked={isDebt} onChange={setDebt} label="Для платежей по долгам" description="При добавлении трат можно выбрать конкретный долг" />
            </>
          ) : (
            <Toggle checked={isSalary} onChange={setSalary} label="Зарплата" description={`От этих доходов считается «можно отложить»`} />
          )}
        </div>
        {error && <p className="text-sm text-error-600">{error}</p>}
      </form>
    </Modal>
  );
}
