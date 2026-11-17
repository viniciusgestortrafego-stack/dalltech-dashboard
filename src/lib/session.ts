import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

// Só importe isto de route.ts / proxy.ts (servidor). O token de sessão é derivado da senha do admin,
// sem tabela de sessões: trocar SETTINGS_AUTH_PASSWORD desconecta todo mundo.

export const SESSION_COOKIE_NAME = "genius_session";

function expectedToken(): string | null {
  const user = process.env.SETTINGS_AUTH_USER;
  const pass = process.env.SETTINGS_AUTH_PASSWORD;
  if (!user || !pass) return null;
  return createHmac("sha256", pass).update(user).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function checkLogin(user: string, pass: string): boolean {
  const expectedUser = process.env.SETTINGS_AUTH_USER;
  const expectedPass = process.env.SETTINGS_AUTH_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass);
}

export function issueSessionToken(): string | null {
  return expectedToken();
}

export function isValidSession(request: NextRequest): boolean {
  const token = expectedToken();
  if (!token) return false;
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, token);
}
