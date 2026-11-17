// Chamadas da página /instagram. Tudo passa por /api/meta (o token fica no servidor).
export class InstagramFetchError extends Error {}

type MetaResponse<T> = { ok: boolean; data: T & { error?: string } };

async function metaGet<T>(endpoint: string, params: Record<string, string>): Promise<MetaResponse<T>> {
  const query = new URLSearchParams({ endpoint, ...params });
  const res = await fetch(`/api/meta?${query.toString()}`, { cache: "no-store" });
  const data = await res.json();
  return { ok: res.ok, data };
}

type InsightMetric = {
  name: string;
  total_value?: { value?: number };
  values?: { value?: number }[];
};

async function insights(endpoint: string, params: Record<string, string>): Promise<InsightMetric[]> {
  const { ok, data } = await metaGet<{ data?: InsightMetric[] }>(`${endpoint}/insights`, params);
  if (!ok) throw new InstagramFetchError(data.error || "Erro ao buscar dados do Instagram");
  return data.data || [];
}

const toUnix = (date: string, endOfDay: boolean) =>
  Math.floor(new Date(`${date}T${endOfDay ? "23:59:59" : "00:00:00"}`).getTime() / 1000);

// a API só aceita ~30 dias por consulta de insights
function splitRange(since: number, until: number, step = 2505600) {
  const ranges: { since: number; until: number }[] = [];
  for (let start = since; start <= until; ) {
    const end = Math.min(start + step, until);
    ranges.push({ since: start, until: end });
    start = end + 1;
  }
  return ranges;
}

export type InstagramSummary = {
  views: number;
  followerChange: number;
  interactions: number;
  reach: number;
  profileViews: number;
};

export async function fetchInstagramSummary(args: {
  instagramAccountId: string;
  since: string;
  until: string;
}): Promise<InstagramSummary> {
  const ranges = splitRange(toUnix(args.since, false), toUnix(args.until, true));
  const [totals, followers] = await Promise.all([
    Promise.all(
      ranges.map((r) =>
        insights(args.instagramAccountId, {
          metric: "reach,profile_views,total_interactions,views",
          period: "day",
          metric_type: "total_value",
          since: String(r.since),
          until: String(r.until),
        }),
      ),
    ),
    Promise.all(
      ranges.map((r) =>
        insights(args.instagramAccountId, {
          metric: "follower_count",
          period: "day",
          since: String(r.since),
          until: String(r.until),
        }),
      ),
    ),
  ]);

  const followerChange = followers.reduce(
    (sum, metrics) => sum + (metrics[0]?.values || []).reduce((s, v) => s + (v.value || 0), 0),
    0,
  );
  const total = (name: string) =>
    totals.reduce((sum, metrics) => sum + (metrics.find((m) => m.name === name)?.total_value?.value ?? 0), 0);

  return {
    views: total("views"),
    followerChange,
    interactions: total("total_interactions"),
    reach: total("reach"),
    profileViews: total("profile_views"),
  };
}

export type InstagramMediaItem = {
  id: string;
  caption: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
  reach: number;
  views: number;
  follows: number;
};

type RawMedia = {
  id?: string;
  caption?: string;
  thumbnail_url?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
};

const metricValue = (metrics: InsightMetric[], name: string) => metrics.find((m) => m.name === name)?.values?.[0]?.value ?? 0;

export async function fetchInstagramMedia(args: { instagramAccountId: string }): Promise<InstagramMediaItem[]> {
  const { ok, data } = await metaGet<{ data?: RawMedia[] }>(`${args.instagramAccountId}/media`, {
    fields: "id,caption,thumbnail_url,media_url,permalink,timestamp",
    limit: "10",
  });
  if (!ok) throw new InstagramFetchError(data.error || "Erro ao buscar conteúdos do Instagram");

  return Promise.all(
    (data.data || []).map(async (media) => {
      const id = String(media.id ?? "");
      let metrics: InsightMetric[] = [];
      // "follows" não existe para todo formato (ex.: Reels): cai para o conjunto menor
      for (const metric of ["reach,views,follows", "reach"]) {
        const r = await metaGet<{ data?: InsightMetric[] }>(`${id}/insights`, { metric });
        if (r.ok) {
          metrics = r.data.data || [];
          break;
        }
      }
      return {
        id,
        caption: String(media.caption ?? ""),
        thumbnailUrl: media.thumbnail_url || media.media_url || undefined,
        permalink: String(media.permalink ?? "#"),
        timestamp: String(media.timestamp ?? ""),
        reach: metricValue(metrics, "reach"),
        views: metricValue(metrics, "views"),
        follows: metricValue(metrics, "follows"),
      };
    }),
  );
}
