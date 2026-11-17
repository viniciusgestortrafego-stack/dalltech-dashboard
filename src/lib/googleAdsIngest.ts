// Validação do que o script do Google Ads envia (nunca confie no corpo do webhook).
import type {
  GoogleAdsConversionRow,
  GoogleAdsKeywordRow,
  GoogleAdsRow,
} from "./googleAdsStore";

const MAX_ROWS = 50_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown, max = 300): string => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));
const asObjects = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.slice(0, MAX_ROWS).filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];

export type ParsedIngest = {
  rows: GoogleAdsRow[];
  keywords: GoogleAdsKeywordRow[];
  conversions: GoogleAdsConversionRow[];
};

export function parseIngestBody(body: unknown): ParsedIngest | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!Array.isArray(b.rows)) {
    return { error: "Formato inválido: esperado { rows: [...], keywords?: [...], conversions?: [...] }" };
  }
  const withDate = <T extends { date: string }>(items: T[]) => items.filter((x) => DATE_RE.test(x.date));

  const rows = withDate(
    asObjects(b.rows).map((r) => ({
      date: str(r.date, 10),
      campaignId: str(r.campaignId, 40),
      campaignName: str(r.campaignName),
      spend: num(r.spend),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      conversions: num(r.conversions),
      conversionValue: num(r.conversionValue),
    })),
  );
  const keywords = withDate(
    asObjects(b.keywords).map((r) => ({
      date: str(r.date, 10),
      keyword: str(r.keyword),
      matchType: str(r.matchType, 20),
      spend: num(r.spend),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      conversions: num(r.conversions),
    })),
  );
  const conversions = withDate(
    asObjects(b.conversions).map((r) => ({
      date: str(r.date, 10),
      conversionActionName: str(r.conversionActionName),
      conversionActionCategory: str(r.conversionActionCategory, 60),
      conversions: num(r.conversions),
      conversionValue: num(r.conversionValue),
    })),
  );
  return { rows, keywords, conversions };
}
