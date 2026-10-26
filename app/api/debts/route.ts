import { body, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getDebts, toDebtDTO } from "@/lib/data";
import { debtSchema } from "@/lib/validation";

export const GET = route(async () => getDebts());

export const POST = route(async (req) => {
  const data = await body(req, debtSchema);
  return toDebtDTO(await prisma.debt.create({ data }));
});
