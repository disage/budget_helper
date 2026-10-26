import { body, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getRecurring, toRecurringDTO } from "@/lib/data";
import { recurringSchema } from "@/lib/validation";

export const GET = route(async () => getRecurring());

export const POST = route(async (req) => {
  const data = await body(req, recurringSchema);
  return toRecurringDTO(await prisma.recurringPayment.create({ data }));
});
