/*
 * Busca os dados reais em /api/dashboard (função no servidor que consulta a Graph API da Meta).
 * Sem a API (arquivo aberto direto, ou token não configurado) devolve null e o app usa data.js (exemplo).
 */
window.loadLive = async function () {
  window.LIVE_STATUS = null;
  if (location.protocol === 'file:') return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch('/api/dashboard', { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (r.status === 404) return null; // hospedagem estática, sem a função /api: usa os dados de exemplo
    if (!r.ok) { window.LIVE_STATUS = { configured: true, error: 'A API respondeu com erro (HTTP ' + r.status + ').' }; return null; }
    const j = await r.json();
    window.LIVE_STATUS = j;
    return j && j.configured && j.data ? j.data : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
