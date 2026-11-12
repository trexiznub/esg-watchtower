/* Domain model, scoring and the synthetic demo generator.
   Company reference facts are real. Everything produced by genDemo() is SYNTHETIC and is labelled
   as demo data wherever it is shown. */
import type { Company, Db, FactorKey, Factors, Incident, Pillar, RawIncident, Stage, Story, SubmittedArticle, Workspace } from './types';

export const DAY = 864e5;
export const TODAY = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); })();
export const P3: Pillar[] = ['E', 'S', 'G'];

export const PILLARS: Record<Pillar, { name: string; subs: string[] }> = {
  E: { name: 'Environmental', subs: ['Carbon emissions', 'Pollution', 'Water management', 'Biodiversity', 'Waste management', 'Climate risk', 'Renewable energy', 'Environmental violations'] },
  S: { name: 'Social', subs: ['Labour rights', 'Employee safety', 'Human rights', 'Diversity and inclusion', 'Community impact', 'Supply-chain labour practices', 'Consumer protection'] },
  G: { name: 'Governance', subs: ['Corruption', 'Fraud', 'Regulatory non-compliance', 'Board accountability', 'Executive misconduct', 'Data privacy', 'Financial transparency', 'Corporate ethics'] }
};
export const STAGES: Record<Stage, { label: string; mult: number; desc: string }> = {
  allegation: { label: 'Allegation', mult: 0.8, desc: 'A reported claim. No authority has verified it.' },
  investigation: { label: 'Under investigation', mult: 0.92, desc: 'A formal inquiry is open. No finding has been made.' },
  confirmed: { label: 'Confirmed violation', mult: 1, desc: 'An authority has confirmed a finding or penalty.' },
  resolved: { label: 'Resolved', mult: 0.55, desc: 'Remediated or formally closed.' }
};
export const FACTORS: [FactorKey, string, number][] = [
  ['magnitude', 'Magnitude of the incident', 0.22],
  ['scale', 'Scale of potential impact', 0.16],
  ['regulatory', 'Regulatory implications', 0.18],
  ['reputational', 'Reputational exposure', 0.16],
  ['financial', 'Financial implications', 0.14],
  ['recurrence', 'Recurrence', 0.09],
  ['credibility', 'Credibility of the source', 0.05]
];
export const BANDS = ['Low', 'Moderate', 'Elevated', 'High', 'Critical'];
export const BAND_RANGES = ['0–19', '20–39', '40–59', '60–79', '80–100'];
export const bandIx = (s: number) => (s >= 80 ? 4 : s >= 60 ? 3 : s >= 40 ? 2 : s >= 20 ? 1 : 0);
export const INV_STATES = ['New', 'Under review', 'Escalated', 'Monitoring', 'Closed'];
export const RES_STATES = ['Open', 'Mitigating', 'Resolved'];
const DEFAULT_INV: Record<Stage, string> = { allegation: 'New', investigation: 'Under review', confirmed: 'Escalated', resolved: 'Closed' };
const DEFAULT_RES: Record<Stage, string> = { allegation: 'Open', investigation: 'Open', confirmed: 'Mitigating', resolved: 'Resolved' };

