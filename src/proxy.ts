import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/session";

// Só /api/credentials é protegido aqui: a página /settings sempre carrega
// (ela mostra o formulário de login e chama /api/auth/login).

export function proxy(request: NextRequest) {
  if (isValidSession(request)) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
}

export const config = {
  matcher: "/api/credentials",
};
