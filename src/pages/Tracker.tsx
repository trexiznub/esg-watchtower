import { useState } from 'react';
import type { Incident } from '../lib/types';
import { BANDS, RES_STATES, bandIx } from '../lib/model';
import { exportIncidents } from '../services/exporter';
import { useStore } from '../state/store';
import { DemoBar, Empty, Icon, PageHead, Pager, Select } from '../components/ui';
import { IncidentRow } from './Overview';

type SortKey = 'company' | 'headline' | 'pillar' | 'sev' | 'date' | 'res';
const KEY: Record<SortKey, (i: Incident) => string | number> = { company: i => i.co.name, headline: i => i.cur.headline, pillar: i => i.pillar, sev: i => i.sev, date: i => i.detected, res: i => RES_STATES.indexOf(i.res) };
const COLS: [SortKey, string][] = [['company', 'Company'], ['headline', 'Headline'], ['pillar', 'Category'], ['sev', 'Severity'], ['date', 'Detected'], ['res', 'Status']];
const BLANK = { q: '', company: '', band: '', res: '' };

export default function Tracker() {
  const { db, toast } = useStore();
  const [f, setF] = useState(BLANK);
  const [sort, setSort] = useState<{ k: SortKey; dir: number }>({ k: 'date', dir: -1 });
  const [pg, setPg] = useState(1);
  const set = (k: keyof typeof BLANK) => (v: string) => { setF({ ...f, [k]: v }); setPg(1); };
  const per = 8, ql = f.q.trim().toLowerCase();
  const list = db.incs.filter(i => (!ql || i.cur.headline.toLowerCase().includes(ql) || i.id.toLowerCase().includes(ql) || i.co.name.toLowerCase().includes(ql)) && (!f.company || i.companyId === f.company) && (!f.band || BANDS[bandIx(i.sev)] === f.band) && (!f.res || i.res === f.res))
    .sort((a, b) => { const x = KEY[sort.k](a), y = KEY[sort.k](b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  const page = Math.min(pg, Math.max(1, Math.ceil(list.length / per)));
  const sortBy = (k: SortKey) => { setSort(s => (s.k === k ? { k, dir: -s.dir } : { k, dir: k === 'sev' || k === 'date' ? -1 : 1 })); setPg(1); };
  return (
    <>
      <PageHead title="Controversy Tracker" sub="Select any row to see its timeline, change its status or add a note."><button className="btn" onClick={() => { exportIncidents(db); toast('Incidents exported as CSV'); }}><Icon n="down" />Export CSV</button></PageHead>
      <DemoBar />
      <div className="card">
        <div className="toolbar">
          <input className="inp" id="tq" value={f.q} onChange={e => set('q')(e.target.value)} placeholder="Search company or headline" aria-label="Search incidents" />
          <Select id="tc" value={f.company} onChange={set('company')} options={db.cos.map(c => [c.id, c.name] as [string, string])} all="All companies" />
          <Select id="tb" value={f.band} onChange={set('band')} options={BANDS} all="All severities" />
          <Select id="tr" value={f.res} onChange={set('res')} options={RES_STATES} all="Any status" />
        </div>
        {list.length ? (
          <div className="tw soft" key={JSON.stringify([f, sort, page])}>
            <table>
              <thead><tr>{COLS.map(([k, l]) => <th key={k} aria-sort={sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}><button className={sort.k === k ? 'on' : ''} data-sort={k} onClick={() => sortBy(k)}>{l}{sort.k === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>)}<th>Review</th></tr></thead>
              <tbody>{list.slice((page - 1) * per, page * per).map(i => <IncidentRow key={i.id} i={i} />)}</tbody>
            </table>
          </div>
        ) : <Empty title="No incidents match" text="Change the filters to see more records."><button className="btn" onClick={() => { setF(BLANK); setPg(1); }}>Clear filters</button></Empty>}
        <Pager total={list.length} page={page} per={per} onPage={setPg} />
      </div>
    </>
  );
}
