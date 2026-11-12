import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Incident, Pillar } from '../lib/types';
import { BANDS, BAND_RANGES, DAY, P3, PILLARS, TODAY, activeIncs, bandIx, coScore, exposure, fmtD, portScore } from '../lib/model';
import { trendSeries, weeks } from '../lib/analytics';
import { niceMax } from '../lib/svgCharts';
import { useStore } from '../state/store';
import { BC, Card, CountUp, DemoBar, Donut, Empty, HBars, Icon, Legend, LineChart, PC, PageHead, PillarChip, PillarLegend, Seg, SevPill, SrcChip, StackedBars, cssVars } from '../components/ui';

export function IncidentRow({ i, full }: { i: Incident; full?: boolean }) {
  const { open, patchIncident } = useStore();
  const go = () => open({ kind: 'incident', id: i.id });
  return (
    <tr tabIndex={0} onClick={go} onKeyDown={e => { if (e.key === 'Enter') go(); }}>
      {full && <td className="nw mono">{i.id}</td>}
      <td className="nw">{i.co.name}</td>
      <td className="hl">{i.cur.headline} <SrcChip src={i.src} classifier={i.cur.classifier} /></td>
      <td className="nw"><PillarChip p={i.pillar} mini /></td>
      <td className="nw"><SevPill s={i.sev} /></td>
      <td className="nw">{fmtD(i.detected)}</td>
      {full && <><td className="nw muted">{i.cur.publisher}</td><td className="nw">{i.inv}</td></>}
      <td className="nw">{i.res}</td>
      {full && <td className="nw"><button className={`btn sm ${i.reviewed ? 'ghost' : ''}`} data-review onClick={e => { e.stopPropagation(); patchIncident(i.id, { reviewed: !i.reviewed }, i.reviewed ? 'Review mark removed' : 'Marked as reviewed'); }}>{i.reviewed ? <><Icon n="check" />Reviewed</> : 'Mark reviewed'}</button></td>}
    </tr>
  );
}

function Kpi({ k, value, d, c, meter }: { k: string; value: number; d: string; c?: string; meter?: boolean }) {
  return (
    <div className="card kpi hov">
      <div className="k">{c && <i style={cssVars({ '--c': c })} />}{k}</div>
      <div className="v"><CountUp to={value} />{meter && <small> / 100</small>}</div>
      <div className="d">{d}</div>
      {meter && c && <div className="meter"><i style={cssVars({ '--c': c, '--w': value + '%' })} /></div>}
    </div>
  );
}

