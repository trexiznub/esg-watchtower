/* Dependency-free SVG chart builders. Each returns an SVG string; every mark carries a data-tip
   tooltip that the <Tooltip> component displays. Colours come from the theme's CSS variables. */
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export const niceMax = (v: number) => { if (v <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const dot = (c: string) => `<i style="background:${c}"></i>`;

export interface Series { name: string; short?: string; color: string; values: number[]; }
export interface LineOpts { labels: string[]; series: Series[]; w?: number; h?: number; yMax?: number; area?: boolean; endLabels?: boolean; label?: string; }
export function lineSvg(o: LineOpts) {
  const W = o.w ?? 640, H = o.h ?? 230, m = { l: 30, r: o.endLabels ? 46 : 10, t: 10, b: 22 };
  const n = o.labels.length, max = o.yMax ?? niceMax(Math.max(1, ...o.series.flatMap(s => s.values)));
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = (i: number) => m.l + (n > 1 ? (iw * i) / (n - 1) : iw / 2), y = (v: number) => m.t + ih * (1 - v / max);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = (max * k) / 4; g += `<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
  const ticks = Math.min(6, n);
  for (let k = 0; k < ticks; k++) { const i = Math.round(((n - 1) * k) / Math.max(1, ticks - 1)); g += `<text x="${x(i)}" y="${H - 4}" text-anchor="${k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle'}">${esc(o.labels[i])}</text>`; }
  let paths = '';
  o.series.forEach((s, si) => {
    const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    if (o.area && si === 0) paths += `<path class="area" d="${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="${s.color}" fill-opacity=".09"/>`;
    paths += `<path class="ln" pathLength="1" d="${d}" stroke="${s.color}"/>`;
    const lv = s.values[n - 1];
    paths += `<circle cx="${x(n - 1)}" cy="${y(lv)}" r="3.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    if (o.endLabels) paths += `<text x="${x(n - 1) + 8}" y="${y(lv) + 4}" style="fill:var(--ink2)">${esc(s.short ?? s.name)} ${lv}</text>`;
  });
  let cols = ''; const cw = n > 1 ? iw / (n - 1) : iw;
  for (let i = 0; i < n; i++) {
    const tip = `<b>${esc(o.labels[i])}</b><br>` + o.series.map(s => `${dot(s.color)}${esc(s.name)}: <b>${s.values[i]}</b>`).join('<br>');
    cols += `<g class="col" data-tip="${esc(tip)}"><rect x="${x(i) - cw / 2}" y="${m.t}" width="${cw}" height="${ih}" fill="transparent"/><line class="hl" x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${m.t + ih}" stroke="var(--line2)"/>${o.series.map(s => `<circle class="hl" cx="${x(i)}" cy="${y(s.values[i])}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join('')}</g>`;
  }
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label ?? 'Line chart')}">${g}${paths}${cols}</svg>`;
}

export interface DonutOpts { parts: { name: string; color: string; value: number; extra?: string }[]; big: string | number; small: string; unit?: string; label?: string; }
export function donutSvg(o: DonutOpts) {
  const total = o.parts.reduce((s, p) => s + p.value, 0), R = 62, C = 2 * Math.PI * R;
  let off = 0, arcs = '';
  if (!total) arcs = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--surface2)" stroke-width="20"/>`;
  const live = o.parts.filter(q => q.value).length;
  o.parts.forEach(p => {
    if (!p.value) return;
    const len = (C * p.value) / total, gap = live > 1 ? 3 : 0;
    const tip = `${dot(p.color)}<b>${esc(p.name)}</b><br>${p.value} ${esc(o.unit ?? '')} · ${Math.round((100 * p.value) / total)}%${p.extra ? '<br>' + esc(p.extra) : ''}`;
    arcs += `<circle class="arc" data-tip="${esc(tip)}" cx="90" cy="90" r="${R}" fill="none" stroke="${p.color}" stroke-width="20" stroke-dasharray="${Math.max(0, len - gap)} ${C - len + gap}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"/>`;
    off += len;
  });
  return `<svg class="ch" viewBox="0 0 180 180" style="max-width:190px" role="img" aria-label="${esc(o.label ?? 'Donut chart')}">${arcs}<text x="90" y="88" text-anchor="middle" style="font:600 28px var(--display);fill:var(--ink)">${esc(o.big)}</text><text x="90" y="106" text-anchor="middle">${esc(o.small)}</text></svg>`;
}

export interface StackOpts { labels: string[]; tipLabels?: string[]; stacks: { name: string; color: string; values: number[] }[]; w?: number; h?: number; yMax?: number; label?: string; }
export function stackedSvg(o: StackOpts) {
  const W = o.w ?? 640, H = o.h ?? 230, m = { l: 30, r: 10, t: 10, b: 22 };
  const n = o.labels.length, totals = o.labels.map((_, i) => o.stacks.reduce((s, st) => s + st.values[i], 0));
  const max = o.yMax ?? niceMax(Math.max(1, ...totals)), iw = W - m.l - m.r, ih = H - m.t - m.b;
  const bw = Math.min(46, (iw / n) * 0.62), xc = (i: number) => m.l + (iw * (i + 0.5)) / n, y = (v: number) => m.t + ih * (1 - v / max);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = (max * k) / 4; g += `<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`; }
  const step = Math.ceil(n / 8);
  let bars = '';
  for (let i = 0; i < n; i++) {
    if (i % step === 0 || n <= 8) g += `<text x="${xc(i)}" y="${H - 4}" text-anchor="middle">${esc(o.labels[i])}</text>`;
    const tl = esc(o.tipLabels ? o.tipLabels[i] : o.labels[i]);
    const tip = totals[i] ? `<b>${tl}</b><br>` + o.stacks.filter(st => st.values[i]).map(st => `${dot(st.color)}${esc(st.name)}: <b>${st.values[i]}</b>`).join('<br>') + (o.stacks.length > 1 ? `<br>Total: <b>${totals[i]}</b>` : '') : `<b>${tl}</b><br>None`;
    let acc = 0, segs = '';
    o.stacks.forEach(st => { const v = st.values[i]; if (!v) return; const y1 = y(acc + v), h = y(acc) - y1; segs += `<rect x="${xc(i) - bw / 2}" y="${y1 + 1}" width="${bw}" height="${Math.max(1, h - 2)}" rx="3" fill="${st.color}"/>`; acc += v; });
    bars += `<g class="col" data-tip="${esc(tip)}"><rect x="${xc(i) - iw / n / 2}" y="${m.t}" width="${iw / n}" height="${ih}" fill="transparent"/><rect class="hl" x="${xc(i) - iw / n / 2 + 2}" y="${m.t}" width="${iw / n - 4}" height="${ih}" rx="6" fill="var(--surface2)"/><g class="bar" style="animation-delay:${i * 25}ms">${segs}</g></g>`;
  }
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label ?? 'Bar chart')}">${g}${bars}</svg>`;
}
export const tipHtml = (title: string, rows: { name: string; color: string; value: number | string }[], extra = '') =>
  `<b>${esc(title)}</b><br>` + rows.map(s => `${dot(s.color)}${esc(s.name)}: <b>${esc(s.value)}</b>`).join('<br>') + (extra ? '<br>' + extra : '');
