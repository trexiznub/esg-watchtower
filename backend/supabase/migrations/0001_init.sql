-- ESG Watchtower backend schema.
-- Row level security is enabled with no policies: only the service role (used by the
-- Edge Functions) can read or write. Nothing is exposed through the public REST API.

create table if not exists watched_companies (
  id                text primary key,
  name              text not null,
  ticker            text,
  last_collected_at timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists incidents (
  id            text primary key,
  company_id    text not null,
  pillar        text not null check (pillar in ('E','S','G')),
  sub           text not null,
  created_at    timestamptz not null default now(),
  last_story_at timestamptz not null
);
create index if not exists incidents_company_idx on incidents (company_id, pillar, sub);

create table if not exists articles (
  id           bigint generated always as identity primary key,
  company_id   text not null,
  url          text not null unique,
  headline     text not null,
  publisher    text,
  published_at timestamptz not null,
  status       text not null default 'new' check (status in ('new','classified','irrelevant','failed')),
  incident_id  text references incidents (id) on delete set null,
  stage        text check (stage in ('allegation','investigation','confirmed','resolved')),
  summary      text,
  impact       text,
  rationale    text,
  confidence   int,
  factors      jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists articles_company_idx on articles (company_id, status, published_at desc);
create index if not exists articles_status_idx on articles (status, published_at desc);

create table if not exists workspaces (
  id         text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists rss_feeds (
  url      text primary key,
  added_at timestamptz not null default now()
);

create table if not exists api_usage (
  day date not null,
  key text not null,
  n   int  not null default 0,
  primary key (day, key)
);

-- Atomic per-day counter used to rate-limit the AI routes.
create or replace function bump_usage(k text) returns int
language sql as $$
  insert into api_usage (day, key, n) values (current_date, k, 1)
  on conflict (day, key) do update set n = api_usage.n + 1
  returning n;
$$;

alter table watched_companies enable row level security;
alter table incidents         enable row level security;
alter table articles          enable row level security;
alter table workspaces        enable row level security;
alter table rss_feeds         enable row level security;
alter table api_usage         enable row level security;

insert into watched_companies (id, name, ticker) values
  ('tatamotors', 'Tata Motors', 'TMCV'),
  ('reliance',   'Reliance Industries', 'RELIANCE'),
  ('adanient',   'Adani Enterprises', 'ADANIENT'),
  ('infosys',    'Infosys', 'INFY'),
  ('itc',        'ITC', 'ITC'),
  ('mm',         'Mahindra & Mahindra', 'M&M')
on conflict (id) do nothing;
