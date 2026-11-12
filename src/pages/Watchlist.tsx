import { useState } from 'react';
import { BANDS, P3, PILLARS, bandIx, coScore } from '../lib/model';
import { useStore } from '../state/store';
import { BC, Empty, Icon, LogoTile, PageHead, Select, SevPill, cssVars } from '../components/ui';

export default function Watchlist() {
  const { db, open, removeCompany, justAdded } = useStore();
  const [q, setQ] = useState(''), [industry, setIndustry] = useState(''), [risk, setRisk] = useState('');
  const [leaving, setLeaving] = useState<string | null>(null);
  const ql = q.trim().toLowerCase();
  const list = db.cos.filter(c => (!ql || c.name.toLowerCase().includes(ql) || c.ticker.toLowerCase().includes(ql)) && (!industry || c.industry === industry) && (!risk || BANDS[bandIx(coScore(db, c.id))] === risk));
  const remove = (id: string) => { setLeaving(id); setTimeout(() => { removeCompany(id); setLeaving(null); }, 260); };
  const clear = () => { setQ(''); setIndustry(''); setRisk(''); };
  return (
    <>
      <PageHead title="Company Watchlist" sub="Companies you monitor. Open a card for the full profile."><button className="btn pri" onClick={() => open({ kind: 'add' })}><Icon n="plus" />Add company</button></PageHead>
      <div className="toolbar">
        <input className="inp" id="wq" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or ticker" aria-label="Search watchlist" />
        <Select id="wi" value={industry} onChange={setIndustry} options={[...new Set(db.cos.map(c => c.industry))].sort()} all="All industries" />
        <Select id="wr" value={risk} onChange={setRisk} options={BANDS} all="All risk levels" />
        <span className="spacer" /><span className="dim" style={{ fontSize: 12.5 }}>{list.length} of {db.cos.length}</span>
      </div>
      {list.length ? (
        <div className="cos">
          {list.map(c => {
            const s = coScore(db, c.id), b = bandIx(s);
            return (
              <div key={c.id} className={`card co hov${justAdded === c.id ? ' in' : ''}${leaving === c.id ? ' out' : ''}`} tabIndex={0} role="button" aria-label={`Open ${c.name} profile`} onClick={() => open({ kind: 'company', id: c.id })} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) open({ kind: 'company', id: c.id }); }}>
                <div className="cohead"><LogoTile c={c} /><div><b>{c.name}</b><span className="dim" style={{ fontSize: 12 }}><span className="mono">{c.ticker}</span> · {c.industry}</span></div><div className="ring" style={cssVars({ '--p': s, '--c': BC[b] })} title="Overall risk score"><span>{s}</span></div></div>
                <div className="esg">{P3.map(p => <div key={p}><b>{coScore(db, c.id, p)}</b>{PILLARS[p].name}</div>)}</div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <SevPill s={s} label={`${BANDS[b]} risk`} />
                  <span className="row" style={{ gap: 4 }}><span className="dim" style={{ fontSize: 12 }}>{db.byCo[c.id].flatMap(i => i.stories).length} stories</span><button className="iconbtn" data-remove title={`Remove ${c.name} from watchlist`} aria-label={`Remove ${c.name}`} onClick={e => { e.stopPropagation(); remove(c.id); }}><Icon n="trash" /></button></span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">{db.cos.length ? <Empty title="No companies match" text="Change the search or filters."><button className="btn" onClick={clear}>Clear filters</button></Empty> : <Empty title="Your watchlist is empty" text="Add a company to start its intelligence feed."><button className="btn pri" onClick={() => open({ kind: 'add' })}><Icon n="plus" />Add company</button></Empty>}</div>
      )}
    </>
  );
}
