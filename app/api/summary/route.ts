import { route } from "@/lib/api";
import { getSummary } from "@/lib/data";
import { monthOrCurrent } from "@/lib/month";

export const GET = route(async (req) => {
  const month = monthOrCurrent(new URL(req.url).searchParams.get("month"));
  return getSummary(month);
});
