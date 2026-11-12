/* Shared presentational components. */
import { memo, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Company, Pillar, Source, Stage, Story } from '../lib/types';
import { BANDS, FACTORS, PILLARS, STAGES, bandIx, initials } from '../lib/model';
import { donutSvg, lineSvg, stackedSvg, tipHtml } from '../lib/svgCharts';
import type { DonutOpts, LineOpts, StackOpts } from '../lib/svgCharts';
import { useStore } from '../state/store';

export const PC: Record<Pillar, string> = { E: 'var(--E)', S: 'var(--S)', G: 'var(--G)' };
export const BC = ['var(--b0)', 'var(--b1)', 'var(--b2)', 'var(--b3)', 'var(--b4)'];
const v = (o: Record<string, string | number>) => o as unknown as CSSProperties;

const ICON: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4"/>',
  news: '<path d="M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/>',
  alert: '<path d="M12 3l9.5 17h-19zM12 10v4M12 17.2v.3"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.200-8-4.500-8-9V6z"/>'
};
/* Memoised so a parent re-render never rewrites the SVG's inner markup while a click on it is still bubbling. */
export const Icon = memo(function Icon({ n }: { n: string }) {
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON[n] ?? '' }} />;
});
export const Logo = ({ size = 30 }: { size?: number }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
    <path d="M16 2.5l11 4v8.2c0 6.600-4.400 11.600-11 14.800C9.400 26.300 5 21.300 5 14.700V6.500z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M8.500 15.500c2-3.200 4.600-4.800 7.500-4.800s5.500 1.600 7.500 4.800c-2 3.200-4.600 4.800-7.500 4.800s-5.500-1.600-7.500-4.800z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="16" cy="15.500" r="2.300" fill="currentColor" />
    <path d="M19.500 7.800a6 6 0 0 1 3.200 2.600" stroke="var(--E)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const PillarChip = ({ p, mini }: { p: Pillar; mini?: boolean }) => <span className={`chip p-${p}`} title={PILLARS[p].name}><i />{mini ? p : `${p} · ${PILLARS[p].name}`}</span>;
export const SevPill = ({ s, label }: { s: number; label?: string }) => { const b = bandIx(s); return <span className={`sev b${b}`}><i />{label ?? <><b>{s}</b>{BANDS[b]}</>}</span>; };
export const StageChip = ({ st }: { st: Stage }) => <span className="chip" title={STAGES[st].desc}>{STAGES[st].label}</span>;
export function SrcChip({ src, classifier }: { src: Source; classifier?: 'llm' | 'rules' }) {
  if (src === 'live') return <span className="chip live" title="Returned by the connected backend">Live</span>;
  if (src === 'user') return <span className="chip user" title={classifier === 'rules' ? 'Submitted by you and classified by keyword rules in demo mode' : 'Submitted by you and classified by the AI service'}>{classifier === 'rules' ? 'Rule classified' : 'AI analysed'}</span>;
  return <span className="chip demo" title="Synthetic record generated for demonstration. Not a real event.">Demo</span>;
}
export const LogoTile = ({ c, lg }: { c: Company; lg?: boolean }) => <span className={`logo${lg ? ' lg' : ''}`} aria-hidden="true">{initials(c.name)}</span>;

export function Select({ id, value, onChange, options, all }: { id: string; value: string; onChange(v: string): void; options: (string | [string, string])[]; all: string }) {
  return (
    <select className="sel" id={id} aria-label={all} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{all}</option>
      {options.map(o => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
    </select>
  );
}
export const Empty = ({ title, text, children }: { title: string; text: string; children?: ReactNode }) => (
  <div className="empty"><Icon n="inbox" /><b>{title}</b>{text}{children && <div style={{ marginTop: 12 }}>{children}</div>}</div>
);
export function Pager({ total, page, per, onPage }: { total: number; page: number; per: number; onPage(p: number): void }) {
  const pages = Math.max(1, Math.ceil(total / per));
  return (
    <div className="pager">
      <span>{total ? `${(page - 1) * per + 1}–${Math.min(total, page * per)} of ${total}` : '0 results'}</span>
      <span className="row">
        <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="mono">{page} / {pages}</span>
        <button className="btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    </div>
  );
}
/** Score breakdown: every factor, its weight and its contribution, then the stage multiplier. */
export function FactorRows({ st }: { st: Story }) {
  const raw = FACTORS.reduce((s, [k, , w]) => s + w * st.factors[k], 0);
  return (
    <>
      <div className="fx">
        {FACTORS.map(([k, l, w]) => [
          <span key={k + 'l'}>{l} <span className="dim">×{w.toFixed(2)}</span></span>,
          <span key={k + 't'} className="t"><i style={v({ '--w': st.factors[k] + '%' })} /></span>,
          <span key={k + 'v'} className="mono">{st.factors[k]}</span>,
          <span key={k + 'c'} className="mono dim">+{(w * st.factors[k]).toFixed(1)}</span>
        ])}
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
        Weighted sum <b className="mono">{raw.toFixed(1)}</b> × stage multiplier <b className="mono">{STAGES[st.stage].mult}</b> ({STAGES[st.stage].label.toLowerCase()}) = severity <b className="mono">{st.severity}</b>, {BANDS[bandIx(st.severity)]}. {STAGES[st.stage].desc}
      </p>
    </>
  );
}
export function DemoBar() {
  const { mode, db, loading } = useStore();
  if (mode === 'live') return <div className="demobar live"><Icon n="check" /><span><b>Live data</b> from your backend.{!loading && !db.stories.length ? ' No articles have been collected yet; the collector runs hourly.' : ''}</span></div>;
  return <div className="demobar"><Icon n="alert" /><span><b>Demo mode.</b> These are sample scenarios, not real events.</span></div>;
}
export const PageHead = ({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) => (
  <div className="ph"><div><h1>{title}</h1><p>{sub}</p></div><div className="acts">{children}</div></div>
);
export const Card = ({ title, sub, right, children, style }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; style?: CSSProperties }) => (
  <div className="card" style={style}>
    {title && <div className="chead"><div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>{right}</div>}
    {children}
  </div>
);
export const Legend = ({ items }: { items: { name: string; color: string }[] }) => (
  <div className="legend">{items.map(i => <span key={i.name}><i style={v({ '--c': i.color })} />{i.name}</span>)}</div>
);
export const PillarLegend = () => <Legend items={(['E', 'S', 'G'] as Pillar[]).map(p => ({ name: PILLARS[p].name, color: PC[p] }))} />;
export const Seg = <T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange(v: T): void; label: string }) => (
  <div className="seg" role="group" aria-label={label}>{options.map(([val, l]) => <button key={String(val)} className={value === val ? 'on' : ''} onClick={() => onChange(val)}>{l}</button>)}</div>
);
export const Switch = ({ id, checked, onChange }: { id: string; checked: boolean; onChange(v: boolean): void }) => (
  <span className="switch"><input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} /><span /></span>
);

