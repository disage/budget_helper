"use client";

import Link from "next/link";
import { TriangleAlert, Target } from "lucide-react";
import { useAppData } from "../providers";
import { EmptyState } from "../ui";
import type { CategoryRow } from "@/lib/budget";

/** Буллет-бары: серая дорожка — план, тёмная полоса — факт, красная — перерасход. */
export function PlanVsActual({ rows, month }: { rows: CategoryRow[]; month: string }) {
  const { money } = useAppData();
  const visible = rows.filter((r) => r.plannedCents > 0 || r.actualCents > 0);
  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<Target className="size-5" />}
        title="Нет плана и трат"
        text="Задай план по категориям, чтобы видеть, где укладываешься, а где перерасход."
        action={<Link href={`/plan?month=${month}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">Открыть план месяца →</Link>}
      />
    );
  }
  const scale = Math.max(...visible.map((r) => Math.max(r.plannedCents, r.actualCents)));
  const pct = (v: number) => `${(v / scale) * 100}%`;

  return (
    <ul className="space-y-4">
      {visible.map((r) => {
        const over = r.plannedCents > 0 && r.actualCents > r.plannedCents;
        const noPlan = r.plannedCents === 0;
        return (
          <li key={r.id ?? "none"}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-gray-700 dark:text-gray-300">{r.name}</span>
              <span className="num shrink-0 text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-800 dark:text-white/90">{money(r.actualCents, { compact: true })}</span>
                {noPlan ? " · без плана" : ` из ${money(r.plannedCents, { compact: true })}`}
              </span>
            </div>
            <div className="relative h-2.5 w-full" title={`${r.name}: ${money(r.actualCents)}${noPlan ? "" : ` из ${money(r.plannedCents)}`}`}>
              {!noPlan && <div className="absolute inset-y-0 left-0 rounded-full bg-gray-200 dark:bg-gray-700/70" style={{ width: pct(r.plannedCents) }} />}
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-error-500" : noPlan ? "bg-gray-400 dark:bg-gray-500" : "bg-gray-700 dark:bg-gray-300"}`}
                style={{ width: pct(r.actualCents), minWidth: r.actualCents > 0 ? 4 : 0 }}
              />
              {over && <div className="absolute -inset-y-1 w-0.5 rounded bg-gray-900 dark:bg-white" style={{ left: pct(r.plannedCents) }} />}
            </div>
            {over && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-error-600 dark:text-error-500">
                <TriangleAlert className="size-3.5" /> Перерасход {money(r.actualCents - r.plannedCents, { compact: true })}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
