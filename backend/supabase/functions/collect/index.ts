// Scheduled collector. Call hourly with the header  x-cron-secret: <CRON_SECRET>.
//   1. Search GDELT (free, no key) for recent news on a few watched companies.
//   2. Read any RSS feeds listed in the rss_feeds table.
//   3. Classify new articles with the LLM and group them into incidents.
// Each run does a bounded amount of work so it fits the Edge Function time limit;
// companies are taken in rotation, least recently collected first.
import { classify, db, json } from '../_shared/core.ts';

const COMPANIES_PER_RUN = 5;
const CLASSIFY_PER_RUN = Number(Deno.env.get('CLASSIFY_PER_RUN') ?? 20);
const BUDGET_MS = 120_000;
const ESG_TERMS = '(pollution OR emissions OR environmental OR "safety" OR workers OR strike OR "human rights" OR fraud OR bribery OR probe OR investigation OR regulator OR penalty OR fine OR lawsuit OR "data breach" OR whistleblower OR greenwashing OR SEBI OR tribunal)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const coreName = (name: string) => name.replace(/\b(Industries|Enterprises|India|Limited|Ltd)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
const mentions = (title: string, name: string) => new RegExp(`(^|[^a-z0-9])${coreName(name).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(title.toLowerCase());

interface Company { id: string; name: string; last_collected_at: string | null; }
interface Found { company_id: string; url: string; headline: string; publisher: string; published_at: string; }

function gdeltDate(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s ?? '');
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : new Date().toISOString();
}
async function searchGdelt(c: Company): Promise<Found[]> {
  const q = `"${coreName(c.name)}" ${ESG_TERMS} sourcelang:english`;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=40&sort=datedesc&timespan=${c.last_collected_at ? '3d' : '30d'}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'esg-watchtower-collector' } });
  const body = await res.text();
  if (!res.ok || !body.trim().startsWith('{')) { console.warn('GDELT', c.id, res.status, body.slice(0, 120)); return []; }
  const list = (JSON.parse(body).articles ?? []) as { url?: string; title?: string; domain?: string; seendate?: string }[];
  return list.filter((a) => a.url && a.title && /^https?:\/\//.test(a.url) && mentions(a.title, c.name))
    .map((a) => ({ company_id: c.id, url: a.url!, headline: a.title!.trim().slice(0, 300), publisher: a.domain ?? 'unknown', published_at: gdeltDate(a.seendate ?? '') }));
}
const unwrap = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
async function readFeed(feed: string, companies: Company[]): Promise<Found[]> {
  const res = await fetch(feed, { headers: { 'User-Agent': 'esg-watchtower-collector' } });
  if (!res.ok) return [];
  const xml = (await res.text()).slice(0, 2_000_000), out: Found[] = [];
  const host = new URL(feed).hostname.replace(/^www\./, '');
  for (const item of xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? []) {
    const title = unwrap(/<title>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? ''), link = unwrap(/<link>([\s\S]*?)<\/link>/.exec(item)?.[1] ?? '');
    const date = new Date(unwrap(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)?.[1] ?? ''));
    if (!title || !/^https?:\/\//.test(link)) continue;
    for (const c of companies) if (mentions(title, c.name)) out.push({ company_id: c.id, url: link, headline: title.slice(0, 300), publisher: host, published_at: (isNaN(date.getTime()) ? new Date() : date).toISOString() });
  }
  return out;
}
async function store(found: Found[]): Promise<number> {
  if (!found.length) return 0;
  const { data, error } = await db.from('articles').upsert(found, { onConflict: 'url', ignoreDuplicates: true }).select('id');
  if (error) console.error('insert', error.message);
  return data?.length ?? 0;
}

async function classifyNew(started: number, names: Map<string, string>) {
  const { data: fresh } = await db.from('articles').select('id, company_id, headline, publisher, published_at').eq('status', 'new').order('published_at', { ascending: false }).limit(CLASSIFY_PER_RUN);
  let done = 0, kept = 0;
  for (const a of fresh ?? []) {
    if (Date.now() - started > BUDGET_MS) break;
    try {
      const r = await classify({ name: names.get(a.company_id) ?? a.company_id }, a.headline, a.publisher ?? 'unknown', '');
      done++;
      if (!r.esg_relevant || !r.about_company) { await db.from('articles').update({ status: 'irrelevant', rationale: r.rationale }).eq('id', a.id); continue; }
      // Same company and subcategory within 30 days joins the existing incident's timeline.
      const windowStart = new Date(new Date(a.published_at).getTime() - 30 * 864e5).toISOString();
      const { data: open } = await db.from('incidents').select('id, last_story_at').eq('company_id', a.company_id).eq('pillar', r.pillar).eq('sub', r.subcategory).gte('last_story_at', windowStart).order('last_story_at', { ascending: false }).limit(1);
      let incidentId = open?.[0]?.id as string | undefined;
      const { count } = await db.from('incidents').select('id', { count: 'exact', head: true }).eq('company_id', a.company_id).eq('pillar', r.pillar).gte('created_at', new Date(Date.now() - 90 * 864e5).toISOString());
      const prior = Math.max(0, (count ?? 0) - (incidentId ? 1 : 0));
      if (!incidentId) {
        incidentId = `INC-${a.company_id.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
        await db.from('incidents').insert({ id: incidentId, company_id: a.company_id, pillar: r.pillar, sub: r.subcategory, last_story_at: a.published_at });
      } else if (new Date(a.published_at) > new Date(open![0].last_story_at)) {
        await db.from('incidents').update({ last_story_at: a.published_at }).eq('id', incidentId);
      }
      const factors = { magnitude: r.magnitude, scale: r.scale, regulatory: r.regulatory, reputational: r.reputational, financial: r.financial, recurrence: Math.min(100, 12 + prior * 26), credibility: r.source_credibility };
      await db.from('articles').update({ status: 'classified', incident_id: incidentId, stage: r.stage, summary: r.summary, impact: r.business_impact, rationale: r.rationale, confidence: r.confidence, factors }).eq('id', a.id);
      kept++;
    } catch (e) {
      console.error('classify', a.id, e);
      await db.from('articles').update({ status: 'failed' }).eq('id', a.id);
    }
  }
  return { done, kept };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Forbidden' }, 403);
  const started = Date.now();
  const { data: all } = await db.from('watched_companies').select('id, name, last_collected_at').order('last_collected_at', { ascending: true, nullsFirst: true });
  const companies = (all ?? []) as Company[];
  let inserted = 0;
  for (const [i, c] of companies.slice(0, COMPANIES_PER_RUN).entries()) {
    if (i > 0) await sleep(5500); // GDELT asks for at most one request every five seconds
    try { inserted += await store(await searchGdelt(c)); } catch (e) { console.error('gdelt', c.id, e); }
    await db.from('watched_companies').update({ last_collected_at: new Date().toISOString() }).eq('id', c.id);
  }
  const { data: feeds } = await db.from('rss_feeds').select('url').limit(5);
  for (const f of feeds ?? []) { try { inserted += await store(await readFeed(f.url, companies)); } catch (e) { console.error('rss', f.url, e); } }
  const result = await classifyNew(started, new Map(companies.map((c) => [c.id, c.name])));
  return json({ companies: Math.min(companies.length, COMPANIES_PER_RUN), inserted, classified: result.done, kept: result.kept, ms: Date.now() - started });
});
