'use strict';
/**
 * Monta o objeto DASHBOARD_DATA a partir da Graph API (Meta Ads + Instagram).
 * Cada fonte falha de forma isolada: o erro vira diagnóstico em `sources`,
 * nunca dados inventados.
 */
const TZ = 'America/Sao_Paulo';
const N_DAYS = 60;

const ymdInTZ = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function addDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Brasília não tem horário de verão desde 2019 (UTC-3)
const dayStartUnix = (ymd) => Math.floor(Date.parse(ymd + 'T00:00:00-03:00') / 1000);

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const OBJECTIVES = {
  OUTCOME_LEADS: 'Leads', OUTCOME_ENGAGEMENT: 'Engajamento', OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_SALES: 'Vendas', OUTCOME_AWARENESS: 'Reconhecimento', OUTCOME_APP_PROMOTION: 'App',
  LEAD_GENERATION: 'Leads', MESSAGES: 'Mensagens', LINK_CLICKS: 'Tráfego', CONVERSIONS: 'Conversões',
};
const STATUS = { ACTIVE: 'Ativa', PAUSED: 'Pausada', CAMPAIGN_PAUSED: 'Pausada', ADSET_PAUSED: 'Pausada', ARCHIVED: 'Arquivada', DELETED: 'Excluída', IN_PROCESS: 'Em processamento', WITH_ISSUES: 'Com problemas', PENDING_REVIEW: 'Em revisão', DISAPPROVED: 'Reprovada' };
const ACCOUNT_STATUS = { 1: 'Ativa', 2: 'Desativada', 3: 'Pagamento pendente', 7: 'Em revisão de risco', 8: 'Pagamento em análise', 9: 'Período de carência', 100: 'Encerramento pendente', 101: 'Encerrada', 201: 'Qualquer', 202: 'Encerrada' };

const actionValue = (actions, type) => Number(((actions || []).find((a) => a.action_type === type) || {}).value || 0);
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const errMsg = (e) => (e && e.message ? e.message : 'erro desconhecido');

/* ---------------------------- Meta Ads ---------------------------- */
async function loadMeta(graph, adAccountId, days) {
  const since = days[0], until = days[days.length - 1];
  const idx = new Map(days.map((d, i) => [d, i]));
  const act = `act_${adAccountId}`;

  const info = await graph.get(act, { fields: 'name,account_status,currency,timezone_name,amount_spent,business_name' });
  const [camps, rows] = await Promise.all([
    graph.getAll(`${act}/campaigns`, { fields: 'id,name,objective,effective_status', limit: 200 }),
    graph.getAll(`${act}/insights`, {
      level: 'campaign', time_increment: 1, limit: 500,
      fields: 'campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions',
      time_range: JSON.stringify({ since, until }),
    }),
  ]);

  const blank = () => days.map(() => ({ spend: 0, impressions: 0, clicks: 0, lpv: 0, leads: 0 }));
  const byId = new Map();
  camps.forEach((c) => byId.set(c.id, { id: c.id, name: c.name, objective: OBJECTIVES[c.objective] || c.objective || '—', status: STATUS[c.effective_status] || c.effective_status || '—', daily: blank() }));
  rows.forEach((r) => {
    if (!byId.has(r.campaign_id)) byId.set(r.campaign_id, { id: r.campaign_id, name: r.campaign_name, objective: '—', status: '—', daily: blank() });
    const i = idx.get(r.date_start);
    if (i == null) return;
    const d = byId.get(r.campaign_id).daily[i];
    d.spend += Number(r.spend || 0);
    d.impressions += Number(r.impressions || 0);
    d.clicks += Number(r.inline_link_clicks || 0);
    d.lpv += actionValue(r.actions, 'landing_page_view');
    // lead = formulário/pixel; conversa iniciada = anúncios que levam ao WhatsApp/Direct
    d.leads += actionValue(r.actions, 'lead') + actionValue(r.actions, 'onsite_conversion.messaging_conversation_started_7d');
  });

  const campaigns = [...byId.values()]
    .map((c) => ({ ...c, daily: c.daily.map((d) => ({ ...d, spend: Math.round(d.spend * 100) / 100 })) }))
    .filter((c) => c.status === 'Ativa' || c.daily.some((d) => d.spend > 0 || d.impressions > 0));
  const spent60 = campaigns.reduce((s, c) => s + c.daily.reduce((a, d) => a + d.spend, 0), 0);
  const withSpend = campaigns.filter((c) => c.daily.some((d) => d.spend > 0)).length;

  const source = {
    name: 'Meta Ads', title: 'Conta de anúncios', state: camps.length ? 'ok' : 'empty', stateLabel: camps.length ? 'Conectado' : 'Sem campanhas',
    facts: [
      ['Conta', info.name || '—'],
      ['ID da conta', adAccountId],
      ['Empresa (BM)', info.business_name || '—'],
      ['Status da conta', ACCOUNT_STATUS[info.account_status] || `Código ${info.account_status}`],
      ['Moeda e fuso', `${info.currency || '—'} · ${info.timezone_name || '—'}`],
      ['Campanhas na conta', String(camps.length)],
      ['Campanhas com gasto nos últimos 60 dias', String(withSpend)],
      ['Gasto nos últimos 60 dias', brl(spent60)],
    ],
    note: camps.length ? '' : 'A API respondeu, mas a conta não tem nenhuma campanha.',
  };
  return { campaigns, source, account: { adAccount: info.name || adAccountId, adAccountId, currency: info.currency || 'BRL' } };
}

