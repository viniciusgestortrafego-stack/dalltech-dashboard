'use strict';
const { makeGraph, sanitize } = require('./_lib/graph');
const { buildDashboard } = require('./_lib/build');

/**
 * GET /api/dashboard
 * Consulta a Graph API da Meta no servidor (token em META_ACCESS_TOKEN) e devolve
 * o JSON que o dashboard exibe. O token nunca chega ao navegador.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const token = process.env.META_ACCESS_TOKEN;
  const adAccountId = (process.env.META_AD_ACCOUNT_ID || '1321298613137677').replace(/^act_/, '');
  const igId = process.env.META_INSTAGRAM_ACCOUNT_ID || '17841471433460467';

  if (!token) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    return res.end(JSON.stringify({ configured: false, missing: ['META_ACCESS_TOKEN'], adAccountId, instagramAccountId: igId }));
  }
  try {
    const graph = makeGraph({ token, version: process.env.META_GRAPH_VERSION || 'v23.0' });
    const data = await buildDashboard({ graph, adAccountId, igId, now: new Date() });
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.statusCode = 200;
    return res.end(JSON.stringify({ configured: true, data }));
  } catch (e) {
    console.error('dashboard error:', sanitize(e && e.message, token));
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 502;
    return res.end(JSON.stringify({ configured: true, error: 'Falha ao consultar a API da Meta.' }));
  }
};
