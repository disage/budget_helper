import { Dashboard } from "@/components/dashboard/Dashboard";
import { getGoalInfos, getSummary, resolveMonth } from "@/lib/data";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const month = await resolveMonth((await searchParams).month);
  const [summary, goals] = await Promise.all([getSummary(month), getGoalInfos(month)]);
  return <Dashboard s={summary} goals={goals.filter((g) => !g.goal.achievedAt)} />;
}
