// Somente servidor: busca dados ao vivo na Google Analytics Data API (GA4) usando o
// app OAuth da agência (mesmo projeto do Google Ads, com refresh token próprio e escopo
// analytics.readonly). Nunca encaminhe este token para plataformas de terceiros.
//
// Variáveis de ambiente usadas:
//   GOOGLE_ANALYTICS_PROPERTY_ID      ID numérico da propriedade GA4
//   GOOGLE_ANALYTICS_REFRESH_TOKEN    refresh token OAuth (escopo analytics.readonly)
//   GOOGLE_ADS_CLIENT_ID              client id do app OAuth
//   GOOGLE_ADS_CLIENT_SECRET          client secret do app OAuth

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

type TokenResponse = { access_token?: string; expires_in?: number };

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.access_token) {
    throw new Error("Google OAuth token exchange failed: resposta sem access_token");
  }
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.accessToken;
}

export function isGa4Configured(): boolean {
  return Boolean(
    process.env.GOOGLE_ANALYTICS_PROPERTY_ID &&
      process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
}

export interface RunReportParams {
  propertyId: string;
  dimensions: string[];
  metrics: string[];
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
  dimensionFilter?: Record<string, unknown>;
}

export interface RunReportResult {
  dimensionHeaders: string[];
  metricHeaders: string[];
  rows: { dimensionValues: string[]; metricValues: string[] }[];
}

type Ga4Value = { value?: string };
type Ga4Row = { dimensionValues?: Ga4Value[]; metricValues?: Ga4Value[] };
type Ga4ReportResponse = {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: Ga4Row[];
  rowCount?: number;
  error?: { message?: string };
};

const PAGE_SIZE = 10000;

export async function runReport(params: RunReportParams): Promise<RunReportResult> {
  const { propertyId, dimensions, metrics, since, until, dimensionFilter } = params;
  const accessToken = await getAccessToken();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;

  const result: RunReportResult = { dimensionHeaders: [], metricHeaders: [], rows: [] };
  let offset = 0;

  // pagina até buscar todas as linhas
  for (;;) {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: since, endDate: until }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        ...(dimensionFilter ? { dimensionFilter } : {}),
        limit: PAGE_SIZE,
        offset,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as Ga4ReportResponse;
    if (!response.ok) {
      throw new Error(`GA4 runReport falhou (${response.status}): ${data.error?.message ?? "erro desconhecido"}`);
    }

    result.dimensionHeaders = (data.dimensionHeaders ?? []).map((h) => h.name);
    result.metricHeaders = (data.metricHeaders ?? []).map((h) => h.name);
    const rows = data.rows ?? [];
    for (const row of rows) {
      result.rows.push({
        dimensionValues: (row.dimensionValues ?? []).map((v) => v.value ?? ""),
        metricValues: (row.metricValues ?? []).map((v) => v.value ?? ""),
      });
    }

    offset += rows.length;
    if (rows.length === 0 || offset >= (data.rowCount ?? 0)) break;
  }

  return result;
}

// Transforma as linhas em objetos { dimensao: texto, metrica: número }
export function rowsToObjects(result: RunReportResult): Record<string, string | number>[] {
  return result.rows.map((row) => {
    const obj: Record<string, string | number> = {};
    result.dimensionHeaders.forEach((name, i) => {
      obj[name] = row.dimensionValues[i] ?? "";
    });
    result.metricHeaders.forEach((name, i) => {
      obj[name] = parseFloat(row.metricValues[i] ?? "0") || 0;
    });
    return obj;
  });
}

// "20240115" -> "2024-01-15"
export function formatGa4Date(value: string): string {
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return value;
}

type KeyEventsResponse = { keyEvents?: { eventName?: string }[]; error?: { message?: string } };

// Nomes dos eventos-chave (conversões) configurados na propriedade
export async function listConversionEventNames(propertyId: string): Promise<string[]> {
  const accessToken = await getAccessToken();
  const names: string[] = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}/keyEvents`,
    );
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json()) as KeyEventsResponse & { nextPageToken?: string };
    if (!response.ok) {
      throw new Error(`GA4 keyEvents falhou (${response.status}): ${data.error?.message ?? "erro desconhecido"}`);
    }
    for (const event of data.keyEvents ?? []) {
      if (event.eventName) names.push(event.eventName);
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return names;
}
