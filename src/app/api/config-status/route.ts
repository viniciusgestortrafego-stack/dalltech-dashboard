import { NextResponse } from "next/server";
import { normalizeAdAccountId } from "@/lib/credentials";
import { getStoredCredentials } from "@/lib/credentialsStore";

// Público: só diz o que está configurado (IDs não são segredo). Nunca devolve tokens nem chaves.
export const dynamic = "force-dynamic";

export async function GET() {
  const c = await getStoredCredentials();
  const adAccountId = normalizeAdAccountId(c.adAccountId);
  return NextResponse.json({
    adAccountId,
    instagramAccountId: c.instagramAccountId,
    wooStoreUrl: c.wooStoreUrl,
    hasMeta: Boolean(c.metaToken && adAccountId),
    hasInstagram: Boolean(c.metaToken && c.instagramAccountId),
    hasWoo: Boolean(c.wooStoreUrl && c.wooConsumerKey && c.wooConsumerSecret),
    hasGoogleAds: Boolean(c.googleAdsWebhookSecret),
  });
}
