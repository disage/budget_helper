import { route } from "@/lib/api";
import { getSummary, resolveMonth } from "@/lib/data";

export const GET = route(async (req) => {
  const month = await resolveMonth(new URL(req.url).searchParams.get("month"));
  return getSummary(month);
});
