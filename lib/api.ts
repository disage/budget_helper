import "server-only";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Запись") => new HttpError(404, `${what} не найдена`);

type Ctx = { params: Promise<Record<string, string>> };

/** Оборачивает роут: ошибки валидации → 400, не найдено → 404, остальное → 500. */
export function route(fn: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const data = await fn(req, ctx);
      return data instanceof Response ? data : NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof ZodError) {
        const issue = e.issues[0];
        return NextResponse.json({ error: issue?.message ?? "Неверные данные", issues: e.issues }, { status: 400 });
      }
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        return NextResponse.json({ error: "Связанная запись не найдена" }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
    }
  };
}

export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Ожидался JSON");
  }
  return schema.parse(json);
}

export async function paramId(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Неверный id");
  return n;
}
