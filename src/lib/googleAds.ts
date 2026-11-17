// Funções do lado do cliente da página /google-ads: busca em /api/google-ads/data e agregação por período.
export type GoogleAdsRow = {
  date: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
};

export type GoogleAdsKeywordRow = {
  date: string;
  keyword: string;
  matchType: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type GoogleAdsConversionRow = {
  date: string;
  conversionActionName: string;
  conversions: number;
  conversionValue: number;
};

export type GoogleAdsPayload = {
  rows: GoogleAdsRow[];
  keywords: GoogleAdsKeywordRow[];
  conversionBreakdown: GoogleAdsConversionRow[];
  conversionActionNames: string[];
  conversionActionCategories: Record<string, string>;
  updatedAt: string;
};

export class GoogleAdsFetchError extends Error {}

export async function fetchGoogleAdsData(): Promise<GoogleAdsPayload> {
  const res = await fetch("/api/google-ads/data", { cache: "no-store" });
  if (!res.ok) throw new GoogleAdsFetchError("Erro ao buscar dados do Google Ads");
  const json = await res.json();
  return {
    rows: json.rows || [],
    keywords: json.keywords || [],
    conversionBreakdown: json.conversionBreakdown || [],
    conversionActionNames: json.conversionActionNames || [],
    conversionActionCategories: json.conversionActionCategories || {},
    updatedAt: json.updatedAt || "",
  };
}

function inRange<T extends { date: string }>(items: T[], from: string, to: string): T[] {
  return items.filter((item) => item.date >= from && item.date <= to);
}

export const filterGoogleAdsRowsByRange = inRange<GoogleAdsRow>;
export const filterKeywordsByRange = inRange<GoogleAdsKeywordRow>;
export const filterConversionsByRange = inRange<GoogleAdsConversionRow>;

export function aggregateGoogleAdsRows(rows: GoogleAdsRow[]) {
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const conversionValue = rows.reduce((s, r) => s + r.conversionValue, 0);
  return {
    spend,
    impressions,
    clicks,
    conversions,
    conversionValue,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    costPerConversion: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? conversionValue / spend : 0,
  };
}

export function aggregateGoogleAdsByCampaign(rows: GoogleAdsRow[]) {
  const map = new Map<
    string,
    { name: string; spend: number; impressions: number; clicks: number; conversions: number; conversionValue: number }
  >();
  for (const r of rows) {
    const cur = map.get(r.campaignId) || {
      name: r.campaignName,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionValue: 0,
    };
    cur.spend += r.spend;
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    cur.conversions += r.conversions;
    cur.conversionValue += r.conversionValue;
    map.set(r.campaignId, cur);
  }
  return Array.from(map.entries())
    .map(([id, c]) => ({
      id,
      name: c.name,
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      conversions: c.conversions,
      costPerConversion: c.conversions > 0 ? c.spend / c.conversions : 0,
      conversionValue: c.conversionValue,
      roas: c.spend > 0 ? c.conversionValue / c.spend : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export function aggregateGoogleAdsByDay(rows: GoogleAdsRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, (map.get(r.date) || 0) + r.spend);
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, spend]) => ({ date, spend }));
}

export function aggregateGoogleAdsByKeyword(rows: GoogleAdsKeywordRow[]) {
  const map = new Map<
    string,
    { keyword: string; matchType: string; spend: number; impressions: number; clicks: number; conversions: number }
  >();
  for (const r of rows) {
    const key = `${r.keyword}__${r.matchType}`;
    const cur = map.get(key) || { keyword: r.keyword, matchType: r.matchType, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    cur.spend += r.spend;
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    cur.conversions += r.conversions;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((k) => ({
      keyword: k.keyword,
      matchType: k.matchType,
      spend: k.spend,
      impressions: k.impressions,
      clicks: k.clicks,
      cpc: k.clicks > 0 ? k.spend / k.clicks : 0,
      conversions: k.conversions,
      costPerConversion: k.conversions > 0 ? k.spend / k.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export function aggregateConversionBreakdown(rows: GoogleAdsConversionRow[]) {
  const map = new Map<string, { conversions: number; conversionValue: number }>();
  for (const r of rows) {
    const cur = map.get(r.conversionActionName) || { conversions: 0, conversionValue: 0 };
    cur.conversions += r.conversions;
    cur.conversionValue += r.conversionValue;
    map.set(r.conversionActionName, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, conversions: v.conversions, conversionValue: v.conversionValue }))
    .sort((a, b) => b.conversions - a.conversions);
}

// Categorias de conversão do Google Ads que contam como "lead" para um negócio B2B/serviços.
export const LEAD_CATEGORIES = new Set([
  "SUBMIT_LEAD_FORM",
  "PHONE_CALL_LEAD",
  "IMPORTED_LEAD",
  "QUALIFIED_LEAD",
  "CONVERTED_LEAD",
  "REQUEST_QUOTE",
  "CONTACT",
  "BOOK_APPOINTMENT",
  "SIGNUP",
]);
