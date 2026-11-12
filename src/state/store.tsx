/* Application state: the workspace (persisted), the incident database derived from the active
   provider, the demo/live mode switch, overlays and toasts. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ClassifyInput, Db, Override, RawIncident, SubmittedArticle, Workspace } from '../lib/types';
import { DEFAULT_WATCH, buildDb, clamp, coById, impactText, needsReview } from '../lib/model';
import { ApiError, WORKSPACE_KEY, backendConfigured, demoDiscover, demoProvider, remoteProvider } from '../services/api';

export type Overlay = { kind: 'company' | 'incident' | 'article'; id: string } | { kind: 'add'; q?: string } | { kind: 'analyse' };
export interface Toast { id: number; msg: string; err: boolean; }
type ClassifyOutcome = { ok: true; storyId: string } | { ok: false; message: string };

export const defaultWorkspace = (): Workspace => ({
  theme: 'dark', collapsed: false, watch: [...DEFAULT_WATCH], overrides: {}, submitted: [], feeds: [], refreshed: Date.now(),
  prefs: { name: 'Ujwal Raj K.P.', role: 'ESG Analyst', rm: false, digestDay: 'Monday', digestFreq: 'Weekly', digestSkip: [], threshold: 40, emailOn: false, email: '' }
});
function readLocal(): Workspace {
  const d = defaultWorkspace();
  try { const j = JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? 'null'); if (j && Array.isArray(j.watch)) return { ...d, ...j, prefs: { ...d.prefs, ...(j.prefs ?? {}) } }; } catch { /* ignore */ }
  return d;
}

