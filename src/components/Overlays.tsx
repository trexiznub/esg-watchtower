/* Drawers and modals: company profile, incident detail, article detail, add company, analyse article. */
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Incident, Story } from '../lib/types';
import { BANDS, CATALOG, DAY, INV_STATES, P3, PILLARS, RES_STATES, STAGES, TODAY, bandIx, coById, coScore, fmtD, fmtDY, fmtT } from '../lib/model';
import { insights } from '../lib/analytics';
import { niceMax } from '../lib/svgCharts';
import { useStore } from '../state/store';
import { BC, Empty, FactorRows, HBars, Icon, LineChart, LogoTile, PC, PillarChip, SevPill, SrcChip, StageChip, cssVars } from './ui';

const Frame = ({ kind, children }: { kind: 'drawer' | 'modal'; children: ReactNode }) => {
  const { close } = useStore();
  return <div id="ov" className="on"><div className="bg" onClick={close} /><div className={kind} role="dialog" aria-modal="true">{children}</div></div>;
};
const Head = ({ title, children }: { title: ReactNode; children?: ReactNode }) => {
  const { close } = useStore();
  return <div className="ovh"><div><h2>{title}</h2>{children}</div><button className="iconbtn" onClick={close} aria-label="Close"><Icon n="x" /></button></div>;
};
const Sec = ({ title, children, row }: { title?: string; children: ReactNode; row?: boolean }) => <div className={`sec${row ? ' row' : ''}`}>{title && <h4>{title}</h4>}{children}</div>;
const SourceLink = ({ s }: { s: Story }) => s.url
  ? <a className="btn sm" href={s.url} target="_blank" rel="noopener noreferrer"><Icon n="ext" />Open original article</a>
  : <span className="dim" style={{ fontSize: 12.5 }}>{s.src === 'demo' ? 'No source URL. This is a synthetic demo record, so there is no original article to open.' : 'No source URL was supplied for this record.'}</span>;

/** Compact incident line used inside drawers. */
export const IncLine = ({ i }: { i: Incident }) => {
  const { open } = useStore();
  return <button className="art" onClick={() => open({ kind: 'incident', id: i.id })}><h4>{i.cur.headline}</h4><SevPill s={i.sev} /><div className="meta"><SrcChip src={i.src} classifier={i.cur.classifier} /><span className="mono">{i.id}</span>·<span>{fmtD(i.detected)}</span><PillarChip p={i.pillar} mini /><StageChip st={i.cur.stage} /></div></button>;
};

function CompanyDrawer({ id }: { id: string }) {
  const { db, removeCompany, close } = useStore(), nav = useNavigate();
  const c = coById(id), incs = [...(db.byCo[id] ?? [])].sort((a, b) => b.cur.date - a.cur.date), s = coScore(db, id), b = bandIx(s), obs = insights(db, id);
  const labels: string[] = [], vals: number[] = [];
  for (let d = 90; d >= 0; d -= 3) { labels.push(fmtD(TODAY - d * DAY)); vals.push(coScore(db, id, null, TODAY - d * DAY)); }
  return (
    <Frame kind="drawer">
      <Head title={<span className="row"><LogoTile c={c} lg /><span>{c.name}<div className="dim mono" style={{ font: '400 12.5px var(--mono)', marginTop: 2 }}>NSE: {c.ticker}</div></span></span>} />
      <dl className="kv"><dt>Sector</dt><dd>{c.sector}</dd><dt>Industry</dt><dd>{c.industry}</dd><dt>Headquarters</dt><dd>{c.hq}</dd><dt>Stories analysed</dt><dd>{incs.flatMap(i => i.stories).length}</dd>{c.note && <><dt>Note</dt><dd className="muted">{c.note}</dd></>}</dl>
      <Sec title="Risk scores">
        <div className="row" style={{ gap: 20, flexWrap: 'nowrap' }}>
          <div className="ring" style={{ ...cssVars({ '--p': s, '--c': BC[b] }), margin: 0, width: 76, height: 76 }}><span style={{ width: 62, height: 62, fontSize: 20 }}>{s}</span></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ marginBottom: 10 }}><SevPill s={s} label={`Overall: ${BANDS[b]}`} /></div><HBars max={100} rows={P3.map(p => ({ label: PILLARS[p].name, value: coScore(db, id, p), segs: [{ name: 'Score', color: PC[p], value: coScore(db, id, p) }] }))} /></div>
        </div>
      </Sec>
      <Sec title="Historical risk trend · 90 days"><LineChart labels={labels} area h={170} yMax={Math.max(40, niceMax(Math.max(...vals)))} series={[{ name: 'Overall score', color: 'var(--ink)', values: vals }]} /></Sec>
      <Sec title="Key ESG risk observations">{obs.length ? <div className="stack" style={{ gap: 14 }}>{obs.slice(0, 4).map(i => <div key={i.title} className={`ins ${i.pillar ? 'p-' + i.pillar : ''}`}><h4>{i.title}</h4><p>{i.text}</p></div>)}</div> : <p className="muted">No pattern rule matched for this company.</p>}</Sec>
      <Sec title="Recent controversies">{incs.length ? <div className="news">{incs.slice(0, 6).map(i => <IncLine key={i.id} i={i} />)}</div> : <p className="muted">No incidents on record.</p>}</Sec>
      <Sec row><button className="btn" onClick={() => { close(); nav('/news', { state: { company: id } }); }}><Icon n="news" />View all news</button><button className="btn danger" onClick={() => removeCompany(id)}><Icon n="trash" />Remove from watchlist</button></Sec>
    </Frame>
  );
}

