# DallTech Dashboard

Dashboard de **tráfego pago (Meta Ads)** e **Instagram (@dall.tech)**. Site estático (HTML + CSS + JS puro, gráficos em SVG, sem dependências e sem build).

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Ou abra `index.html` direto no navegador. Para publicar, qualquer hospedagem estática serve (ex.: Vercel apontando para a raiz do repositório).

## O que tem

- **Tráfego pago:** investimento, leads, CPL, cliques, CTR e CPM com variação vs. período anterior; gráficos diários de investimento, leads e CPL; funil (cliques → visualizações da página → leads); tabela de campanhas.
- **Instagram:** seguidores, novos seguidores, visualizações, alcance médio, interações e toques nos links; gráficos diários; interações por formato (Reel/Carrossel/Imagem); melhores posts.
- Filtro de período (7/14/30 dias), tema claro/escuro, tooltips por hover e teclado (setas ← →), tabela diária em cada aba.

## ⚠️ Estado atual: dados de exemplo

`data.js` gera dados **fictícios** (marcados com um aviso na tela) porque, na criação do dashboard:

- a conta de anúncios **DALL.TECH-AD-01** (`1321298613137677`) não tinha nenhuma campanha nem gasto em todo o histórico;
- a leitura do Instagram pelo **Windsor.ai** estava pausada (plano Free permite 1 conta; há 15 conectadas).

## Conectar dados reais

`data.js` é o único ponto de troca. Substitua `window.DASHBOARD_DATA` por um objeto no formato abaixo e use `sample: false` (o aviso some sozinho):

```js
window.DASHBOARD_DATA = {
  sample: false,
  account: { adAccount: 'DALL.TECH-AD-01', currency: 'BRL' },
  days: ['2026-09-17', /* ... 60 dias consecutivos, o mais recente por último */],
  campaigns: [
    {
      id: 'c1', name: 'Nome da campanha', objective: 'Leads', status: 'Ativa', // ou 'Pausada'
      daily: [{ spend: 72.5, impressions: 3000, clicks: 48, lpv: 39, leads: 4 } /* um item por dia de `days` */],
    },
  ],
  instagram: {
    handle: '@dall.tech',
    followers: 4812, // total atual
    daily: [{ reach: 1150, views: 2100, interactions: 90, profile_taps: 5, new_followers: 7 } /* um por dia */],
    posts: [{ date: '2026-11-10', type: 'Reel', /* 'Reel' | 'Carrossel' | 'Imagem' */ caption: '...',
              reach: 2300, views: 4200, likes: 110, comments: 9, saves: 12, shares: 15 }],
  },
};
```

Mapeamento das fontes:

| Campo | Meta Ads (`ads_get_ad_entities`) | Instagram (Windsor `instagram`) |
|---|---|---|
| `spend` | `amount_spent` | — |
| `impressions`, `clicks` | `impressions`, `link_click` | — |
| `lpv`, `leads` | `landing_page_view`, `lead` | — |
| `reach`, `views` | — | `reach_1d`, `views` |
| `interactions` | — | `total_interactions` |
| `profile_taps`, `new_followers` | — | `profile_links_taps`, `follower_count_1d` |
| posts | — | `media_*` (`media_reach`, `media_views`, `media_like_count`, `media_comments_count`, `media_saved`, `media_shares`) |

Para gerar o `data.js` real, rode o export (Meta Ads com `level=campaign` e `time_increment=1`; Windsor com os campos acima) e grave o resultado nesse formato.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `styles.css` | Tema claro/escuro e layout responsivo |
| `app.js` | Cálculos, KPIs, gráficos SVG, tabelas e interações |
| `data.js` | Dados (exemplo, hoje) |
