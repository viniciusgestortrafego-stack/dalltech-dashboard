'use strict';
// Teste do montador de dados com respostas simuladas no formato da Graph API.  Rodar: node test/build.test.js
const assert = require('node:assert/strict');
const { buildDashboard, addDays } = require('../api/_lib/build');
const { sanitize } = require('../api/_lib/graph');

const NOW = new Date('2026-11-17T15:00:00Z'); // 12:00 em Brasília → último dia completo = 16/11
const { mockGraph, AD, IG } = require('./mock-graph');

(async () => {
  // 1) caminho feliz
  const d = await buildDashboard({ graph: mockGraph(), adAccountId: AD, igId: IG, now: NOW });
  assert.equal(d.sample, false);
  assert.equal(d.days.length, 60);
  assert.equal(d.days[59], '2026-11-16');
  assert.equal(d.days[0], addDays('2026-11-16', -59));
  assert.equal(d.campaigns.length, 1, 'campanha pausada sem gasto é omitida');
  const c1 = d.campaigns[0];
  assert.equal(c1.status, 'Ativa'); assert.equal(c1.objective, 'Leads');
  assert.deepEqual(c1.daily[59], { spend: 50.5, impressions: 2000, clicks: 40, lpv: 30, leads: 5 });
  assert.equal(c1.daily[58].spend, 40); assert.equal(c1.daily[58].leads, 0);
  assert.equal(c1.daily.length, 60);
  assert.equal(d.instagram.handle, '@dall.tech');
  assert.equal(d.instagram.daily.length, 60);
  assert.ok(d.instagram.daily.every((x) => x.views === 50 && x.interactions === 5 && x.profile_views === 3), 'fallback por métrica preenche todos os dias');
  assert.ok(d.instagram.daily.filter((x) => x.reach === 100).length >= 58, 'alcance diário mapeado para os dias');
  assert.equal(d.instagram.daily[59].new_followers, 7);
  assert.equal(d.instagram.posts.length, 2);
  assert.equal(d.instagram.posts.at(-1).type, 'Reel');            // mais recente por último
  assert.equal(d.instagram.posts.at(-1).reach, 900);               // fallback sem "follows"
  assert.equal(d.instagram.posts[0].type, 'Carrossel'); assert.equal(d.instagram.posts[0].follows, 3);
  assert.equal(d.sources[0].state, 'ok'); assert.equal(d.sources[1].state, 'ok');
  assert.ok(d.sources[0].facts.some(([k, v]) => k === 'ID da conta' && v === AD));

  // 2) conta sem campanhas → diagnóstico "empty", sem inventar dados
  const e = await buildDashboard({ graph: mockGraph({ campaigns: false }), adAccountId: AD, igId: IG, now: NOW });
  assert.equal(e.campaigns.length, 0); assert.equal(e.sources[0].state, 'empty');

  // 3) Instagram sem permissão → erro isolado, Meta Ads segue funcionando
  const f = await buildDashboard({ graph: mockGraph({ igFail: true }), adAccountId: AD, igId: IG, now: NOW });
  assert.equal(f.sources[1].state, 'blocked'); assert.match(f.sources[1].note, /permission/);
  assert.equal(f.campaigns.length, 1);
  assert.equal(f.instagram.daily.length, 60);

  // 4) o token nunca aparece em mensagens de erro
  assert.equal(sanitize('falhou https://x?access_token=SEGREDO123&a=1 e SEGREDO123', 'SEGREDO123').includes('SEGREDO123'), false);
  console.log('OK — todos os testes passaram');
})().catch((err) => { console.error(err); process.exit(1); });