function IncidentDrawer({ id }: { id: string }) {
  const { db, open, patchIncident, addNote, toast } = useStore();
  const [note, setNote] = useState('');
  const i = db.incs.find(x => x.id === id);
  if (!i) return null;
  const s = i.cur;
  const events = [...i.stories.map(x => ({ t: x.date, story: x as Story | null, text: '' })), ...i.log.map(l => ({ t: l.t, story: null as Story | null, text: l.text }))].sort((a, b) => a.t - b.t);
  const others = (db.byCo[i.companyId] ?? []).filter(x => x.id !== id).sort((a, b) => b.detected - a.detected);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!note.trim()) return toast('Write a note first.', true); addNote(id, note.trim()); setNote(''); };
  return (
    <Frame kind="drawer">
      <Head title={s.headline}><div className="row" style={{ marginTop: 10, gap: 6 }}><SrcChip src={i.src} classifier={s.classifier} /><span className="chip mono">{i.id}</span><PillarChip p={i.pillar} /><span className="chip">{i.sub}</span><StageChip st={s.stage} /><SevPill s={i.sev} /></div></Head>
      <dl className="kv"><dt>Company</dt><dd><button className="linkish" style={{ fontFamily: 'var(--body)', fontSize: 13 }} onClick={() => open({ kind: 'company', id: i.companyId })}>{i.co.name}</button></dd><dt>Detected</dt><dd>{fmtDY(i.detected)}</dd><dt>Latest source</dt><dd>{s.publisher} · {fmtDY(s.date)}</dd><dt>Evidence stage</dt><dd>{STAGES[s.stage].desc}</dd></dl>
      <div className="row" style={{ marginTop: 14 }}><SourceLink s={s} /></div>
      <Sec title="Status">
        <div className="grid g2" style={{ gap: 12 }}>
          <label className="field"><span>Investigation status</span><select className="sel" id="iv" value={i.inv} onChange={e => patchIncident(id, { inv: e.target.value }, `Investigation status set to ${e.target.value}`)}>{INV_STATES.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="field"><span>Resolution status</span><select className="sel" id="ir" value={i.res} onChange={e => patchIncident(id, { res: e.target.value }, `Resolution status set to ${e.target.value}`)}>{RES_STATES.map(x => <option key={x}>{x}</option>)}</select></label>
        </div>
        <button className="btn sm" id="revbtn" style={{ marginTop: 12 }} onClick={() => patchIncident(id, { reviewed: !i.reviewed }, i.reviewed ? 'Review mark removed' : 'Marked as reviewed')}><Icon n="check" />{i.reviewed ? 'Reviewed. Select to undo' : 'Mark as reviewed'}</button>
      </Sec>
      <Sec title="AI-generated impact assessment"><p>{s.impact}</p><p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>{s.src === 'demo' ? 'Synthetic assessment for demonstration.' : s.classifier === 'rules' ? 'Estimated by keyword rules in demo mode, not by an AI model.' : 'Assessment by the AI classification service.'} Confidence {s.confidence}%.</p></Sec>
      <Sec title={`Why it scored ${s.severity}`}><FactorRows st={s} /></Sec>
      <Sec title="Incident timeline">
        <ul className="tl">{events.map((e, k) => <li key={k} className={e.story === s ? 'cur' : ''}><span className="pt" /><div><small>{fmtT(e.t)}</small><div>{e.story ? <><b style={{ fontWeight: 500 }}>{STAGES[e.story.stage].label}</b> · severity {e.story.severity}<br /><button className="linkish" style={{ fontFamily: 'var(--body)', fontSize: 13, textAlign: 'left' }} onClick={() => open({ kind: 'article', id: e.story!.id })}>{e.story.headline}</button></> : <>{e.text} <span className="dim">(you)</span></>}</div></div></li>)}</ul>
      </Sec>
      <Sec title="Internal notes">
        <div className="stack" style={{ gap: 8 }}>{i.notes.length ? i.notes.map((n, k) => <div key={k} className="note">{n.text}<small>{n.by} · {fmtT(n.t)}</small></div>) : <span className="dim">No notes yet.</span>}</div>
        <form onSubmit={submit} style={{ marginTop: 10 }} className="stack"><textarea className="inp" id="notetext" rows={2} placeholder="Add a note for your team" aria-label="New note" value={note} onChange={e => setNote(e.target.value)} /><div><button className="btn sm pri" id="noteadd">Add note</button></div></form>
      </Sec>
      <Sec title={`Other records for ${i.co.name}`}>{others.length ? <div className="stack" style={{ gap: 8 }}>{others.map(x => <div key={x.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><button className="linkish" onClick={() => open({ kind: 'incident', id: x.id })}>{x.id}</button><span className="muted" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 }}>{x.sub} · {fmtD(x.detected)} · {x.res}</span><SevPill s={x.sev} /></div>)}</div> : <span className="dim">None.</span>}</Sec>
    </Frame>
  );
}