interface Store {
  ws: Workspace; db: Db; mode: 'demo' | 'live'; modeNote: string; loading: boolean; justAdded: string | null;
  overlay: Overlay | null; open(o: Overlay): void; close(): void;
  toasts: Toast[]; toast(msg: string, err?: boolean): void;
  update(fn: (w: Workspace) => Workspace): void;
  refresh(): void; reset(): void;
  addCompany(id: string): void; removeCompany(id: string): void;
  patchIncident(id: string, patch: Override, log: string): void; addNote(id: string, text: string): void; reviewAll(): number;
  classify(input: ClassifyInput): Promise<ClassifyOutcome>; deleteSubmitted(id: string): void;
  summarise(facts: unknown): Promise<string | null>;
}
const Ctx = createContext<Store | null>(null);
export function useStore(): Store { const s = useContext(Ctx); if (!s) throw new Error('useStore must be used inside StoreProvider'); return s; }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace>(readLocal);
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [modeNote, setModeNote] = useState(backendConfigured ? 'Checking the backend…' : 'No backend is configured, so the app runs in demo mode.');
  const [raw, setRaw] = useState<RawIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const seq = useRef(0), saveWarned = useRef(false);

  const toast = useCallback((msg: string, err = false) => {
    const id = ++seq.current;
    setToasts(t => [...t, { id, msg, err }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), err ? 5200 : 3000);
  }, []);
  const update = useCallback((fn: (w: Workspace) => Workspace) => setWs(fn), []);
  const fallBack = useCallback((why: string) => { setMode('demo'); setModeNote(why + ' Showing demo data instead.'); toast(why + ' Switched to demo mode.', true); }, [toast]);

  /* 1. Decide the mode once: live only if a backend is configured and healthy. */
  useEffect(() => {
    if (!backendConfigured) return;
    let dead = false;
    (async () => {
      if (!(await remoteProvider.health())) { if (!dead) { setModeNote('The backend did not respond. Showing demo data instead.'); } return; }
      if (dead) return;
      try { const remote = await remoteProvider.loadWorkspace(); if (!dead && remote && Array.isArray(remote.watch)) { const d = defaultWorkspace(); setWs({ ...d, ...remote, prefs: { ...d.prefs, ...(remote.prefs ?? {}) } }); } } catch { /* keep the local copy */ }
      if (!dead) { setMode('live'); setModeNote('Connected to the backend.'); }
    })();
    return () => { dead = true; };
  }, []);

  /* 2. Live mode: discover news whenever the watchlist changes or a refresh is requested. */
  const watchKey = ws.watch.join(',');
  useEffect(() => {
    if (mode !== 'live') return;
    let dead = false; setLoading(true);
    remoteProvider.discoverNews(ws.watch.map(coById).filter(c => c.id !== 'unknown'))
      .then(r => { if (!dead) { setRaw(r); setWs(w => ({ ...w, refreshed: Date.now() })); } })
      .catch((e: unknown) => { if (!dead) fallBack(e instanceof ApiError ? e.message : 'News discovery failed.'); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, watchKey, tick]);

  /* 3. Persist: always to this browser, and to the backend database in live mode. */
  useEffect(() => {
    void demoProvider.saveWorkspace(ws);
    if (mode !== 'live') return;
    const t = setTimeout(() => { remoteProvider.saveWorkspace(ws).catch(() => { if (!saveWarned.current) { saveWarned.current = true; toast('Changes could not be saved to the backend. They are kept in this browser.', true); } }); }, 800);
    return () => clearTimeout(t);
  }, [ws, mode, toast]);

  useEffect(() => { document.documentElement.classList.toggle('dark', ws.theme === 'dark'); document.documentElement.classList.toggle('rm', ws.prefs.rm); }, [ws.theme, ws.prefs.rm]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOverlay(null); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  useEffect(() => { if (!justAdded) return; const t = setTimeout(() => setJustAdded(null), 600); return () => clearTimeout(t); }, [justAdded]);

  const db = useMemo(() => buildDb(ws, mode === 'live' ? raw : demoDiscover(ws.watch.map(coById).filter(c => c.id !== 'unknown'))), [ws, mode, raw]);

  const store: Store = {
    ws, db, mode, modeNote, loading, justAdded, overlay, toasts, toast, update,
    open: setOverlay, close: () => setOverlay(null),
    refresh() {
      if (loading) return;
      if (mode === 'live') { setTick(t => t + 1); return; }
      setLoading(true);
      setTimeout(() => { setLoading(false); update(w => ({ ...w, refreshed: Date.now() })); toast('Demo pipeline re-run. No live provider is connected.'); }, 650);
    },
    reset() { setWs(defaultWorkspace()); toast('Workspace reset to the sample watchlist'); },
    addCompany(id) {
      if (ws.watch.includes(id)) return;
      update(w => ({ ...w, watch: [...w.watch, id] })); setJustAdded(id); setOverlay(null);
      toast(mode === 'live' ? `${coById(id).name} added. Fetching its news…` : `${coById(id).name} added with synthetic demo records.`);
    },
    removeCompany(id) { update(w => ({ ...w, watch: w.watch.filter(x => x !== id) })); setOverlay(null); toast(`${coById(id).name} removed from watchlist`); },
    patchIncident(id, patch, log) {
      update(w => { const o = w.overrides[id] ?? {}; return { ...w, overrides: { ...w.overrides, [id]: { ...o, ...patch, log: [...(o.log ?? []), { t: Date.now(), text: log }] } } }; });
      toast(`${id}: ${log.charAt(0).toLowerCase() + log.slice(1)}`);
    },
    addNote(id, text) {
      update(w => { const o = w.overrides[id] ?? {}; return { ...w, overrides: { ...w.overrides, [id]: { ...o, notes: [...(o.notes ?? []), { t: Date.now(), text: text.slice(0, 1000), by: w.prefs.name || 'You' }] } } }; });
      toast('Note added');
    },
    reviewAll() {
      const list = needsReview(db);
      update(w => { const ov = { ...w.overrides }; list.forEach(i => { const o = ov[i.id] ?? {}; ov[i.id] = { ...o, reviewed: true, log: [...(o.log ?? []), { t: Date.now(), text: 'Marked as reviewed' }] }; }); return { ...w, overrides: ov }; });
      toast(`${list.length} incident${list.length === 1 ? '' : 's'} marked as reviewed`);
      return list.length;
    },
    async classify(input) {
      try {
        const r = await (mode === 'live' ? remoteProvider : demoProvider).classifyArticle(input);
        if (!r.esg_relevant) return { ok: false, message: 'No ESG issue was found in this article, so nothing was filed. ' + r.rationale };
        const prior = (db.byCo[input.company.id] ?? []).filter(i => i.pillar === r.pillar).length;
        const factors = { magnitude: r.magnitude, scale: r.scale, regulatory: r.regulatory, reputational: r.reputational, financial: r.financial, recurrence: clamp(12 + prior * 26, 0, 100), credibility: r.source_credibility };
        const id = `INC-USR-${String(ws.submitted.length + 1).padStart(2, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
        const a: SubmittedArticle = { id, companyId: input.company.id, headline: input.headline, publisher: input.publisher, url: input.url, date: input.date, pillar: r.pillar, sub: r.subcategory, stage: r.stage, factors, confidence: r.confidence, summary: r.summary, impact: r.business_impact || impactText(r.pillar, factors), rationale: r.rationale, classifier: r.classifier };
        update(w => ({ ...w, submitted: [...w.submitted, a] }));
        toast(`Article filed against ${input.company.name}`);
        return { ok: true, storyId: id + '-N1' };
      } catch (e) { return { ok: false, message: (e instanceof ApiError ? e.message : 'The analysis failed.') + ' Nothing was filed.' }; }
    },
    deleteSubmitted(id) { update(w => { const ov = { ...w.overrides }; delete ov[id]; return { ...w, submitted: w.submitted.filter(a => a.id !== id), overrides: ov }; }); setOverlay(null); toast('Submitted article deleted'); },
    async summarise(facts) { if (mode !== 'live') return null; try { return await remoteProvider.summarise(facts); } catch { return null; } }
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
