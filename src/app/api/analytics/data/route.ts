import { NextResponse } from "next/server";
import {
  formatGa4Date,
  isGa4Configured,
  listConversionEventNames,
  rowsToObjects,
  runReport,
} from "@/lib/ga4Api";

// Pública — mesma política das demais rotas de dados do dashboard.
// Puxa ao vivo da Google Analytics Data API (GA4) — veja src/lib/ga4Api.ts.

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 90;

function dateWindow(): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (WINDOW_DAYS - 1));
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  return { since: toISO(since), until: toISO(until) };
}

function str(value: string | number | undefined): string {
  return typeof value === "string" ? value : value === undefined ? "" : String(value);
}

function num(value: string | number | undefined): number {
  return typeof value === "number" ? value : parseFloat(value ?? "0") || 0;
}

export async function GET() {
  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  if (!propertyId || !isGa4Configured()) {
    return NextResponse.json({
      configured: false,
      daily: [],
      channels: [],
      conversionBreakdown: [],
      conversionEventNames: [],
      products: [],
      utms: [],
    });
  }

  try {
    const { since, until } = dateWindow();

    const [dailyResult, channelResult, conversionEventNames, productResult, utmResult] = await Promise.all([
      runReport({
        propertyId,
        dimensions: ["date"],
        metrics: ["sessions", "activeUsers", "engagementRate"],
        since,
        until,
      }),
      runReport({
        propertyId,
        dimensions: ["date", "sessionDefaultChannelGroup"],
        metrics: ["sessions", "activeUsers", "conversions"],
        since,
        until,
      }),
      listConversionEventNames(propertyId),
      // Itens de e-commerce (visualizados, adicionados ao carrinho, comprados, receita)
      runReport({
        propertyId,
        dimensions: ["date", "itemName"],
        metrics: ["itemsViewed", "itemsAddedToCart", "itemsPurchased", "itemRevenue"],
        since,
        until,
      }),
      runReport({
        propertyId,
        dimensions: [
          "date",
          "sessionSource",
          "sessionMedium",
          "sessionCampaignName",
          "sessionManualTerm",
          "sessionManualAdContent",
        ],
        metrics: ["sessions", "conversions", "totalRevenue"],
        since,
        until,
      }),
    ]);

    // Contagem diária de cada evento de conversão (só os configurados como evento-chave)
    const conversionResult =
      conversionEventNames.length > 0
        ? await runReport({
            propertyId,
            dimensions: ["date", "eventName"],
            metrics: ["eventCount"],
            since,
            until,
            dimensionFilter: {
              filter: { fieldName: "eventName", inListFilter: { values: conversionEventNames } },
            },
          })
        : null;

    const daily = rowsToObjects(dailyResult).map((r) => ({
      date: formatGa4Date(str(r.date)),
      sessions: num(r.sessions),
      activeUsers: num(r.activeUsers),
      engagementRate: num(r.engagementRate),
    }));

    const channels = rowsToObjects(channelResult).map((r) => ({
      date: formatGa4Date(str(r.date)),
      channel: str(r.sessionDefaultChannelGroup),
      sessions: num(r.sessions),
      activeUsers: num(r.activeUsers),
      conversions: num(r.conversions),
    }));

    const conversionBreakdown = conversionResult
      ? rowsToObjects(conversionResult).map((r) => ({
          date: formatGa4Date(str(r.date)),
          eventName: str(r.eventName),
          count: num(r.eventCount),
        }))
      : [];

    const products = rowsToObjects(productResult).map((r) => ({
      date: formatGa4Date(str(r.date)),
      itemName: str(r.itemName),
      itemsViewed: num(r.itemsViewed),
      itemsAddedToCart: num(r.itemsAddedToCart),
      itemsPurchased: num(r.itemsPurchased),
      itemRevenue: num(r.itemRevenue),
    }));

    const utms = rowsToObjects(utmResult).map((r) => ({
      date: formatGa4Date(str(r.date)),
      source: str(r.sessionSource),
      medium: str(r.sessionMedium),
      campaign: str(r.sessionCampaignName),
      term: str(r.sessionManualTerm),
      content: str(r.sessionManualAdContent),
      sessions: num(r.sessions),
      conversions: num(r.conversions),
      revenue: num(r.totalRevenue),
    }));

    return NextResponse.json({
      configured: true,
      daily,
      channels,
      conversionBreakdown,
      conversionEventNames,
      products,
      utms,
    });
  } catch (error) {
    console.error("GA4 data error:", error instanceof Error ? error.message : "desconhecido");
    return NextResponse.json({ error: "Erro ao buscar dados do Analytics" }, { status: 500 });
  }
}
