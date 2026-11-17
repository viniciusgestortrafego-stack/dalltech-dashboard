import { SalesBaseMetrics, SalesRow, deriveSalesMetrics } from "./sales";

// Paleta categórica validada (ordem de matiz fixa, pares adjacentes seguros para daltonismo).
// Nunca reordenar nem ciclar; as cores são atribuídas em sequência.
const PALETTE = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

export class MetaFetchError extends Error {}

export interface BreakdownItem {
  name: string;
  value: number;
  color: string;
}

export interface CampaignPerformanceRow {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  checkoutsIniciados: number;
  custoPorCheckout: number;
  purchases: number;
  cpa: number;
  spend: number;
  revenue: number;
  grossProfit: number;
}

export interface EntityPerformanceRow {
  id: string;
  name: string;
  spend: number;
  purchases: number;
  cpa: number;
  revenue: number;
  roas: number;
  managerUrl: string;
  thumbnailUrl?: string;
  permalinkUrl?: string;
}

type MetaAction = { action_type?: string; value?: string };
type MetaRow = Record<string, unknown>;
type MetaResponse = { data?: MetaRow[]; error?: string };

interface FetchBreakdownParams {
  adAccountId: string;
  breakdowns: string[];
  since: string;
  until: string;
  formatLabel?: (row: MetaRow) => string;
}

interface FetchRangeParams {
  adAccountId: string;
  since: string;
  until: string;
}

interface FetchEntityParams extends FetchRangeParams {
  level: "ad" | "adset";
}

function normalizeAccountId(id: string): string {
  return id.startsWith("act_") ? id : `act_${id}`;
}

function toNumber(value: unknown): number {
  return parseFloat(String(value ?? "0")) || 0;
}

function asActions(value: unknown): MetaAction[] | undefined {
  return Array.isArray(value) ? (value as MetaAction[]) : undefined;
}

const GENDER_LABELS: Record<string, string> = { male: "Masculino", female: "Feminino", unknown: "Não informado" };
const DEVICE_LABELS: Record<string, string> = {
  mobile_app: "App Mobile",
  mobile_web: "Web Mobile",
  desktop: "Desktop",
};

export function formatAgeGenderLabel(row: MetaRow): string {
  const age = String(row.age ?? "");
  const gender = String(row.gender ?? "");
  const genderLabel = GENDER_LABELS[gender] ?? gender;
  if (age && genderLabel) return `${age} anos • ${genderLabel}`;
  return age || genderLabel || "Não identificado";
}

export function formatDeviceLabel(row: MetaRow): string {
  const device = String(row.device_platform ?? "");
  return DEVICE_LABELS[device] ?? (device || "Não identificado");
}

function labelForRow(row: MetaRow, breakdowns: string[]): string {
  const parts = breakdowns.map((key) => row[key]).filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" - ") : "Não identificado";
}

// Tipos de ação (Meta) por métrica; o último parâmetro é o fallback por substring
const PURCHASE_ACTIONS = [
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "onsite_web_purchase",
  "web_in_store_purchase",
];
const LANDING_PAGE_VIEW_ACTIONS = ["landing_page_view", "omni_landing_page_view"];
const CHECKOUT_ACTIONS = [
  "omni_initiated_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
  "initiate_checkout",
  "onsite_web_initiate_checkout",
];
const CONTACT_ACTIONS = [
  "omni_contact",
  "offsite_conversion.fb_pixel_contact",
  "contact",
  "onsite_web_contact",
  "on_facebook_contact",
  "offsite_conversion.fb_pixel_custom",
];

function pickActionValue(actions: MetaAction[] | undefined, types: string[], fallbackSubstring: string): number {
  if (!Array.isArray(actions)) return 0;
  for (const type of types) {
    const found = actions.find((action) => action?.action_type === type);
    if (found) return parseFloat(found.value ?? "0") || 0;
  }
  const partial = actions.find(
    (action) => typeof action?.action_type === "string" && action.action_type.includes(fallbackSubstring),
  );
  return (partial && parseFloat(partial.value ?? "0")) || 0;
}

function purchaseCount(actions: MetaAction[] | undefined): number {
  return pickActionValue(actions, PURCHASE_ACTIONS, "purchase");
}

function purchaseValue(actionValues: MetaAction[] | undefined): number {
  return pickActionValue(actionValues, PURCHASE_ACTIONS, "purchase");
}

function landingPageViews(actions: MetaAction[] | undefined): number {
  return pickActionValue(actions, LANDING_PAGE_VIEW_ACTIONS, "landing_page_view");
}

function initiatedCheckouts(actions: MetaAction[] | undefined): number {
  return pickActionValue(actions, CHECKOUT_ACTIONS, "initiate_checkout");
}

