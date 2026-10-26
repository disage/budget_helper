import { Dashboard } from "@/components/dashboard/Dashboard";
import { getSummary } from "@/lib/data";
import { monthOrCurrent } from "@/lib/month";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const month = monthOrCurrent((await searchParams).month);
  return <Dashboard s={await getSummary(month)} />;
}
