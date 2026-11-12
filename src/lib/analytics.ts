/* Portfolio analytics: trends, weekly buckets, the transparent pattern engine and the weekly digest. */
import type { Company, Db, Incident, Pillar, Prefs, Story } from './types';
import { DAY, P3, PILLARS, STAGES, TODAY, coById, coScore, exposure, fmtD, fmtDY, mean, portScore, riskScore } from './model';

export function trendSeries(db: Db, days: number, cos: Company[] = db.cos) {
  const step = days > 60 ? 3 : days > 30 ? 2 : 1;
  const labels: string[] = [], o: number[] = [], e: number[] = [], s: number[] = [], g: number[] = [];
  for (let d = days; d >= 0; d -= step) {
    const t = TODAY - d * DAY; labels.push(fmtD(t));
    o.push(portScore(db, null, t, cos)); e.push(portScore(db, 'E', t, cos)); s.push(portScore(db, 'S', t, cos)); g.push(portScore(db, 'G', t, cos));
  }
  return { labels, o, e, s, g };
}
export function weeks(n = 13) { const w: { a: number; b: number }[] = []; for (let k = n - 1; k >= 0; k--) w.push({ a: TODAY - (k + 1) * 7 * DAY, b: TODAY - k * 7 * DAY }); return w; }

export interface Insight { type: string; pillar: Pillar | null; co: Company; w: number; title: string; text: string; why: string; ev: Incident[]; }

/** Rule-based signals for one company. Every signal carries the rule and the matched evidence. */
export function insights(db: Db, coId: string): Insight[] {
  const incs = db.byCo[coId] ?? [], co = coById(coId), out: Insight[] = [];
  if (!incs.length) return out;
  const ids = (l: Incident[]) => l.map(i => i.id).join(', ');
  for (const p of P3) {
    const list = incs.filter(i => i.pillar === p), bySub: Record<string, Incident[]> = {};
    list.forEach(i => (bySub[i.sub] = bySub[i.sub] ?? []).push(i));
    const rep = Object.entries(bySub).filter(([, l]) => l.length >= 2);
    rep.forEach(([sub, l]) => out.push({ type: 'Repeated pattern', pillar: p, co, w: 60 + l.length * 10, title: `Recurring ${PILLARS[p].name.toLowerCase()} pattern: ${sub.toLowerCase()}`, text: `${l.length} separate incidents on ${sub.toLowerCase()} were detected for ${co.name} in the last 90 days.`, why: `Rule: two or more incidents in the same subcategory within 90 days. Matched ${ids(l)}. Their current severities are ${l.map(i => i.sev).join(', ')}.`, ev: l }));
    if (!rep.length && list.length >= 3) out.push({ type: 'Repeated pattern', pillar: p, co, w: 55 + list.length * 5, title: `Cluster of ${PILLARS[p].name.toLowerCase()} incidents`, text: `${list.length} ${PILLARS[p].name.toLowerCase()} incidents across ${new Set(list.map(i => i.sub)).size} subcategories in 90 days.`, why: `Rule: three or more incidents in one pillar within 90 days. Matched ${ids(list)}.`, ev: list });
  }
  const ex: Record<Pillar, number> = { E: exposure(incs, TODAY, 'E'), S: exposure(incs, TODAY, 'S'), G: exposure(incs, TODAY, 'G') }, tot = ex.E + ex.S + ex.G;
  const top = (Object.entries(ex) as [Pillar, number][]).sort((a, b) => b[1] - a[1])[0];
  if (tot && top[1] / tot >= 0.5 && incs.length >= 3) out.push({ type: 'Risk concentration', pillar: top[0], co, w: 50 + Math.round((40 * top[1]) / tot), title: `Risk concentrated in ${PILLARS[top[0]].name}`, text: `${Math.round((100 * top[1]) / tot)}% of ${co.name}'s recency-weighted exposure sits in the ${PILLARS[top[0]].name} pillar.`, why: `Rule: one pillar holds at least 50% of exposure. Exposure is severity × 0.5^(age ÷ 45 days), summed. E ${ex.E.toFixed(0)}, S ${ex.S.toFixed(0)}, G ${ex.G.toFixed(0)}.`, ev: incs.filter(i => i.pillar === top[0]) });
  const reg = incs.filter(i => ['investigation', 'confirmed'].includes(i.cur.stage) && i.res !== 'Resolved');
  if (reg.length) out.push({ type: 'Regulatory exposure', pillar: reg[0].pillar, co, w: 45 + reg.length * 12 + Math.max(...reg.map(i => i.sev)) / 4, title: `${reg.length} open matter${reg.length > 1 ? 's' : ''} involving an authority`, text: `${reg.filter(i => i.cur.stage === 'investigation').length} under investigation and ${reg.filter(i => i.cur.stage === 'confirmed').length} with confirmed findings. Investigations are not findings of fault.`, why: `Rule: unresolved incidents whose latest report is at the investigation or confirmed stage. Matched ${ids(reg)}.`, ev: reg });
  const now = riskScore(incs), prev = riskScore(incs, TODAY - 30 * DAY), d = now - prev;
  if (Math.abs(d) >= 8) out.push({ type: d > 0 ? 'Emerging risk signal' : 'Easing risk', pillar: null, co, w: 40 + Math.abs(d) * 2, title: d > 0 ? `Risk score rising: ${prev} → ${now} in 30 days` : `Risk score easing: ${prev} → ${now} in 30 days`, text: d > 0 ? `New or escalating reports lifted ${co.name}'s overall score by ${d} points.` : `Older incidents are ageing out or being resolved; the score fell ${-d} points.`, why: `Rule: overall score moved 8 points or more against its value 30 days ago. Reports in the last 30 days: ${incs.flatMap(i => i.stories).filter(s => s.date > TODAY - 30 * DAY).length}.`, ev: incs.filter(i => i.cur.date > TODAY - 30 * DAY) });
  const alg = incs.filter(i => i.cur.stage === 'allegation' && i.cur.factors.reputational >= 60);
  if (alg.length) out.push({ type: 'Reputation risk', pillar: alg[0].pillar, co, w: 35 + alg.length * 8, title: `${alg.length} unverified allegation${alg.length > 1 ? 's' : ''} with high reputational exposure`, text: 'These remain allegations. They carry reputational weight even without a finding, so they merit monitoring, not conclusions.', why: `Rule: latest report is at the allegation stage and the reputational factor is 60 or higher. Matched ${ids(alg)}.`, ev: alg });
  return out.sort((a, b) => b.w - a.w);
}
export function comparative(db: Db) {
  const ranked = db.cos.map(c => ({ c, s: coScore(db, c.id) })).sort((a, b) => b.s - a.s), avg = mean(ranked.map(r => r.s));
  return ranked.map((r, i) => ({ ...r, rank: i + 1, avg, d: r.s - avg }));
}

