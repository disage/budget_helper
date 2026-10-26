"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleCheck, Goal, Pencil, PiggyBank, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { PageHeader } from "./AppShell";
import { useQuickAdd } from "./QuickAdd";
import { CategoryBadgeIcon, CategoryIcon } from "./icons";
import { useAppData, useConfirm, useToast } from "./providers";
import { useIsDark } from "./useIsDark";
import { Badge, Button, Card, EmptyState, Field, Modal, inputClass } from "./ui";
import type { GoalInfo } from "@/lib/data";
import { api, cx } from "@/lib/client";
import { centsToInput, parseMoney } from "@/lib/money";
import { byMonthLabel, formatDate, monthLabel } from "@/lib/month";
import { PALETTE, themedColor } from "@/lib/palette";
import type { GoalDTO } from "@/lib/types";

const GOAL_ICONS = ["piggy-bank", "car", "house", "plane", "laptop", "smartphone", "bike", "sofa", "umbrella", "gem", "gift", "graduation-cap", "heart-pulse", "baby", "shield", "wallet"];

export function GoalsView({ month, items }: { month: string; items: GoalInfo[] }) {
  const { money } = useAppData();
  const [form, setForm] = useState<GoalDTO | "new" | null>(null);
  const active = items.filter((i) => !i.goal.achievedAt);
  const achieved = items.filter((i) => i.goal.achievedAt);
  const totalSaved = active.reduce((a, i) => a + i.progress.savedCents, 0);
  const totalTarget = active.reduce((a, i) => a + i.goal.targetCents, 0);
  const thisMonth = items.reduce((a, i) => a + i.progress.savedThisMonthCents, 0);
  const needed = active.reduce((a, i) => a + (i.progress.monthlyNeededCents ?? 0), 0);

  return (
    <>
      <PageHeader title="Цели" subtitle="Копилки на крупные покупки: машина, отпуск, подушка безопасности. Взносы — это операции «Отложить».">
        <Button onClick={() => setForm("new")}>
          <Plus className="size-4" /> Новая цель
        </Button>
      </PageHeader>

      {active.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Накоплено на цели" value={money(totalSaved, { compact: true })} hint={`из ${money(totalTarget, { compact: true })}`} />
          <Stat label="Отложено в этом месяце" value={money(thisMonth, { compact: true })} hint={monthLabel(month)} tone="saving" />
          <Stat label="Нужно в месяц" value={money(needed, { compact: true })} hint="Чтобы успеть к срокам всех целей" />
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Goal className="size-5" />}
            title="Целей пока нет"
            text="Например, «Машина — 10 000 € к декабрю 2027». Приложение посчитает, сколько откладывать в месяц."
            action={<Button onClick={() => setForm("new")}><Plus className="size-4" /> Добавить цель</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {active.map((i) => <GoalCard key={i.goal.id} info={i} onEdit={() => setForm(i.goal)} />)}
          {active.length === 0 && (
            <Card className="lg:col-span-2">
              <EmptyState icon={<CircleCheck className="size-5" />} title="Все цели достигнуты" text="Пора ставить новую!" />
            </Card>
          )}
        </div>
      )}

      {achieved.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Достигнутые</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {achieved.map((i) => <GoalCard key={i.goal.id} info={i} onEdit={() => setForm(i.goal)} />)}
          </div>
        </>
      )}

      {form && <GoalForm goal={form === "new" ? null : form} onClose={() => setForm(null)} />}
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "saving" }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cx("num mt-1 text-2xl font-semibold", tone === "saving" ? "text-saving-600 dark:text-[#8f9cff]" : "text-gray-900 dark:text-white")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

