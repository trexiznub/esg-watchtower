import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Incident } from '../lib/types';
import { BANDS, DAY, P3, PILLARS, TODAY, activeIncs, bandIx, coScore, exposure, fmtD, needsReview, portScore } from '../lib/model';
import { trendSeries } from '../lib/analytics';
import { niceMax } from '../lib/svgCharts';
import { useStore } from '../state/store';
import { BC, Card, CountUp, DemoBar, Empty, HBars, Icon, Legend, LineChart, PC, PageHead, PillarChip, PillarLegend, Seg, SevPill, SrcChip, cssVars } from '../components/ui';
import { IncLine } from '../components/Overlays';

/** Table row used by the Controversy Tracker. */
export function IncidentRow({ i }: { i: Incident }) {
  const { open, patchIncident } = useStore();
  const go = () => open({ kind: 'incident', id: i.id });
  return (
    <tr tabIndex={0} onClick={go} onKeyDown={e => { if (e.key === 'Enter') go(); }}>
      <td className="nw">{i.co.name}</td>
      <td className="hl">{i.cur.headline} <SrcChip src={i.src} classifier={i.cur.classifier} /></td>
      <td className="nw"><PillarChip p={i.pillar} mini /></td>
      <td className="nw"><SevPill s={i.sev} /></td>
      <td className="nw">{fmtD(i.detected)}</td>
      <td className="nw">{i.res}</td>
      <td className="nw"><button className={`btn sm ${i.reviewed ? 'ghost' : ''}`} data-review onClick={e => { e.stopPropagation(); patchIncident(i.id, { reviewed: !i.reviewed }, i.reviewed ? 'Review mark removed' : 'Marked as reviewed'); }}>{i.reviewed ? <><Icon n="check" />Reviewed</> : 'Mark reviewed'}</button></td>
    </tr>
  );
}

export default function Overview() {
  const { db, open } = useStore();
  const [range, setRange] = useState<number>(90);
  const [split, setSplit] = useState(false);
  const act = activeIncs(db), tr = trendSeries(db, range), todo = needsReview(db);
  const score = portScore(db), d30 = score - portScore(db, null, TODAY - 30 * DAY), b = bandIx(score);
  const rank = db.cos.map(c => {
    const incs = db.byCo[c.id], s = coScore(db, c.id), ex = P3.map(p => exposure(incs, TODAY, p)), t = ex[0] + ex[1] + ex[2] || 1;
    return { label: c.name, value: s, onClick: () => open({ kind: 'company', id: c.id }), segs: P3.map((p, j) => ({ name: PILLARS[p].name + ' share', color: PC[p], value: Math.round((s * ex[j]) / t) })), tipExtra: `Overall risk score: <b>${s}</b>` };
  }).sort((a, c) => c.value - a.value);
  const top = (todo.length ? todo : [...act].sort((a, c) => c.sev - a.sev)).slice(0, 5);
  const crit = act.filter(i => i.sev >= 80).length;
  const headline = !act.length ? 'Nothing active right now.' : todo.length ? `${todo.length} incident${todo.length === 1 ? ' needs' : 's need'} your review${crit ? `, ${crit} of them critical` : ''}.` : 'You are up to date. No high-severity incident is waiting for review.';
  const series = split
    ? [{ name: 'Overall', color: 'var(--ink)', values: tr.o }, { name: 'Environmental', color: PC.E, values: tr.e }, { name: 'Social', color: PC.S, values: tr.s }, { name: 'Governance', color: PC.G, values: tr.g }]
    : [{ name: 'Overall', color: 'var(--ink)', values: tr.o }];

  return (
    <>
      <PageHead title="Overview" sub={headline}>
        <Link className="btn" to="/digest"><Icon n="file" />Weekly digest</Link>
        <Link className="btn pri" to="/tracker"><Icon n="alert" />Open tracker</Link>
      </PageHead>
      <DemoBar />
      {!db.cos.length ? <div className="card"><Empty title="Your watchlist is empty" text="Add companies to start monitoring."><button className="btn pri" onClick={() => open({ kind: 'add' })}><Icon n="plus" />Add company</button></Empty></div> : (
        <>
          <div className="kpis">
            <div className="card kpi hov"><div className="k">Companies monitored</div><div className="v"><CountUp to={db.cos.length} /></div><div className="d">{db.stories.length} news reports analysed</div></div>
            <div className="card kpi hov"><div className="k">Active controversies</div><div className="v"><CountUp to={act.length} /></div><div className="d">{db.incs.length - act.length} resolved</div></div>
            <div className="card kpi hov"><div className="k"><i style={cssVars({ '--c': 'var(--b4)' })} />Critical incidents</div><div className="v"><CountUp to={crit} /></div><div className="d">{act.filter(i => i.sev >= 60 && i.sev < 80).length} more rated high</div></div>
            <div className="card kpi hov"><div className="k"><i style={cssVars({ '--c': BC[b] })} />Portfolio risk score</div><div className="v"><CountUp to={score} /><small> / 100</small></div><div className="d">{BANDS[b]} · {d30 >= 0 ? '+' : ''}{d30} in 30 days</div></div>
          </div>
          <div className="grid g21">
            <Card title="Risk trend" sub="Average risk score across your watchlist. Higher means more exposure." right={<div className="row"><button className={`btn sm ${split ? 'pri' : ''}`} id="split" onClick={() => setSplit(s => !s)}>E / S / G</button><Seg<number> label="Trend range" value={range} onChange={v => setRange(v)} options={[[30, '30d'], [60, '60d'], [90, '90d']]} /></div>}>
              <LineChart key={`${range}${split}`} labels={tr.labels} area yMax={Math.max(40, niceMax(Math.max(...series.flatMap(s => s.values))))} label="Risk trend" series={series} />
              {split && <div style={{ marginTop: 10 }}><Legend items={series.map(s => ({ name: s.name, color: s.color }))} /></div>}
            </Card>
            <Card title="By pillar" sub="Score and active incidents">
              <div className="stack" style={{ gap: 18 }}>
                {P3.map(p => { const v = portScore(db, p), n = act.filter(i => i.pillar === p).length; return (
                  <div key={p}><div className="row" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 8 }}><PillarChip p={p} mini />{PILLARS[p].name}</span><span className="mono">{v}</span></div><div className="meter"><i style={cssVars({ '--c': PC[p], '--w': v + '%' })} /></div><div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{n} active incident{n === 1 ? '' : 's'}</div></div>
                ); })}
              </div>
            </Card>
          </div>
          <div className="grid g2" style={{ marginTop: 20 }}>
            <Card title={todo.length ? 'Needs your attention' : 'Highest severity right now'} sub={todo.length ? 'High and critical incidents you have not reviewed' : 'The most severe active incidents'} right={<Link className="btn sm" to="/tracker">View all <Icon n="arrow" /></Link>}>
              {top.length ? <div className="news">{top.map(i => <IncLine key={i.id} i={i} />)}</div> : <Empty title="All clear" text="No active incidents." />}
            </Card>
            <Card title="Companies by risk" sub="Select a company to open its profile">
              <HBars rows={rank} max={100} /><div style={{ marginTop: 12 }}><PillarLegend /></div>
            </Card>
          </div>
          <p className="dim" style={{ fontSize: 12.5, marginTop: 16 }}>More charts, including severity breakdown and weekly activity, are in <Link to="/analytics">Analytics &amp; Reports</Link>.</p>
        </>
      )}
    </>
  );
}
