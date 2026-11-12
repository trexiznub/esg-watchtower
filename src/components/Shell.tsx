/* Application shell: collapsible sidebar, top bar (search, refresh stamp, notifications, theme,
   profile), routed content, footer, toasts. */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CATALOG, fmtD, fmtT, initials, needsReview } from '../lib/model';
import { useStore } from '../state/store';
import { Icon, Logo, LogoTile, SevPill, Tooltip } from './ui';
import { Overlays } from './Overlays';

export const ROUTES: [string, string, string][] = [
  ['/overview', 'Overview', 'grid'], ['/watchlist', 'Company Watchlist', 'building'], ['/news', 'News Intelligence', 'news'],
  ['/risk', 'ESG Risk Analysis', 'radar'], ['/tracker', 'Controversy Tracker', 'alert'], ['/analytics', 'Analytics & Reports', 'chart'],
  ['/digest', 'Weekly Digest', 'file'], ['/settings', 'Settings', 'gear']
];
export const COPYRIGHT = '© 2026 Ujwal Raj K.P. All Rights Reserved.';
export const CREDIT = 'Designed & Developed by Ujwal Raj K.P.';

const Skeleton = () => (
  <>
    <div className="kpis">{[0, 1, 2, 3].map(i => <div key={i} className="card sk" style={{ height: 104 }} />)}</div>
    <div className="grid g12">{[0, 1].map(i => <div key={i} className="card sk" style={{ height: 300 }} />)}</div>
    <div className="card sk" style={{ height: 260, marginTop: 16 }} />
  </>
);

export function Toasts() {
  const { toasts } = useStore();
  return <div id="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={`toast${t.err ? ' err' : ''}`} role="status"><Icon n={t.err ? 'alert' : 'check'} /><span>{t.msg}</span></div>)}</div>;
}

