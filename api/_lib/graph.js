'use strict';
/**
 * Cliente mínimo da Graph API da Meta (somente leitura, só no servidor).
 * O token vem de META_ACCESS_TOKEN e NUNCA é enviado ao navegador.
 */
const BASE = 'https://graph.facebook.com';

class GraphError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
    this.code = code;
  }
}

function sanitize(msg, token) {
  let s = String(msg == null ? '' : msg);
  if (token) s = s.split(token).join('***');
  return s.replace(/access_token=[^&\s"']+/g, 'access_token=***');
}

function makeGraph({ token, version = 'v23.0', fetchImpl = fetch }) {
  async function request(url) {
    const res = await fetchImpl(url);
    let json;
    try { json = await res.json(); } catch (e) { throw new GraphError(`Resposta inválida da Meta (HTTP ${res.status})`, res.status); }
    if (!res.ok || (json && json.error)) {
      const err = (json && json.error) || {};
      throw new GraphError(sanitize(err.message || `HTTP ${res.status}`, token), res.status, err.code);
    }
    return json;
  }

  async function get(path, params = {}) {
    const url = new URL(`${BASE}/${version}/${path}`);
    for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
    url.searchParams.set('access_token', token);
    return request(url.toString());
  }

  // segue a paginação (o link "next" já traz o token e fica só no servidor)
  async function getAll(path, params = {}, maxPages = 30) {
    const out = [];
    let json = await get(path, params);
    out.push(...(json.data || []));
    let next = json.paging && json.paging.next;
    for (let pages = 1; next && pages < maxPages; pages++) {
      json = await request(next);
      out.push(...(json.data || []));
      next = json.paging && json.paging.next;
    }
    return out;
  }

  return { get, getAll };
}

module.exports = { makeGraph, GraphError, sanitize };