function leadCount(actions: MetaAction[] | undefined): number {
  return pickActionValue(actions, CONTACT_ACTIONS, "contact");
}

function leadValue(actionValues: MetaAction[] | undefined): number {
  return pickActionValue(actionValues, CONTACT_ACTIONS, "contact");
}

// Campanhas de captação de leads são identificadas pelo prefixo [LEAD] no nome
const LEAD_CAMPAIGN_FILTER = JSON.stringify([{ field: "campaign.name", operator: "CONTAIN", value: "[LEAD]" }]);

async function requestInsights(params: URLSearchParams): Promise<MetaRow[]> {
  const response = await fetch(`/api/meta?${params.toString()}`);
  const json = (await response.json()) as MetaResponse;
  if (!response.ok) throw new MetaFetchError(json.error || "Erro ao buscar dados do Meta Ads");
  return json.data || [];
}

// Compras por quebra (posicionamento, dispositivo, idade e gênero), em ordem decrescente
export async function fetchPurchaseBreakdown({
  adAccountId,
  breakdowns,
  since,
  until,
  formatLabel,
}: FetchBreakdownParams): Promise<BreakdownItem[]> {
  const params = new URLSearchParams({
    endpoint: `${normalizeAccountId(adAccountId)}/insights`,
    fields: "spend,actions",
    breakdowns: breakdowns.join(","),
    level: "account",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
  });
  const rows = await requestInsights(params);

  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = formatLabel ? formatLabel(row) : labelForRow(row, breakdowns);
    const purchases = purchaseCount(asActions(row.actions));
    totals.set(label, (totals.get(label) || 0) + purchases);
  }

  return Array.from(totals.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({ name, value, color: PALETTE[index % PALETTE.length] }));
}

function managerUrl(adAccountId: string, level: "ad" | "adset", id: string): string {
  const account = adAccountId.replace(/^act_/, "");
  const page = level === "ad" ? "ads" : "adsets";
  const selected = level === "ad" ? "selected_ad_ids" : "selected_adset_ids";
  return `https://www.facebook.com/adsmanager/manage/${page}?act=${account}&${selected}=${id}`;
}

type CreativeInfo = { thumbnailUrl?: string; permalinkUrl?: string };

async function fetchAdCreatives(adAccountId: string): Promise<Map<string, CreativeInfo>> {
  const params = new URLSearchParams({
    endpoint: `${normalizeAccountId(adAccountId)}/ads`,
    fields: "id,creative{thumbnail_url,image_url,instagram_permalink_url}",
    limit: "500",
  });
  const response = await fetch(`/api/meta?${params.toString()}`);
  const json = (await response.json()) as MetaResponse;
  const creatives = new Map<string, CreativeInfo>();
  if (!response.ok) return creatives;
  for (const ad of json.data || []) {
    const creative = ad.creative as
      | { thumbnail_url?: string; image_url?: string; instagram_permalink_url?: string }
      | undefined;
    if (creative) {
      creatives.set(String(ad.id), {
        thumbnailUrl: creative.thumbnail_url || creative.image_url || undefined,
        permalinkUrl: creative.instagram_permalink_url || undefined,
      });
    }
  }
  return creatives;
}

async function fetchEntities(
  { adAccountId, level, since, until }: FetchEntityParams,
  filtering: string | null,
): Promise<EntityPerformanceRow[]> {
  const idKey = level === "ad" ? "ad_id" : "adset_id";
  const nameKey = level === "ad" ? "ad_name" : "adset_name";
  const query: Record<string, string> = {
    endpoint: `${normalizeAccountId(adAccountId)}/insights`,
    fields: `${idKey},${nameKey},spend,actions,action_values`,
    level,
    time_range: JSON.stringify({ since, until }),
    limit: "500",
  };
  if (filtering) query.filtering = filtering;
  const params = new URLSearchParams(query);

  const [rows, creatives] = await Promise.all([
    requestInsights(params),
    level === "ad" ? fetchAdCreatives(adAccountId) : Promise.resolve(new Map<string, CreativeInfo>()),
  ]);

  return rows.map((row) => {
    const id = String(row[idKey] ?? "");
    const name = String(row[nameKey] ?? "Sem nome");
    const spend = toNumber(row.spend);
    const purchases = filtering ? leadCount(asActions(row.actions)) : purchaseCount(asActions(row.actions));
    const revenue = filtering ? leadValue(asActions(row.action_values)) : purchaseValue(asActions(row.action_values));
    const creative = creatives.get(id);
    return {
      id,
      name,
      spend,
      purchases,
      cpa: purchases > 0 ? spend / purchases : 0,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      managerUrl: managerUrl(adAccountId, level, id),
      thumbnailUrl: creative?.thumbnailUrl,
      permalinkUrl: creative?.permalinkUrl,
    };
  });
}

