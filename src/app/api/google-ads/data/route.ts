import { NextResponse } from "next/server";
import { getGoogleAdsData } from "@/lib/googleAdsStore";

// Lido pela página /google-ads (público, como as demais páginas do dashboard).
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getGoogleAdsData();

  const conversionActionCategories: Record<string, string> = {};
  for (const c of data.conversions) {
    if (c.conversionActionName && c.conversionActionCategory) {
      conversionActionCategories[c.conversionActionName] = c.conversionActionCategory;
    }
  }
  const conversionActionNames = Object.keys(conversionActionCategories).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    rows: data.rows,
    keywords: data.keywords,
    conversionBreakdown: data.conversions.map((c) => ({
      date: c.date,
      conversionActionName: c.conversionActionName,
      conversions: c.conversions,
      conversionValue: c.conversionValue,
    })),
    conversionActionNames,
    conversionActionCategories,
    updatedAt: data.updatedAt,
  });
}
