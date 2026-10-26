"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Button, Modal } from "./ui";
import { formatMoney } from "@/lib/money";
import type { CategoryDTO, CategoryKind, DebtDTO, SettingsDTO } from "@/lib/types";

// ---------- Данные приложения (категории, долги, настройки) ----------

interface AppData {
  settings: SettingsDTO;
  categories: CategoryDTO[];
  debts: DebtDTO[];
  authEnabled: boolean;
}

interface AppDataValue extends AppData {
  money: (cents: number, opts?: { compact?: boolean; sign?: boolean }) => string;
  category: (id: number | null | undefined) => CategoryDTO | undefined;
  activeCategories: (kind: CategoryKind) => CategoryDTO[];
  debt: (id: number | null | undefined) => DebtDTO | undefined;
  openDebts: DebtDTO[];
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function useAppData() {
  const v = useContext(AppDataContext);
  if (!v) throw new Error("useAppData вне AppDataProvider");
  return v;
}

function AppDataProvider({ data, children }: { data: AppData; children: ReactNode }) {
  const value = useMemo<AppDataValue>(() => {
    const byId = new Map(data.categories.map((c) => [c.id, c]));
    const debtById = new Map(data.debts.map((d) => [d.id, d]));
    return {
      ...data,
      money: (cents, opts) => formatMoney(cents, data.settings.currency, opts),
      category: (id) => (id == null ? undefined : byId.get(id)),
      activeCategories: (kind) =>
        data.categories.filter((c) => c.kind === kind && !c.archived).sort((a, b) => a.sortOrder - b.sortOrder),
      debt: (id) => (id == null ? undefined : debtById.get(id)),
      openDebts: data.debts.filter((d) => !d.closedAt),
    };
  }, [data]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

// ---------- Тосты ----------

interface Toast {
  id: number;
  text: string;
  tone: "success" | "error";
}

const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastContext);

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[110] flex flex-col items-center gap-2 px-4 lg:right-6 lg:bottom-6 lg:left-auto lg:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-theme-xl animate-[toast-in_.2s_ease-out] dark:bg-white dark:text-gray-900"
          >
            {t.tone === "success" ? (
              <CircleCheck className="size-4 shrink-0 text-success-500" />
            ) : (
              <CircleAlert className="size-4 shrink-0 text-error-500" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- Подтверждение ----------

interface ConfirmOpts {
  title: string;
  text?: string;
  confirmText?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(opts: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Отмена
            </Button>
            <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {state?.confirmText ?? "Подтвердить"}
            </Button>
          </>
        }
      >
        {state?.text && <p className="text-sm text-gray-600 dark:text-gray-400">{state.text}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function Providers({ data, children }: { data: AppData; children: ReactNode }) {
  return (
    <AppDataProvider data={data}>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </AppDataProvider>
  );
}