/** Number that counts up once when it mounts. Honours reduced motion. */
export function CountUp({ to }: { to: number }) {
  const { ws } = useStore();
  const [n, setN] = useState(to);
  const first = useRef(true);
  useEffect(() => {
    if (!first.current || !to || ws.prefs.rm || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); first.current = false; return; }
    first.current = false;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 700); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    setN(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return <span>{n}</span>;
}

/* ---- charts ---- */
const Svg = ({ html }: { html: string }) => <div className="tsvg" dangerouslySetInnerHTML={{ __html: html }} />;
export const LineChart = (p: LineOpts) => <Svg html={lineSvg(p)} />;
export const Donut = (p: DonutOpts) => <Svg html={donutSvg(p)} />;
export const StackedBars = (p: StackOpts) => <Svg html={stackedSvg(p)} />;
export interface HRow { label: string; segs: { name: string; color: string; value: number }[]; value?: number; tipExtra?: string; onClick?(): void; }
export function HBars({ rows, max }: { rows: HRow[]; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map(r => r.segs.reduce((s, x) => s + x.value, 0)));
  return (
    <div className="hb">
      {rows.map(r => {
        const inner = <><span className="n">{r.label}</span><span className="t">{r.segs.map(s => (s.value ? <i key={s.name} style={v({ '--c': s.color, '--w': (100 * s.value) / m + '%' })} /> : null))}</span><span className="val">{r.value ?? r.segs.reduce((s, x) => s + x.value, 0)}</span></>;
        const tip = tipHtml(r.label, r.segs, r.tipExtra);
        return r.onClick ? <button key={r.label} className="r" data-tip={tip} onClick={r.onClick}>{inner}</button> : <div key={r.label} className="r" data-tip={tip}>{inner}</div>;
      })}
    </div>
  );
}
/** One floating tooltip for every element that carries data-tip. */
export function Tooltip() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cur: Element | null = null;
    const move = (e: MouseEvent) => {
      const tip = ref.current; if (!tip) return;
      const el = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
      if (!el) { tip.classList.remove('on'); cur = null; return; }
      if (cur !== el) { tip.innerHTML = el.getAttribute('data-tip') ?? ''; cur = el; }
      tip.classList.add('on'); const r = tip.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - r.width - 8)) + 'px';
      tip.style.top = Math.max(8, e.clientY + 14 + r.height > window.innerHeight ? e.clientY - r.height - 10 : e.clientY + 14) + 'px';
    };
    document.addEventListener('mousemove', move);
    return () => document.removeEventListener('mousemove', move);
  }, []);
  return <div id="tip" role="tooltip" ref={ref} />;
}
export const cssVars = v;
