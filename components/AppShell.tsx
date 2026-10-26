"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight, CreditCard, LayoutDashboard, LogOut, Menu, Moon, Plus, Repeat, Settings, Sun, Target,
} from "lucide-react";
import { useQuickAdd } from "./QuickAdd";
import { useAppData } from "./providers";
import { Modal } from "./ui";
import { cx } from "@/lib/client";

const NAV = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard, monthAware: true },
  { href: "/transactions", label: "Операции", icon: ArrowLeftRight, monthAware: true },
  { href: "/plan", label: "План месяца", icon: Target, monthAware: true },
  { href: "/debts", label: "Долги", icon: CreditCard },
  { href: "/recurring", label: "Регулярные", icon: Repeat },
  { href: "/settings", label: "Настройки", icon: Settings },
];

function useNavHref() {
  const params = useSearchParams();
  const month = params.get("month");
  return (item: (typeof NAV)[number]) => (item.monthAware && month ? `${item.href}?month=${month}` : item.href);
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
    window.dispatchEvent(new Event("themechange"));
  };
  return { dark, toggle };
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
          <path d="M9 21V11h7.5a3 3 0 0 1 0 6H9m7.5 0H18a3 3 0 0 1 0 6H9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 -1)" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Budget Helper</span>
    </Link>
  );
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navHref = useNavHref();
  const quickAdd = useQuickAdd();
  const { authEnabled } = useAppData();
  const { dark, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  // Горячая клавиша «N» — новая операция.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "т") {
        e.preventDefault();
        quickAdd();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [quickAdd]);

  const current = NAV.find((n) => isActive(pathname, n.href));

  return (
    <div className="min-h-dvh">
      {/* Сайдбар (десктоп) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-gray-200 bg-white px-5 dark:border-gray-800 dark:bg-gray-900 lg:flex">
        <div className="flex h-[76px] items-center">
          <Logo />
        </div>
        <button
          type="button"
          onClick={() => quickAdd()}
          className="mb-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-700"
        >
          <Plus className="size-4" /> Операция
          <kbd className="ml-1 rounded bg-white/20 px-1.5 text-[11px] font-normal">N</kbd>
        </button>
        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-gray-400">Меню</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={navHref(item)}
                className={cx(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/[0.12] dark:text-brand-400"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
                )}
              >
                <item.icon
                  className={cx(
                    "size-5",
                    active ? "text-brand-600 dark:text-brand-400" : "text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-gray-100 py-4 dark:border-gray-800">
          <button type="button" onClick={toggle} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">
            {dark ? <Sun className="size-5 text-gray-400" /> : <Moon className="size-5 text-gray-500" />}
            {dark ? "Светлая тема" : "Тёмная тема"}
          </button>
          {authEnabled && (
            <button type="button" onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">
              <LogOut className="size-5 text-gray-500 dark:text-gray-400" /> Выйти
            </button>
          )}
        </div>
      </aside>

      {/* Шапка (мобильная) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 lg:hidden">
        <Logo />
        <button type="button" onClick={toggle} aria-label="Сменить тему" className="flex size-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
      </header>

      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">
          {children}
        </div>
      </main>

      {/* Таб-бар (мобильный) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {[NAV[0], NAV[1]].map((item) => (
            <TabLink key={item.href} href={navHref(item)} active={isActive(pathname, item.href)} icon={item.icon} label={item.label} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => quickAdd()}
              aria-label="Новая операция"
              className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-theme-lg ring-4 ring-gray-50 active:scale-95 dark:ring-gray-900"
            >
              <Plus className="size-6" />
            </button>
          </div>
          <TabLink href="/debts" active={isActive(pathname, "/debts")} icon={CreditCard} label="Долги" />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cx(
              "flex flex-col items-center gap-1 text-[11px] font-medium",
              current && ["/plan", "/recurring", "/settings"].includes(current.href) ? "text-brand-600 dark:text-brand-400" : "text-gray-500 dark:text-gray-400",
            )}
          >
            <Menu className="size-5" />
            Ещё
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Ещё" size="sm">
        <div className="flex flex-col gap-1">
          {NAV.slice(2).filter((n) => n.href !== "/debts").map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                setMoreOpen(false);
                router.push(navHref(item));
              }}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
            >
              <item.icon className="size-5 text-gray-500" /> {item.label}
            </button>
          ))}
          {authEnabled && (
            <button type="button" onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5">
              <LogOut className="size-5 text-gray-500" /> Выйти
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}

function TabLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: typeof Plus; label: string }) {
  return (
    <Link href={href} className={cx("flex flex-col items-center gap-1 text-[11px] font-medium", active ? "text-brand-600 dark:text-brand-400" : "text-gray-500 dark:text-gray-400")}>
      <Icon className="size-5" />
      {label === "Дашборд" ? "Главная" : label}
    </Link>
  );
}

/** Заголовок страницы с правым блоком действий. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
