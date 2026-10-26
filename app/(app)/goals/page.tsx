import { GoalsView } from "@/components/GoalsView";
import { getGoalInfos } from "@/lib/data";
import { currentMonth } from "@/lib/month";

export default async function GoalsPage() {
  const month = currentMonth();
  return <GoalsView month={month} items={await getGoalInfos(month)} />;
}
