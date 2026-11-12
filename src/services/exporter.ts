/* File exports, all generated in the browser: CSV datasets, the digest as HTML and as PDF. */
import type { Db } from '../lib/types';
import type { Digest } from '../lib/analytics';
import { BANDS, DAY, FACTORS, P3, PILLARS, STAGES, TODAY, bandIx, coById, coScore, fmtD, fmtDY } from '../lib/model';
import { esc } from '../lib/svgCharts';

const COPYRIGHT = '© 2026 Ujwal Raj K.P. All Rights Reserved.';
const CREDIT = 'Designed & Developed by Ujwal Raj K.P.';
const stamp = () => new Date(TODAY).toISOString().slice(0, 10);
const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const srcLabel = (s: string) => (s === 'user' ? 'user-submitted' : s === 'live' ? 'live' : 'synthetic-demo');

export function download(name: string, data: string | Blob, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const csv = (rows: (string | number)[][]) => rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');

export function exportIncidents(db: Db) {
  download(`esg-watchtower-incidents-${stamp()}.csv`, csv([['incident_id', 'data_source', 'company', 'ticker', 'headline', 'pillar', 'subcategory', 'evidence_stage', 'severity', 'band', 'detected', 'source', 'investigation_status', 'resolution_status', 'reviewed', 'url'],
    ...db.incs.map(i => [i.id, srcLabel(i.src), i.co.name, i.co.ticker, i.cur.headline, PILLARS[i.pillar].name, i.sub, STAGES[i.cur.stage].label, i.sev, BANDS[bandIx(i.sev)], day(i.detected), i.cur.publisher, i.inv, i.res, i.reviewed ? 'yes' : 'no', i.cur.url ?? ''])]), 'text/csv;charset=utf-8');
}
export function exportArticles(db: Db) {
  download(`esg-watchtower-articles-${stamp()}.csv`, csv([['article_id', 'incident_id', 'data_source', 'company', 'headline', 'publisher', 'published', 'url', 'pillar', 'subcategory', 'evidence_stage', 'severity', 'ai_confidence', ...FACTORS.map(f => f[0]), 'summary', 'business_impact'],
    ...db.stories.map(s => [s.id, s.incId, srcLabel(s.src), coById(s.companyId).name, s.headline, s.publisher, day(s.date), s.url ?? '', PILLARS[s.pillar].name, s.sub, STAGES[s.stage].label, s.severity, s.confidence, ...FACTORS.map(f => s.factors[f[0]]), s.summary, s.impact])]), 'text/csv;charset=utf-8');
}
export function exportScores(db: Db) {
  download(`esg-watchtower-scores-${stamp()}.csv`, csv([['company', 'ticker', 'industry', 'overall', 'environmental', 'social', 'governance', 'band', 'overall_30d_ago', 'incidents', 'stories'],
    ...db.cos.map(c => [c.name, c.ticker, c.industry, coScore(db, c.id), coScore(db, c.id, 'E'), coScore(db, c.id, 'S'), coScore(db, c.id, 'G'), BANDS[bandIx(coScore(db, c.id))], coScore(db, c.id, null, TODAY - 30 * DAY), db.byCo[c.id].length, db.byCo[c.id].flatMap(i => i.stories).length])]), 'text/csv;charset=utf-8');
}

type S = Digest['cur'][number];
export function digestHtml(d: Digest, summary: string, demo: boolean) {
  const li = (s: S) => `<li><b>${esc(coById(s.companyId).name)}</b> · ${esc(s.headline)} <span style="color:#666">(${PILLARS[s.pillar].name}, ${STAGES[s.stage].label}, severity ${s.severity}, ${fmtD(s.date)})</span></li>`;
  const sec = (t: string, b: string) => `<h2>${t}</h2>${b}`, list = (l: S[]) => (l.length ? `<ul>${l.map(li).join('')}</ul>` : '<p>None this week.</p>');
  const bar = (l: string, a: number, b: number) => { const m = Math.max(1, a, b); return `<tr><td>${l}</td><td style="width:60%"><div style="background:#bbb;height:8px;width:${(100 * b) / m}%;border-radius:4px;margin-bottom:3px"></div><div style="background:#111;height:8px;width:${(100 * a) / m}%;border-radius:4px"></div></td><td>${a} vs ${b}</td></tr>`; };
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>ESG Watchtower weekly digest</title><style>body{font:15px/1.55 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111}h1{font-size:26px;margin:0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#555;margin:32px 0 8px;border-top:1px solid #ddd;padding-top:16px}table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}.demo{border:1px dashed #999;padding:8px 12px;border-radius:8px;font-size:13px;color:#555;margin:16px 0}footer{margin-top:40px;font-size:12px;color:#777;border-top:1px solid #ddd;padding-top:12px}</style></head><body>
<h1>ESG WATCHTOWER</h1><p>Weekly ESG intelligence digest · ${esc(d.period)} · ${d.cos.length} companies</p>${demo ? '<div class="demo"><b>Demo data.</b> Records prefixed "Demo:" are synthetic scenarios, not real events.</div>' : ''}
${sec('1. Executive summary', `<p>${esc(summary)}</p>`)}${sec('2. Most significant ESG controversies', list(d.sig.slice(0, 5)))}${sec('3. Critical and high-risk incidents', list(d.cur.filter(s => s.severity >= 60)))}
${sec('Weekly comparison (this week in black, previous in grey)', `<table>${P3.map(p => bar(PILLARS[p].name, d.pcCur[p], d.pcPrev[p])).join('')}</table>`)}
${sec('4. Environmental developments', list(d.cur.filter(s => s.pillar === 'E')))}${sec('5. Social developments', list(d.cur.filter(s => s.pillar === 'S')))}${sec('6. Governance developments', list(d.cur.filter(s => s.pillar === 'G')))}
${sec('7. Company-wise risk changes', `<table><tr><th>Company</th><th>Now</th><th>7 days ago</th><th>Change</th></tr>${d.changes.map(x => `<tr><td>${esc(x.c.name)}</td><td>${x.now}</td><td>${x.was}</td><td>${x.d > 0 ? '+' : ''}${x.d}</td></tr>`).join('')}</table>`)}
${sec('8. Emerging ESG risk patterns', d.patterns.length ? `<ul>${d.patterns.map(p => `<li><b>${esc(p.co.name)}:</b> ${esc(p.title)}. ${esc(p.text)}</li>`).join('')}</ul>` : '<p>No pattern rule matched.</p>')}
${sec('9. Key observations and recommended areas for investigation', `<ul>${d.recs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`)}
<footer>${COPYRIGHT} · ${esc(CREDIT)}</footer></body></html>`;
}
export function exportDigestHtml(d: Digest, summary: string, demo: boolean) { download(`esg-watchtower-digest-${stamp()}.html`, digestHtml(d, summary, demo), 'text/html;charset=utf-8'); }

/** jsPDF is loaded on demand so it stays out of the main bundle. */
export async function exportDigestPdf(d: Digest, summary: string, demo: boolean) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }), W = 595, M = 48; let y = 60;
  const clean = (s: string) => String(s).replace(/[–—]/g, '-').replace(/→/g, '->').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  const room = (h: number) => { if (y + h > 790) { doc.addPage(); y = 56; } };
  const text = (s: string, size = 10.5, style = 'normal', color = 30, gap = 5) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color);
    (doc.splitTextToSize(clean(s), W - 2 * M) as string[]).forEach(l => { room(size + 4); doc.text(l, M, y); y += size + 4; }); y += gap;
  };
  const h2 = (s: string) => { y += 8; room(40); doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 18; text(s.toUpperCase(), 9.5, 'bold', 110, 4); };
  const list = (l: S[]) => { if (!l.length) return text('None this week.', 10, 'normal', 110); l.forEach(s => text(`- ${coById(s.companyId).name}: ${s.headline} (${PILLARS[s.pillar].name}, ${STAGES[s.stage].label}, severity ${s.severity}, ${fmtD(s.date)})`, 10, 'normal', 40, 2)); };
  text('ESG WATCHTOWER', 20, 'bold', 15, 2);
  text(`Weekly ESG intelligence digest | ${fmtD(d.t0 + DAY)} - ${fmtDY(TODAY)} | ${d.cos.length} companies`, 10, 'normal', 100);
  if (demo) text('DEMO DATA: records prefixed "Demo:" are synthetic scenarios, not real events.', 9.5, 'bold', 150);
  h2('1. Executive summary'); text(summary);
  h2('2. Most significant ESG controversies'); list(d.sig.slice(0, 5));
  h2('3. Critical and high-risk incidents'); list(d.cur.filter(s => s.severity >= 60));
  h2('Weekly comparison by pillar');
  const m = Math.max(1, ...P3.flatMap(p => [d.pcCur[p], d.pcPrev[p]]));
  P3.forEach(p => { room(26); doc.setFontSize(10); doc.setTextColor(40); doc.text(PILLARS[p].name, M, y + 8); doc.setFillColor(190); doc.rect(M + 100, y, (260 * d.pcPrev[p]) / m, 5, 'F'); doc.setFillColor(20); doc.rect(M + 100, y + 7, (260 * d.pcCur[p]) / m, 5, 'F'); doc.text(`${d.pcCur[p]} this week, ${d.pcPrev[p]} previous`, M + 372, y + 8); y += 24; });
  h2('4. Environmental developments'); list(d.cur.filter(s => s.pillar === 'E'));
  h2('5. Social developments'); list(d.cur.filter(s => s.pillar === 'S'));
  h2('6. Governance developments'); list(d.cur.filter(s => s.pillar === 'G'));
  h2('7. Company-wise risk changes'); d.changes.forEach(x => text(`${x.c.name}: ${x.now} now, ${x.was} seven days ago (${x.d > 0 ? '+' : ''}${x.d})`, 10, 'normal', 40, 1));
  h2('8. Emerging ESG risk patterns'); if (d.patterns.length) d.patterns.forEach(p => text(`- ${p.co.name}: ${p.title}. ${p.text}`, 10, 'normal', 40, 2)); else text('No pattern rule matched.', 10, 'normal', 110);
  h2('9. Key observations and recommended areas for investigation'); d.recs.forEach(r => text('- ' + r, 10, 'normal', 40, 2));
  y += 10; text(`\xA9 2026 Ujwal Raj K.P. All Rights Reserved. | ${CREDIT}`, 8.5, 'normal', 130);
  download(`esg-watchtower-digest-${stamp()}.pdf`, doc.output('blob'));
}
