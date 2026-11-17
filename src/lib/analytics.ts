// Tipos, busca e agregações do Analytics (GA4). Seguro para importar em componentes "use client":
// a chamada ao Google acontece no servidor, em /api/analytics/data.

export interface AnalyticsDailyRow {
  date: string;
  sessions: number;
  activeUsers: number;
  engagementRate: number;
}

export interface AnalyticsChannelRow {
  date: string;
  channel: string;
  sessions: number;
  activeUsers: number;
  conversions: number;
}

export interface AnalyticsConversionRow {
  date: string;
  eventName: string;
  count: number;
}

export interface AnalyticsProductRow {
  date: string;
  itemName: string;
  itemsViewed: number;
  itemsAddedToCart: number;
  itemsPurchased: number;
  itemRevenue: number;
}

export interface AnalyticsUtmRow {
  date: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  sessions: number;
  conversions: number;
  revenue: number;
}

export interface AnalyticsChannelSummary {
  channel: string;
  sessions: number;
  activeUsers: number;
  conversions: number;
}

export interface AnalyticsConversionSummary {
  eventName: string;
  count: number;
}

export interface AnalyticsProductSummary {
  itemName: string;
  itemsViewed: number;
  itemsAddedToCart: number;
  itemsPurchased: number;
  itemRevenue: number;
}

export interface AnalyticsUtmSummary {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  sessions: number;
  conversions: number;
  revenue: number;
}

export class AnalyticsFetchError extends Error {}

export interface AnalyticsData {
  configured: boolean;
  daily: AnalyticsDailyRow[];
  channels: AnalyticsChannelRow[];
  conversionBreakdown: AnalyticsConversionRow[];
  conversionEventNames: string[];
  products: AnalyticsProductRow[];
  utms: AnalyticsUtmRow[];
}

export async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const response = await fetch("/api/analytics/data");
  if (!response.ok) {
    throw new AnalyticsFetchError("Erro ao buscar dados do Analytics");
  }
  const data = (await response.json()) as Partial<AnalyticsData>;
  return {
    configured: data.configured !== false,
    daily: data.daily || [],
    channels: data.channels || [],
    conversionBreakdown: data.conversionBreakdown || [],
    conversionEventNames: data.conversionEventNames || [],
    products: data.products || [],
    utms: data.utms || [],
  };
}

function filterByRange<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter((row) => row.date >= from && row.date <= to);
}

export const filterDailyByRange = filterByRange<AnalyticsDailyRow>;
export const filterChannelsByRange = filterByRange<AnalyticsChannelRow>;
export const filterConversionsByRange = filterByRange<AnalyticsConversionRow>;
export const filterProductsByRange = filterByRange<AnalyticsProductRow>;
export const filterUtmsByRange = filterByRange<AnalyticsUtmRow>;

// Taxa de engajamento ponderada pelas sessões de cada dia
export function aggregateDaily(rows: AnalyticsDailyRow[]): {
  sessions: number;
  activeUsers: number;
  engagementRate: number;
} {
  const sessions = rows.reduce((total, row) => total + row.sessions, 0);
  const activeUsers = rows.reduce((total, row) => total + row.activeUsers, 0);
  const weighted = rows.reduce((total, row) => total + row.engagementRate * row.sessions, 0);
  return { sessions, activeUsers, engagementRate: sessions > 0 ? weighted / sessions : 0 };
}

export function aggregateByChannel(rows: AnalyticsChannelRow[]): AnalyticsChannelSummary[] {
  const map = new Map<string, { sessions: number; activeUsers: number; conversions: number }>();
  for (const row of rows) {
    const current = map.get(row.channel) || { sessions: 0, activeUsers: 0, conversions: 0 };
    current.sessions += row.sessions;
    current.activeUsers += row.activeUsers;
    current.conversions += row.conversions;
    map.set(row.channel, current);
  }
  return Array.from(map.entries())
    .map(([channel, totals]) => ({ channel, ...totals }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function aggregateConversionBreakdown(rows: AnalyticsConversionRow[]): AnalyticsConversionSummary[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.eventName, (map.get(row.eventName) || 0) + row.count);
  }
  return Array.from(map.entries())
    .map(([eventName, count]) => ({ eventName, count }))
    .sort((a, b) => b.count - a.count);
}

export function aggregateByProduct(rows: AnalyticsProductRow[]): AnalyticsProductSummary[] {
  const map = new Map<
    string,
    { itemsViewed: number; itemsAddedToCart: number; itemsPurchased: number; itemRevenue: number }
  >();
  for (const row of rows) {
    const current = map.get(row.itemName) || {
      itemsViewed: 0,
      itemsAddedToCart: 0,
      itemsPurchased: 0,
      itemRevenue: 0,
    };
    current.itemsViewed += row.itemsViewed;
    current.itemsAddedToCart += row.itemsAddedToCart;
    current.itemsPurchased += row.itemsPurchased;
    current.itemRevenue += row.itemRevenue;
    map.set(row.itemName, current);
  }
  return Array.from(map.entries())
    .map(([itemName, totals]) => ({ itemName, ...totals }))
    .sort((a, b) => b.itemsViewed - a.itemsViewed);
}

export function aggregateByUtm(rows: AnalyticsUtmRow[]): AnalyticsUtmSummary[] {
  const map = new Map<string, AnalyticsUtmSummary>();
  for (const row of rows) {
    const key = `${row.source}__${row.medium}__${row.campaign}__${row.term}__${row.content}`;
    const current = map.get(key) || {
      source: row.source,
      medium: row.medium,
      campaign: row.campaign,
      term: row.term,
      content: row.content,
      sessions: 0,
      conversions: 0,
      revenue: 0,
    };
    current.sessions += row.sessions;
    current.conversions += row.conversions;
    current.revenue += row.revenue;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions);
}

// Sessões por dia, já no formato do gráfico (data curta dd/mm)
export function aggregateSessionsByDay(
  rows: AnalyticsDailyRow[],
  formatDate: (date: Date) => string,
): { date: string; sessoes: number }[] {
  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const [year, month, day] = row.date.split("-").map(Number);
      return { date: formatDate(new Date(year, (month || 1) - 1, day || 1)), sessoes: row.sessions };
    });
}
