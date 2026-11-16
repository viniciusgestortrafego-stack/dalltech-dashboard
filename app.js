(function () {
  'use strict';
  const D = window.DASHBOARD_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r) => (r || document).querySelector(s);
  const N = D.days.length;

  // ---------- helpers de DOM (sempre textContent: nada de innerHTML com dados) ----------
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'text') e.textContent = props[k];
      else e.setAttribute(k, props[k]);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }
  function svgEl(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // ---------- formatação pt-BR ----------
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: D.account.currency || 'BRL' });
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: D.account.currency || 'BRL', maximumFractionDigits: 0 });
  const fInt = (v) => nf0.format(v);
  const fBRL = (v) => brl.format(v);
  const fPct = (v) => nf1.format(v * 100) + '%';
  const fAxis = (v) => (v >= 10000 ? nf0.format(v / 1000) + ' mil' : v >= 1000 ? nf1.format(v / 1000) + ' mil' : nf0.format(v));
  const fAxisBRL = (v) => (v >= 1000 ? 'R$ ' + nf1.format(v / 1000) + ' mil' : brl0.format(v));
  const dm = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const dLong = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const div = (a, b) => (b ? a / b : 0);

  // ---------- estado ----------
  const state = { tab: 'paid', range: 30 };
  const bounds = () => ({ from: N - state.range, to: N, pFrom: N - 2 * state.range, pTo: N - state.range });

  // ---------- tooltip global ----------
  const tip = $('#tip');
  function showTip(title, rows, x, y) {
    tip.textContent = '';
    if (title) tip.append(el('div', { class: 'tip-title', text: title }));
    rows.forEach((r) => {
      const key = el('span', { class: 'tip-key' });
      key.style.background = r.color;
      tip.append(el('div', { class: 'tip-row' }, key, el('span', { class: 'tip-val', text: r.value }), el('span', { class: 'tip-lab', text: r.label })));
    });
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 14; if (left + w > window.innerWidth - 8) left = x - w - 14;
    let top = y - h - 12; if (top < 8) top = y + 16;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = top + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  // ---------- KPI ----------
  function delta(cur, prev, lowerIsBetter) {
    if (!prev) return el('span', { class: 'delta flat', text: '—' });
    const p = (cur - prev) / prev;
    if (Math.abs(p) < 0.005) return el('span', { class: 'delta flat', text: '— 0%', title: 'Sem variação' });
    const up = p > 0;
    const good = lowerIsBetter ? !up : up;
    return el('span', {
      class: 'delta ' + (good ? 'good' : 'bad'),
      title: good ? 'Melhora em relação ao período anterior' : 'Piora em relação ao período anterior',
      text: (up ? '▲ ' : '▼ ') + nf1.format(Math.abs(p) * 100) + '%',
    });
  }
  function renderKpis(container, items) {
    container.textContent = '';
    items.forEach((k) => {
      const foot = el('div', { class: 'kpi-foot' });
      if (k.sub) foot.append(k.sub);
      else foot.append(delta(k.cur, k.prev, k.lowerIsBetter), el('span', { text: 'vs. período anterior' }));
      container.append(el('div', { class: 'kpi' },
        el('div', { class: 'kpi-label', text: k.label }),
        el('div', { class: 'kpi-value', text: k.fmt(k.cur) }),
        foot));
    });
  }

  // ---------- escala ----------
  // passo "redondo" (1, 2 ou 5 × 10^n) que cobre o valor máximo com no máximo 5 intervalos
  function niceScale(v) {
    if (v <= 0) return { max: 4, step: 1 };
    const pow = Math.pow(10, Math.floor(Math.log10(v / 5)));
    const step = [1, 2, 5, 10].map((f) => f * pow).find((s) => Math.ceil(v / s) <= 5);
    return { max: step * Math.ceil(v / step), step };
  }
  function barPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  // ---------- gráfico temporal (barra ou linha, 1 série, crosshair + tooltip) ----------
  function timeChart(host, cfg) {
    host.textContent = '';
    const W = Math.max(260, Math.floor(host.clientWidth) || 560);
    const H = 230;
    const m = { l: 52, r: 8, t: 10, b: 26 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const n = cfg.values.length;
    const scale = niceScale(Math.max(...cfg.values, 0) * 1.03);
    const max = scale.max;
    const band = iw / n;
    const X = (i) => m.l + (i + 0.5) * band;
    const Y = (v) => m.t + ih - (v / max) * ih;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-label': cfg.aria });
    // grade + eixo Y
    for (let k = 0; k <= Math.round(max / scale.step); k++) {
      const v = scale.step * k, y = Y(v);
      svg.append(svgEl('line', { class: k === 0 ? 'g-axis' : 'g-grid', x1: m.l, x2: W - m.r, y1: y, y2: y }));
      const t = svgEl('text', { class: 'g-tick', x: m.l - 8, y: y + 4, 'text-anchor': 'end' });
      t.textContent = cfg.yFmt(v);
      svg.append(t);
    }
    // eixo X
    const step = Math.ceil(n / 6);
    for (let i = n - 1; i >= 0; i -= step) {
      const t = svgEl('text', { class: 'g-tick', x: X(i), y: H - 6, 'text-anchor': 'middle' });
      t.textContent = dm(cfg.dates[i]);
      svg.append(t);
    }
    // marcas
    const marks = [];
    if (cfg.type === 'bar') {
      const bw = Math.min(30, band * 0.62);
      cfg.values.forEach((v, i) => {
        const h = (v / max) * ih;
        const p = svgEl('path', { d: h > 0.5 ? barPath(X(i) - bw / 2, Y(v), bw, h, 4) : '' });
        p.style.fill = cfg.color;
        svg.append(p); marks.push(p);
      });
    } else {
      const d = cfg.values.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join('');
      const path = svgEl('path', { d, fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      path.style.stroke = cfg.color;
      svg.append(path);
    }
    // camada de hover
    const cross = svgEl('line', { class: 'g-cross', y1: m.t, y2: m.t + ih, x1: 0, x2: 0, visibility: 'hidden' });
    const dot = svgEl('circle', { r: 4, 'stroke-width': 2, visibility: 'hidden' });
    dot.style.fill = cfg.color; dot.style.stroke = 'var(--surface)';
    svg.append(cross, dot);
    const hit = svgEl('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
    svg.append(hit);

    let active = -1;
    function setActive(i, cx, cy) {
      active = i;
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      if (cfg.type === 'line') { dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(cfg.values[i])); dot.setAttribute('visibility', 'visible'); }
      else marks.forEach((p, k) => { p.style.opacity = k === i ? '1' : '0.6'; });
      showTip(dLong(cfg.dates[i]), [{ color: cfg.color, value: cfg.tipFmt(cfg.values[i]), label: cfg.label }], cx, cy);
    }
    function clear() {
      active = -1; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden');
      marks.forEach((p) => { p.style.opacity = ''; });
      hideTip();
    }
    const idxFrom = (e) => {
      const r = svg.getBoundingClientRect();
      return Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - m.l) / band)));
    };
    hit.addEventListener('pointermove', (e) => setActive(idxFrom(e), e.clientX, e.clientY));
    hit.addEventListener('pointerdown', (e) => setActive(idxFrom(e), e.clientX, e.clientY));
    hit.addEventListener('pointerleave', clear);
    svg.addEventListener('blur', clear);
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = active < 0 ? n - 1 : Math.max(0, Math.min(n - 1, active + (e.key === 'ArrowRight' ? 1 : -1)));
      const r = svg.getBoundingClientRect();
      setActive(i, r.left + X(i), r.top + Y(cfg.values[i]));
    });
    host.append(svg);
  }

  // ---------- barras horizontais (funil, formatos) ----------
  function hbars(host, items) {
    host.textContent = '';
    const max = Math.max(...items.map((i) => i.value), 1);
    items.forEach((it) => {
      const bar = el('div', { class: 'hbar' });
      bar.style.width = `max(3px, calc(${(it.value / max) * 100}% * 0.62))`;
      bar.style.background = it.color;
      const track = el('div', { class: 'htrack' }, bar, el('span', { class: 'hval', text: it.valueText }), it.subText ? el('span', { class: 'hsub', text: it.subText }) : null);
      const row = el('div', { class: 'hrow', tabindex: '0', role: 'group', 'aria-label': `${it.label}: ${it.valueText}${it.subText ? ', ' + it.subText : ''}` },
        el('div', { class: 'hlabel', text: it.label }), track);
      const show = (e) => {
        const r = row.getBoundingClientRect();
        showTip(it.label, [{ color: it.color, value: it.valueText, label: it.tipLabel || '' }], e.clientX || r.left + r.width / 2, e.clientY || r.top);
      };
      row.addEventListener('pointermove', show);
      row.addEventListener('focus', show);
      row.addEventListener('pointerleave', hideTip);
      row.addEventListener('blur', hideTip);
      host.append(row);
    });
  }

  // ---------- tabelas ----------
  function fillTable(table, cols, rows, foot) {
    table.textContent = '';
    const thead = el('thead', null, el('tr', null, cols.map((c) => el('th', { class: c.txt ? 'txt' : '', scope: 'col', text: c.label }))));
    const tbody = el('tbody');
    rows.forEach((r) => tbody.append(el('tr', null, cols.map((c, i) => {
      const v = c.cell(r);
      const td = el('td', { class: (c.txt ? 'txt ' : '') + (c.cls || '') });
      td.append(v && v.nodeType ? v : document.createTextNode(v == null ? '' : String(v)));
      return td;
    }))));
    table.append(thead, tbody);
    if (foot) table.append(el('tfoot', null, el('tr', null, foot.map((f, i) => el('td', { class: i === 0 ? 'txt' : '', text: f })))));
  }

  // ======================================================================
  //                               TRÁFEGO PAGO
  // ======================================================================
  const PAID_KEYS = ['spend', 'impressions', 'clicks', 'lpv', 'leads'];
  function paidSeries(from, to) {
    const o = {};
    PAID_KEYS.forEach((k) => { o[k] = Array.from({ length: to - from }, (_, i) => sum(D.campaigns.map((c) => c.daily[from + i][k]))); });
    return o;
  }
  function campTotals(c, from, to) {
    const o = {};
    PAID_KEYS.forEach((k) => { o[k] = sum(c.daily.slice(from, to).map((d) => d[k])); });
    return o;
  }

  function renderPaid() {
    const b = bounds();
    const cur = paidSeries(b.from, b.to), prev = paidSeries(b.pFrom, b.pTo);
    const T = (s) => ({ spend: sum(s.spend), impr: sum(s.impressions), clicks: sum(s.clicks), lpv: sum(s.lpv), leads: sum(s.leads) });
    const c = T(cur), p = T(prev);

    renderKpis($('#paid-kpis'), [
      { label: 'Investimento', cur: c.spend, prev: p.spend, fmt: fBRL },
      { label: 'Leads', cur: c.leads, prev: p.leads, fmt: fInt },
      { label: 'Custo por lead (CPL)', cur: div(c.spend, c.leads), prev: div(p.spend, p.leads), fmt: fBRL, lowerIsBetter: true },
      { label: 'Cliques no link', cur: c.clicks, prev: p.clicks, fmt: fInt },
      { label: 'CTR (link)', cur: div(c.clicks, c.impr), prev: div(p.clicks, p.impr), fmt: fPct },
      { label: 'CPM', cur: div(c.spend, c.impr) * 1000, prev: div(p.spend, p.impr) * 1000, fmt: fBRL, lowerIsBetter: true },
    ]);

    const dates = D.days.slice(b.from, b.to);
    const cpl = cur.spend.map((s, i) => (cur.leads[i] ? s / cur.leads[i] : 0));
    timeChart($('#c-spend'), { dates, values: cur.spend, type: 'bar', color: 'var(--s1)', yFmt: fAxisBRL, tipFmt: fBRL, label: 'Investimento',
      aria: `Investimento diário. Total no período: ${fBRL(c.spend)}.` });
    timeChart($('#c-leads'), { dates, values: cur.leads, type: 'line', color: 'var(--s2)', yFmt: fAxis, tipFmt: fInt, label: 'Leads',
      aria: `Leads por dia. Total no período: ${fInt(c.leads)}.` });
    timeChart($('#c-cpl'), { dates, values: cpl, type: 'line', color: 'var(--s3)', yFmt: fAxisBRL, tipFmt: (v) => (v ? fBRL(v) : 'sem leads'), label: 'CPL',
      aria: `Custo por lead diário. Média no período: ${fBRL(div(c.spend, c.leads))}.` });

    hbars($('#c-funnel'), [
      { label: 'Cliques no link', value: c.clicks, valueText: fInt(c.clicks), subText: 'etapa inicial', color: 'var(--ramp-1)', tipLabel: 'cliques' },
      { label: 'Visualizações da página', value: c.lpv, valueText: fInt(c.lpv), subText: fPct(div(c.lpv, c.clicks)) + ' dos cliques', color: 'var(--ramp-2)', tipLabel: 'visualizações' },
      { label: 'Leads', value: c.leads, valueText: fInt(c.leads), subText: fPct(div(c.leads, c.lpv)) + ' das visualizações', color: 'var(--ramp-3)', tipLabel: 'leads' },
    ]);

    // campanhas
    const rows = D.campaigns.map((camp) => ({ camp, t: campTotals(camp, b.from, b.to) })).sort((a, z) => z.t.spend - a.t.spend);
    fillTable($('#t-campaigns'), [
      { label: 'Campanha', txt: true, cls: 'name', cell: (r) => el('span', null, r.camp.name, el('span', { class: 'cell-sub', text: r.camp.objective })) },
      { label: 'Status', txt: true, cell: (r) => el('span', { class: 'status ' + (r.camp.status === 'Ativa' ? 'on' : 'off') }, r.camp.status === 'Ativa' ? '● ' : '❚❚ ', r.camp.status) },
      { label: 'Investimento', cell: (r) => fBRL(r.t.spend) },
      { label: 'Impressões', cell: (r) => fInt(r.t.impressions) },
      { label: 'Cliques', cell: (r) => fInt(r.t.clicks) },
      { label: 'CTR', cell: (r) => fPct(div(r.t.clicks, r.t.impressions)) },
      { label: 'Leads', cell: (r) => fInt(r.t.leads) },
      { label: 'CPL', cell: (r) => (r.t.leads ? fBRL(r.t.spend / r.t.leads) : '—') },
    ], rows, ['Total', '', fBRL(c.spend), fInt(c.impr), fInt(c.clicks), fPct(div(c.clicks, c.impr)), fInt(c.leads), c.leads ? fBRL(c.spend / c.leads) : '—']);

    // diário
    const idx = Array.from({ length: dates.length }, (_, i) => dates.length - 1 - i);
    fillTable($('#t-paid-daily'), [
      { label: 'Data', txt: true, cell: (i) => dLong(dates[i]) },
      { label: 'Investimento', cell: (i) => fBRL(cur.spend[i]) },
      { label: 'Impressões', cell: (i) => fInt(cur.impressions[i]) },
      { label: 'Cliques', cell: (i) => fInt(cur.clicks[i]) },
      { label: 'Visualizações da página', cell: (i) => fInt(cur.lpv[i]) },
      { label: 'Leads', cell: (i) => fInt(cur.leads[i]) },
      { label: 'CPL', cell: (i) => (cur.leads[i] ? fBRL(cur.spend[i] / cur.leads[i]) : '—') },
    ], idx);
  }

  // ======================================================================
  //                                INSTAGRAM
  // ======================================================================
  const IG = D.instagram;
  const IG_KEYS = ['reach', 'views', 'interactions', 'profile_taps', 'new_followers'];
  const igSlice = (k, from, to) => IG.daily.slice(from, to).map((d) => d[k]);
  const TYPE_COLORS = { Reel: 'var(--s1)', Carrossel: 'var(--s2)', Imagem: 'var(--s3)' };
  const postInter = (p) => p.likes + p.comments + p.saves + p.shares;

  function renderIG() {
    const b = bounds();
    const S = (k) => ({ cur: igSlice(k, b.from, b.to), prev: igSlice(k, b.pFrom, b.pTo) });
    const reach = S('reach'), views = S('views'), inter = S('interactions'), taps = S('profile_taps'), nf = S('new_followers');

    renderKpis($('#ig-kpis'), [
      { label: 'Seguidores', cur: IG.followers, fmt: fInt, sub: el('span', null, el('span', { class: 'delta good', text: '+' + fInt(sum(nf.cur)) }), ' no período') },
      { label: 'Novos seguidores', cur: sum(nf.cur), prev: sum(nf.prev), fmt: fInt },
      { label: 'Visualizações', cur: sum(views.cur), prev: sum(views.prev), fmt: fInt },
      { label: 'Alcance médio por dia', cur: sum(reach.cur) / state.range, prev: sum(reach.prev) / state.range, fmt: fInt },
      { label: 'Interações', cur: sum(inter.cur), prev: sum(inter.prev), fmt: fInt },
      { label: 'Toques nos links do perfil', cur: sum(taps.cur), prev: sum(taps.prev), fmt: fInt },
    ]);

    const dates = D.days.slice(b.from, b.to);
    timeChart($('#c-reach'), { dates, values: reach.cur, type: 'line', color: 'var(--s1)', yFmt: fAxis, tipFmt: fInt, label: 'Alcance',
      aria: `Alcance diário. Média no período: ${fInt(sum(reach.cur) / state.range)} contas por dia.` });
    timeChart($('#c-follow'), { dates, values: nf.cur, type: 'bar', color: 'var(--s3)', yFmt: fAxis, tipFmt: fInt, label: 'Novos seguidores',
      aria: `Novos seguidores por dia. Total no período: ${fInt(sum(nf.cur))}.` });
    timeChart($('#c-views'), { dates, values: views.cur, type: 'bar', color: 'var(--s1)', yFmt: fAxis, tipFmt: fInt, label: 'Visualizações',
      aria: `Visualizações diárias. Total no período: ${fInt(sum(views.cur))}.` });

    // posts do período
    const posts = IG.posts.filter((p) => p.date >= D.days[b.from] && p.date <= D.days[N - 1]);
    const byType = {};
    posts.forEach((p) => { (byType[p.type] = byType[p.type] || []).push(p); });
    const items = Object.keys(TYPE_COLORS).filter((t) => byType[t]).map((t) => {
      const avg = sum(byType[t].map(postInter)) / byType[t].length;
      return { label: t, value: avg, valueText: fInt(avg), subText: `${byType[t].length} ${byType[t].length === 1 ? 'post' : 'posts'}`, color: TYPE_COLORS[t], tipLabel: 'interações por post' };
    }).sort((a, z) => z.value - a.value);
    if (items.length) hbars($('#c-format'), items);
    else { $('#c-format').textContent = ''; $('#c-format').append(el('p', { class: 'sub', text: 'Nenhum post publicado no período.' })); }

    const top = posts.slice().sort((a, z) => postInter(z) - postInter(a)).slice(0, 8);
    fillTable($('#t-posts'), [
      { label: 'Post', txt: true, cls: 'name', cell: (p) => el('span', null, p.caption, el('span', { class: 'cell-sub', text: dLong(p.date) })) },
      { label: 'Formato', txt: true, cell: (p) => p.type },
      { label: 'Alcance', cell: (p) => fInt(p.reach) },
      { label: 'Visualizações', cell: (p) => fInt(p.views) },
      { label: 'Curtidas', cell: (p) => fInt(p.likes) },
      { label: 'Comentários', cell: (p) => fInt(p.comments) },
      { label: 'Salvos', cell: (p) => fInt(p.saves) },
      { label: 'Compart.', cell: (p) => fInt(p.shares) },
      { label: 'Engajamento', cell: (p) => fPct(div(postInter(p), p.reach)) },
    ], top);

    const idx = Array.from({ length: dates.length }, (_, i) => dates.length - 1 - i);
    fillTable($('#t-ig-daily'), [
      { label: 'Data', txt: true, cell: (i) => dLong(dates[i]) },
      { label: 'Alcance', cell: (i) => fInt(reach.cur[i]) },
      { label: 'Visualizações', cell: (i) => fInt(views.cur[i]) },
      { label: 'Interações', cell: (i) => fInt(inter.cur[i]) },
      { label: 'Toques nos links', cell: (i) => fInt(taps.cur[i]) },
      { label: 'Novos seguidores', cell: (i) => fInt(nf.cur[i]) },
    ], idx);
  }

  // ======================================================================
  //                          CASCA / INTERAÇÃO GERAL
  // ======================================================================
  function render() {
    const b = bounds();
    $('#range-label').textContent = `${dm(D.days[b.from])} a ${dm(D.days[N - 1])} · comparado com ${dm(D.days[b.pFrom])} a ${dm(D.days[b.pTo - 1])}`;
    hideTip();
    if (state.tab === 'paid') renderPaid(); else renderIG();
  }

  function setTab(tab) {
    state.tab = tab;
    $('#view-paid').hidden = tab !== 'paid';
    $('#view-ig').hidden = tab !== 'ig';
    $('#tab-paid').setAttribute('aria-selected', tab === 'paid');
    $('#tab-ig').setAttribute('aria-selected', tab === 'ig');
    render();
  }
  $('#tab-paid').addEventListener('click', () => setTab('paid'));
  $('#tab-ig').addEventListener('click', () => setTab('ig'));

  document.querySelectorAll('#range-seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.range = Number(btn.dataset.range);
      document.querySelectorAll('#range-seg button').forEach((x) => x.setAttribute('aria-pressed', x === btn));
      const chart = document.querySelectorAll('.chart');
      chart.forEach((c) => c.classList.add('loading'));
      requestAnimationFrame(() => { render(); chart.forEach((c) => c.classList.remove('loading')); });
    });
  });

  // tema
  function currentTheme() {
    return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function paintThemeBtn() { $('#theme-label').textContent = currentTheme() === 'dark' ? '☀ Claro' : '☾ Escuro'; }
  $('#theme-btn').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('dalltech-theme', next); } catch (e) { /* sem persistência */ }
    paintThemeBtn();
  });
  paintThemeBtn();

  // cabeçalho / rodapé / banner
  $('#brand-sub').textContent = `Meta Ads · ${IG.handle}`;
  $('#banner-acc').textContent = D.account.adAccount;
  $('#sample-banner').hidden = !D.sample;
  $('#foot-note').textContent = D.sample
    ? 'Dados fictícios gerados em data.js apenas para demonstrar o layout.'
    : `Fontes: Meta Ads (${D.account.adAccount}) e Instagram ${IG.handle}.`;

  // redimensionamento: redesenha gráficos quando a largura muda
  let lastW = window.innerWidth, timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; render(); } }, 120);
  });
  document.addEventListener('scroll', hideTip, { passive: true });

  render();
})();