export default function Overview() {
  const { db, open } = useStore();
  const [range, setRange] = useState<number>(90);
  const [tl, setTl] = useState<'all' | Pillar>('all');
  const act = activeIncs(db), tr = trendSeries(db, range), wk = weeks();
  const pc = (p: Pillar) => act.filter(i => i.pillar === p).length;
  const d30 = portScore(db) - portScore(db, null, TODAY - 30 * DAY);
  const rank = db.cos.map(c => {
    const incs = db.byCo[c.id], s = coScore(db, c.id), ex = P3.map(p => exposure(incs, TODAY, p)), t = ex[0] + ex[1] + ex[2] || 1;
    return { label: c.name, value: s, onClick: () => open({ kind: 'company', id: c.id }), segs: P3.map((p, j) => ({ name: PILLARS[p].name + ' share', color: PC[p], value: Math.round((s * ex[j]) / t) })), tipExtra: `Overall risk score: <b>${s}</b>` };
  }).sort((a, b) => b.value - a.value);
  const recent = [...db.incs].sort((a, b) => b.cur.date - a.cur.date).slice(0, 8);
  const plural = (n: number) => `${n} active incident${n === 1 ? '' : 's'}`;

  return (
    <>
      <PageHead title="Overview" sub={`Portfolio view of ${db.cos.length} monitored companies. Scores run 0–100; higher means more exposure.`}>
        <Link className="btn" to="/digest"><Icon n="file" />Weekly digest</Link>
        <Link className="btn pri" to="/tracker"><Icon n="alert" />Open tracker</Link>
      </PageHead>
      <DemoBar />
      {!db.cos.length ? <div className="card"><Empty title="Your watchlist is empty" text="Add companies to start monitoring."><button className="btn pri" onClick={() => open({ kind: 'add' })}><Icon n="plus" />Add company</button></Empty></div> : (
        <>
          <div className="kpis">
            <Kpi k="Companies monitored" value={db.cos.length} d={`${new Set(db.cos.map(c => c.industry)).size} industries`} />
            <Kpi k="News articles analysed" value={db.stories.length} d={`${db.stories.filter(s => s.date > TODAY - 7 * DAY).length} in the last 7 days`} />
            <Kpi k="Active ESG controversies" value={act.length} d={`${db.incs.length - act.length} resolved`} />
            <Kpi k="Critical risk incidents" value={act.filter(i => i.sev >= 80).length} d={`${act.filter(i => i.sev >= 60 && i.sev < 80).length} more rated high`} c="var(--b4)" />
          </div>
          <div className="kpis three">{P3.map(p => <Kpi key={p} k={`${PILLARS[p].name} risk score`} value={portScore(db, p)} d={plural(pc(p))} c={PC[p]} meter />)}</div>
          <div className="grid g12">
            <Card title="ESG risk distribution" sub="Active controversies by pillar">
              <div className="row" style={{ justifyContent: 'center', gap: 20 }}>
                <Donut parts={P3.map(p => ({ name: PILLARS[p].name, color: PC[p], value: pc(p), extra: `Pillar score ${portScore(db, p)}` }))} big={act.length} small="active" unit="incidents" label="Active controversies by pillar" />
                <div className="stack" style={{ gap: 8 }}>{P3.map(p => <div key={p} className="row" style={{ gap: 8 }}><PillarChip p={p} mini /><span className="mono">{pc(p)}</span><span className="dim">{act.length ? Math.round((100 * pc(p)) / act.length) : 0}%</span></div>)}</div>
              </div>
            </Card>
            <Card title="ESG risk trend" sub={`Mean risk score across the watchlist · ${d30 >= 0 ? '+' : ''}${d30} vs 30 days ago`} right={<Seg<number> label="Trend range" value={range} onChange={v => setRange(v)} options={[[30, '30d'], [60, '60d'], [90, '90d']]} />}>
              <LineChart key={range} labels={tr.labels} area yMax={Math.max(40, niceMax(Math.max(...tr.o, ...tr.e, ...tr.s, ...tr.g)))} label="Risk trend"
                series={[{ name: 'Overall', color: 'var(--ink)', values: tr.o }, { name: 'Environmental', color: PC.E, values: tr.e }, { name: 'Social', color: PC.S, values: tr.s }, { name: 'Governance', color: PC.G, values: tr.g }]} />
              <div style={{ marginTop: 10 }}><Legend items={[{ name: 'Overall', color: 'var(--ink)' }, ...P3.map(p => ({ name: PILLARS[p].name, color: PC[p] }))]} /></div>
            </Card>
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            <Card title="Risk severity breakdown" sub="Active incidents per pillar, stacked by severity band">
              <StackedBars h={220} labels={P3.map(p => PILLARS[p].name)} label="Severity by pillar" stacks={BANDS.map((b, j) => ({ name: b, color: BC[j], values: P3.map(p => act.filter(i => i.pillar === p && bandIx(i.sev) === j).length) }))} />
              <div style={{ marginTop: 10 }}><Legend items={BANDS.map((b, j) => ({ name: `${b} ${BAND_RANGES[j]}`, color: BC[j] }))} /></div>
            </Card>
            <Card title="Company risk comparison" sub="Overall score, split by each pillar's share of exposure. Select a bar to open the profile.">
              <HBars rows={rank} max={100} /><div style={{ marginTop: 12 }}><PillarLegend /></div>
            </Card>
          </div>
          <Card style={{ marginTop: 16 }} title="News activity timeline" sub="ESG reports per week, last 13 weeks" right={<Seg<'all' | Pillar> label="Pillar filter" value={tl} onChange={v => setTl(v)} options={[['all', 'All'], ['E', 'E'], ['S', 'S'], ['G', 'G']]} />}>
            <StackedBars w={1000} h={200} labels={wk.map(w => fmtD(w.a + DAY))} tipLabels={wk.map(w => `Week of ${fmtD(w.a + DAY)}`)} label="Weekly activity"
              stacks={P3.filter(p => tl === 'all' || tl === p).map(p => ({ name: PILLARS[p].name, color: PC[p], values: wk.map(w => db.stories.filter(s => s.pillar === p && s.date > w.a && s.date <= w.b).length) }))} />
          </Card>
          <Card style={{ marginTop: 16 }} title="Recent controversies" sub="Latest activity first" right={<Link className="btn sm" to="/tracker">View all <Icon n="arrow" /></Link>}>
            <div className="tw"><table><thead><tr><th>Company</th><th>Headline</th><th>Category</th><th>Severity</th><th>Date</th><th>Status</th></tr></thead><tbody>{recent.map(i => <IncidentRow key={i.id} i={i} />)}</tbody></table></div>
          </Card>
        </>
      )}
    </>
  );
}
