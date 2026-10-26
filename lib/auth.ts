// Простейшая авторизация одним паролем: в cookie лежит хэш пароля.
// Работает и в middleware (Edge), и в роутах — только Web Crypto.
export const SESSION_COOKIE = "bh_session";

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

export async function sessionToken(password = process.env.APP_PASSWORD ?? ""): Promise<string> {
  const data = new TextEncoder().encode(`budget-helper:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(cookie: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  return !!cookie && cookie === (await sessionToken());
}
