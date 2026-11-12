/* API service layer.
   The frontend never talks to a news provider, an AI provider or the database directly, and it holds
   no credentials. It calls one backend (VITE_API_BASE_URL) which owns every secret. When no backend
   is configured, or it cannot be reached, the DemoProvider below serves the same interface locally. */
import type { ClassifyInput, ClassifyResult, Company, Pillar, RawIncident, Stage, Story, Workspace } from '../lib/types';
import { PILLARS, STAGES, clamp, genDemo, impactText, severity } from '../lib/model';

const env = import.meta.env;
export const config = {
  apiBaseUrl: (env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  forceDemo: env.VITE_DEMO_MODE === 'true',
  withCredentials: env.VITE_API_WITH_CREDENTIALS === 'true',
  timeoutMs: Number(env.VITE_API_TIMEOUT_MS) || 12000
};
export const backendConfigured = !!config.apiBaseUrl && !config.forceDemo;

export const WORKSPACE_KEY = 'esgwt.react.v1';
/** Random id that names this browser's workspace on the backend. It is not a credential. */
export function workspaceId(): string {
  try {
    let id = localStorage.getItem('esgwt.wsid');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('esgwt.wsid', id); }
    return id;
  } catch { return 'anonymous'; }
}

export interface ApiProvider {
  kind: 'demo' | 'remote';
  /** True when the backend answers. */
  health(): Promise<boolean>;
  /** News discovery: classified incidents for the given companies. */
  discoverNews(companies: Company[]): Promise<RawIncident[]>;
  /** AI classification of one article. */
  classifyArticle(input: ClassifyInput): Promise<ClassifyResult>;
  /** Optional AI executive summary. Null when the provider has none. */
  summarise(facts: unknown): Promise<string | null>;
  /** Database operations for the user's workspace. */
  loadWorkspace(): Promise<Workspace | null>;
  saveWorkspace(ws: Workspace): Promise<void>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

/* ---------------- remote: your backend ---------------- */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), config.timeoutMs);
  try {
    const res = await fetch(config.apiBaseUrl + path, {
      ...init, signal: ctl.signal, credentials: config.withCredentials ? 'include' : 'omit',
      headers: { Accept: 'application/json', 'X-Workspace-Id': workspaceId(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) }
    });
    if (!res.ok) throw new ApiError(`The server answered ${res.status} for ${path}.`, res.status);
    return (res.status === 204 ? null : await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof DOMException && e.name === 'AbortError' ? `The request to ${path} timed out.` : `The backend could not be reached for ${path}.`);
  } finally { clearTimeout(timer); }
}
const isPillar = (v: unknown): v is Pillar => v === 'E' || v === 'S' || v === 'G';
const isStage = (v: unknown): v is Stage => typeof v === 'string' && v in STAGES;
const num = (v: unknown) => clamp(Math.round(Number(v) || 0), 0, 100);

/** Backend records are untrusted input: keep only well-formed ones and recompute severity locally. */
function sanitiseIncidents(payload: unknown): RawIncident[] {
  const list = (payload as { incidents?: unknown })?.incidents;
  if (!Array.isArray(list)) throw new ApiError('The backend returned an unexpected news payload.');
  const out: RawIncident[] = [];
  for (const r of list as Record<string, unknown>[]) {
    if (!r || typeof r.id !== 'string' || typeof r.companyId !== 'string' || !isPillar(r.pillar) || !Array.isArray(r.stories)) continue;
    const pillar = r.pillar, sub = String(r.sub ?? PILLARS[pillar].subs[0]);
    const stories: Story[] = [];
    (r.stories as Record<string, unknown>[]).forEach((s, i) => {
      if (!s || typeof s.headline !== 'string' || !isStage(s.stage)) return;
      const date = typeof s.date === 'number' ? s.date : Date.parse(String(s.date));
      const url = typeof s.url === 'string' && /^https?:\/\//.test(s.url) ? s.url : null;
      const f = (s.factors ?? {}) as Record<string, unknown>;
      const factors = { magnitude: num(f.magnitude), scale: num(f.scale), regulatory: num(f.regulatory), reputational: num(f.reputational), financial: num(f.financial), recurrence: num(f.recurrence), credibility: num(f.credibility) };
      if (!Number.isFinite(date)) return;
      stories.push({ id: typeof s.id === 'string' ? s.id : `${r.id}-N${i + 1}`, incId: r.id as string, companyId: r.companyId as string, date, stage: s.stage, headline: s.headline, summary: String(s.summary ?? ''), publisher: String(s.publisher ?? 'Unknown publisher'), url, src: 'live', pillar, sub, factors, severity: severity(factors, s.stage), confidence: num(s.confidence), impact: String(s.impact ?? impactText(pillar, factors)), rationale: s.rationale ? String(s.rationale) : undefined, classifier: 'llm' });
    });
    if (stories.length) out.push({ id: r.id, companyId: r.companyId, pillar, sub, src: 'live', stories });
  }
  return out;
}

