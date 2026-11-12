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
      <div className="meta"><SrcChip src={s.src} classifier={s.classifier} /><span>{coById(s.companyId).name}</span>·<span>{fmtDY(s.date)}</span><PillarChip p={s.pillar} mini /><StageChip st={s.stage} /></div>
      {!brief && <p>{s.summary}</p>}
    </button>
  );
}

export default function News() {
  const { db, open } = useStore();
  const loc = useLocation();
  const preset = (loc.state as { company?: string } | null)?.company ?? '';
  const [f, setF] = useState({ q: '', company: preset, pillar: '', band: '', stage: '', page: 1 });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v, page: 1 });
  const per = 6, ql = f.q.trim().toLowerCase();
  const list = db.stories.filter(s => (!ql || s.headline.toLowerCase().includes(ql) || s.summary.toLowerCase().includes(ql) || s.sub.toLowerCase().includes(ql)) && (!f.company || s.companyId === f.company) && (!f.pillar || s.pillar === f.pillar) && (!f.band || BANDS[bandIx(s.severity)] === f.band) && (!f.stage || s.stage === f.stage));
  const page = Math.min(f.page, Math.max(1, Math.ceil(list.length / per)));
  return (
    <>
      <PageHead title="News Intelligence" sub="Open any report to see how it was classified and why it scored what it did."><button className="btn pri" onClick={() => open({ kind: 'analyse' })}><Icon n="spark" />Analyse an article</button></PageHead>
      <DemoBar />
      <div className="card">
        <div className="toolbar">
          <input className="inp" id="nq" value={f.q} onChange={e => set('q')(e.target.value)} placeholder="Search headlines and topics" aria-label="Search news" />
          <Select id="nc" value={f.company} onChange={set('company')} options={db.cos.map(c => [c.id, c.name] as [string, string])} all="All companies" />
          <Select id="np" value={f.pillar} onChange={set('pillar')} options={[['E', 'Environmental'], ['S', 'Social'], ['G', 'Governance']]} all="All categories" />
          <Select id="nb" value={f.band} onChange={set('band')} options={BANDS} all="All severities" />
        </div>
        {list.length ? <div className="news soft" key={JSON.stringify(f)}>{list.slice((page - 1) * per, page * per).map(s => <StoryItem key={s.id} s={s} />)}</div>
          : <Empty title="No reports match" text="Change the filters, or analyse an article."><button className="btn" onClick={() => setF({ q: '', company: '', pillar: '', band: '', stage: '', page: 1 })}>Clear filters</button></Empty>}
        <div style={{ marginTop: 18 }}><Pager total={list.length} page={page} per={per} onPage={p => setF({ ...f, page: p })} /></div>
      </div>
    </>
  );
}
