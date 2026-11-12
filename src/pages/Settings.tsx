import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Prefs } from '../lib/types';
import { BANDS, BAND_RANGES, FACTORS, STAGES } from '../lib/model';
import { backendConfigured, config } from '../services/api';
import { useStore } from '../state/store';
import { Icon, PageHead, Seg, SevPill, Switch } from '../components/ui';

const TABS: [string, string][] = [['profile', 'Profile & display'], ['providers', 'Backend'], ['scoring', 'Scoring model'], ['data', 'Data & storage']];
const ENDPOINTS: [string, string, string][] = [
  ['GET /health', 'Availability check at start-up', 'none'],
  ['POST /news/discover', 'News discovery for the watchlist', 'NEWSAPI_KEY, RSS feeds'],
  ['POST /ai/classify', 'Classify and score one article', 'AI provider key'],
  ['POST /ai/summarise', 'Draft the digest summary', 'AI provider key'],
  ['GET · PUT /workspace', 'Load and save watchlist, notes, statuses', 'Database service-role key']
];

export default function Settings() {
  const { ws, mode, modeNote, update, toast, reset } = useStore();
  const loc = useLocation();
  const [tab, setTab] = useState((loc.state as { tab?: string } | null)?.tab ?? 'profile');
  const [confirm, setConfirm] = useState(false);
  const P = ws.prefs;
  const pref = <K extends keyof Prefs>(k: K, v: Prefs[K]) => update(w => ({ ...w, prefs: { ...w.prefs, [k]: v } }));
  return (
    <>
      <PageHead title="Settings" sub="Your preferences, the backend connection and how scores are calculated." />
      <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} data-tab={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setConfirm(false); }}>{l}</button>)}</div>
      <div className="soft" key={tab}>
        {tab === 'profile' && (
          <div className="grid g2">
            <div className="card"><div className="chead"><h3>Profile</h3></div><div className="stack" style={{ gap: 12 }}>
              <label className="field"><span>Display name</span><input className="inp" id="pn" value={P.name} onChange={e => pref('name', e.target.value)} /></label>
              <label className="field"><span>Role</span><input className="inp" id="pr" value={P.role} onChange={e => pref('role', e.target.value)} /></label>
              <p className="dim" style={{ fontSize: 12 }}>The static site has no sign-in of its own. Authentication belongs to the backend.</p>
            </div></div>
            <div className="card"><div className="chead"><h3>Display</h3></div><div className="stack" style={{ gap: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>Theme</span><Seg<'dark' | 'light'> label="Theme" value={ws.theme} onChange={t => update(w => ({ ...w, theme: t }))} options={[['dark', 'Dark'], ['light', 'Light']]} /></div>
              <label className="row" style={{ justifyContent: 'space-between' }}><span>Reduce motion</span><Switch id="prm" checked={P.rm} onChange={v => pref('rm', v)} /></label>
              <label className="row" style={{ justifyContent: 'space-between' }}><span>Collapse sidebar</span><Switch id="pcs" checked={ws.collapsed} onChange={v => update(w => ({ ...w, collapsed: v }))} /></label>
              <p className="dim" style={{ fontSize: 12 }}>Your system's reduced-motion setting is always respected.</p>
            </div></div>
          </div>
        )}
        {tab === 'providers' && (
          <div className="stack">
            <div className="card">
              <div className="chead"><div><h3>Backend connection</h3><div className="sub">Set at build time through VITE_API_BASE_URL. No credentials live in this site.</div></div><span className={`status ${mode === 'live' ? 'ok' : 'warn'}`}><i />{mode === 'live' ? 'Live mode' : 'Demo mode'}</span></div>
              <dl className="kv"><dt>API base URL</dt><dd className="mono">{config.apiBaseUrl || 'not set'}</dd><dt>Forced demo</dt><dd>{config.forceDemo ? 'yes' : 'no'}</dd><dt>Status</dt><dd>{modeNote}</dd><dt>Timeout</dt><dd>{config.timeoutMs} ms</dd></dl>
              <div className="tw" style={{ margin: '16px 0 0', border: 0 }}><table><thead><tr><th>Endpoint</th><th>Purpose</th><th>Secret held by the backend</th></tr></thead><tbody>{ENDPOINTS.map(r => <tr key={r[0]} style={{ cursor: 'default' }}><td className="mono nw">{r[0]}</td><td className="muted">{r[1]}</td><td className="muted">{r[2]}</td></tr>)}</tbody></table></div>
              {!backendConfigured && <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Without a backend the dashboard uses the synthetic demo generator and a keyword-rule classifier, and saves your workspace in this browser.</p>}
            </div>
          </div>
        )}
        {tab === 'scoring' && (
          <div className="grid g2">
            <div className="card"><div className="chead"><div><h3>Article severity, 0–100</h3><div className="sub">Seven factors, each scored 0–100, combined by weight</div></div></div>
              <div className="fx" style={{ gridTemplateColumns: '1fr 60px' }}>{FACTORS.map(([k, l, w]) => [<span key={k}>{l}</span>, <span key={k + 'w'} className="mono">{(w * 100).toFixed(0)}%</span>])}</div>
              <div className="sec"><h4>Stage multiplier</h4><div className="stack" style={{ gap: 8 }}>{Object.values(STAGES).map(s => <div key={s.label} className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span><b style={{ fontWeight: 500 }}>{s.label}</b> <span className="dim">{s.desc}</span></span><span className="mono">×{s.mult}</span></div>)}</div><p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>An allegation scores lower than a confirmed violation with the same facts. Negative coverage alone is never treated as proof.</p></div>
            </div>
            <div className="card"><div className="chead"><div><h3>Bands and company scores</h3></div></div>
              <div className="stack" style={{ gap: 8 }}>{BANDS.map((b, j) => <div key={b} className="row" style={{ justifyContent: 'space-between' }}><SevPill s={j * 20} label={b} /><span className="mono">{BAND_RANGES[j]}</span></div>)}</div>
              <div className="sec"><h4>Company risk score</h4><p className="muted" style={{ fontSize: 13 }}>Each incident contributes its current severity, halved for every 45 days since its latest report. The contributions are summed into an exposure figure, then mapped to 0–100:</p>
                <pre className="code" style={{ marginTop: 10 }}>{'exposure = Σ severity × 0.5^(age_days / 45)\nscore    = 100 × (1 − e^(−exposure / k))\nk = 260 overall, 160 per pillar'}</pre>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Portfolio scores are the mean across watchlist companies.</p></div>
            </div>
          </div>
        )}
        {tab === 'data' && (
          <div className="grid g2">
            <div className="card"><div className="chead"><h3>Where your work is kept</h3></div><p className="muted" style={{ fontSize: 13 }}>{mode === 'live' ? 'Your workspace is saved to the backend database and cached in this browser.' : 'In demo mode your watchlist, notes, status changes, submitted articles and preferences are stored in this browser only. They do not sync to other devices.'}</p>
              <dl className="kv" style={{ marginTop: 14 }}><dt>Watchlist</dt><dd>{ws.watch.length} companies</dd><dt>Edited incidents</dt><dd>{Object.keys(ws.overrides).length}</dd><dt>Submitted articles</dt><dd>{ws.submitted.length}</dd></dl></div>
            <div className="card"><div className="chead"><h3>Reset</h3></div><p className="muted" style={{ fontSize: 13 }}>Restore the six sample companies and delete your notes, status changes, submitted articles and settings.</p>
              <button className="btn danger" id="resetbtn" style={{ marginTop: 14 }} onClick={() => { if (!confirm) return setConfirm(true); setConfirm(false); reset(); }}><Icon n="trash" />{confirm ? 'Select again to confirm reset' : 'Reset workspace'}</button></div>
          </div>
        )}
      </div>
    </>
  );
}
