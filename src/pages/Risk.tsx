import { useState } from 'react';
import { BANDS, P3, PILLARS, bandIx, coScore } from '../lib/model';
import { comparative, insights } from '../lib/analytics';
import type { Insight } from '../lib/analytics';
import { esc } from '../lib/svgCharts';
import { useStore } from '../state/store';
import { Card, DemoBar, Empty, PC, PageHead, PillarChip, Select, cssVars } from '../components/ui';

const TYPES = ['Emerging risk signal', 'Repeated pattern', 'Regulatory exposure', 'Reputation risk', 'Risk concentration', 'Easing risk'];

export function InsightCard({ i, withWhy }: { i: Insight; withWhy?: boolean }) {
  const { open } = useStore();
  return (
    <div className={`ins ${i.pillar ? 'p-' + i.pillar : ''}`}>
      {withWhy && <div className="row" style={{ gap: 8 }}><span className="chip">{i.type}</span>{i.pillar && <PillarChip p={i.pillar} mini />}<span className="dim" style={{ fontSize: 12 }}>{i.co.name}</span></div>}
      <h4>{withWhy ? i.title : `${i.co.name}: ${i.title}`}</h4><p>{i.text}</p>
      {withWhy && <details><summary>Why this was flagged</summary><div>{i.why}<div className="row" style={{ marginTop: 8, gap: 6 }}>{i.ev.slice(0, 6).map(e => <button key={e.id} className="linkish" onClick={() => open({ kind: 'incident', id: e.id })}>{e.id}</button>)}</div></div></details>}
    </div>
  );
}

export default function Risk() {
  const { db, open } = useStore();
  const [cid, setCid] = useState('');
  const [more, setMore] = useState(false);
  const cos = cid ? db.cos.filter(c => c.id === cid) : db.cos;
  const all = cos.flatMap(c => insights(db, c.id)), cmp = comparative(db);
  return (
    <>
      <PageHead title="ESG Risk Analysis" sub="What the reports add up to. Every signal shows the rule and evidence behind it."><Select id="rc" value={cid} onChange={setCid} options={db.cos.map(c => [c.id, c.name] as [string, string])} all="All companies" /></PageHead>
      <DemoBar />
      {!db.cos.length ? <div className="card"><Empty title="Nothing to analyse" text="Add companies to your watchlist first." /></div> : (
        <div className="grid g21">
          <Card title="Risk signals" sub="Patterns found across several reports, strongest first">
            {all.length ? <div className="stack soft" key={cid} style={{ gap: 20 }}>{[...all].sort((a, b) => b.w - a.w).slice(0, more ? all.length : 4).map((i, k) => <InsightCard key={k} i={i} withWhy />)}{all.length > 4 && <div><button className="btn sm" id="moresig" onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : `Show all ${all.length} signals`}</button></div>}</div> : <Empty title="No signals" text="No pattern rule matched for this selection." />}
          </Card>
          <div className="stack">
            <Card title="Risk heatmap" sub="Score by company and pillar">
              <div className="heat">
                <span />{['Overall', 'E', 'S', 'G'].map(h => <span key={h} className="h">{h}</span>)}
                {cmp.map(r => [
                  <button key={r.c.id} className="nm" onClick={() => open({ kind: 'company', id: r.c.id })}>{r.c.name}</button>,
                  ...[null, ...P3].map(p => { const v = coScore(db, r.c.id, p); return <span key={r.c.id + (p ?? 'o')} className="c" style={cssVars({ '--c': p ? PC[p] : 'var(--b3)', '--a': Math.round(v * 0.85) })} data-tip={`<b>${esc(r.c.name)}</b><br>${p ? PILLARS[p].name : 'Overall'} score: <b>${v}</b> · ${BANDS[bandIx(v)]}`}>{v}</span>; })
                ])}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
