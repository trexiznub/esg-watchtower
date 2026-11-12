import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Pillar, Prefs } from '../lib/types';
import { DAY, P3, PILLARS, TODAY, coById, fmtDY } from '../lib/model';
import { digestData } from '../lib/analytics';
import { exportDigestHtml, exportDigestPdf } from '../services/exporter';
import { useStore } from '../state/store';
import { DemoBar, Icon, Logo, PageHead, StackedBars, Switch } from '../components/ui';
import { StoryItem } from './News';
import { InsightCard } from './Risk';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const Sec = ({ n, title, children }: { n?: number; title: string; children: ReactNode }) => <div className="sec"><h4>{n ? `${n}. ` : ''}{title}</h4>{children}</div>;

export default function Digest() {
  const { db, ws, mode, update, open, toast, summarise } = useStore();
  const P = ws.prefs, d = digestData(db, P);
  const [ai, setAi] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const summary = ai ?? d.summary;
  const pref = <K extends keyof Prefs>(k: K, v: Prefs[K], quiet?: boolean) => { update(w => ({ ...w, prefs: { ...w.prefs, [k]: v } })); setAi(null); if (!quiet) toast(k === 'emailOn' ? (v ? 'Preference saved. Email is sent only once a mail service is connected.' : 'Email preference turned off') : 'Preference saved'); };
  const next = (() => { const want = (DAYS.indexOf(P.digestDay) + 1) % 7; const add = (want - new Date(TODAY).getDay() + 7) % 7 || 7; return fmtDY(TODAY + add * DAY); })();
  const dev = (p: Pillar) => { const l = d.cur.filter(s => s.pillar === p); return l.length ? <div className="news">{l.map(s => <StoryItem key={s.id} s={s} brief />)}</div> : <p className="muted">No {PILLARS[p].name.toLowerCase()} reports this week. Previous week: {d.pcPrev[p]}.</p>; };
  const high = d.cur.filter(s => s.severity >= 60);
  const draft = async () => {
    setBusy(true);
    const text = await summarise({ period: d.period, companies: d.cos.length, reports_this_week: d.cur.length, reports_previous_week: d.prev.length, threshold: d.thr, portfolio_score_now: d.port.now, portfolio_score_week_ago: d.port.was, by_pillar: d.pcCur, top_reports: d.sig.slice(0, 5).map(s => ({ company: coById(s.companyId).name, pillar: s.pillar, topic: s.sub, stage: s.stage, severity: s.severity })), score_changes: d.changes.map(x => ({ company: x.c.name, now: x.now, was: x.was })) });
    setBusy(false);
    if (text) { setAi(text.trim()); toast('Summary drafted by the AI service'); } else toast('The AI service could not draft the summary.', true);
  };
  const pdf = async () => { try { await exportDigestPdf(d, summary, mode === 'demo'); toast('Digest exported as PDF'); } catch { toast('The PDF could not be generated. Download the HTML report instead.', true); } };
  return (
    <>
      <PageHead title="Weekly Digest" sub={`Report for ${d.period}, compared with the previous seven days.`}>
        <button className="btn" onClick={() => { exportDigestHtml(d, summary, mode === 'demo'); toast('Digest exported as HTML'); }}><Icon n="down" />Download HTML</button>
        <button className="btn pri" onClick={pdf}><Icon n="down" />Download PDF</button>
      </PageHead>
      <DemoBar />
      <div className="grid g21">
        <div className="card" id="report">
          <div className="row" style={{ justifyContent: 'space-between' }}><div className="row"><Logo size={28} /><div><b style={{ fontFamily: 'var(--display)', letterSpacing: '.05em' }}>ESG WATCHTOWER</b><div className="dim" style={{ fontSize: 12 }}>Weekly ESG intelligence digest · {d.cos.length} companies · threshold {d.thr}</div></div></div>{mode === 'demo' ? <span className="chip demo">Demo data</span> : <span className="chip live">Live</span>}</div>
          <Sec n={1} title="Executive summary">
            {busy ? <div className="stack" style={{ gap: 8 }}><div className="sk" style={{ height: 14 }} /><div className="sk" style={{ height: 14, width: '80%' }} /></div> : <p id="exec" style={{ maxWidth: '70ch' }}>{summary}</p>}
            <div className="row" style={{ marginTop: 10 }}>
              {mode === 'live' && <button className="btn sm" onClick={draft} disabled={busy}><Icon n="spark" />{ai ? 'Redraft with AI' : 'Draft with AI'}</button>}
              {ai ? <><button className="btn sm ghost" onClick={() => setAi(null)}>Use computed summary</button><span className="dim" style={{ fontSize: 12 }}>Drafted by the AI service from the figures in this report.</span></> : <span className="dim" style={{ fontSize: 12 }}>Summary computed from the figures.{mode === 'demo' ? ' AI drafting needs a connected backend.' : ''}</span>}
            </div>
            <div className="kpis three" style={{ margin: '16px 0 0' }}>{([['Reports', d.cur.length, d.prev.length], ['At or above threshold', d.sig.length, d.prev.filter(s => s.severity >= d.thr).length], ['Portfolio risk score', d.port.now, d.port.was]] as [string, number, number][]).map(([k, a, b]) => <div key={k} className="kpi" style={{ padding: 12, background: 'var(--surface2)', borderRadius: 10 }}><div className="k">{k}</div><div className="v" style={{ fontSize: 24 }}>{a}</div><div className="d">previous {b} ({a - b >= 0 ? '+' : ''}{a - b})</div></div>)}</div>
          </Sec>
          <Sec n={2} title="Most significant ESG controversies">{d.sig.length ? <div className="news">{d.sig.slice(0, 5).map(s => <StoryItem key={s.id} s={s} brief />)}</div> : <p className="muted">No report reached severity {d.thr} this week.</p>}</Sec>
          <Sec n={3} title="Critical and high-risk incidents">{high.length ? <div className="news">{high.map(s => <StoryItem key={s.id} s={s} brief />)}</div> : <p className="muted">None this week.</p>}</Sec>
          <Sec title="Weekly comparison by pillar"><StackedBars h={180} labels={P3.flatMap(p => [`${p} · previous`, `${p} · this week`])} stacks={[{ name: 'Reports', color: 'var(--ink2)', values: P3.flatMap(p => [d.pcPrev[p], d.pcCur[p]]) }]} /></Sec>
          <Sec n={4} title="Environmental developments">{dev('E')}</Sec>
          <Sec n={5} title="Social developments">{dev('S')}</Sec>
          <Sec n={6} title="Governance developments">{dev('G')}</Sec>
          <Sec n={7} title="Company-wise risk changes">
            <div className="tw" style={{ margin: 0, border: 0 }}><table><thead><tr><th>Company</th><th>Score now</th><th>7 days ago</th><th>Change</th></tr></thead><tbody>{d.changes.map(x => <tr key={x.c.id} onClick={() => open({ kind: 'company', id: x.c.id })}><td>{x.c.name}</td><td className="mono">{x.now}</td><td className="mono">{x.was}</td><td className="mono" style={{ color: x.d > 0 ? 'var(--b3)' : x.d < 0 ? 'var(--ok)' : 'inherit' }}>{x.d > 0 ? `▲ +${x.d}` : x.d < 0 ? `▼ ${x.d}` : '0'}</td></tr>)}</tbody></table></div>
          </Sec>
          <Sec n={8} title="Emerging ESG risk patterns">{d.patterns.length ? <div className="stack" style={{ gap: 14 }}>{d.patterns.map((p, k) => <InsightCard key={k} i={p} />)}</div> : <p className="muted">No pattern rule matched.</p>}</Sec>
          <Sec n={9} title="Key observations and recommended areas for investigation"><ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink2)' }}>{d.recs.map(r => <li key={r}>{r}</li>)}</ul></Sec>
        </div>
        <div className="stack">
          <div className="card">
            <div className="chead"><div><h3>Delivery schedule</h3><div className="sub">Saved with your workspace</div></div></div>
            <div className="stack" style={{ gap: 12 }}>
              <label className="field"><span>Reporting day</span><select className="sel" id="dd" value={P.digestDay} onChange={e => pref('digestDay', e.target.value)}>{DAYS.map(x => <option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>Frequency</span><select className="sel" id="df" value={P.digestFreq} onChange={e => pref('digestFreq', e.target.value)}>{['Weekly', 'Fortnightly', 'Monthly'].map(x => <option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>Minimum severity for "significant": <b className="mono">{P.threshold}</b></span><input type="range" id="dt" min={0} max={80} step={20} value={P.threshold} onChange={e => pref('threshold', +e.target.value, true)} /></label>
              <div className="field"><span>Companies included</span>{db.cos.length ? db.cos.map(c => <label key={c.id} className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" id={`dc-${c.id}`} checked={!P.digestSkip.includes(c.id)} onChange={e => pref('digestSkip', e.target.checked ? P.digestSkip.filter(x => x !== c.id) : [...P.digestSkip, c.id], true)} />{c.name}</label>) : <span className="dim">Watchlist is empty.</span>}</div>
              <label className="row" style={{ justifyContent: 'space-between' }}><span>Email me the digest</span><Switch id="de" checked={P.emailOn} onChange={v => pref('emailOn', v)} /></label>
              <label className="field"><span>Email address</span><input className="inp" id="dm" type="email" value={P.email} placeholder="name@company.com" onChange={e => pref('email', e.target.value, true)} onBlur={e => { if (e.target.value && !/^\S+@\S+\.\S+$/.test(e.target.value)) toast('That email address does not look valid.', true); }} /></label>
            </div>
          </div>
          <div className="card">
            <div className="chead"><div><h3>Automation status</h3></div></div>
            <div className="stack" style={{ gap: 10 }}>
              <span className={`status ${mode === 'live' ? 'ok' : 'warn'}`}><i />Backend · {mode === 'live' ? 'connected' : 'not connected'}</span>
              <p className="muted" style={{ fontSize: 12.5 }}>This page generates the report on demand and sends nothing itself. Scheduling and email are backend jobs: with those configured, the next {P.digestFreq.toLowerCase()} run would fall on <b>{next}</b>.</p>
              <div><Link className="btn sm" to="/settings" state={{ tab: 'providers' }}>Backend settings</Link></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
