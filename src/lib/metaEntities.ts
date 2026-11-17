// Buscas na Meta (via proxy /api/meta) usadas por Captação de Leads e Criativos:
// desempenho por anúncio/conjunto e série diária das campanhas de leads.
import { SalesRow, deriveSalesMetrics } from "@/lib/sales";

export class MetaFetchError extends Error {}

type MetaAction = { action_type?: string; value?: string };
type MetaRecord = Record<string, unknown>;
type MetaResponse = { data?: MetaRecord[]; error?: string };

export type EntityLevel = "ad" | "adset";

export interface EntityPerformanceRow {
  id: string;
  name: string;
  spend: number;
  purchases: number; // compras (Criativos) ou contatos (Captação de Leads)
  cpa: number;
  revenue: number;
  roas: number;
  managerUrl: string;
  thumbnailUrl?: string;
  permalinkUrl?: string;
}

const PURCHASE_ACTIONS = [
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "onsite_web_purchase",
  "web_in_store_purchase",
];
const LANDING_PAGE_ACTIONS = ["landing_page_view", "omni_landing_page_view"];
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

// Campanhas de captação de leads são identificadas por "[LEAD]" no nome
const LEAD_FILTER = JSON.stringify([{ field: "campaign.name", operator: "CONTAIN", value: "[LEAD]" }]);

