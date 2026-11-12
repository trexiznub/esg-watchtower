// Shared helpers for the ESG Watchtower Edge Functions (Deno runtime).
import { createClient } from 'jsr:@supabase/supabase-js@2';

export const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
export const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, accept, authorization, x-workspace-id',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin'
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const PILLARS: Record<string, string[]> = {
  E: ['Carbon emissions', 'Pollution', 'Water management', 'Biodiversity', 'Waste management', 'Climate risk', 'Renewable energy', 'Environmental violations'],
  S: ['Labour rights', 'Employee safety', 'Human rights', 'Diversity and inclusion', 'Community impact', 'Supply-chain labour practices', 'Consumer protection'],
  G: ['Corruption', 'Fraud', 'Regulatory non-compliance', 'Board accountability', 'Executive misconduct', 'Data privacy', 'Financial transparency', 'Corporate ethics']
};
export const STAGES = ['allegation', 'investigation', 'confirmed', 'resolved'];
export const num = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** One call to the Anthropic Messages API. The key never leaves the server. */
export async function askClaude(prompt: string, maxTokens = 600): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
}
export function parseJson(text: string): Record<string, unknown> {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The model did not return JSON');
  return JSON.parse(text.slice(a, b + 1));
}

export interface Classification {
  esg_relevant: boolean; about_company: boolean; pillar: string; subcategory: string; stage: string;
  magnitude: number; scale: number; regulatory: number; reputational: number; financial: number;
  source_credibility: number; confidence: number; summary: string; business_impact: string; rationale: string;
}
/** Classifies one article. `text` may be empty, in which case only the headline is judged. */
export async function classify(company: { name: string; industry?: string }, headline: string, publisher: string, text: string): Promise<Classification> {
  const prompt = `You are an ESG controversy analyst. Classify the news item below with respect to the company ${company.name}${company.industry ? ` (${company.industry})` : ''}.
Return ONLY a JSON object with these keys:
"about_company": boolean, true only if the item is substantially about ${company.name} itself,
"esg_relevant": boolean, true only if it reports an environmental, social or governance controversy or risk event,
"pillar": "E" | "S" | "G",
"subcategory": the exact string from this list for the chosen pillar: ${JSON.stringify(PILLARS)},
"stage": "allegation" (reported claim, unverified) | "investigation" (formal inquiry open, no finding) | "confirmed" (an authority confirmed a finding or penalty) | "resolved" (remediated or closed),
"magnitude", "scale", "regulatory", "reputational", "financial": integers 0-100,
"source_credibility": integer 0-100 for the publisher "${publisher}",
"confidence": integer 0-100; use a lower value when you only have a headline,
"summary": at most 45 words, neutral, in your own words, no quotations,
"business_impact": at most 40 words,
"rationale": at most 40 words explaining the stage and scores.
Rules: use only what the item states. Do not treat negative coverage as proof of wrongdoing. Routine business news, results, product launches and stock moves are not ESG controversies.

HEADLINE: ${headline}
${text ? `ARTICLE:\n${text.slice(0, 12000)}` : '(Only the headline is available.)'}`;
  const r = parseJson(await askClaude(prompt));
  const pillar = ['E', 'S', 'G'].includes(String(r.pillar)) ? String(r.pillar) : 'G';
  return {
    esg_relevant: r.esg_relevant === true, about_company: r.about_company !== false, pillar,
    subcategory: PILLARS[pillar].includes(String(r.subcategory)) ? String(r.subcategory) : PILLARS[pillar][0],
    stage: STAGES.includes(String(r.stage)) ? String(r.stage) : 'allegation',
    magnitude: num(r.magnitude), scale: num(r.scale), regulatory: num(r.regulatory), reputational: num(r.reputational), financial: num(r.financial),
    source_credibility: num(r.source_credibility), confidence: num(r.confidence),
    summary: String(r.summary ?? '').slice(0, 500), business_impact: String(r.business_impact ?? '').slice(0, 500), rationale: String(r.rationale ?? '').slice(0, 500)
  };
}
