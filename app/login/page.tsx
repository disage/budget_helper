"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) return setError("Неверный пароль");
    const next = params.get("next");
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-8 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
        <Lock className="size-5" />
      </span>
      <h1 className="mt-5 text-center text-xl font-semibold text-gray-900 dark:text-white">Budget Helper</h1>
      <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">Введи пароль, чтобы открыть бюджет</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        autoComplete="current-password"
        placeholder="Пароль"
        aria-label="Пароль"
        className="mt-6 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3.5 text-sm shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-none dark:border-gray-700 dark:text-white"
      />
      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}
      <button type="submit" disabled={busy || !password} className="mt-4 h-11 w-full rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {busy ? "Проверяю…" : "Войти"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
