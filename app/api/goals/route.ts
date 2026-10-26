import { body, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getGoalInfos, toGoalDTO } from "@/lib/data";
import { monthOrCurrent } from "@/lib/month";
import { goalSchema } from "@/lib/validation";

/** Цели с прогрессом относительно month (по умолчанию — текущий месяц). */
export const GET = route(async (req) => getGoalInfos(monthOrCurrent(new URL(req.url).searchParams.get("month"))));

export const POST = route(async (req) => {
  const data = await body(req, goalSchema);
  return toGoalDTO(await prisma.savingsGoal.create({ data }));
});
