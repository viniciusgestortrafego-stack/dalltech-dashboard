# DallTech Dashboard

Dashboard de **tráfego pago (Meta Ads)** e **Instagram (@dall.tech)**. Site estático (HTML + CSS + JS puro, gráficos em SVG, sem dependências e sem build).

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Ou abra `index.html` direto no navegador. Para publicar, qualquer hospedagem estática serve (ex.: Vercel apontando para a raiz do repositório).

## O que tem

Layout baseado no modelo `/instagram` de um projeto *genius-** (sidebar + cabeçalho + conteúdo, violeta `#8b5cf6`, fonte Inter, tema escuro por padrão). Navegação por hash: `#meta` e `#instagram`.

- **Meta Ads:** investimento, leads, CPL, cliques, CTR e CPM com variação vs. período anterior; gráficos diários de investimento, leads e CPL; funil (cliques → visualizações da página → leads); tabela de campanhas.
- **Instagram (igual ao modelo):** 5 cards — Visualizações, Seguidores (variação líquida), Interações, Contas Alcançadas, Visitas ao Perfil — e **Últimos Conteúdos** (10 posts: data, legenda, Alcance, Views, Seguidores). Extra: gráficos diários de alcance e novos seguidores.
- Filtro de período (7/14/30 dias), tema claro/escuro, tooltips por hover e teclado (setas ← →), tabela diária em cada página.

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
    daily: [{ reach: 1150, views: 2100, interactions: 90, profile_views: 25, new_followers: 7 } /* um por dia */],
    posts: [{ date: '2026-11-10', type: 'Reel', /* 'Reel' | 'Carrossel' | 'Imagem' */ caption: '...',
              reach: 2300, views: 4200, follows: 6,
              permalink: 'https://www.instagram.com/p/...', thumbnail: 'https://...' /* ou null */ }],
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
| `profile_views`, `new_followers` | — | `profile_views_1d`, `follower_count_1d` |
| posts | — | `media_reach`, `media_views`, `media_follows`, `media_permalink`, `media_thumbnail_url`, `media_caption`, `timestamp` |

> Nota: o card **Contas Alcançadas** soma o alcance diário. Com dados reais, prefira o alcance único do período (`metric=reach` com `metric_type=total_value`), como faz o modelo — a soma diária conta a mesma conta mais de uma vez.

Para gerar o `data.js` real, rode o export (Meta Ads com `level=campaign` e `time_increment=1`; Windsor com os campos acima) e grave o resultado nesse formato.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `styles.css` | Tokens de cor (claro/escuro), sidebar e layout responsivo |
| `app.js` | Cálculos, KPIs, gráficos SVG, tabelas e interações |
| `data.js` | Dados (exemplo, hoje) |
