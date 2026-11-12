// Public API for the static frontend. Base URL: https://<project-ref>.supabase.co/functions/v1/api
//   GET  /health            availability check
//   POST /news/discover     classified incidents for the given companies (read from the database)
//   POST /ai/classify       classify one submitted article with the LLM
//   POST /ai/summarise      draft the weekly digest summary
//   GET  /workspace         load the caller's workspace
//   PUT  /workspace         save the caller's workspace
import { askClaude, classify, cors, db, json } from '../_shared/core.ts';

const DAILY_AI_CALLS = Number(Deno.env.get('DAILY_AI_CALLS_PER_IP') ?? 40);
const ID = /^[a-z0-9_-]{1,40}$/;
const WS = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function limited(req: Request): Promise<boolean> {
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const { data, error } = await db.rpc('bump_usage', { k: ip });
  return !error && Number(data) > DAILY_AI_CALLS;
}

async function discover(req: Request) {
  const body = await req.json().catch(() => ({}));
  const companies = (Array.isArray(body.companies) ? body.companies : []).filter((c: { id?: unknown; name?: unknown }) => typeof c?.id === 'string' && ID.test(c.id) && typeof c?.name === 'string').slice(0, 30);
  if (!companies.length) return json({ incidents: [] });
  // Register companies so the scheduled collector starts following them.
  await db.from('watched_companies').upsert(companies.map((c: { id: string; name: string; ticker?: string }) => ({ id: c.id, name: c.name.slice(0, 120), ticker: String(c.ticker ?? '').slice(0, 20) })), { onConflict: 'id', ignoreDuplicates: true });
  const days = Math.max(1, Math.min(180, Number(body.days) || 90));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await db.from('articles')
    .select('id, company_id, url, headline, publisher, published_at, stage, summary, impact, rationale, confidence, factors, incident_id, incidents ( pillar, sub )')
    .eq('status', 'classified').in('company_id', companies.map((c: { id: string }) => c.id)).gte('published_at', since)
    .order('published_at', { ascending: true }).limit(1000);
  if (error) return json({ error: 'Database query failed' }, 500);
  // deno-lint-ignore no-explicit-any
  const byInc = new Map<string, any>();
  // deno-lint-ignore no-explicit-any
  for (const a of (data ?? []) as any[]) {
    const inc = Array.isArray(a.incidents) ? a.incidents[0] : a.incidents;
    if (!a.incident_id || !inc) continue;
    if (!byInc.has(a.incident_id)) byInc.set(a.incident_id, { id: a.incident_id, companyId: a.company_id, pillar: inc.pillar, sub: inc.sub, stories: [] });
    byInc.get(a.incident_id).stories.push({ id: `${a.incident_id}-A${a.id}`, headline: a.headline, publisher: a.publisher, url: a.url, date: a.published_at, stage: a.stage, summary: a.summary, impact: a.impact, rationale: a.rationale, confidence: a.confidence, factors: a.factors });
  }
  return json({ incidents: [...byInc.values()] });
}

async function classifyRoute(req: Request) {
  if (await limited(req)) return json({ error: 'Daily limit reached' }, 429);
  const b = await req.json().catch(() => ({}));
  const headline = String(b.headline ?? '').slice(0, 300), text = String(b.text ?? '');
  if (!headline || text.length < 80 || typeof b.company?.name !== 'string') return json({ error: 'headline, text and company are required' }, 400);
  const r = await classify({ name: b.company.name.slice(0, 120), industry: String(b.company.industry ?? '').slice(0, 80) }, headline, String(b.publisher ?? 'unknown').slice(0, 80), text);
  return json({ ...r, esg_relevant: r.esg_relevant });
}

async function summarise(req: Request) {
  if (await limited(req)) return json({ error: 'Daily limit reached' }, 429);
  const b = await req.json().catch(() => ({}));
  const facts = JSON.stringify(b.facts ?? {}).slice(0, 6000);
  const text = await askClaude(`Write an executive summary of at most 90 words for a weekly ESG risk digest, for a risk committee. Plain prose, no bullets, no headings. Use only the figures below. Distinguish allegations and investigations from confirmed findings.\n\n${facts}`, 300);
  return json({ text: text.trim() });
}

async function workspace(req: Request) {
  const id = req.headers.get('x-workspace-id') ?? '';
  if (!WS.test(id)) return json({ error: 'A valid X-Workspace-Id header is required' }, 400);
  if (req.method === 'GET') {
    const { data } = await db.from('workspaces').select('payload').eq('id', id).maybeSingle();
    return data ? json(data.payload) : json({ error: 'Not found' }, 404);
  }
  const raw = await req.text();
  if (raw.length > 200_000) return json({ error: 'Workspace too large' }, 413);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { error } = await db.from('workspaces').upsert({ id, payload, updated_at: new Date().toISOString() });
  return error ? json({ error: 'Save failed' }, 500) : json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const path = new URL(req.url).pathname.replace(/^.*\/api(?=\/|$)/, '') || '/';
  try {
    if (req.method === 'GET' && path === '/health') return json({ ok: true, time: new Date().toISOString() });
    if (req.method === 'POST' && path === '/news/discover') return await discover(req);
    if (req.method === 'POST' && path === '/ai/classify') return await classifyRoute(req);
    if (req.method === 'POST' && path === '/ai/summarise') return await summarise(req);
    if ((req.method === 'GET' || req.method === 'PUT') && path === '/workspace') return await workspace(req);
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: 'Internal error' }, 500);
  }
});
