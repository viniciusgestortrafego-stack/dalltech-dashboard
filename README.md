# DallTech Dashboard

Dashboard de performance (Meta Ads, **Google Ads**, Instagram, Analytics, Funil de Vendas, Captação de Leads e Criativos) da DallTech,
construído **na mesma estrutura do dashboard Home Garden** da Genius: Next.js 16 (App Router) + React 19 + Tailwind 4 + recharts,
credenciais salvas no servidor (Vercel Blob) e uma página de **Configurações** onde se coloca tudo.

## Páginas

| Rota | Página | Fonte dos dados |
|---|---|---|
| `/` | Meta Ads | Graph API da Meta (via `/api/meta`) |
| `/landing-page` | Funil de Vendas | Meta + Google Ads + WooCommerce (opcional) |
| `/google-ads` | **Google Ads** | Webhook: um script dentro do Google Ads envia os dados |
| `/analytics` | Analytics (GA4) | Google Analytics Data API (variáveis de ambiente) |
| `/captacao-leads` | Captação de Leads | Meta (campanhas `[LEAD]`) |
| `/criativos` | Criativos | Meta (anúncios e criativos) |
| `/instagram` | Instagram | Graph API da Meta |
| `/settings` | Configurações | Login + credenciais |

O período (de/até) fica na URL (`?from=AAAA-MM-DD&to=AAAA-MM-DD`) e vale para todas as páginas.

## Como colocar os dados (passo a passo)

### 1. Variáveis de ambiente (Vercel → Project → Settings → Environment Variables)

| Variável | Para quê |
|---|---|
| `SETTINGS_AUTH_USER` e `SETTINGS_AUTH_PASSWORD` | Login da página de Configurações (você escolhe) |
| `BLOB_READ_WRITE_TOKEN` | Criado ao conectar um **Blob store privado** (Vercel → Storage → Create → Blob). Guarda credenciais e dados do Google Ads |
| `META_GRAPH_VERSION` | Opcional (padrão `v23.0`) |

Depois faça um novo deploy. Veja `.env.example`.

### 2. Abra `/settings`, entre com o login e preencha

- **System User Token - Meta** (Business Manager → Usuários do sistema → Gerar novo token; o token precisa das permissões `ads_read`, `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`)
- **ID da Conta de Anúncios** (DALL.TECH-AD-01 = `1321298613137677`)
- **ID da Conta do Instagram** (ID da conta profissional do `@dall.tech`; o ID `17841471433460467` veio de uma listagem, **confirme** no Meta Business Suite)
- WooCommerce (opcional, só se a DallTech tiver loja)
- **Google Ads**: clique em **Gerar nova** na chave do webhook e **Salvar**

### 3. Google Ads (o que mais importa para a DallTech)

1. Em `/settings`, depois de salvar a chave, copie o **script pronto** (já vem com a URL e a chave preenchidas).
2. No Google Ads: **Ferramentas → Ações em massa → Scripts → Novo script**, cole, autorize e **agende 1x por dia**. Rode uma vez na hora para testar.
3. O script envia campanhas (90 dias), palavras-chave (30 dias) e conversões por ação. Cada envio substitui os dias que cobre; reenviar não duplica.
4. `/settings` mostra quando foi o último envio recebido. A página `/google-ads` mostra investimento, cliques, CPC, CPM, conversões, **leads** (conversões de categorias de lead: formulário, ligação, orçamento, contato...), ROAS, funil, evolução, campanhas, conversões e palavras-chave.

### 4. Analytics (GA4), opcional

Variáveis de ambiente (servidor): `GOOGLE_ANALYTICS_PROPERTY_ID`, `GOOGLE_ANALYTICS_REFRESH_TOKEN` (escopo `analytics.readonly`), `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`. Sem elas, a página avisa o que falta.

## Segurança

- O token da Meta e as chaves ficam só no servidor (Blob privado). `/api/credentials` exige login; `/api/config-status` só diz *o que está configurado*.
- `/api/meta` é um proxy **somente leitura** que só aceita contas e objetos numéricos (`act_<id>`, `<id>/insights`, `<id>/media`...) e remove os links de paginação (eles trariam o token).
- O webhook do Google Ads exige `Authorization: Bearer <chave>`.
- As páginas de dados são **públicas para quem tiver o endereço** (como no modelo). Ative a *Deployment Protection* da Vercel se não quiser isso.

## Marca (reaproveitar em outro cliente)

Tudo em `src/config/site.ts` (nome da agência, do cliente, subtítulo, título do navegador). **Logo:** coloque o arquivo da agência em `public/logo.png`; enquanto ele não existir, o menu usa `public/logo.svg`. O botão **Modo Claro/Modo Escuro** fica no rodapé do menu (padrão: escuro).

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:3000  (sem BLOB_READ_WRITE_TOKEN, as credenciais ficam em memória)
npm run lint
npm run build
```

## Estado da verificação

Testado de ponta a ponta localmente (login, proteção das credenciais, webhook do Google Ads, páginas), **mas não contra a Graph API da Meta, o GA4 ou um Google Ads reais** (não há token neste ambiente). Se alguma resposta real vier em formato diferente do esperado, as páginas mostram o erro em vez de números inventados.