export interface Digest {
  cos: Company[]; cur: Story[]; prev: Story[]; sig: Story[]; changes: { c: Company; now: number; was: number; d: number }[];
  patterns: Insight[]; port: { now: number; was: number }; recs: string[]; pcCur: Record<Pillar, number>; pcPrev: Record<Pillar, number>;
  summary: string; t0: number; thr: number; period: string;
}
export function digestData(db: Db, prefs: Prefs): Digest {
  const cos = db.cos.filter(c => !prefs.digestSkip.includes(c.id)), ids = new Set(cos.map(c => c.id));
  const t0 = TODAY - 7 * DAY, tp = TODAY - 14 * DAY, thr = +prefs.threshold;
  const cur = db.stories.filter(s => ids.has(s.companyId) && s.date > t0), prev = db.stories.filter(s => ids.has(s.companyId) && s.date > tp && s.date <= t0);
  const sig = cur.filter(s => s.severity >= thr).sort((a, b) => b.severity - a.severity);
  const changes = cos.map(c => { const now = coScore(db, c.id), was = coScore(db, c.id, null, t0); return { c, now, was, d: now - was }; }).sort((a, b) => b.d - a.d);
  const patterns = cos.flatMap(c => insights(db, c.id)).filter(i => ['Repeated pattern', 'Emerging risk signal'].includes(i.type)).slice(0, 6);
  const port = { now: portScore(db, null, TODAY, cos), was: portScore(db, null, t0, cos) };
  const recs: string[] = [];
  sig.slice(0, 3).forEach(s => recs.push(`Review ${s.incId} (${coById(s.companyId).name}): ${STAGES[s.stage].label.toLowerCase()}, severity ${s.severity}.`));
  changes.filter(x => x.d >= 5).slice(0, 2).forEach(x => recs.push(`Examine what drove ${x.c.name}'s score from ${x.was} to ${x.now} this week.`));
  patterns.slice(0, 2).forEach(p => recs.push(`Check whether "${p.title}" at ${p.co.name} reflects a control gap.`));
  if (!recs.length) recs.push('No item crossed the configured thresholds this week. Keep monitoring.');
  const pc = (l: Story[]): Record<Pillar, number> => ({ E: l.filter(s => s.pillar === 'E').length, S: l.filter(s => s.pillar === 'S').length, G: l.filter(s => s.pillar === 'G').length });
  const up = changes.filter(x => x.d > 0).length;
  const summary = `${cur.length} ESG report${cur.length === 1 ? ' was' : 's were'} recorded across ${cos.length} companies this week, against ${prev.length} the week before. ${sig.length} met the severity threshold of ${thr}, including ${cur.filter(s => s.severity >= 80).length} critical and ${cur.filter(s => s.severity >= 60 && s.severity < 80).length} high. The portfolio risk score moved from ${port.was} to ${port.now}; ${up} compan${up === 1 ? 'y' : 'ies'} saw an increase.`;
  return { cos, cur, prev, sig, changes, patterns, port, recs, pcCur: pc(cur), pcPrev: pc(prev), summary, t0, thr, period: `${fmtD(t0 + DAY)} – ${fmtDY(TODAY)}` };
}