/* ----------------------------- Instagram ---------------------------- */
const unixRange = (a, b) => ({ since: dayStartUnix(a), until: dayStartUnix(b) + 86399 });

async function loadInstagram(graph, igId, days) {
  const idx = new Map(days.map((d, i) => [d, i]));
  const zero = () => days.map(() => ({ reach: 0, views: 0, interactions: 0, profile_views: 0, new_followers: 0 }));
  const daily = zero();

  const profile = await graph.get(igId, { fields: 'username,name,followers_count,media_count' });

  // série diária (period=day): alcance (60 dias, em blocos de 30) e novos seguidores (só os últimos 30 dias)
  const seriesDay = (v) => addDays(String(v.end_time).slice(0, 10), -1); // end_time marca o FIM do dia
  async function series(metric, from, to, key) {
    const r = await graph.get(`${igId}/insights`, { metric, period: 'day', ...unixRange(from, to) });
    const values = (r.data && r.data[0] && r.data[0].values) || [];
    values.forEach((v) => { const i = idx.get(seriesDay(v)); if (i != null) daily[i][key] = Number(v.value || 0); });
  }
  const warnings = [];
  const safe = async (label, fn) => { try { await fn(); } catch (e) { warnings.push(`${label}: ${errMsg(e)}`); } };

  const chunks = [];
  for (let s = 0; s < days.length; s += 30) chunks.push([days[s], days[Math.min(s + 29, days.length - 1)]]);
  await Promise.all([
    ...chunks.map(([a, b]) => safe('alcance diário', () => series('reach', a, b, 'reach'))),
    safe('novos seguidores', () => series('follower_count', days[days.length - 30], days[days.length - 1], 'new_followers')),
  ]);

  // totais por dia (metric_type=total_value): uma chamada por dia, em paralelo limitado
  await mapLimit(days, 6, async (day, i) => {
    const range = unixRange(day, day);
    const fill = (r) => (r.data || []).forEach((m) => {
      const v = Number((m.total_value && m.total_value.value) || 0);
      if (m.name === 'views') daily[i].views = v;
      if (m.name === 'total_interactions') daily[i].interactions = v;
      if (m.name === 'profile_views') daily[i].profile_views = v;
    });
    try {
      fill(await graph.get(`${igId}/insights`, { metric: 'views,total_interactions,profile_views', period: 'day', metric_type: 'total_value', ...range }));
    } catch (e) {
      // se uma métrica não for aceita, tenta uma a uma e ignora a que falhar
      for (const m of ['views', 'total_interactions', 'profile_views']) {
        try { fill(await graph.get(`${igId}/insights`, { metric: m, period: 'day', metric_type: 'total_value', ...range })); } catch (e2) { /* métrica indisponível */ }
      }
    }
  });

  // últimos conteúdos (mesmas métricas do modelo: alcance, views, seguidores ganhos)
  let posts = [];
  await safe('conteúdos', async () => {
    const media = await graph.get(`${igId}/media`, { fields: 'id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp', limit: 10 });
    posts = await mapLimit(media.data || [], 5, async (m) => {
      let metrics = [];
      for (const set of ['reach,views,follows', 'reach,views', 'reach']) {
        try { metrics = (await graph.get(`${m.id}/insights`, { metric: set })).data || []; break; } catch (e) { /* tenta o conjunto menor */ }
      }
      const val = (name) => Number(((metrics.find((x) => x.name === name) || {}).values || [{}])[0].value || 0);
      const type = m.media_product_type === 'REELS' ? 'Reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Imagem';
      return { date: String(m.timestamp).slice(0, 10), type, caption: m.caption || '', reach: val('reach'), views: val('views'), follows: val('follows'), permalink: m.permalink || null, thumbnail: m.thumbnail_url || m.media_url || null };
    });
    posts.reverse(); // do mais antigo ao mais recente
  });

  const source = {
    name: 'Instagram', title: `Perfil @${profile.username}`, state: warnings.length ? 'blocked' : 'ok', stateLabel: warnings.length ? 'Parcial' : 'Conectado',
    facts: [
      ['Perfil', profile.name || profile.username],
      ['ID do Instagram', igId],
      ['Seguidores agora', Number(profile.followers_count || 0).toLocaleString('pt-BR')],
      ['Publicações', Number(profile.media_count || 0).toLocaleString('pt-BR')],
      ['Conteúdos lidos', String(posts.length)],
      ['Dias com alcance', String(daily.filter((d) => d.reach > 0).length) + ' de ' + days.length],
    ],
    note: warnings.join(' · '),
  };
  return { instagram: { handle: '@' + profile.username, daily, posts }, source };
}

