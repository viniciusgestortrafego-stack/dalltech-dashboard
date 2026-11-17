import { NextRequest, NextResponse } from "next/server";
import { getStoredCredentials } from "@/lib/credentialsStore";

// Proxy somente-leitura da Graph API: o token fica no servidor e nunca chega ao navegador.
// Só aceita contas/objetos numéricos (act_123, 1784..., <id>/insights ...), não qualquer rota da Graph API.
export const dynamic = "force-dynamic";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const ENDPOINT_RE =
  /^(act_\d+|\d+)(\/(insights|media|stories|campaigns|adsets|ads|adcreatives|adimages|advideos|leadgen_forms|leads))?$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }
    if (!ENDPOINT_RE.test(endpoint)) {
      return NextResponse.json({ error: "Endpoint não permitido" }, { status: 400 });
    }

    const credentials = await getStoredCredentials();
    if (!credentials.metaToken) {
      return NextResponse.json({ error: "Meta Ads não configurado" }, { status: 400 });
    }

    const metaUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`);
    searchParams.forEach((value, key) => {
      if (key !== "endpoint" && key !== "access_token") metaUrl.searchParams.append(key, value);
    });
    metaUrl.searchParams.append("access_token", credentials.metaToken);

    const response = await fetch(metaUrl.toString(), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      const message = String(data?.error?.message || "Erro no Meta API").split(credentials.metaToken).join("***");
      return NextResponse.json({ error: message }, { status: response.status });
    }

    // não repassa os links de paginação: eles trazem o access_token embutido
    if (data?.paging) {
      delete data.paging.next;
      delete data.paging.previous;
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Meta API Proxy Error:", error instanceof Error ? error.message : "desconhecido");
    return NextResponse.json({ error: "Não foi possível falar com a API da Meta. Tente de novo em instantes." }, { status: 502 });
  }
}