function ArticleModal({ id }: { id: string }) {
  const { db, open, deleteSubmitted } = useStore();
  const s = db.stories.find(x => x.id === id);
  if (!s) return null;
  const c = coById(s.companyId);
  return (
    <Frame kind="modal">
      <Head title={s.headline}><div className="row" style={{ marginTop: 10, gap: 6 }}><SrcChip src={s.src} classifier={s.classifier} /><PillarChip p={s.pillar} /><span className="chip">{s.sub}</span><StageChip st={s.stage} /><SevPill s={s.severity} /></div></Head>
      <dl className="kv"><dt>Company</dt><dd>{c.name} <span className="dim mono">{c.ticker}</span></dd><dt>Publisher</dt><dd>{s.publisher}</dd><dt>Published</dt><dd>{fmtDY(s.date)}</dd><dt>Original URL</dt><dd>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a> : <span className="dim">{s.src === 'demo' ? 'None. Synthetic demo record.' : 'None supplied.'}</span>}</dd><dt>{s.classifier === 'rules' ? 'Rule confidence' : 'AI confidence'}</dt><dd className="mono">{s.confidence}%</dd></dl>
      <Sec title={s.classifier === 'rules' ? 'Summary' : 'AI summary'}><p>{s.summary}</p></Sec>
      <Sec title="Potential business impact"><p>{s.impact}</p></Sec>
      {s.rationale && <Sec title="Classifier rationale"><p>{s.rationale}</p></Sec>}
      <Sec title="Score breakdown"><FactorRows st={s} /></Sec>
      <Sec row>{s.url && <SourceLink s={s} />}<button className="btn" onClick={() => open({ kind: 'incident', id: s.incId })}><Icon n="alert" />Open controversy {s.incId}</button>{s.src === 'user' && <button className="btn danger" onClick={() => deleteSubmitted(s.incId)}><Icon n="trash" />Delete</button>}</Sec>
    </Frame>
  );
}

function AddModal({ initial }: { initial?: string }) {
  const { ws, addCompany } = useStore();
  const [q, setQ] = useState(initial ?? '');
  const ql = q.trim().toLowerCase();
  const list = CATALOG.filter(c => !ws.watch.includes(c.id) && (!ql || c.name.toLowerCase().includes(ql) || c.ticker.toLowerCase().includes(ql) || c.industry.toLowerCase().includes(ql)));
  return (
    <Frame kind="modal">
      <Head title="Add a company"><p className="muted" style={{ marginTop: 4 }}>Search the company directory by name, ticker or industry.</p></Head>
      <input className="inp" id="addq" style={{ width: '100%' }} placeholder="Search companies" aria-label="Search companies" autoFocus value={q} onChange={e => setQ(e.target.value)} />
      <div id="addlist" style={{ marginTop: 10 }}>
        {list.length ? list.map(c => <div key={c.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '8px 0', borderBottom: '1px solid var(--line)' }}><div className="cohead"><LogoTile c={c} /><div><b style={{ fontSize: 14 }}>{c.name}</b><span className="dim" style={{ fontSize: 12 }}>{c.ticker} · {c.industry} · {c.hq}</span></div></div><button className="btn sm pri" onClick={() => addCompany(c.id)}><Icon n="plus" />Add</button></div>)
          : <Empty title="No companies found" text="The built-in directory lists 20 NSE-listed companies. A production backend would search a full securities master." />}
      </div>
    </Frame>
  );
}

