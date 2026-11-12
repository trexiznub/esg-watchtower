export type Pillar = 'E' | 'S' | 'G';
export type Stage = 'allegation' | 'investigation' | 'confirmed' | 'resolved';
export type FactorKey = 'magnitude' | 'scale' | 'regulatory' | 'reputational' | 'financial' | 'recurrence' | 'credibility';
export type Factors = Record<FactorKey, number>;
/** demo = synthetic scenario, user = article submitted in this browser, live = record returned by the backend */
export type Source = 'demo' | 'user' | 'live';

export interface Company { id: string; name: string; ticker: string; sector: string; industry: string; hq: string; note?: string; }

export interface Story {
  id: string; incId: string; companyId: string; date: number; stage: Stage;
  headline: string; summary: string; publisher: string; url: string | null; src: Source;
  pillar: Pillar; sub: string; factors: Factors; severity: number; confidence: number;
  impact: string; rationale?: string; classifier?: 'llm' | 'rules';
}
export interface RawIncident { id: string; companyId: string; pillar: Pillar; sub: string; src: Source; stories: Story[]; }
export interface Note { t: number; text: string; by: string; }
export interface LogEntry { t: number; text: string; }
export interface Override { inv?: string; res?: string; reviewed?: boolean; notes?: Note[]; log?: LogEntry[]; }
export interface Incident extends RawIncident {
  cur: Story; sev: number; detected: number; inv: string; res: string; reviewed: boolean;
  notes: Note[]; log: LogEntry[]; co: Company;
}
export interface Db { cos: Company[]; incs: Incident[]; stories: Story[]; byCo: Record<string, Incident[]>; }

export interface SubmittedArticle {
  id: string; companyId: string; headline: string; publisher: string; url: string | null; date: number;
  pillar: Pillar; sub: string; stage: Stage; factors: Factors; confidence: number;
  summary: string; impact: string; rationale: string; classifier: 'llm' | 'rules';
}
export interface Prefs {
  name: string; role: string; rm: boolean; digestDay: string; digestFreq: string; digestSkip: string[];
  threshold: number; emailOn: boolean; email: string;
}
export interface Workspace {
  theme: 'dark' | 'light'; collapsed: boolean; watch: string[]; overrides: Record<string, Override>;
  submitted: SubmittedArticle[]; feeds: string[]; refreshed: number; prefs: Prefs;
}

export interface ClassifyInput { company: Company; headline: string; publisher: string; url: string | null; date: number; text: string; }
/** Shape returned by POST /ai/classify. The backend holds the AI provider key. */
export interface ClassifyResult {
  esg_relevant: boolean; pillar: Pillar; subcategory: string; stage: Stage;
  magnitude: number; scale: number; regulatory: number; reputational: number; financial: number;
  source_credibility: number; confidence: number; summary: string; business_impact: string; rationale: string;
  classifier: 'llm' | 'rules';
}