function normalizeAct(adAccountId: string): string {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

function isActionList(value: unknown): value is MetaAction[] {
  return Array.isArray(value);
}

// Procura o primeiro tipo de ação conhecido; se nenhum bater, aceita qualquer um que contenha o termo
function actionValue(list: unknown, types: string[], fallbackContains: string): number {
  if (!isActionList(list)) return 0;
  for (const type of types) {
    const found = list.find((action) => action?.action_type === type);
    if (found) return parseFloat(found.value ?? "0") || 0;
  }
  const loose = list.find(
    (action) => typeof action?.action_type === "string" && action.action_type.includes(fallbackContains),
  );
  return (loose && parseFloat(loose.value ?? "0")) || 0;
}

const purchases = (list: unknown) => actionValue(list, PURCHASE_ACTIONS, "purchase");
const landingPageViews = (list: unknown) => actionValue(list, LANDING_PAGE_ACTIONS, "landing_page_view");
const checkouts = (list: unknown) => actionValue(list, CHECKOUT_ACTIONS, "initiate_checkout");
const contacts = (list: unknown) => actionValue(list, CONTACT_ACTIONS, "contact");

function toNumber(value: unknown): number {
  return parseFloat(String(value ?? "0")) || 0;
}

async function metaGet(params: URLSearchParams): Promise<MetaRecord[]> {
  const response = await fetch(`/api/meta?${params.toString()}`);
  const json = (await response.json()) as MetaResponse;
  if (!response.ok) throw new MetaFetchError(json.error || "Erro ao buscar dados do Meta Ads");
  return json.data || [];
}

function managerUrl(adAccountId: string, level: EntityLevel, id: string): string {
  const account = adAccountId.replace(/^act_/, "");
  const page = level === "ad" ? "ads" : "adsets";
  const selected = level === "ad" ? "selected_ad_ids" : "selected_adset_ids";
  return `https://www.facebook.com/adsmanager/manage/${page}?act=${account}&${selected}=${id}`;
}

type CreativeInfo = { thumbnailUrl?: string; permalinkUrl?: string };

// Miniaturas e links dos anúncios (best effort: se falhar, a tabela segue sem imagens)
async function fetchCreativeInfo(adAccountId: string): Promise<Map<string, CreativeInfo>> {
  const params = new URLSearchParams({
    endpoint: `${normalizeAct(adAccountId)}/ads`,
    fields: "id,creative{thumbnail_url,image_url,instagram_permalink_url}",
    limit: "500",
  });
  const response = await fetch(`/api/meta?${params.toString()}`);
  const json = (await response.json()) as MetaResponse;
  const map = new Map<string, CreativeInfo>();
  if (!response.ok) return map;
  for (const ad of json.data || []) {
    const creative = ad.creative as
      | { thumbnail_url?: string; image_url?: string; instagram_permalink_url?: string }
      | undefined;
    if (creative) {
      map.set(String(ad.id), {
        thumbnailUrl: creative.thumbnail_url || creative.image_url || undefined,
        permalinkUrl: creative.instagram_permalink_url || undefined,
      });
    }
  }
  return map;
}

async function fetchEntities(
  {
    adAccountId,
    level,
    since,
    until,
  }: { adAccountId: string; level: EntityLevel; since: string; until: string },
  leadsOnly: boolean,
): Promise<EntityPerformanceRow[]> {
  const idKey = level === "ad" ? "ad_id" : "adset_id";
  const nameKey = level === "ad" ? "ad_name" : "adset_name";
  const params = new URLSearchParams({
    endpoint: `${normalizeAct(adAccountId)}/insights`,
    fields: `${idKey},${nameKey},spend,actions,action_values`,
    level,
    time_range: JSON.stringify({ since, until }),
    ...(leadsOnly ? { filtering: LEAD_FILTER } : {}),
    limit: "500",
  });

  const [data, creatives] = await Promise.all([
    metaGet(params),
    level === "ad" ? fetchCreativeInfo(adAccountId) : Promise.resolve(new Map<string, CreativeInfo>()),
  ]);

  return data.map((row) => {
    const id = String(row[idKey] ?? "");
    const spend = toNumber(row.spend);
    const count = leadsOnly ? contacts(row.actions) : purchases(row.actions);
    // para leads, o original usa o valor de ação "contact" como receita (normalmente 0)
    const revenue = leadsOnly ? contacts(row.action_values) : purchases(row.action_values);
    const creative = creatives.get(id);
    return {
      id,
      name: String(row[nameKey] ?? "Sem nome"),
      spend,
      purchases: count,
      cpa: count > 0 ? spend / count : 0,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      managerUrl: managerUrl(adAccountId, level, id),
      thumbnailUrl: creative?.thumbnailUrl,
      permalinkUrl: creative?.permalinkUrl,
    };
  });
}

// Criativos: desempenho de vendas por anúncio, ordenado por investimento
export async function fetchEntityPerformance(args: {
  adAccountId: string;
  level: EntityLevel;
  since: string;
  until: string;
}): Promise<EntityPerformanceRow[]> {
  return (await fetchEntities(args, false)).sort((a, b) => b.spend - a.spend);
}

// Captação de Leads: contatos por conjunto/anúncio (só campanhas "[LEAD]"), ordenado por contatos
export async function fetchLeadEntityPerformance(args: {
  adAccountId: string;
  level: EntityLevel;
  since: string;
  until: string;
}): Promise<EntityPerformanceRow[]> {
  return (await fetchEntities(args, true)).sort((a, b) => b.purchases - a.purchases);
}

// Série diária das campanhas de leads; "compras" guarda os contatos no site
export async function fetchDailyLeadRows({
  adAccountId,
  since,
  until,
}: {
  adAccountId: string;
  since: string;
  until: string;
}): Promise<SalesRow[]> {
  const params = new URLSearchParams({
    endpoint: `${normalizeAct(adAccountId)}/insights`,
    fields: "spend,clicks,impressions,actions,action_values",
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    filtering: LEAD_FILTER,
    limit: "500",
  });
  const data = await metaGet(params);

  type Day = {
    investimento: number;
    compras: number;
    receita: number;
    impressoes: number;
    cliques: number;
    visitasLP: number;
    checkoutsIniciados: number;
  };
  const byDay = new Map<string, Day>();
  for (const row of data) {
    const date = String(row.date_start ?? "");
    const day: Day = byDay.get(date) || {
      investimento: 0,
      compras: 0,
      receita: 0,
      impressoes: 0,
      cliques: 0,
      visitasLP: 0,
      checkoutsIniciados: 0,
    };
    day.investimento += toNumber(row.spend);
    day.compras += contacts(row.actions);
    day.receita += contacts(row.action_values);
    day.impressoes += toNumber(row.impressions);
    day.cliques += toNumber(row.clicks);
    day.visitasLP += landingPageViews(row.actions);
    day.checkoutsIniciados += checkouts(row.actions);
    byDay.set(date, day);
  }

  return Array.from(byDay.entries()).map(([date, day]) => ({
    date,
    dateObj: date ? new Date(`${date}T00:00:00`) : null,
    ...day,
    ...deriveSalesMetrics(day),
  }));
}
