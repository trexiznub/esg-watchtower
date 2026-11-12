import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Story } from '../lib/types';
import { BANDS, STAGES, bandIx, coById, fmtDY } from '../lib/model';
import { backendConfigured } from '../services/api';
import { useStore } from '../state/store';
import { DemoBar, Empty, Icon, PageHead, Pager, PillarChip, Select, SevPill, SrcChip, StageChip } from '../components/ui';

export function StoryItem({ s, brief }: { s: Story; brief?: boolean }) {
  const { open } = useStore();
  return (
    <button className="art" onClick={() => open({ kind: 'article', id: s.id })}>
      <h4>{s.headline}</h4><SevPill s={s.severity} />
      <div className="meta"><SrcChip src={s.src} classifier={s.classifier} /><span>{coById(s.companyId).name}</span>·{!brief && <><span>{s.publisher}</span>·</>}<span>{fmtDY(s.date)}</span><PillarChip p={s.pillar} mini />{!brief && <span className="chip">{s.sub}</span>}<StageChip st={s.stage} />{!brief && <span className="mono">AI confidence {s.confidence}%</span>}</div>
      {!brief && <p>{s.summary}</p>}
    </button>
  );
}

export default function News() {
  const { db, ws, mode, open } = useStore();
  const loc = useLocation();
  const preset = (loc.state as { company?: string } | null)?.company ?? '';
  const [f, setF] = useState({ q: '', company: preset, pillar: '', band: '', stage: '', page: 1 });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v, page: 1 });
  const per = 8, ql = f.q.trim().toLowerCase();
  const list = db.stories.filter(s => (!ql || s.headline.toLowerCase().includes(ql) || s.summary.toLowerCase().includes(ql) || s.sub.toLowerCase().includes(ql)) && (!f.company || s.companyId === f.company) && (!f.pillar || s.pillar === f.pillar) && (!f.band || BANDS[bandIx(s.severity)] === f.band) && (!f.stage || s.stage === f.stage));
  const page = Math.min(f.page, Math.max(1, Math.ceil(list.length / per)));
  return (
    <>
      <PageHead title="News Intelligence" sub="Every report is classified, staged and scored. Open one to see why it received its score."><button className="btn pri" onClick={() => open({ kind: 'analyse' })}><Icon n="spark" />Analyse an article</button></PageHead>
      <DemoBar />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: '10px 24px' }}>
          <span className={`status ${mode === 'live' ? 'ok' : 'warn'}`}><i />Backend API · {mode === 'live' ? 'connected' : backendConfigured ? 'unreachable' : 'not configured'}</span>
          <span className="status ok"><i />{mode === 'live' ? 'News discovery · live' : 'Demo generator · active'}</span>
          <span className={`status ${mode === 'live' ? 'ok' : ''}`}><i />Classifier · {mode === 'live' ? 'AI service via backend' : 'keyword rules (demo)'}</span>
          <span className="status"><i />RSS feeds · {ws.feeds.length} saved</span>
          <span className="spacer" /><Link className="btn sm" to="/settings" state={{ tab: 'providers' }}>Configure providers</Link>
        </div>
      </div>
      <div className="card">
        <div className="toolbar">
          <input className="inp" id="nq" value={f.q} onChange={e => set('q')(e.target.value)} placeholder="Search headlines and topics" aria-label="Search news" />
          <Select id="nc" value={f.company} onChange={set('company')} options={db.cos.map(c => [c.id, c.name] as [string, string])} all="All companies" />
          <Select id="np" value={f.pillar} onChange={set('pillar')} options={[['E', 'Environmental'], ['S', 'Social'], ['G', 'Governance']]} all="All categories" />
          <Select id="nb" value={f.band} onChange={set('band')} options={BANDS} all="All severities" />
          <Select id="ns" value={f.stage} onChange={set('stage')} options={Object.entries(STAGES).map(([k, v]) => [k, v.label] as [string, string])} all="All stages" />
        </div>
        {list.length ? <div className="news soft" key={JSON.stringify(f)}>{list.slice((page - 1) * per, page * per).map(s => <StoryItem key={s.id} s={s} />)}</div>
          : <Empty title="No reports match" text="Change the filters, or analyse an article."><button className="btn" onClick={() => setF({ q: '', company: '', pillar: '', band: '', stage: '', page: 1 })}>Clear filters</button></Empty>}
        <div style={{ marginTop: 18 }}><Pager total={list.length} page={page} per={per} onPage={p => setF({ ...f, page: p })} /></div>
      </div>
    </>
  );
}