export const CATALOG: Company[] = [
  { id: 'tatamotors', name: 'Tata Motors', ticker: 'TMCV', sector: 'Consumer Discretionary', industry: 'Automobiles', hq: 'Mumbai, Maharashtra', note: 'Ticker changed from TATAMOTORS after the 2025 demerger.' },
  { id: 'reliance', name: 'Reliance Industries', ticker: 'RELIANCE', sector: 'Energy', industry: 'Oil, Gas & Diversified', hq: 'Mumbai, Maharashtra' },
  { id: 'adanient', name: 'Adani Enterprises', ticker: 'ADANIENT', sector: 'Industrials', industry: 'Diversified Infrastructure', hq: 'Ahmedabad, Gujarat' },
  { id: 'infosys', name: 'Infosys', ticker: 'INFY', sector: 'Information Technology', industry: 'IT Services', hq: 'Bengaluru, Karnataka' },
  { id: 'itc', name: 'ITC', ticker: 'ITC', sector: 'Consumer Staples', industry: 'FMCG', hq: 'Kolkata, West Bengal' },
  { id: 'mm', name: 'Mahindra & Mahindra', ticker: 'M&M', sector: 'Consumer Discretionary', industry: 'Automobiles', hq: 'Mumbai, Maharashtra' },
  { id: 'tcs', name: 'Tata Consultancy Services', ticker: 'TCS', sector: 'Information Technology', industry: 'IT Services', hq: 'Mumbai, Maharashtra' },
  { id: 'wipro', name: 'Wipro', ticker: 'WIPRO', sector: 'Information Technology', industry: 'IT Services', hq: 'Bengaluru, Karnataka' },
  { id: 'hdfcbank', name: 'HDFC Bank', ticker: 'HDFCBANK', sector: 'Financials', industry: 'Banking', hq: 'Mumbai, Maharashtra' },
  { id: 'lt', name: 'Larsen & Toubro', ticker: 'LT', sector: 'Industrials', industry: 'Engineering & Construction', hq: 'Mumbai, Maharashtra' },
  { id: 'jswsteel', name: 'JSW Steel', ticker: 'JSWSTEEL', sector: 'Materials', industry: 'Steel', hq: 'Mumbai, Maharashtra' },
  { id: 'tatasteel', name: 'Tata Steel', ticker: 'TATASTEEL', sector: 'Materials', industry: 'Steel', hq: 'Mumbai, Maharashtra' },
  { id: 'vedanta', name: 'Vedanta', ticker: 'VEDL', sector: 'Materials', industry: 'Metals & Mining', hq: 'Mumbai, Maharashtra' },
  { id: 'coalindia', name: 'Coal India', ticker: 'COALINDIA', sector: 'Energy', industry: 'Coal Mining', hq: 'Kolkata, West Bengal' },
  { id: 'ntpc', name: 'NTPC', ticker: 'NTPC', sector: 'Utilities', industry: 'Power Generation', hq: 'New Delhi' },
  { id: 'hul', name: 'Hindustan Unilever', ticker: 'HINDUNILVR', sector: 'Consumer Staples', industry: 'FMCG', hq: 'Mumbai, Maharashtra' },
  { id: 'maruti', name: 'Maruti Suzuki India', ticker: 'MARUTI', sector: 'Consumer Discretionary', industry: 'Automobiles', hq: 'New Delhi' },
  { id: 'sunpharma', name: 'Sun Pharmaceutical Industries', ticker: 'SUNPHARMA', sector: 'Health Care', industry: 'Pharmaceuticals', hq: 'Mumbai, Maharashtra' },
  { id: 'airtel', name: 'Bharti Airtel', ticker: 'BHARTIARTL', sector: 'Communication Services', industry: 'Telecom', hq: 'New Delhi' },
  { id: 'ultratech', name: 'UltraTech Cement', ticker: 'ULTRACEMCO', sector: 'Materials', industry: 'Cement', hq: 'Mumbai, Maharashtra' }
];
export const DEFAULT_WATCH = ['tatamotors', 'reliance', 'adanient', 'infosys', 'itc', 'mm'];
const UNKNOWN: Company = { id: 'unknown', name: 'Unknown company', ticker: '?', sector: 'Unknown', industry: 'Unknown', hq: 'Unknown' };
export const coById = (id: string): Company => CATALOG.find(c => c.id === id) ?? UNKNOWN;

