import { NextRequest, NextResponse } from "next/server";
import { getStoredCredentials } from "@/lib/credentialsStore";

export const dynamic = "force-dynamic";

// Proxy da REST API do WooCommerce (v3). As chaves ficam só no servidor e a URL da loja
// vem sempre das credenciais salvas, para que as chaves nunca sejam enviadas a outro host.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json({ error: "Parâmetro endpoint ausente" }, { status: 400 });
    }
    // somente caminhos simples da API (ex.: orders, products, reports/sales)
    if (!/^[a-z0-9_\-/]+$/i.test(endpoint) || endpoint.includes("..")) {
      return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });
    }

    const credentials = await getStoredCredentials();
    if (!credentials.wooStoreUrl || !credentials.wooConsumerKey || !credentials.wooConsumerSecret) {
      return NextResponse.json({ error: "WooCommerce não configurado" }, { status: 400 });
    }

    const wooUrl = new URL(
      `${credentials.wooStoreUrl.replace(/\/+$/, "")}/wp-json/wc/v3/${endpoint}`,
    );

    searchParams.forEach((value, key) => {
      if (key !== "endpoint" && key !== "storeUrl") {
        wooUrl.searchParams.append(key, value);
      }
    });

    wooUrl.searchParams.append("consumer_key", credentials.wooConsumerKey);
    wooUrl.searchParams.append("consumer_secret", credentials.wooConsumerSecret);

    const response = await fetch(wooUrl.toString(), { cache: "no-store" });
    const data: unknown = await response.json();

    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
          ? data.message
          : "Erro na API do WooCommerce";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("WooCommerce API Proxy Error:", error);
    return NextResponse.json({ error: "Erro interno ao consultar o WooCommerce" }, { status: 500 });
  }
}
