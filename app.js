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

  // ícones lucide (mesmos usados no modelo)
  const ICONS = {
    'eye': [['path', { d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    'user-plus': [['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }], ['circle', { cx: 9, cy: 7, r: 4 }], ['line', { x1: 19, x2: 19, y1: 8, y2: 14 }], ['line', { x1: 22, x2: 16, y1: 11, y2: 11 }]],
    'heart': [['path', { d: 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5' }]],
    'radar': [['path', { d: 'M19.07 4.93A10 10 0 0 0 6.99 3.34' }], ['path', { d: 'M4 6h.01' }], ['path', { d: 'M2.29 9.62A10 10 0 1 0 21.31 8.35' }], ['path', { d: 'M16.24 7.76A6 6 0 1 0 8.23 16.67' }], ['path', { d: 'M12 18h.01' }], ['path', { d: 'M17.99 11.66A6 6 0 0 1 15.77 16.67' }], ['circle', { cx: 12, cy: 12, r: 2 }], ['path', { d: 'm13.41 10.59 5.66-5.66' }]],
    'circle-user': [['circle', { cx: 12, cy: 12, r: 10 }], ['circle', { cx: 12, cy: 10, r: 3 }], ['path', { d: 'M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662' }]],
    'layout-dashboard': [['rect', { width: 7, height: 9, x: 3, y: 3, rx: 1 }], ['rect', { width: 7, height: 5, x: 14, y: 3, rx: 1 }], ['rect', { width: 7, height: 9, x: 14, y: 12, rx: 1 }], ['rect', { width: 7, height: 5, x: 3, y: 16, rx: 1 }]],
    'camera': [['path', { d: 'M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z' }], ['circle', { cx: 12, cy: 13, r: 3 }]],
  };
  function icon(name, size) {
    const svg = svgEl('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    (ICONS[name] || []).forEach(([tag, attrs]) => svg.append(svgEl(tag, attrs)));
    return svg;
  }
  document.querySelectorAll('[data-icon]').forEach((n) => n.prepend(icon(n.dataset.icon, 20)));

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
    if (!prev) return null;
    const p = (cur - prev) / prev;
    if (Math.abs(p) < 0.005) return el('span', { class: 'pill flat', text: '— 0%', title: 'Sem variação vs. período anterior' });
    const up = p > 0;
    const good = lowerIsBetter ? !up : up;
    return el('span', {
      class: 'pill ' + (good ? 'good' : 'bad'),
      title: (good ? 'Melhora' : 'Piora') + ' em relação ao período anterior',
      text: (up ? '▲ ' : '▼ ') + nf1.format(Math.abs(p) * 100) + '%',
    });
  }
  // cartão de métrica no padrão do modelo: título, ícone, valor, subtítulo e variação
  function renderKpis(container, items) {
    container.textContent = '';
    items.forEach((k) => {
      const top = el('div', { class: 'kpi-top' }, el('h3', { class: 'kpi-title', text: k.label }));
      if (k.icon) top.append(el('div', { class: 'kpi-icon' }, icon(k.icon, 18)));
      container.append(el('div', { class: 'kpi' },
        top,
        el('p', { class: 'kpi-value', text: k.fmt(k.cur) }),
        el('div', { class: 'kpi-foot' },
          k.sub ? el('p', { class: 'kpi-sub', text: k.sub }) : null,
          delta(k.cur, k.prev, k.lowerIsBetter))));
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
  //                                META ADS
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

  function renderMeta() {
    const b = bounds();
    const cur = paidSeries(b.from, b.to), prev = paidSeries(b.pFrom, b.pTo);
    const T = (s) => ({ spend: sum(s.spend), impr: sum(s.impressions), clicks: sum(s.clicks), lpv: sum(s.lpv), leads: sum(s.leads) });
    const c = T(cur), p = T(prev);

    renderKpis($('#meta-kpis'), [
      { label: 'Investimento', sub: 'gasto no período', cur: c.spend, prev: p.spend, fmt: fBRL },
      { label: 'Leads', sub: 'contatos gerados', cur: c.leads, prev: p.leads, fmt: fInt },
      { label: 'Custo por lead', sub: 'investimento ÷ leads', cur: div(c.spend, c.leads), prev: div(p.spend, p.leads), fmt: fBRL, lowerIsBetter: true },
      { label: 'Cliques no link', sub: 'cliques que levaram ao site', cur: c.clicks, prev: p.clicks, fmt: fInt },
      { label: 'CTR (link)', sub: 'cliques ÷ impressões', cur: div(c.clicks, c.impr), prev: div(p.clicks, p.impr), fmt: fPct },
      { label: 'CPM', sub: 'custo por mil impressões', cur: div(c.spend, c.impr) * 1000, prev: div(p.spend, p.impr) * 1000, fmt: fBRL, lowerIsBetter: true },
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

    const idx = Array.from({ length: dates.length }, (_, i) => dates.length - 1 - i);
    fillTable($('#t-meta-daily'), [
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
  const igSlice = (k, from, to) => IG.daily.slice(from, to).map((d) => d[k]);
  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

  function postCard(p) {
    const link = safeUrl(p.permalink);
    const root = link
      ? el('a', { class: 'post', href: link, target: '_blank', rel: 'noopener noreferrer' })
      : el('div', { class: 'post' });
    const img = safeUrl(p.thumbnail);
    root.append(
      img
        ? el('img', { class: 'thumb', src: img, alt: p.caption || 'Conteúdo do Instagram', loading: 'lazy' })
        : el('div', { class: 'thumb', 'data-type': p.type, text: p.type }),
      el('div', { class: 'post-body' },
        el('p', { class: 'post-date', text: new Date(p.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) }),
        p.caption ? el('p', { class: 'post-cap', text: p.caption }) : null,
        el('div', { class: 'post-stats' },
          el('div', null, el('b', { text: fInt(p.reach) }), el('span', { text: 'Alcance' })),
          el('div', null, el('b', { text: fInt(p.views) }), el('span', { text: 'Views' })),
          el('div', null, el('b', { class: 'p', text: fInt(p.follows) }), el('span', { text: 'Seguidores' })))));
    return root;
  }

  function renderInstagram() {
    const b = bounds();
    const S = (k) => ({ cur: igSlice(k, b.from, b.to), prev: igSlice(k, b.pFrom, b.pTo) });
    const reach = S('reach'), views = S('views'), inter = S('interactions'), pv = S('profile_views'), nf = S('new_followers');
    const tot = (x) => ({ cur: sum(x.cur), prev: sum(x.prev) });

    renderKpis($('#ig-kpis'), [
      { label: 'Visualizações', sub: 'conteúdo visualizado', icon: 'eye', fmt: fInt, ...tot(views) },
      { label: 'Seguidores', sub: 'variação líquida no período', icon: 'user-plus', fmt: fInt, ...tot(nf) },
      { label: 'Interações', sub: 'curtidas, comentários, envios e salvamentos', icon: 'heart', fmt: fInt, ...tot(inter) },
      { label: 'Contas Alcançadas', sub: 'perfis únicos que viram o conteúdo', icon: 'radar', fmt: fInt, ...tot(reach) },
      { label: 'Visitas ao Perfil', sub: 'visitas diretas no perfil', icon: 'circle-user', fmt: fInt, ...tot(pv) },
    ]);

    const posts = $('#ig-posts');
    posts.textContent = '';
    const latest = IG.posts.slice(-10).reverse();
    if (!latest.length) posts.append(el('div', { class: 'sub', text: 'Nenhum conteúdo encontrado' }));
    latest.forEach((p) => posts.append(postCard(p)));

    const dates = D.days.slice(b.from, b.to);
    timeChart($('#c-reach'), { dates, values: reach.cur, type: 'line', color: 'var(--s1)', yFmt: fAxis, tipFmt: fInt, label: 'Alcance',
      aria: `Alcance diário. Média no período: ${fInt(sum(reach.cur) / state.range)} contas por dia.` });
    timeChart($('#c-follow'), { dates, values: nf.cur, type: 'bar', color: 'var(--s3)', yFmt: fAxis, tipFmt: fInt, label: 'Novos seguidores',
      aria: `Novos seguidores por dia. Total no período: ${fInt(sum(nf.cur))}.` });

    const idx = Array.from({ length: dates.length }, (_, i) => dates.length - 1 - i);
    fillTable($('#t-ig-daily'), [
      { label: 'Data', txt: true, cell: (i) => dLong(dates[i]) },
      { label: 'Alcance', cell: (i) => fInt(reach.cur[i]) },
      { label: 'Visualizações', cell: (i) => fInt(views.cur[i]) },
      { label: 'Interações', cell: (i) => fInt(inter.cur[i]) },
      { label: 'Visitas ao perfil', cell: (i) => fInt(pv.cur[i]) },
      { label: 'Novos seguidores', cell: (i) => fInt(nf.cur[i]) },
    ], idx);
  }

  // ======================================================================
  //                       CASCA: ROTAS, FILTRO, TEMA
  // ======================================================================
  const PAGES = ['meta', 'instagram'];

  function render() {
    const b = bounds();
    $('#range-label').textContent = `${dm(D.days[b.from])} a ${dm(D.days[N - 1])} · vs. ${dm(D.days[b.pFrom])} a ${dm(D.days[b.pTo - 1])}`;
    hideTip();
    if (state.tab === 'meta') renderMeta(); else renderInstagram();
  }

  function applyRoute() {
    const h = location.hash.replace('#', '');
    state.tab = PAGES.includes(h) ? h : 'meta';
    PAGES.forEach((pg) => {
      $('#page-' + pg).hidden = pg !== state.tab;
      const a = $('#nav-' + pg);
      if (pg === state.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = (state.tab === 'meta' ? 'Meta Ads' : 'Instagram') + ' · DallTech Dashboard';
    $('#content').scrollTop = 0;
    render();
  }
  window.addEventListener('hashchange', applyRoute);

  document.querySelectorAll('#range-seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.range = Number(btn.dataset.range);
      document.querySelectorAll('#range-seg button').forEach((x) => x.setAttribute('aria-pressed', x === btn));
      const charts = document.querySelectorAll('.chart');
      charts.forEach((c) => c.classList.add('loading'));
      requestAnimationFrame(() => { render(); charts.forEach((c) => c.classList.remove('loading')); });
    });
  });

  // tema (escuro por padrão, como no modelo)
  const currentTheme = () => document.documentElement.dataset.theme || 'dark';
  function paintThemeBtn() { $('#theme-label').textContent = currentTheme() === 'dark' ? '☀ Claro' : '☾ Escuro'; }
  $('#theme-btn').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('dalltech-theme', next); } catch (e) { /* sem persistência */ }
    paintThemeBtn();
  });
  paintThemeBtn();

  // banner / rodapé
  $('#banner-acc').textContent = D.account.adAccount;
  $('#sample-banner').hidden = !D.sample;
  $('#foot-note').textContent = D.sample
    ? 'Dados fictícios gerados em data.js apenas para demonstrar o layout.'
    : `Fontes: Meta Ads (${D.account.adAccount}) e Instagram ${IG.handle}.`;

  // redesenha os gráficos quando a largura muda
  let lastW = window.innerWidth, timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; render(); } }, 120);
  });
  document.addEventListener('scroll', hideTip, { capture: true, passive: true });

  applyRoute();
})();