interface Tpl { p: Pillar; s: string; h: string; t: string; f: number[]; path: Stage[]; }
const TPL: Tpl[] = [
  { p: 'E', s: 'Carbon emissions', h: 'Investor group questions pace of Scope 1 emission cuts', t: 'the pace of emission reductions', f: [38, 45, 30, 50, 30], path: ['allegation'] },
  { p: 'E', s: 'Pollution', h: 'Pollution board issues notice over effluent discharge at a plant', t: 'effluent discharge at a plant', f: [68, 60, 78, 62, 52], path: ['investigation', 'confirmed', 'resolved'] },
  { p: 'E', s: 'Water management', h: 'Community groups allege groundwater depletion near a facility', t: 'groundwater use near a facility', f: [55, 58, 48, 60, 35], path: ['allegation', 'investigation'] },
  { p: 'E', s: 'Biodiversity', h: 'Expansion project faces objections over forest land diversion', t: 'forest land diversion for an expansion project', f: [60, 66, 62, 68, 48], path: ['allegation', 'investigation'] },
  { p: 'E', s: 'Waste management', h: 'Audit flags hazardous-waste storage lapses at a unit', t: 'hazardous-waste storage at a unit', f: [48, 40, 58, 42, 30], path: ['investigation', 'resolved'] },
  { p: 'E', s: 'Climate risk', h: 'Analysts flag physical climate risk to coastal assets', t: 'climate exposure of coastal assets', f: [30, 52, 18, 28, 46], path: ['allegation'] },
  { p: 'E', s: 'Renewable energy', h: 'Complaint calls renewable-energy claims greenwashing', t: 'renewable-energy marketing claims', f: [44, 40, 52, 70, 30], path: ['allegation', 'investigation'] },
  { p: 'E', s: 'Environmental violations', h: 'Tribunal imposes penalty for environmental clearance breach', t: 'an environmental clearance breach', f: [94, 84, 96, 90, 84], path: ['confirmed'] },
  { p: 'S', s: 'Labour rights', h: 'Contract workers protest over wage arrears', t: 'contract-worker wage arrears', f: [50, 46, 44, 56, 30], path: ['allegation', 'resolved'] },
  { p: 'S', s: 'Employee safety', h: 'Worker injured in plant incident; safety inquiry ordered', t: 'a workplace safety incident', f: [72, 50, 70, 66, 44], path: ['investigation', 'confirmed'] },
  { p: 'S', s: 'Employee safety', h: 'Union raises concerns over safety equipment on assembly line', t: 'safety equipment on an assembly line', f: [46, 44, 42, 48, 24], path: ['allegation'] },
  { p: 'S', s: 'Human rights', h: 'NGO report alleges rights concerns at a supplier site', t: 'rights concerns at a supplier site', f: [66, 60, 54, 78, 40], path: ['allegation', 'investigation'] },
  { p: 'S', s: 'Diversity and inclusion', h: 'Former employee files workplace discrimination complaint', t: 'a workplace discrimination complaint', f: [36, 28, 40, 52, 20], path: ['allegation'] },
  { p: 'S', s: 'Community impact', h: 'Residents oppose land acquisition for a new project', t: 'land acquisition for a new project', f: [58, 62, 50, 64, 46], path: ['allegation', 'investigation'] },
  { p: 'S', s: 'Supply-chain labour practices', h: 'Supplier audit finds excessive overtime at vendor factories', t: 'overtime at vendor factories', f: [54, 56, 46, 60, 34], path: ['allegation', 'resolved'] },
  { p: 'S', s: 'Consumer protection', h: 'Consumer authority reviews complaints over product claims', t: 'product-claim complaints', f: [44, 54, 62, 50, 40], path: ['investigation', 'resolved'] },
  { p: 'G', s: 'Corruption', h: 'Anti-corruption agency examines a contract award process', t: 'a contract award process', f: [80, 66, 86, 82, 68], path: ['investigation'] },
  { p: 'G', s: 'Fraud', h: 'Whistleblower letter alleges accounting irregularities', t: 'alleged accounting irregularities', f: [78, 72, 76, 84, 80], path: ['allegation', 'investigation'] },
  { p: 'G', s: 'Regulatory non-compliance', h: 'Market regulator seeks clarification on disclosure lapses', t: 'disclosure lapses', f: [52, 44, 72, 50, 38], path: ['investigation', 'resolved'] },
  { p: 'G', s: 'Board accountability', h: 'Proxy adviser recommends vote against director reappointment', t: 'a director reappointment', f: [32, 30, 24, 44, 22], path: ['allegation'] },
  { p: 'G', s: 'Executive misconduct', h: 'Senior executive steps aside pending conduct inquiry', t: 'an executive conduct inquiry', f: [62, 42, 50, 74, 36], path: ['investigation', 'resolved'] },
  { p: 'G', s: 'Data privacy', h: 'Customer data exposure reported; regulator seeks incident report', t: 'a customer data exposure', f: [86, 90, 90, 86, 74], path: ['investigation', 'confirmed'] },
  { p: 'G', s: 'Financial transparency', h: 'Auditor qualifies opinion on related-party transactions', t: 'related-party transaction disclosures', f: [88, 78, 92, 90, 90], path: ['confirmed'] },
  { p: 'G', s: 'Corporate ethics', h: 'Competition authority opens inquiry into pricing practices', t: 'pricing practices', f: [64, 68, 80, 60, 66], path: ['investigation', 'confirmed'] }
];
const PUBLISHERS = [
  { name: 'Demo Newswire (synthetic)', cred: 86 },
  { name: 'Demo Business Daily (synthetic)', cred: 74 },
  { name: 'Demo Regional Desk (synthetic)', cred: 58 }
];
const IMPACT: Record<Pillar, string> = {
  E: 'Possible outcomes include remediation costs, permit conditions and closer scrutiny from lenders with environmental covenants.',
  S: 'Possible outcomes include production disruption, higher labour-relations costs and questions from customers with supplier codes of conduct.',
  G: 'Possible outcomes include regulatory penalties, a higher cost of capital and pressure from institutional investors on oversight.'
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function hash(str: string) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Severity 0-100: weighted factor sum times the evidence-stage multiplier. */
export function severity(factors: Factors, stage: Stage) {
  const raw = FACTORS.reduce((s, [k, , w]) => s + w * (factors[k] || 0), 0);
  return Math.round(clamp(raw * STAGES[stage].mult, 0, 100));
}
export function impactText(pillar: Pillar, factors: Factors) {
  const top = FACTORS.filter(f => f[0] !== 'credibility').map(([k, l]) => [l.toLowerCase(), factors[k]] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return `${IMPACT[pillar]} Main score drivers: ${top[0][0]} (${top[0][1]}) and ${top[1][0]} (${top[1][1]}).`;
}
function storyText(tpl: Tpl, stage: Stage, first: boolean) {
  const head = first ? tpl.h : stage === 'investigation' ? `Regulator opens formal inquiry into ${tpl.t}` : stage === 'confirmed' ? `Authority confirms findings on ${tpl.t}` : stage === 'resolved' ? `Company reports remediation complete on ${tpl.t}` : tpl.h;
  const sum = stage === 'allegation' ? `A claim has been reported concerning ${tpl.t}. No regulator or court has verified it, and the company has not been found at fault.`
    : stage === 'investigation' ? `A formal inquiry is open into ${tpl.t}. No finding has been made and the outcome is uncertain.`
    : stage === 'confirmed' ? `An authority has confirmed findings relating to ${tpl.t}. Penalties or corrective orders may follow.`
    : `The company reports that remediation on ${tpl.t} is complete and the matter is treated as closed.`;
  return { headline: 'Demo: ' + head, summary: 'Synthetic demo scenario. ' + sum };
}

/** Deterministic synthetic incidents for one company, spread over the last ~90 days. */
export function genDemo(co: Company): RawIncident[] {
  const r = rng(hash(co.id + ':v3'));
  const n = 4 + Math.floor(r() * 5);
  const bias: Record<Pillar, number> = { E: 0.6 + r(), S: 0.6 + r(), G: 0.6 + r() };
  const picks = [];
  for (let i = 0; i < n; i++) {
    let best = TPL[0], bs = -1;
    for (const t of TPL) { const sc = r() * bias[t.p]; if (sc > bs) { bs = sc; best = t; } }
    picks.push({ tpl: best, start: 2 + Math.floor(r() * 86), pub: PUBLISHERS[Math.floor(r() * 3)], noise: FACTORS.map(() => Math.round((r() - 0.5) * 22)), gaps: [5 + Math.floor(r() * 12), 6 + Math.floor(r() * 14)], conf: 62 + Math.floor(r() * 33) });
  }
  picks.sort((a, b) => b.start - a.start);
  const seen: Record<Pillar, number> = { E: 0, S: 0, G: 0 };
  return picks.map((pk, i) => {
    const { tpl } = pk;
    const base = (j: number) => clamp(tpl.f[j] + pk.noise[j], 5, 100);
    const factors: Factors = { magnitude: base(0), scale: base(1), regulatory: base(2), reputational: base(3), financial: base(4), recurrence: clamp(12 + seen[tpl.p] * 26, 0, 100), credibility: pk.pub.cred };
    seen[tpl.p]++;
    const id = `INC-${co.ticker.replace(/[^A-Z]/g, '').slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
    const stories: Story[] = []; let ago = pk.start;
    tpl.path.forEach((stage, j) => {
      if (j > 0) ago -= pk.gaps[j - 1];
      if (ago < 0) return;
      const tx = storyText(tpl, stage, j === 0);
      stories.push({ id: `${id}-N${j + 1}`, incId: id, companyId: co.id, date: TODAY - ago * DAY, stage, headline: tx.headline, summary: tx.summary, publisher: pk.pub.name, url: null, src: 'demo', pillar: tpl.p, sub: tpl.s, factors, severity: severity(factors, stage), confidence: clamp(pk.conf - (stage === 'allegation' ? 6 : 0), 40, 98), impact: impactText(tpl.p, factors) });
    });
    return { id, companyId: co.id, pillar: tpl.p, sub: tpl.s, src: 'demo' as const, stories };
  });
}
export function submittedToIncident(a: SubmittedArticle): RawIncident {
  return { id: a.id, companyId: a.companyId, pillar: a.pillar, sub: a.sub, src: 'user', stories: [{ id: a.id + '-N1', incId: a.id, companyId: a.companyId, date: a.date, stage: a.stage, headline: a.headline, summary: a.summary, publisher: a.publisher, url: a.url, src: 'user', pillar: a.pillar, sub: a.sub, factors: a.factors, severity: severity(a.factors, a.stage), confidence: a.confidence, impact: a.impact, rationale: a.rationale, classifier: a.classifier }] };
}

/* ---- derived views ---- */
type HasStories = { stories: Story[]; pillar: Pillar };
export function curStory(inc: HasStories, t = TODAY): Story | null { let s: Story | null = null; for (const x of inc.stories) if (x.date <= t) s = x; return s; }
export function exposure(incs: HasStories[], t: number, pillar?: Pillar | null) {
  let e = 0;
  for (const inc of incs) {
    if (pillar && inc.pillar !== pillar) continue;
    const s = curStory(inc, t); if (!s) continue;
    e += s.severity * Math.pow(0.5, (t - s.date) / (45 * DAY));
  }
  return e;
}
/** Risk score 0-100: saturating function of recency-weighted severity, half-life 45 days. */
export function riskScore(incs: HasStories[], t = TODAY, pillar: Pillar | null = null) {
  return Math.round(100 * (1 - Math.exp(-exposure(incs, t, pillar) / (pillar ? 160 : 260))));
}

/** Joins raw incidents with the user's overrides (status, notes, review marks). */
export function buildDb(ws: Workspace, raw: RawIncident[]): Db {
  const cos = ws.watch.map(coById).filter(c => c.id !== 'unknown');
  const ids = new Set(cos.map(c => c.id));
  const all = [...raw, ...ws.submitted.map(submittedToIncident)].filter(i => ids.has(i.companyId) && i.stories.length);
  const byCo: Record<string, Incident[]> = {}; cos.forEach(c => (byCo[c.id] = []));
  const incs: Incident[] = all.map(r => {
    const stories = [...r.stories].sort((a, b) => a.date - b.date);
    const cs = curStory({ stories, pillar: r.pillar }) ?? stories[0], o = ws.overrides[r.id] ?? {};
    const inc: Incident = { ...r, stories, cur: cs, sev: cs.severity, detected: stories[0].date, inv: o.inv ?? DEFAULT_INV[cs.stage], res: o.res ?? DEFAULT_RES[cs.stage], reviewed: !!o.reviewed, notes: o.notes ?? [], log: o.log ?? [], co: coById(r.companyId) };
    byCo[r.companyId].push(inc);
    return inc;
  });
  return { cos, incs, byCo, stories: incs.flatMap(i => i.stories).sort((a, b) => b.date - a.date) };
}
export const coScore = (db: Db, id: string, p: Pillar | null = null, t = TODAY) => riskScore(db.byCo[id] ?? [], t, p);
export const mean = (a: number[]) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0);
export const portScore = (db: Db, p: Pillar | null = null, t = TODAY, cos: Company[] = db.cos) => mean(cos.map(c => coScore(db, c.id, p, t)));
export const activeIncs = (db: Db) => db.incs.filter(i => i.res !== 'Resolved');
export const needsReview = (db: Db) => activeIncs(db).filter(i => i.sev >= 60 && !i.reviewed).sort((a, b) => b.sev - a.sev);

export const fmtD = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtDY = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtT = (t: number) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const initials = (n: string) => n.replace(/&/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