/* ------------------------------ geral ------------------------------ */
async function buildDashboard({ graph, adAccountId, igId, now = new Date() }) {
  const today = ymdInTZ(now);
  const end = addDays(today, -1); // o dia de hoje ainda está incompleto
  const days = Array.from({ length: N_DAYS }, (_, i) => addDays(end, -(N_DAYS - 1 - i)));
  const blankCampaigns = [];
  const blankIg = { handle: '', daily: days.map(() => ({ reach: 0, views: 0, interactions: 0, profile_views: 0, new_followers: 0 })), posts: [] };

  const failed = (name, title, e) => ({ name, title, state: 'blocked', stateLabel: 'Erro na API', facts: [], note: errMsg(e) });
  const [meta, ig] = await Promise.all([
    loadMeta(graph, adAccountId, days).catch((e) => ({ campaigns: blankCampaigns, account: { adAccount: adAccountId, adAccountId, currency: 'BRL' }, source: failed('Meta Ads', 'Conta de anúncios', e) })),
    loadInstagram(graph, igId, days).catch((e) => ({ instagram: { ...blankIg, handle: '@' + igId }, source: failed('Instagram', 'Perfil do Instagram', e) })),
  ]);

  return {
    sample: false,
    account: meta.account,
    days,
    campaigns: meta.campaigns,
    instagram: ig.instagram,
    sources: [meta.source, ig.source],
    sourcesCheckedAt: today,
    generatedAt: now.toISOString(),
  };
}

module.exports = { buildDashboard, ymdInTZ, addDays, dayStartUnix, N_DAYS };