export const remoteProvider: ApiProvider = {
  kind: 'remote',
  async health() { try { await request<unknown>('/health'); return true; } catch { return false; } },
  async discoverNews(companies) {
    return sanitiseIncidents(await request<unknown>('/news/discover', { method: 'POST', body: JSON.stringify({ companies: companies.map(c => ({ id: c.id, name: c.name, ticker: c.ticker })), days: 90 }) }));
  },
  async classifyArticle(input) {
    const r = await request<Record<string, unknown>>('/ai/classify', { method: 'POST', body: JSON.stringify({ company: { id: input.company.id, name: input.company.name, industry: input.company.industry }, headline: input.headline, publisher: input.publisher, url: input.url, date: new Date(input.date).toISOString(), text: input.text.slice(0, 12000) }) });
    const pillar: Pillar = isPillar(r.pillar) ? r.pillar : 'G';
    return {
      esg_relevant: r.esg_relevant !== false, pillar,
      subcategory: PILLARS[pillar].subs.includes(String(r.subcategory)) ? String(r.subcategory) : PILLARS[pillar].subs[0],
      stage: isStage(r.stage) ? r.stage : 'allegation',
      magnitude: num(r.magnitude), scale: num(r.scale), regulatory: num(r.regulatory), reputational: num(r.reputational), financial: num(r.financial),
      source_credibility: num(r.source_credibility), confidence: num(r.confidence),
      summary: String(r.summary ?? '').slice(0, 500), business_impact: String(r.business_impact ?? '').slice(0, 500), rationale: String(r.rationale ?? '').slice(0, 500), classifier: 'llm'
    };
  },
  async summarise(facts) { const r = await request<{ text?: string }>('/ai/summarise', { method: 'POST', body: JSON.stringify({ facts }) }); return r?.text ? String(r.text) : null; },
  async loadWorkspace() { try { return await request<Workspace | null>('/workspace'); } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; } },
  async saveWorkspace(ws) { await request<unknown>('/workspace', { method: 'PUT', body: JSON.stringify(ws) }); }
};

