'use strict';
// Graph API simulada (formato das respostas reais) — usada em testes.
const AD = '123', IG = '999';

function mockGraph({ campaigns = true, igFail = false } = {}) {
  const calls = [];
  const graph = {
    calls,
    async get(path, p = {}) {
      calls.push(path + ' ' + (p.metric || ''));
      if (path === `act_${AD}`) return { name: 'DALL.TECH-AD-01', account_status: 1, currency: 'BRL', timezone_name: 'America/Sao_Paulo', business_name: 'dall.tech' };
      if (igFail && path.startsWith(IG)) throw Object.assign(new Error('(#10) Application does not have permission'), { status: 400 });
      if (path === IG) return { username: 'dall.tech', name: 'DallTech', followers_count: 4812, media_count: 130 };
      if (path === `${IG}/insights` && p.metric === 'reach') {
        // 1 valor por dia; end_time = fim do dia (dia seguinte 08:00 UTC)
        const out = [];
        for (let t = Number(p.since); t <= Number(p.until); t += 86400) out.push({ value: 100, end_time: new Date((t + 86400) * 1000 + 5 * 3600e3).toISOString().replace('Z', '+0000') });
        return { data: [{ name: 'reach', values: out }] };
      }
      if (path === `${IG}/insights` && p.metric === 'follower_count') return { data: [{ name: 'follower_count', values: [{ value: 7, end_time: '2026-11-17T08:00:00+0000' }] }] };
      if (path === `${IG}/insights` && p.metric_type === 'total_value') {
        if (p.metric === 'views,total_interactions,profile_views' && Number(p.since) < 1788000000 && Number(p.since) > 1787000000) throw new Error('metric not supported'); // força o fallback em alguns dias
        const names = p.metric.split(',');
        return { data: names.map((n) => ({ name: n, total_value: { value: { views: 50, total_interactions: 5, profile_views: 3 }[n] } })) };
      }
      if (path === `${IG}/media`) return { data: [
        { id: 'm2', caption: 'Reel novo', media_type: 'VIDEO', media_product_type: 'REELS', thumbnail_url: 'https://t/2.jpg', permalink: 'https://instagram.com/reel/2', timestamp: '2026-11-15T12:00:00+0000' },
        { id: 'm1', caption: 'Carrossel', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', media_url: 'https://t/1.jpg', permalink: 'https://instagram.com/p/1', timestamp: '2026-11-10T12:00:00+0000' },
      ] };
      if (path === 'm2/insights') { if (p.metric.includes('follows')) throw new Error('follows not supported for reels'); return { data: [{ name: 'reach', values: [{ value: 900 }] }, { name: 'views', values: [{ value: 1500 }] }] }; }
      if (path === 'm1/insights') return { data: [{ name: 'reach', values: [{ value: 400 }] }, { name: 'views', values: [{ value: 450 }] }, { name: 'follows', values: [{ value: 3 }] }] };
      throw new Error('rota inesperada: ' + path);
    },
    async getAll(path) {
      if (path === `act_${AD}/campaigns`) return campaigns ? [
        { id: 'c1', name: 'Orçamento WhatsApp', objective: 'OUTCOME_LEADS', effective_status: 'ACTIVE' },
        { id: 'c2', name: 'Pausada antiga', objective: 'OUTCOME_TRAFFIC', effective_status: 'PAUSED' },
      ] : [];
      if (path === `act_${AD}/insights`) return campaigns ? [
        { campaign_id: 'c1', date_start: '2026-11-16', spend: '50.5', impressions: '2000', inline_link_clicks: '40', actions: [{ action_type: 'landing_page_view', value: '30' }, { action_type: 'lead', value: '2' }, { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '3' }] },
        { campaign_id: 'c1', date_start: '2026-11-15', spend: '40', impressions: '1500', inline_link_clicks: '20' },
      ] : [];
      throw new Error('rota inesperada: ' + path);
    },
  };
  return graph;
}


module.exports = { mockGraph, AD, IG };