function GoalCard({ info, onEdit }: { info: GoalInfo; onEdit: () => void }) {
  const { goal: g, progress: p } = info;
  const { money } = useAppData();
  const quickAdd = useQuickAdd();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const dark = useIsDark();
  const done = !!g.achievedAt;
  const reached = p.remainingCents === 0;
  const color = themedColor(g.color, dark);

  async function patch(body: object, msg: string) {
    try {
      await api(`/api/goals/${g.id}`, { method: "PATCH", body });
      toast(msg);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Удалить цель «${g.name}»?`,
      text: info.contributionCount > 0
        ? `${info.contributionCount} взносов на ${money(p.savedCents, { compact: true })} останутся в накоплениях, но без привязки к цели.`
        : "Это нельзя отменить.",
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/goals/${g.id}`, { method: "DELETE" });
      toast("Цель удалена");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <Card className={cx(done && "opacity-75")}>
      <div className="flex items-start gap-4">
        <CategoryBadgeIcon icon={g.icon} color={g.color} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">{g.name}</h3>
            {done ? <Badge tone="success">Достигнута</Badge> : reached ? <Badge tone="success">Накоплено!</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Цель {money(g.targetCents, { compact: true })}
            {g.deadline && ` · ${byMonthLabel(g.deadline)}`}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Редактировать"><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={remove} aria-label="Удалить" className="hover:!text-error-600"><Trash2 className="size-4" /></Button>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Накоплено</p>
          <p className="num text-3xl font-semibold text-gray-900 dark:text-white">{money(p.savedCents, { compact: true })}</p>
        </div>
        <p className="num pb-1 text-right text-sm text-gray-500 dark:text-gray-400">
          осталось <b className="font-semibold text-gray-800 dark:text-white/90">{money(p.remainingCents, { compact: true })}</b>
          {p.savedThisMonthCents > 0 && (
            <>
              <br />
              <span className="text-saving-600 dark:text-[#8f9cff]">+{money(p.savedThisMonthCents, { compact: true })} в этом месяце</span>
            </>
          )}
        </p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${p.percent}%`, backgroundColor: color }} />
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{Math.floor(p.percent)}% накоплено</p>

      {!done && !reached && (
        <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-3.5 text-sm dark:bg-white/[0.03]">
          {p.overdue ? (
            <p className="flex items-start gap-2 text-warning-600">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> Срок прошёл. Поставь новый, чтобы снова считать, сколько откладывать в месяц.
            </p>
          ) : p.monthlyNeededCents != null ? (
            <p className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
              <Goal className="mt-0.5 size-4 shrink-0 text-gray-400" />
              <span>
                Откладывай <b className="num font-semibold">{money(p.monthlyNeededCents, { compact: true })}/мес</b>, чтобы успеть {byMonthLabel(g.deadline!)}
                <span className="text-gray-500 dark:text-gray-400"> (осталось месяцев: {p.monthsLeft})</span>
              </span>
            </p>
          ) : null}
          <p className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-gray-400" />
            {p.etaMonth
              ? `При текущем темпе накопишь ≈ ${byMonthLabel(p.etaMonth)}`
              : "Сделай первый взнос — и появится прогноз, когда накопишь"}
          </p>
        </div>
      )}

      {g.note && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{g.note}</p>}

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">Взносы</p>
        {info.contributions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Пока ничего не отложено.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {info.contributions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="num">{formatDate(t.date)}</span>
                  {t.description && <span className="ml-2 text-gray-400">{t.description}</span>}
                </span>
                <span className="num font-medium text-saving-600 dark:text-[#8f9cff]">+{money(t.amountCents)}</span>
              </li>
            ))}
            {info.contributionCount > info.contributions.length && (
              <li className="pt-2 text-xs text-gray-400">и ещё {info.contributionCount - info.contributions.length}…</li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {!done && (
          <Button
            onClick={() =>
              quickAdd({
                type: "SAVING",
                goalId: g.id,
                amountCents: p.monthlyNeededCents ? Math.min(p.monthlyNeededCents, p.remainingCents) || undefined : undefined,
                title: `В копилку: ${g.name}`,
              })
            }
          >
            <PiggyBank className="size-4" /> Пополнить
          </Button>
        )}
        <Button variant="secondary" onClick={() => patch({ achieved: !done }, done ? "Цель снова активна" : "Поздравляю с целью!")}>
          {done ? <><RotateCcw className="size-4" /> Вернуть в активные</> : <><CircleCheck className="size-4" /> Цель достигнута</>}
        </Button>
      </div>
    </Card>
  );
}

function GoalForm({ goal, onClose }: { goal: GoalDTO | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? centsToInput(goal.targetCents) : "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "piggy-bank");
  const [color, setColor] = useState(goal?.color ?? PALETTE[0].light);
  const [note, setNote] = useState(goal?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const targetCents = parseMoney(target);
    if (!name.trim()) return setError("Укажи название");
    if (!targetCents || targetCents <= 0) return setError("Укажи сумму цели");
    setSaving(true);
    try {
      const body = { name, targetCents, deadline: deadline || null, icon, color, note };
      await api(goal ? `/api/goals/${goal.id}` : "/api/goals", { method: goal ? "PATCH" : "POST", body });
      toast(goal ? "Цель обновлена" : "Цель добавлена");
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
      title={goal ? "Цель" : "Новая цель"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" form="goal-form" disabled={saving}>{saving ? "Сохраняю…" : "Сохранить"}</Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="space-y-5">
        <div className="flex items-end gap-3">
          <CategoryBadgeIcon icon={icon} color={color} size="lg" />
          <Field label="Название" className="flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} placeholder="Например, Машина" className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Сколько нужно накопить">
            <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="10 000" className={cx(inputClass, "num")} />
          </Field>
          <Field label="К какому месяцу" hint="Необязательно — тогда посчитаю, сколько откладывать в месяц">
            <input type="month" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Иконка</p>
          <div className="grid grid-cols-8 gap-1.5">
            {GOAL_ICONS.map((n) => (
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
        <Field label="Заметка"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={cx(inputClass, "h-auto py-2.5")} /></Field>
        {error && <p className="text-sm text-error-600">{error}</p>}
      </form>
    </Modal>
  );
}
