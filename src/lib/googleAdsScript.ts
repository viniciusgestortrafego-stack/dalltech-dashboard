// Gera o Script do Google Ads (Ferramentas → Ações em massa → Scripts) já com a URL e a chave deste dashboard.
export function buildGoogleAdsScript(webhookUrl: string, secret: string): string {
  return `// Dashboard — envio diário de dados do Google Ads
// Cole em: Google Ads → Ferramentas → Ações em massa → Scripts → Novo script.
// Autorize, salve e agende para rodar 1x por dia (ou a cada hora).

const WEBHOOK_URL = ${JSON.stringify(webhookUrl || "COLE_A_URL_DO_WEBHOOK_AQUI")};
const WEBHOOK_KEY = ${JSON.stringify(secret || "COLE_A_CHAVE_DO_WEBHOOK_AQUI")};

const DAYS = 90;            // janela de campanhas e conversões
const KEYWORD_DAYS = 30;    // janela de palavras-chave
const KEYWORD_LIMIT = 3000; // palavras-chave de maior investimento

function main() {
  const tz = AdsApp.currentAccount().getTimeZone();
  const day = (offset) => Utilities.formatDate(new Date(Date.now() - offset * 86400000), tz, 'yyyy-MM-dd');
  const end = day(0);
  const start = day(DAYS);
  const kwStart = day(KEYWORD_DAYS);

  const rows = collect(
    "SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, " +
    "metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign " +
    "WHERE segments.date BETWEEN '" + start + "' AND '" + end + "' AND metrics.impressions > 0",
    (r) => ({
      date: r.segments.date,
      campaignId: String(r.campaign.id),
      campaignName: r.campaign.name,
      spend: Number(r.metrics.costMicros) / 1e6,
      impressions: Number(r.metrics.impressions),
      clicks: Number(r.metrics.clicks),
      conversions: Number(r.metrics.conversions),
      conversionValue: Number(r.metrics.conversionsValue),
    })
  );

  const keywords = collect(
    "SELECT segments.date, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, " +
    "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM keyword_view " +
    "WHERE segments.date BETWEEN '" + kwStart + "' AND '" + end + "' AND metrics.impressions > 0 " +
    "ORDER BY metrics.cost_micros DESC LIMIT " + KEYWORD_LIMIT,
    (r) => ({
      date: r.segments.date,
      keyword: r.adGroupCriterion.keyword.text,
      matchType: r.adGroupCriterion.keyword.matchType,
      spend: Number(r.metrics.costMicros) / 1e6,
      impressions: Number(r.metrics.impressions),
      clicks: Number(r.metrics.clicks),
      conversions: Number(r.metrics.conversions),
    })
  );

  const conversions = collect(
    "SELECT segments.date, segments.conversion_action_name, segments.conversion_action_category, " +
    "metrics.conversions, metrics.conversions_value FROM customer " +
    "WHERE segments.date BETWEEN '" + start + "' AND '" + end + "' AND metrics.conversions > 0",
    (r) => ({
      date: r.segments.date,
      conversionActionName: r.segments.conversionActionName,
      conversionActionCategory: r.segments.conversionActionCategory,
      conversions: Number(r.metrics.conversions),
      conversionValue: Number(r.metrics.conversionsValue),
    })
  );

  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + WEBHOOK_KEY },
    payload: JSON.stringify({ rows: rows, keywords: keywords, conversions: conversions }),
    muteHttpExceptions: true,
  });
  Logger.log('HTTP ' + response.getResponseCode() + ' — ' + response.getContentText());
  if (response.getResponseCode() >= 300) {
    throw new Error('O dashboard recusou o envio: ' + response.getContentText());
  }
}

function collect(query, map) {
  const out = [];
  const iterator = AdsApp.search(query);
  while (iterator.hasNext()) out.push(map(iterator.next()));
  return out;
}
`;
}
