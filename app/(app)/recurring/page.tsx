import { RecurringView } from "@/components/RecurringView";
import { getRecurring } from "@/lib/data";

export default async function RecurringPage() {
  return <RecurringView items={await getRecurring()} />;
}
