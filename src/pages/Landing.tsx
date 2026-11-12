import { Link } from 'react-router-dom';
import { P3, PILLARS, activeIncs, portScore } from '../lib/model';
import { trendSeries } from '../lib/analytics';
import { niceMax } from '../lib/svgCharts';
import { useStore } from '../state/store';
import { Icon, LineChart, Logo, PC, PillarLegend, Tooltip } from '../components/ui';
import { COPYRIGHT, CREDIT } from '../components/Shell';

const FEATURES: [string, string, string][] = [
  ['building', 'Company watchlist', 'Search, add and remove companies. Each profile shows E, S and G scores, a 90-day trend and recent controversies.'],
  ['spark', 'Article analysis', 'Submit a real article for classification, evidence staging and factor scoring. Sources are stored exactly as entered.'],
  ['shield', 'Severity you can audit', 'Seven weighted factors and an evidence-stage multiplier. An allegation never scores like a confirmed violation.'],
  ['alert', 'Controversy tracker', 'Sort and filter every incident. Change investigation status, track resolution, add notes and review the timeline.'],
  ['radar', 'Pattern detection', 'Recurring issues, risk concentration, regulatory exposure and momentum, each with the rule and evidence that triggered it.'],
  ['file', 'Weekly digest', 'A nine-section report compared with the previous week, with HTML and PDF downloads.']
];
const STEPS: [string, string, string][] = [['01', 'Collect', 'Company news from configured providers and feeds.'], ['02', 'Classify', 'Pillar, subcategory and evidence stage.'], ['03', 'Score', 'Severity from 0 to 100 with a factor breakdown.'], ['04', 'Track', 'Incidents with status, notes and history.'], ['05', 'Report', 'Weekly digest with period comparison.']];

export default function Landing() {
  const { db, ws, mode, update } = useStore();
  const tr = trendSeries(db, 90);
  return (
    <div id="landing">
      <header className="lnav">
        <div className="brand" style={{ padding: 0, height: 'auto' }}><Logo /><b>ESG <span>WATCHTOWER</span></b></div>
        <div className="row"><button className="iconbtn" onClick={() => update(w => ({ ...w, theme: w.theme === 'dark' ? 'light' : 'dark' }))} aria-label="Switch theme"><Icon n={ws.theme === 'dark' ? 'sun' : 'moon'} /></button><Link className="btn pri" to="/overview">Open the platform <Icon n="arrow" /></Link></div>
      </header>
      <main className="lwrap">
        <section className="hero">
          <div className="enter">
            <div className="eye">ESG news intelligence · controversy monitoring</div>
            <h1>See the risks. <em>Understand the impact.</em> Stay ahead.</h1>
            <p>ESG Watchtower follows the companies you care about, classifies each report as Environmental, Social or Governance, scores its severity with a visible method, and tells allegations apart from confirmed violations.</p>
            <div className="cta"><Link className="btn pri" id="enter" to="/overview">Open the platform <Icon n="arrow" /></Link><Link className="btn" to="/digest"><Icon n="file" />Read this week's digest</Link></div>
            <p className="dim" style={{ fontSize: 12.5, marginTop: 18 }}>{mode === 'live' ? 'Connected to the live backend.' : 'The workspace opens in demo mode with clearly labelled synthetic data for six NSE-listed companies.'}</p>
          </div>
          <div className="card peek enter" style={{ animationDelay: '.1s' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}><b style={{ fontFamily: 'var(--display)' }}>Portfolio risk · 90 days</b>{mode === 'demo' ? <span className="chip demo">Demo data</span> : <span className="chip live">Live</span>}</div>
            <div className="mini"><div><b>{db.cos.length}</b>companies</div><div><b>{activeIncs(db).length}</b>active controversies</div><div><b>{portScore(db)}</b>risk score</div></div>
            <LineChart labels={tr.labels} h={200} yMax={Math.max(40, niceMax(Math.max(...tr.e, ...tr.s, ...tr.g)))} series={P3.map(p => ({ name: PILLARS[p].name, color: PC[p], values: tr[p.toLowerCase() as 'e' | 's' | 'g'] }))} />
            <div style={{ marginTop: 10 }}><PillarLegend /></div>
          </div>
        </section>
        <section className="lsec">
          <h2>Built for people who have to explain a risk rating</h2>
          <p>Analysts, investors, consultants and corporate risk teams need more than a number. Every score here can be opened and read.</p>
          <div className="feats">{FEATURES.map(f => <div key={f[1]} className="card feat hov"><Icon n={f[0]} /><h3>{f[1]}</h3><p>{f[2]}</p></div>)}</div>
        </section>
        <section className="lsec">
          <h2>From headline to decision</h2>
          <div className="pipe">{STEPS.map(s => <div key={s[0]}><small>{s[0]}</small><b>{s[1]}</b><p>{s[2]}</p></div>)}</div>
          <p style={{ marginTop: 16, fontSize: 13.5 }}>The site is a static frontend. News collection, AI classification and storage run on a separate backend reached through one configurable API; without it, the dashboard runs in demo mode.</p>
        </section>
        <footer className="lfoot"><span>{COPYRIGHT}</span><span>{CREDIT}</span></footer>
      </main>
      <Tooltip />
    </div>
  );
}
