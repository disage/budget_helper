"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/month";

export function MonthSwitcher({ month }: { month: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (m: string) => {
    const p = new URLSearchParams(params);
    p.set("month", m);
    return `${pathname}?${p}`;
  };
  const isCurrent = month === currentMonth();
  const btn =
    "flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white";
  return (
    <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <Link href={href(shiftMonth(month, -1))} className={btn} aria-label="Предыдущий месяц" scroll={false}>
        <ChevronLeft className="size-5" />
      </Link>
      <span className="min-w-[132px] text-center text-sm font-semibold text-gray-800 dark:text-white/90">{monthLabel(month)}</span>
      <Link href={href(shiftMonth(month, 1))} className={btn} aria-label="Следующий месяц" scroll={false}>
        <ChevronRight className="size-5" />
      </Link>
      {!isCurrent && (
        <Link href={href(currentMonth())} className="ml-1 rounded-lg px-2.5 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10" scroll={false}>
          Сегодня
        </Link>
      )}
    </div>
  );
}
