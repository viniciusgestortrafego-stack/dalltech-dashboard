export class WooFetchError extends Error {}

// Mesma paleta categórica usada nos gráficos do dashboard.
const PALETTE = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

// Pedidos nesses status não representam receita real/confirmada.
const EXCLUDED_STATUSES = new Set(["cancelled", "failed", "trash"]);

const MAX_PAGES = 10;
const PER_PAGE = 100;

export type UtmGroupBy = "source" | "campaign" | "content";

export interface UtmBreakdownItem {
  name: string;
  value: number;
  orders: number;
  color: string;
}

export interface UtmBreakdowns {
  source: UtmBreakdownItem[];
  campaign: UtmBreakdownItem[];
  content: UtmBreakdownItem[];
}

interface WooMetaData {
  key: string;
  value: unknown;
}

interface WooOrder {
  status?: string;
  total?: string;
  meta_data?: WooMetaData[];
}

interface WooOrderQueryParams {
  since: string;
  until: string;
}

function readError(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}

async function fetchOrders({ since, until }: WooOrderQueryParams): Promise<WooOrder[]> {
  const after = new Date(`${since}T00:00:00`).toISOString();
  const before = new Date(`${until}T23:59:59`).toISOString();

  const orders: WooOrder[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      endpoint: "orders",
      after,
      before,
      per_page: String(PER_PAGE),
      page: String(page),
      orderby: "date",
      order: "desc",
    });

    const response = await fetch(`/api/woocommerce?${params.toString()}`);
    const data: unknown = await response.json();

    if (!response.ok) {
      throw new WooFetchError(readError(data, "Erro ao buscar pedidos do WooCommerce"));
    }

    const pageOrders: WooOrder[] = Array.isArray(data) ? (data as WooOrder[]) : [];
    orders.push(...pageOrders);

    if (pageOrders.length < PER_PAGE) break;
  }

  return orders.filter((order) => !EXCLUDED_STATUSES.has(String(order.status ?? "")));
}

function readMeta(order: WooOrder, keys: string[]): string {
  const meta = order.meta_data || [];
  for (const key of keys) {
    const entry = meta.find((item) => item.key === key);
    if (entry && entry.value) return String(entry.value);
  }
  return "";
}

function extractUtm(order: WooOrder): Record<UtmGroupBy, string> {
  const source =
    readMeta(order, ["_wc_order_attribution_utm_source", "utm_source"]) ||
    readMeta(order, ["_wc_order_attribution_source_type"]) ||
    "Direto / Não identificado";
  const campaign =
    readMeta(order, ["_wc_order_attribution_utm_campaign", "utm_campaign"]) || "Não definida";
  const content =
    readMeta(order, ["_wc_order_attribution_utm_content", "utm_content"]) || "Não definido";
  return { source, campaign, content };
}

function groupOrders(orders: WooOrder[], groupBy: UtmGroupBy): UtmBreakdownItem[] {
  const groups = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    const name = extractUtm(order)[groupBy];
    const total = parseFloat(String(order.total ?? "0")) || 0;
    const current = groups.get(name) || { revenue: 0, orders: 0 };
    current.revenue += total;
    current.orders += 1;
    groups.set(name, current);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, { revenue, orders: count }], index) => ({
      name,
      value: revenue,
      orders: count,
      color: PALETTE[index % PALETTE.length],
    }));
}

// Busca os pedidos do período uma única vez e agrupa por UTM source, campaign e content.
export async function fetchUtmBreakdowns(params: WooOrderQueryParams): Promise<UtmBreakdowns> {
  const orders = await fetchOrders(params);
  return {
    source: groupOrders(orders, "source"),
    campaign: groupOrders(orders, "campaign"),
    content: groupOrders(orders, "content"),
  };
}

export async function fetchUtmBreakdown({
  groupBy,
  ...params
}: WooOrderQueryParams & { groupBy: UtmGroupBy }): Promise<UtmBreakdownItem[]> {
  return groupOrders(await fetchOrders(params), groupBy);
}
