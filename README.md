# DallTech Dashboard

Dashboard de **Meta Ads** e **Instagram (@dall.tech)**, conectado direto à **Graph API da Meta**. Site estático (HTML/CSS/JS puro, gráficos em SVG) + uma função no servidor (`api/dashboard.js`) que guarda o token e consulta a API.

Layout baseado no modelo `/instagram` dos dashboards *genius-**: sidebar + cabeçalho + conteúdo, violeta `#8b5cf6`, fonte Inter, tema escuro por padrão.

## Como funciona

```
navegador ──GET /api/dashboard──▶ função (Vercel) ──Graph API──▶ Meta Ads + Instagram
   ▲                                  │ usa META_ACCESS_TOKEN (só no servidor)
   └──────── JSON pronto (cache 15 min) ◀┘
```

- O token **nunca** vai ao navegador. A resposta é cacheada 15 min (`s-maxage=900`) para não estourar o limite da API.
- Sem token configurado (ou abrindo `index.html` direto), o dashboard mostra **dados de exemplo** com um aviso, e a página **Fontes de dados** diz exatamente o que falta.
- Com token, tudo vem da API: se uma fonte falhar, aparece o erro na página **Fontes de dados**; nunca se misturam dados de exemplo com dados reais.

## Configurar (Vercel)

Em *Project → Settings → Environment Variables*:

| Variável | Valor |
|---|---|
| `META_ACCESS_TOKEN` | Token da Meta com `ads_read`, `instagram_basic`, `instagram_manage_insights` e `pages_read_engagement` (de preferência um token de usuário do sistema, que não expira) |
| `META_AD_ACCOUNT_ID` | `1321298613137677` (DALL.TECH-AD-01; já é o padrão) |
| `META_INSTAGRAM_ACCOUNT_ID` | `17841471433460467` (@dall.tech; já é o padrão; **confirme** que é o ID de conta profissional do perfil) |

Depois faça um novo deploy. Veja `.env.example`. Nunca commite o valor do token.

> A rota `/api/dashboard` devolve os números da conta para quem abrir o endereço. Se o deploy for público, ative a proteção de deploy da Vercel (ou coloque login) para não expor os dados.

## O que tem

- **Meta Ads:** investimento, leads, CPL, cliques no link, CTR e CPM (com variação vs. período anterior); gráficos diários; funil (cliques → visualizações da página → leads); tabela de campanhas.
- **Instagram (como no modelo):** Visualizações, Seguidores (variação líquida), Interações, Contas Alcançadas, Visitas ao Perfil + **Últimos Conteúdos** (10 posts: alcance, views, seguidores). Extra: gráficos diários de alcance e novos seguidores.
- **Fontes de dados:** qual conta/perfil foi consultado, IDs, status e o que cada um retornou.
- Filtro 7/14/30 dias, tema claro/escuro, tooltips por mouse e teclado (← →), tabela diária.

## Como os números são calculados

| Card | Origem na API |
|---|---|
| Investimento / Impressões | `act_<id>/insights` (`spend`, `impressions`), nível campanha, por dia |
| Cliques no link | `inline_link_clicks` |
| Visualizações da página | ação `landing_page_view` |
| **Leads** | ação `lead` **+** `onsite_conversion.messaging_conversation_started_7d` (formulário/pixel + conversas iniciadas no WhatsApp/Direct). Ajuste em `api/_lib/build.js` se a conta contar leads de outra forma |
| Alcance diário / Novos seguidores | `<ig>/insights` `reach` e `follower_count` (`period=day`; seguidores só dos últimos 30 dias, limite da API) |
| Visualizações / Interações / Visitas ao perfil | `views`, `total_interactions`, `profile_views` com `metric_type=total_value`, uma chamada por dia |
| Últimos Conteúdos | `<ig>/media` + `<media>/insights` (`reach`, `views`, `follows`) |

Observações: o período termina **ontem** (hoje ainda está incompleto, fuso de São Paulo). **Contas Alcançadas** soma o alcance diário (uma conta que viu em dois dias conta duas vezes); o modelo usa o alcance único do período, que é um pouco menor.

## Rodar e testar

```bash
node test/build.test.js        # testa o montador de dados com respostas simuladas da Graph API
python3 -m http.server 8000    # só o front, com dados de exemplo
npx vercel dev                 # front + /api/dashboard (precisa das variáveis de ambiente)
```

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html`, `styles.css`, `app.js` | Interface (páginas `#meta`, `#instagram`, `#fontes`) |
| `live.js` | Busca `/api/dashboard`; se não houver API, o app usa `data.js` |
| `data.js` | Dados de exemplo (fictícios) e diagnóstico estático das fontes |
| `api/dashboard.js` | Função no servidor: lê o token, consulta a Graph API, devolve JSON |
| `api/_lib/graph.js`, `api/_lib/build.js` | Cliente da Graph API e montagem dos dados |
| `test/` | Testes do montador |
