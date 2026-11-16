/*
 * DADOS DE EXEMPLO (fictícios) — DallTech Dashboard
 *
 * Este arquivo é o ÚNICO ponto de troca entre dados de exemplo e dados reais.
 * Para usar dados reais, substitua `window.DASHBOARD_DATA` por um objeto com o
 * mesmo formato (veja o README.md) e coloque `sample: false`.
 *
 * Formato resumido:
 *   days:       ['YYYY-MM-DD', ...]  (60 dias consecutivos, o mais recente por último)
 *   campaigns:  [{ id, name, objective, status, daily: [{spend, impressions, clicks, lpv, leads}, ...] }]
 *   instagram:  { handle, daily: [{reach, views, interactions, profile_views, new_followers}, ...],
 *                 posts: [{date, type, caption, reach, views, follows, permalink, thumbnail}] }
 */
(function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261116);
  const between = (a, b) => a + (b - a) * rnd();
  const noise = (spread) => 1 + (rnd() * 2 - 1) * spread;

  // 60 dias terminando em 15/11/2026
  const N = 60;
  const end = new Date(Date.UTC(2026, 10, 15));
  const days = Array.from({ length: N }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (N - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const weekday = days.map((d) => new Date(d + 'T12:00:00Z').getUTCDay());
  const dowFactor = [0.7, 1.05, 1.1, 1.1, 1.05, 0.95, 0.75]; // dom..sáb

  // ---------- Tráfego pago (Meta Ads) ----------
  const campaignDefs = [
    { id: 'c1', name: '[LEADS] Orçamento de embalagens — WhatsApp', objective: 'Leads', status: 'Ativa',
      base: 72, cpm: 24, ctr: 0.016, lpv: 0.82, leadRate: 0.09, start: 0, stop: N - 1 },
    { id: 'c2', name: '[LEADS] Envase sob medida — Formulário', objective: 'Leads', status: 'Ativa',
      base: 46, cpm: 28, ctr: 0.012, lpv: 0.78, leadRate: 0.06, start: 0, stop: N - 1 },
    { id: 'c3', name: '[ENGAJAMENTO] Impulsionar Reels — Bastidores', objective: 'Engajamento', status: 'Ativa',
      base: 26, cpm: 9, ctr: 0.008, lpv: 0.6, leadRate: 0, start: 8, stop: N - 1 },
    { id: 'c4', name: '[REMARKETING] Visitantes do site — 30 dias', objective: 'Leads', status: 'Pausada',
      base: 21, cpm: 38, ctr: 0.021, lpv: 0.85, leadRate: 0.14, start: 0, stop: 40 },
  ];

  const campaigns = campaignDefs.map((c) => ({
    id: c.id, name: c.name, objective: c.objective, status: c.status,
    daily: days.map((_, i) => {
      if (i < c.start || i > c.stop) return { spend: 0, impressions: 0, clicks: 0, lpv: 0, leads: 0 };
      const spend = c.base * dowFactor[weekday[i]] * noise(0.15);
      const impressions = (spend / (c.cpm * noise(0.1))) * 1000;
      const clicks = impressions * c.ctr * noise(0.14);
      const lpv = clicks * c.lpv * noise(0.08);
      const leads = Math.max(0, Math.round(lpv * c.leadRate * noise(0.4)));
      return {
        spend: Math.round(spend * 100) / 100,
        impressions: Math.round(impressions),
        clicks: Math.round(clicks),
        lpv: Math.round(lpv),
        leads,
      };
    }),
  }));

  // ---------- Instagram (@dall.tech) ----------
  const igDaily = days.map((_, i) => {
    const f = dowFactor[weekday[i]];
    const spike = i === 47 || i === 48 ? 2.6 : 1; // Reel que performou bem
    const reach = Math.round(1150 * f * spike * noise(0.18));
    const views = Math.round(reach * between(1.7, 2.2));
    const interactions = Math.round(views * between(0.035, 0.06));
    return {
      reach, views, interactions,
      profile_views: Math.round(between(14, 40) * f * spike),
      new_followers: Math.max(0, Math.round(between(3, 11) * f * spike)),
    };
  });

  const captions = [
    'Linha de envase automática em operação: 1.200 unidades por hora.',
    '5 erros comuns ao escolher a embalagem do seu produto.',
    'Como a rotulagem correta evita retrabalho na produção.',
    'Bastidores: do pedido à entrega em 7 dias úteis.',
    'Embalagem sustentável: o que realmente reduz custo?',
    'Cliente novo, envase novo: case de cosméticos artesanais.',
    'Checklist para terceirizar o empacotamento sem dor de cabeça.',
    'Seladoras, dosadoras e esteiras: conheça a nossa estrutura.',
    'Quanto custa terceirizar o envase? Explicamos em 60 segundos.',
    'Antes e depois: embalagem que aumentou o valor percebido.',
    'Controle de qualidade em cada lote — veja como fazemos.',
    'Perguntas frequentes sobre pedido mínimo e prazos.',
  ];
  const typeSpec = {
    Reel: { reach: 2300, view: 1.8, follow: 0.006 },
    Carrossel: { reach: 1350, view: 1.25, follow: 0.004 },
    Imagem: { reach: 820, view: 1.15, follow: 0.002 },
  };
  const typeOrder = ['Reel', 'Carrossel', 'Reel', 'Imagem', 'Carrossel', 'Reel', 'Carrossel', 'Imagem'];
  const posts = [];
  for (let i = 0, p = 0; i < N; i += 2 + (p % 2), p++) {
    const type = typeOrder[p % typeOrder.length];
    const s = typeSpec[type];
    const boost = i >= 46 && i <= 48 && type === 'Reel' ? 2.4 : 1;
    const reach = Math.round(s.reach * boost * noise(0.35));
    const views = Math.round(reach * s.view * noise(0.1));
    posts.push({
      date: days[i], type, caption: captions[p % captions.length],
      reach, views,
      follows: Math.round(reach * s.follow * noise(0.4)),
      permalink: null,  // URL do post no Instagram (null = sem link)
      thumbnail: null,  // URL da miniatura (null = placeholder)
    });
  }

  window.DASHBOARD_DATA = {
    sample: true,
    account: { adAccount: 'DALL.TECH-AD-01', currency: 'BRL' },
    days,
    campaigns,
    instagram: { handle: '@dall.tech', daily: igDaily, posts },
  };
})();