/* ---------------- demo: no network, no credentials ---------------- */
const KEYWORDS: [Pillar, string, RegExp][] = [
  ['E', 'Pollution', /pollut|effluent|discharge|spill|emission norm|air quality|toxic/i],
  ['E', 'Carbon emissions', /carbon|co2|greenhouse|scope [123]|net.?zero/i],
  ['E', 'Water management', /groundwater|water (use|table|scarcity)|aquifer/i],
  ['E', 'Biodiversity', /forest|wildlife|biodiversity|mangrove|habitat/i],
  ['E', 'Waste management', /hazardous waste|landfill|waste (dump|disposal)|fly ash/i],
  ['E', 'Renewable energy', /greenwash|renewable|solar|wind power/i],
  ['E', 'Environmental violations', /environmental clearance|green tribunal|ngt|environment(al)? (penalty|violation)/i],
  ['E', 'Climate risk', /climate|flood|cyclone|heatwave/i],
  ['S', 'Employee safety', /worker(s)? (died|killed|injured)|fatal|accident|blast|fire at|safety (lapse|violation|inquiry)/i],
  ['S', 'Labour rights', /strike|wage|union|layoff|retrench|contract worker/i],
  ['S', 'Human rights', /human rights|forced labour|child labour|evict/i],
  ['S', 'Diversity and inclusion', /discriminat|harass|gender|caste bias|posh/i],
  ['S', 'Community impact', /land acquisition|villager|displace|protest by residents|tribal/i],
  ['S', 'Supply-chain labour practices', /supplier|vendor factor|supply chain|subcontract/i],
  ['S', 'Consumer protection', /recall|consumer (court|complaint|authority)|mislead|product (defect|safety)/i],
  ['G', 'Fraud', /fraud|embezzl|accounting irregular|misstat|ponzi|round.?tripping/i],
  ['G', 'Corruption', /brib|corrupt|kickback|cbi|graft/i],
  ['G', 'Data privacy', /data (breach|leak|exposure)|privacy|cyber.?attack|ransomware|hack/i],
  ['G', 'Financial transparency', /auditor|related.?party|disclosure|restat|qualified opinion/i],
  ['G', 'Regulatory non-compliance', /sebi|rbi|show.?cause|penalt|non.?complian|regulator/i],
  ['G', 'Board accountability', /board|independent director|proxy advis|shareholder vote/i],
  ['G', 'Executive misconduct', /ceo|cfo|executive|promoter|insider trading|resign/i],
  ['G', 'Corporate ethics', /antitrust|competition commission|cci|cartel|price.?fixing|whistleblow/i]
];
/** Keyword rules. Used only in demo mode and labelled as such: this is not an LLM. */
function ruleClassify(input: ClassifyInput): ClassifyResult {
  const text = `${input.headline}\n${input.text}`;
  let best: { p: Pillar; s: string; n: number } | null = null;
  for (const [p, s, re] of KEYWORDS) { const n = (text.match(new RegExp(re.source, 'gi')) ?? []).length; if (n && (!best || n > best.n)) best = { p, s, n }; }
  const has = (re: RegExp) => re.test(text);
  const stage: Stage = has(/remediat|settled|closed the (case|matter)|resolved|complied/i) ? 'resolved'
    : has(/fined|penalt(y|ies) (of|imposed)|convict|found guilty|order(ed)? to pay|upheld/i) ? 'confirmed'
    : has(/investigat|probe|inquiry|show.?cause|notice|raid|summon/i) ? 'investigation' : 'allegation';
  const big = has(/crore|billion|million|nationwide|thousands|death|died|killed/i);
  const base = stage === 'confirmed' ? 68 : stage === 'investigation' ? 58 : stage === 'resolved' ? 45 : 48;
  const pillar = best?.p ?? 'G';
  return {
    esg_relevant: !!best, pillar, subcategory: best?.s ?? PILLARS[pillar].subs[0], stage,
    magnitude: clamp(base + (big ? 14 : 0), 0, 100), scale: clamp(base - 6 + (big ? 16 : 0), 0, 100),
    regulatory: clamp(base + (stage === 'allegation' ? -12 : 10), 0, 100), reputational: clamp(base + 6, 0, 100), financial: clamp(base - 10 + (big ? 14 : 0), 0, 100),
    source_credibility: 60, confidence: clamp(38 + (best?.n ?? 0) * 6, 0, 62),
    summary: `Filed from the headline: "${input.headline.slice(0, 160)}". Demo mode does not write summaries; connect a backend for an AI summary.`,
    business_impact: '', rationale: best ? `Keyword rules matched ${best.n} term${best.n === 1 ? '' : 's'} for ${best.s.toLowerCase()} and stage wording for "${STAGES[stage].label.toLowerCase()}". This is a rule-based estimate, not an AI reading of the article.` : 'No ESG keyword matched.',
    classifier: 'rules'
  };
}
export const demoDiscover = (companies: Company[]): RawIncident[] => companies.flatMap(genDemo);
export const demoProvider: ApiProvider = {
  kind: 'demo',
  async health() { return true; },
  async discoverNews(companies) { return demoDiscover(companies); },
  async classifyArticle(input) { return ruleClassify(input); },
  async summarise() { return null; },
  async loadWorkspace() { try { return JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? 'null') as Workspace | null; } catch { return null; } },
  async saveWorkspace(ws) { try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws)); } catch { /* storage unavailable */ } }
};
