import { body, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { settingsSchema } from "@/lib/validation";

export const GET = route(async () => getSettings());

export const PUT = route(async (req) => {
  const data = await body(req, settingsSchema);
  await prisma.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  return getSettings();
});
