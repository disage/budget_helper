import { body, HttpError, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { settingsSchema } from "@/lib/validation";

export const GET = route(async () => getSettings());

export const PUT = route(async (req) => {
  const data = await body(req, settingsSchema);
  if (data.startMonth) {
    const older = await prisma.transaction.count({ where: { date: { lt: new Date(`${data.startMonth}-01T00:00:00Z`) } } });
    if (older > 0) throw new HttpError(400, `Есть операции раньше этого месяца (${older}) — сначала удали их`);
  }
  await prisma.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  return getSettings();
});
