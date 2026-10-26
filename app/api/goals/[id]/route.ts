import { body, paramId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toGoalDTO } from "@/lib/data";
import { goalPatchSchema } from "@/lib/validation";

export const PATCH = route(async (req, ctx) => {
  const id = await paramId(ctx);
  const { achieved, ...data } = await body(req, goalPatchSchema);
  const goal = await prisma.savingsGoal.update({
    where: { id },
    data: { ...data, ...(achieved !== undefined ? { achievedAt: achieved ? new Date() : null } : {}) },
  });
  return toGoalDTO(goal);
});

/** Взносы остаются накоплениями, просто без привязки к цели. */
export const DELETE = route(async (_req, ctx) => {
  await prisma.savingsGoal.delete({ where: { id: await paramId(ctx) } });
});
