import { BANDS, DAY, P3, PILLARS, RES_STATES, activeIncs, bandIx, coScore, fmtD, mean, portScore } from '../lib/model';
import type { Story } from '../lib/types';
import { trendSeries, weeks } from '../lib/analytics';
import { esc, niceMax } from '../lib/svgCharts';
import { exportArticles, exportIncidents, exportScores } from '../services/exporter';
import { useStore } from '../state/store';
import { BC, Card, DemoBar, Donut, Empty, HBars, Icon, Legend, LineChart, PC, PageHead, PillarLegend, StackedBars, cssVars } from '../components/ui';

export default function Analytics() {
  const { db, open, toast } = useStore();
  const tr = trendSeries(db, 90), wk = weeks(), act = activeIncs(db);
  const wl = wk.map(w => fmtD(w.a + DAY)), tl = wk.map(w => `Week of ${fmtD(w.a + DAY)}`);
  const inW = (w: { a: number; b: number }, fn: (s: Story) => boolean) => db.stories.filter(s => s.date > w.a && s.date <= w.b && fn(s)).length;
  const inds = [...new Set(db.cos.map(c => c.industry))].map(ind => { const cs = db.cos.filter(c => c.industry === ind), v = mean(cs.map(c => coScore(db, c.id))); return { label: ind, value: v, segs: [{ name: 'Mean risk score', color: 'var(--ink2)', value: v }], tipExtra: `${cs.length} compan${cs.length === 1 ? 'y' : 'ies'}: ${esc(cs.map(c => c.name).join(', '))}` }; }).sort((a, b) => b.value - a.value);
  const subs: Record<string, { p: 'E' | 'S' | 'G'; sub: string; n: number; ex: number }> = {};
  act.forEach(i => { const k = i.pillar + '|' + i.sub; subs[k] = subs[k] ?? { p: i.pillar, sub: i.sub, n: 0, ex: 0 }; subs[k].n++; subs[k].ex += i.sev; });
  const conc = Object.values(subs).sort((a, b) => b.ex - a.ex).slice(0, 8).map(s => ({ label: s.sub, value: s.n, segs: [{ name: `${PILLARS[s.p].name} · active incidents`, color: PC[s.p], value: s.n }], tipExtra: `Combined severity: <b>${s.ex}</b>` }));
  const resd = db.incs.length - act.length;
  const exp = (fn: () => void, what: string) => () => { fn(); toast(`${what} exported as CSV`); };
  return (
    <>
      <PageHead title="Analytics & Reports" sub="Cross-cutting views of the watchlist over the last 90 days, with dataset exports.">
        <button className="btn" onClick={exp(() => exportIncidents(db), 'Incidents')}><Icon n="down" />Incidents CSV</button>
        <button className="btn" onClick={exp(() => exportArticles(db), 'Articles')}><Icon n="down" />Articles CSV</button>
        <button className="btn" onClick={exp(() => exportScores(db), 'Scores')}><Icon n="down" />Scores CSV</button>
      </PageHead>
      <DemoBar />
      {!db.cos.length ? <div className="card"><Empty title="No data yet" text="Add companies to your watchlist first." /></div> : (
        <div className="grid g2">
          <Card title="ESG risk performance over time" sub="Mean pillar score across the watchlist, 90 days">
            <LineChart labels={tr.labels} endLabels yMax={Math.max(40, niceMax(Math.max(...tr.e, ...tr.s, ...tr.g)))} series={[{ name: 'Environmental', short: 'E', color: PC.E, values: tr.e }, { name: 'Social', short: 'S', color: PC.S, values: tr.s }, { name: 'Governance', short: 'G', color: PC.G, values: tr.g }]} />
            <div style={{ marginTop: 10 }}><PillarLegend /></div>
          </Card>
          <Card title="Company-wise ESG comparison" sub="Pillar scores side by side; the bar length is their sum">
            <HBars max={300} rows={db.cos.map(c => ({ label: c.name, onClick: () => open({ kind: 'company', id: c.id }), value: coScore(db, c.id), segs: P3.map(p => ({ name: PILLARS[p].name, color: PC[p], value: coScore(db, c.id, p) })), tipExtra: `Overall: <b>${coScore(db, c.id)}</b>` })).sort((a, b) => b.value - a.value)} />
            <div style={{ marginTop: 10 }}><PillarLegend /><p className="dim" style={{ fontSize: 12, marginTop: 6 }}>The number at the right is the overall score.</p></div>
          </Card>
          <Card title="Industry-wise risk distribution" sub="Mean overall score by industry"><HBars rows={inds} max={100} /></Card>
          <Card title="E / S / G category comparison" sub="Active incidents and pillar score">
            <div className="kpis three" style={{ margin: 0 }}>{P3.map(p => { const l = act.filter(i => i.pillar === p); return <div key={p} className="kpi" style={{ padding: 0 }}><div className="k"><i style={cssVars({ '--c': PC[p] })} />{PILLARS[p].name}</div><div className="v">{portScore(db, p)}</div><div className="d">{l.length} active · mean severity {mean(l.map(i => i.sev))}</div><div className="meter"><i style={cssVars({ '--c': PC[p], '--w': portScore(db, p) + '%' })} /></div></div>; })}</div>
          </Card>
          <Card title="Incident frequency" sub="Reports per week by pillar">
            <StackedBars labels={wl} tipLabels={tl} stacks={P3.map(p => ({ name: PILLARS[p].name, color: PC[p], values: wk.map(w => inW(w, s => s.pillar === p)) }))} /><div style={{ marginTop: 10 }}><PillarLegend /></div>
          </Card>
          <Card title="Severity trend" sub="Reports per week by severity band">
            <StackedBars labels={wl} tipLabels={tl} stacks={BANDS.map((b, j) => ({ name: b, color: BC[j], values: wk.map(w => inW(w, s => bandIx(s.severity) === j)) }))} /><div style={{ marginTop: 10 }}><Legend items={BANDS.map((b, j) => ({ name: b, color: BC[j] }))} /></div>
          </Card>
          <Card title="Risk concentration" sub="Subcategories with the most active incidents">{conc.length ? <HBars rows={conc} /> : <Empty title="No active incidents" text="" />}</Card>
          <Card title="Resolved versus unresolved" sub={`${db.incs.length} incidents on record`}>
            <div className="row" style={{ gap: 24, justifyContent: 'center' }}>
              <Donut unit="incidents" big={db.incs.length ? Math.round((100 * resd) / db.incs.length) + '%' : '0%'} small="resolved" parts={[{ name: 'Open', color: 'var(--b3)', value: db.incs.filter(i => i.res === 'Open').length }, { name: 'Mitigating', color: 'var(--b1)', value: db.incs.filter(i => i.res === 'Mitigating').length }, { name: 'Resolved', color: 'var(--b0)', value: resd }]} />
              <div className="stack" style={{ gap: 8, fontSize: 13 }}>{RES_STATES.map(r => <div key={r} className="row" style={{ justifyContent: 'space-between', gap: 24 }}><span>{r}</span><span className="mono">{db.incs.filter(i => i.res === r).length}</span></div>)}</div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