function AnalyseModal() {
  const { db, mode, classify, open, close } = useStore();
  const today = new Date(TODAY).toISOString().slice(0, 10);
  const [f, setF] = useState({ co: db.cos[0]?.id ?? '', date: today, head: '', pub: '', url: '', text: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const date = new Date(f.date + 'T12:00:00').getTime(), url = f.url.trim();
    if (!f.head.trim() || !f.pub.trim() || f.text.trim().length < 80) return setErr('Enter the headline, the publisher and at least a paragraph of article text.');
    if (url && !/^https?:\/\/\S+\.\S+/.test(url)) return setErr('The URL must start with http:// or https://.');
    if (!(date <= TODAY + DAY)) return setErr('Enter a valid publication date that is not in the future.');
    setErr(''); setBusy(true);
    const r = await classify({ company: coById(f.co), headline: f.head.trim(), publisher: f.pub.trim(), url: url || null, date, text: f.text.trim() });
    setBusy(false);
    if (r.ok) open({ kind: 'article', id: r.storyId }); else setErr(r.message);
  };
  return (
    <Frame kind="modal">
      <Head title="Analyse an article"><p className="muted" style={{ marginTop: 4 }}>{mode === 'live' ? 'Paste a real article. The backend AI service classifies it, judges the evidence stage and scores five factors.' : 'Demo mode: the article is classified by transparent keyword rules, not an AI model. Connect a backend for AI classification.'} The headline, publisher, date and URL are stored exactly as you enter them.</p></Head>
      {db.cos.length ? (
        <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
          <div className="grid g2" style={{ gap: 12 }}>
            <label className="field"><span>Company</span><select className="sel" id="a-co" value={f.co} onChange={set('co')}>{db.cos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="field"><span>Publication date</span><input className="inp" type="date" id="a-date" value={f.date} max={today} onChange={set('date')} /></label>
          </div>
          <label className="field"><span>Original headline</span><input className="inp" id="a-head" maxLength={240} value={f.head} onChange={set('head')} /></label>
          <div className="grid g2" style={{ gap: 12 }}>
            <label className="field"><span>Publisher</span><input className="inp" id="a-pub" maxLength={80} value={f.pub} onChange={set('pub')} /></label>
            <label className="field"><span>Article URL</span><input className="inp" id="a-url" placeholder="https://" value={f.url} onChange={set('url')} /></label>
          </div>
          <label className="field"><span>Article text</span><textarea className="inp" id="a-text" rows={7} placeholder="Paste the article body here" value={f.text} onChange={set('text')} /></label>
          <div id="a-out">{busy ? <div className="stack" style={{ gap: 8 }}><div className="sk" style={{ height: 14, width: '60%' }} /><div className="sk" style={{ height: 14 }} /><span className="dim" style={{ fontSize: 12 }}>Analysing the article…</span></div> : err && <p style={{ color: 'var(--crit)', fontSize: 13 }}>{err}</p>}</div>
          <div className="row"><button className="btn pri" id="a-go" disabled={busy}><Icon n="spark" />Analyse</button><button type="button" className="btn ghost" onClick={close}>Cancel</button></div>
        </form>
      ) : <Empty title="Add a company first" text="Articles are filed against a watchlist company." />}
    </Frame>
  );
}

export function Overlays() {
  const { overlay: o } = useStore();
  if (!o) return null;
  if (o.kind === 'company') return <CompanyDrawer key={o.id} id={o.id} />;
  if (o.kind === 'incident') return <IncidentDrawer key={o.id} id={o.id} />;
  if (o.kind === 'article') return <ArticleModal id={o.id} />;
  if (o.kind === 'add') return <AddModal initial={o.q} />;
  return <AnalyseModal />;
}
