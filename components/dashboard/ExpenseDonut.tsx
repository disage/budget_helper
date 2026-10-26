"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApexOptions } from "apexcharts";
import { PieChart } from "lucide-react";
import { useAppData } from "../providers";
import { useIsDark } from "../useIsDark";
import { EmptyState } from "../ui";
import { themedColor } from "@/lib/palette";
import type { CategoryRow } from "@/lib/budget";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false, loading: () => <div className="size-[220px] rounded-full border-[28px] border-gray-100 dark:border-gray-800" /> });

const REST_COLOR = "#b8b6ae";
const MAX_SLICES = 8;

interface Slice {
  key: string;
  categoryId: number | null | "rest";
  name: string;
  color: string;
  value: number;
}

/** Цвет закреплён за категорией. Повторяющийся цвет и всё сверх 8 долек сворачиваем в «Остальное». */
function buildSlices(rows: CategoryRow[]): Slice[] {
  const used = new Set<string>();
  const slices: Slice[] = [];
  let rest = 0;
  for (const r of rows.filter((r) => r.actualCents > 0)) {
    const color = r.color.toLowerCase();
    if (used.has(color) || slices.length >= MAX_SLICES - 1) {
      rest += r.actualCents;
      continue;
    }
    used.add(color);
    slices.push({ key: String(r.id), categoryId: r.id, name: r.name, color: r.color, value: r.actualCents });
  }
  if (rest > 0) slices.push({ key: "rest", categoryId: "rest", name: "Остальное", color: REST_COLOR, value: rest });
  return slices;
}

export function ExpenseDonut({ rows, month, totalCents }: { rows: CategoryRow[]; month: string; totalCents: number }) {
  const router = useRouter();
  const dark = useIsDark();
  const { money } = useAppData();
  const slices = buildSlices(rows);

  if (slices.length === 0) {
    return <EmptyState icon={<PieChart className="size-5" />} title="Трат пока нет" text="Как только добавишь расходы, здесь появится разбивка по категориям." />;
  }

  const hrefFor = (s: Slice) =>
    s.categoryId === "rest"
      ? `/transactions?month=${month}&type=EXPENSE`
      : `/transactions?month=${month}&categoryId=${s.categoryId ?? "none"}`;

  const options: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "inherit",
      background: "transparent",
      animations: { enabled: true, speed: 400 },
      events: {
        dataPointSelection: (_e, _ctx, cfg) => {
          const s = cfg ? slices[cfg.dataPointIndex] : undefined;
          if (s) router.push(hrefFor(s));
        },
      },
    },
    labels: slices.map((s) => s.name),
    colors: slices.map((s) => themedColor(s.color, dark)),
    stroke: { width: 2, colors: [dark ? "#1a2231" : "#ffffff"] },
    legend: { show: false },
    dataLabels: { enabled: false },
    states: { hover: { filter: { type: "darken" } }, active: { filter: { type: "none" } } },
    tooltip: {
      theme: dark ? "dark" : "light",
      y: { formatter: (v) => money(v, { compact: true }) },
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { show: true, offsetY: 22, color: dark ? "#98a2b3" : "#667085", fontSize: "13px" },
            value: {
              show: true,
              offsetY: -14,
              fontSize: "22px",
              fontWeight: 600,
              color: dark ? "#ffffff" : "#101828",
              formatter: (v) => money(Number(v), { compact: true }),
            },
            total: {
              show: true,
              label: "Всего",
              color: dark ? "#98a2b3" : "#667085",
              fontSize: "13px",
              formatter: () => money(totalCents, { compact: true }),
            },
          },
        },
      },
    },
  };

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="w-[240px] shrink-0">
        <Chart type="donut" options={options} series={slices.map((s) => s.value)} width={240} height={240} />
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {slices.map((s) => (
          <li key={s.key}>
            <Link href={hrefFor(s)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: themedColor(s.color, dark) }} />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
              <span className="num text-sm font-medium text-gray-800 dark:text-white/90">{money(s.value, { compact: true })}</span>
              <span className="num w-10 text-right text-xs text-gray-500 dark:text-gray-400">
                {Math.round((s.value / totalCents) * 100)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
