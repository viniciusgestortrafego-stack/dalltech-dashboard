import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStoredCredentials } from "@/lib/credentialsStore";
import { parseIngestBody } from "@/lib/googleAdsIngest";
import { saveGoogleAdsData } from "@/lib/googleAdsStore";

// Chamado pelo Script do Google Ads (servidor do Google → este servidor), não por um navegador logado:
// por isso é protegido por uma chave compartilhada (cabeçalho Authorization: Bearer <chave>),
// e não pelo cookie de sessão. Gere/troque a chave em /settings.
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest, expectedSecret: string): boolean {
  if (!expectedSecret) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const credentials = await getStoredCredentials();
  if (!isAuthorized(request, credentials.googleAdsWebhookSecret)) {
    return NextResponse.json({ error: "Chave inválida" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseIngestBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const saved = await saveGoogleAdsData(parsed);
  return NextResponse.json({
    ok: true,
    received: {
      rows: parsed.rows.length,
      keywords: parsed.keywords.length,
      conversions: parsed.conversions.length,
    },
    stored: {
      rows: saved.rows.length,
      keywords: saved.keywords.length,
      conversions: saved.conversions.length,
    },
    updatedAt: saved.updatedAt,
  });
}
