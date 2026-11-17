// Dados enviados pelo script do Google Ads (webhook). Só importe de route.ts (servidor).
import { readJson, writeJson } from "./blobJson";

export type GoogleAdsRow = {
  date: string; // AAAA-MM-DD
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
  matchType: string; // EXACT | PHRASE | BROAD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type GoogleAdsConversionRow = {
  date: string;
  conversionActionName: string;
  conversionActionCategory: string; // ex.: PURCHASE, SUBMIT_LEAD_FORM, PHONE_CALL_LEAD
  conversions: number;
  conversionValue: number;
};

export type GoogleAdsData = {
  rows: GoogleAdsRow[];
  keywords: GoogleAdsKeywordRow[];
  conversions: GoogleAdsConversionRow[];
  updatedAt: string; // ISO do último envio recebido
};

const PATHNAME = "dashboard/google-ads.json";
const EMPTY: GoogleAdsData = { rows: [], keywords: [], conversions: [], updatedAt: "" };

export async function getGoogleAdsData(): Promise<GoogleAdsData> {
  return readJson<GoogleAdsData>(PATHNAME, EMPTY);
}

// Cada envio substitui os dias que ele cobre e preserva os dias fora dessa janela.
function mergeByDate<T extends { date: string }>(current: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return current;
  const dates = incoming.map((row) => row.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const kept = current.filter((row) => row.date < first || row.date > last);
  return [...kept, ...incoming].sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveGoogleAdsData(input: {
  rows: GoogleAdsRow[];
  keywords: GoogleAdsKeywordRow[];
  conversions: GoogleAdsConversionRow[];
}): Promise<GoogleAdsData> {
  const current = await getGoogleAdsData();
  const next: GoogleAdsData = {
    rows: mergeByDate(current.rows, input.rows),
    keywords: mergeByDate(current.keywords, input.keywords),
    conversions: mergeByDate(current.conversions, input.conversions),
    updatedAt: new Date().toISOString(),
  };
  await writeJson(PATHNAME, next);
  return next;
}
