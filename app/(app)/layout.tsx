import { AppShell } from "@/components/AppShell";
import { Providers } from "@/components/providers";
import { QuickAddProvider } from "@/components/QuickAdd";
import { authEnabled } from "@/lib/auth";
import { ensureDefaults, getCategories, getDebts, getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureDefaults();
  const [settings, categories, debts] = await Promise.all([getSettings(), getCategories(), getDebts()]);
  return (
    <Providers data={{ settings, categories, debts, authEnabled: authEnabled() }}>
      <QuickAddProvider>
        <AppShell>{children}</AppShell>
      </QuickAddProvider>
    </Providers>
  );
}