// Desempenho de vendas por anúncio/conjunto, ordenado por investimento
export async function fetchEntityPerformance(params: FetchEntityParams): Promise<EntityPerformanceRow[]> {
  const rows = await fetchEntities(params, null);
  return rows.sort((a, b) => b.spend - a.spend);
}

// Desempenho de leads (campanhas [LEAD]) por anúncio/conjunto, ordenado por leads
export async function fetchLeadEntityPerformance(params: FetchEntityParams): Promise<EntityPerformanceRow[]> {
  const rows = await fetchEntities(params, LEAD_CAMPAIGN_FILTER);
  return rows.sort((a, b) => b.purchases - a.purchases);
}

function toDateObj(date: string): Date | null {
  return date ? new Date(`${date}T00:00:00`) : null;
}

// Série diária da conta (vendas)
export async function fetchDailySalesRows({ adAccountId, since, until }: FetchRangeParams): Promise<SalesRow[]> {
  const params = new URLSearchParams({
    endpoint: `${normalizeAccountId(adAccountId)}/insights`,
    fields: "spend,clicks,impressions,actions,action_values",
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
  });
  const rows = await requestInsights(params);

  return rows.map((row) => {
    const date = String(row.date_start ?? "");
    const base: SalesBaseMetrics = {
      investimento: toNumber(row.spend),
      compras: purchaseCount(asActions(row.actions)),
      receita: purchaseValue(asActions(row.action_values)),
      impressoes: toNumber(row.impressions),
      cliques: toNumber(row.clicks),
      visitasLP: landingPageViews(asActions(row.actions)),
      checkoutsIniciados: initiatedCheckouts(asActions(row.actions)),
    };
    return { date, dateObj: toDateObj(date), ...base, ...deriveSalesMetrics(base) };
  });
}

// Série diária das campanhas de leads ([LEAD]); "compras" e "receita" representam leads e valor de leads
export async function fetchDailyLeadRows({ adAccountId, since, until }: FetchRangeParams): Promise<SalesRow[]> {
  const params = new URLSearchParams({
    endpoint: `${normalizeAccountId(adAccountId)}/insights`,
    fields: "spend,clicks,impressions,actions,action_values",
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    filtering: LEAD_CAMPAIGN_FILTER,
    limit: "500",
  });
  const rows = await requestInsights(params);

  const byDate = new Map<string, SalesBaseMetrics>();
  for (const row of rows) {
    const date = String(row.date_start ?? "");
    const acc: SalesBaseMetrics = byDate.get(date) || {
      investimento: 0,
      compras: 0,
      receita: 0,
      impressoes: 0,
      cliques: 0,
      visitasLP: 0,
      checkoutsIniciados: 0,
    };
    acc.investimento += toNumber(row.spend);
    acc.compras += leadCount(asActions(row.actions));
    acc.receita += leadValue(asActions(row.action_values));
    acc.impressoes += toNumber(row.impressions);
    acc.cliques += toNumber(row.clicks);
    acc.visitasLP += landingPageViews(asActions(row.actions));
    acc.checkoutsIniciados += initiatedCheckouts(asActions(row.actions));
    byDate.set(date, acc);
  }

  return Array.from(byDate.entries()).map(([date, base]) => ({
    date,
    dateObj: toDateObj(date),
    ...base,
    ...deriveSalesMetrics(base),
  }));
}

// Desempenho por campanha no período (visão geral)
export async function fetchCampaignPerformance({
  adAccountId,
  since,
  until,
}: FetchRangeParams): Promise<CampaignPerformanceRow[]> {
  const params = new URLSearchParams({
    endpoint: `${normalizeAccountId(adAccountId)}/insights`,
    fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
    level: "campaign",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
  });
  const rows = await requestInsights(params);

  return rows
    .map((row) => {
      const spend = toNumber(row.spend);
      const impressions = toNumber(row.impressions);
      const clicks = toNumber(row.clicks);
      const checkouts = initiatedCheckouts(asActions(row.actions));
      const purchases = purchaseCount(asActions(row.actions));
      const revenue = purchaseValue(asActions(row.action_values));
      return {
        id: String(row.campaign_id ?? ""),
        name: String(row.campaign_name ?? "Sem nome"),
        impressions,
        clicks,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        checkoutsIniciados: checkouts,
        custoPorCheckout: checkouts > 0 ? spend / checkouts : 0,
        purchases,
        cpa: purchases > 0 ? spend / purchases : 0,
        spend,
        revenue,
        grossProfit: revenue - spend,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