export function Shell() {
  const { ws, db, mode, loading, update, refresh, open, close, toast, reviewAll, addCompany } = useStore();
  const loc = useLocation(), nav = useNavigate();
  const [pop, setPop] = useState<null | 'bell' | 'profile' | 'search'>(null);
  const [q, setQ] = useState('');
  const [mopen, setMopen] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const notif = needsReview(db);

  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; setPop(null); setMopen(false); close(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [loc.pathname]);
  useEffect(() => {
    /* composedPath is fixed when the event is dispatched, so it stays correct even if React has re-rendered the target. */
    const click = (e: MouseEvent) => {
      const path = e.composedPath(), within = (sel: string) => path.some(n => n instanceof Element && n.matches(sel));
      if (!within('.pop') && !within('[data-pop]')) setPop(null);
      if (!within('.side') && !within('[data-side]')) setMopen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPop(null);
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement as Element | null)?.tagName ?? '')) { e.preventDefault(); document.getElementById('gs')?.focus(); }
    };
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  }, []);

  const ql = q.trim().toLowerCase();
  const hitCos = ql ? CATALOG.filter(c => c.name.toLowerCase().includes(ql) || c.ticker.toLowerCase().includes(ql)).slice(0, 4) : [];
  const hitIncs = ql ? db.incs.filter(i => i.id.toLowerCase().includes(ql) || i.cur.headline.toLowerCase().includes(ql) || i.sub.toLowerCase().includes(ql)).slice(0, 5) : [];
  const pick = (fn: () => void) => { fn(); setPop(null); setQ(''); };
  const pickCo = (id: string) => pick(() => (ws.watch.includes(id) ? open({ kind: 'company', id }) : (addCompany(id), nav('/watchlist'))));
  const toggleSide = () => { if (window.matchMedia('(max-width:760px)').matches) setMopen(m => !m); else update(w => ({ ...w, collapsed: !w.collapsed })); };
  const toggleTheme = () => { const next = ws.theme === 'dark' ? 'light' : 'dark'; update(w => ({ ...w, theme: next })); toast(`${next === 'dark' ? 'Dark' : 'Light'} theme on`); };

  return (
    <div id="app" className={`${ws.collapsed ? 'collapsed' : ''} ${mopen ? 'mopen' : ''}`}>
      <aside className="side" aria-label="Primary">
        <Link className="brand" to="/" style={{ textDecoration: 'none' }} title="ESG Watchtower home"><Logo /><b className="lbl">ESG <span>WATCHTOWER</span></b></Link>
        <nav className="nav" aria-label="Sections">
          {ROUTES.map(([to, label, icon]) => <NavLink key={to} to={to} title={label} className={({ isActive }) => (isActive ? 'on' : '')}><Icon n={icon} /><span className="lbl">{label}</span></NavLink>)}
        </nav>
        <div className="sidefoot lbl">See the risks. Understand<br />the impact. Stay ahead.</div>
      </aside>
      <div className="main">
        <header className="top">
          <button className="iconbtn" data-side onClick={toggleSide} aria-label="Toggle sidebar"><Icon n="menu" /></button>
          <div className="search" data-pop>
            <Icon n="search" />
            <input className="inp" id="gs" type="search" placeholder="Search companies, tickers, incidents" aria-label="Search" autoComplete="off" value={q}
              onChange={e => { setQ(e.target.value); setPop(e.target.value.trim() ? 'search' : null); }}
              onKeyDown={e => { if (e.key === 'Enter') { if (hitCos[0]) pickCo(hitCos[0].id); else if (hitIncs[0]) pick(() => open({ kind: 'incident', id: hitIncs[0].id })); } }} />
            {pop === 'search' && ql && (
              <div className="pop left">
                {hitCos.length > 0 && <h5>Companies</h5>}
                {hitCos.map(c => <button key={c.id} className="it" onClick={() => pickCo(c.id)}><LogoTile c={c} /><div><span className="t">{c.name}</span><small>{c.ticker} · {ws.watch.includes(c.id) ? 'on watchlist' : 'select to add to watchlist'}</small></div>{!ws.watch.includes(c.id) && <Icon n="plus" />}</button>)}
                {hitIncs.length > 0 && <h5>Controversies</h5>}
                {hitIncs.map(i => <button key={i.id} className="it" onClick={() => pick(() => open({ kind: 'incident', id: i.id }))}><div><span className="t">{i.cur.headline}</span><small>{i.id} · {i.co.name}</small></div><SevPill s={i.sev} /></button>)}
                {!hitCos.length && !hitIncs.length && <div className="empty" style={{ padding: 20 }}><b>No results</b>Try a company name, ticker or incident ID.</div>}
              </div>
            )}
          </div>
          <div className="stamp"><span className="dot" style={mode === 'live' ? { background: 'var(--ok)' } : undefined} title={mode === 'live' ? 'Live data' : 'Demo data'} /><span><span className="long">{mode === 'live' ? 'Live' : 'Demo data'} · refreshed </span>{fmtT(ws.refreshed)}</span></div>
          <button className="iconbtn" onClick={refresh} aria-label="Refresh data" title={mode === 'live' ? 'Fetch the latest news' : 'Re-run the demo pipeline'}><Icon n="refresh" /></button>
          <button className="iconbtn" id="bell" data-pop onClick={() => setPop(p => (p === 'bell' ? null : 'bell'))} aria-label={`Notifications, ${notif.length} unreviewed`}><Icon n="bell" />{notif.length > 0 && <span className="badge">{notif.length}</span>}</button>
          <button className="iconbtn" id="themebtn" onClick={toggleTheme} aria-label="Switch theme"><Icon n={ws.theme === 'dark' ? 'sun' : 'moon'} /></button>
          <button data-pop onClick={() => setPop(p => (p === 'profile' ? null : 'profile'))} aria-label="Profile menu"><span className="avatar" id="avatar">{initials(ws.prefs.name || 'User')}</span></button>
          {pop === 'bell' && (
            <div className="pop">
              <div className="row" style={{ justifyContent: 'space-between', padding: '4px 8px' }}><b>Needs review</b>{notif.length > 0 && <button className="btn sm ghost" onClick={() => { reviewAll(); setPop(null); }}>Mark all reviewed</button>}</div>
              {notif.length ? notif.slice(0, 8).map(i => <button key={i.id} className="it" onClick={() => pick(() => open({ kind: 'incident', id: i.id }))}><div><span className="t">{i.cur.headline}</span><small>{i.co.name} · {fmtD(i.cur.date)}</small></div><SevPill s={i.sev} /></button>)
                : <div className="empty" style={{ padding: 20 }}><b>All caught up</b>No unreviewed high or critical incidents.</div>}
            </div>
          )}
          {pop === 'profile' && (
            <div className="pop">
              <div style={{ padding: 8 }}><b>{ws.prefs.name}</b><div className="dim" style={{ fontSize: 12 }}>{ws.prefs.role} · {mode === 'live' ? 'backend workspace' : 'local workspace'}</div></div>
              <button className="it" onClick={() => pick(() => nav('/settings'))}><Icon n="gear" /><div>Profile and settings</div></button>
              <button className="it" onClick={() => pick(() => nav('/'))}><Icon n="arrow" /><div>Back to landing page</div></button>
            </div>
          )}
        </header>
        <div className="scroll" id="scroll" ref={scroll}>
          <main id="view" key={loc.pathname} className="enter">{loading ? <Skeleton /> : <Outlet />}</main>
          <footer className="foot"><span>{COPYRIGHT}</span><span>{CREDIT}</span></footer>
        </div>
      </div>
      <Overlays />
      <Tooltip />
    </div>
  );
}
