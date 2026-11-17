import { NextRequest, NextResponse } from "next/server";
import { emptyCredentials, sanitizeCredentials } from "@/lib/credentials";
import {
  clearStoredCredentials,
  getStoredCredentials,
  saveStoredCredentials,
} from "@/lib/credentialsStore";

// Protegida por src/proxy.ts (sessão de quem fez login em /settings)
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getStoredCredentials());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  await saveStoredCredentials(sanitizeCredentials({ ...emptyCredentials, ...body }));
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearStoredCredentials();
  return NextResponse.json({ ok: true });
}
