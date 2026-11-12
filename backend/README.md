# ESG Watchtower backend (Supabase)

This folder is the server side: a Postgres schema and two Edge Functions. It holds every secret; the GitHub Pages site holds none.

| Part | What it does |
|---|---|
| `supabase/migrations/0001_init.sql` | Tables for companies, articles, incidents, workspaces, RSS feeds and rate limiting |
| `supabase/functions/collect` | Hourly job: searches GDELT and your RSS feeds, then classifies new articles with Claude and groups them into incidents |
| `supabase/functions/api` | The API the website calls: `/health`, `/news/discover`, `/ai/classify`, `/ai/summarise`, `/workspace` |

**Status: this code has not been run.** It was type-checked only. Expect to fix small things on first deploy; the function logs in the Supabase dashboard show any error.

## What you need

- A free Supabase account and a new project: https://supabase.com/dashboard
- An Anthropic API key (paid, usage-based): https://platform.claude.com/settings/keys
- The Supabase CLI: `brew install supabase/tap/supabase`

## Setup

Run these from the `backend` folder. Replace the values in capitals.

```bash
cd backend
supabase login
supabase link --project-ref YOUR_PROJECT_REF      # the ref is in your project's URL
supabase db push                                   # creates the tables

supabase secrets set ANTHROPIC_API_KEY=YOUR_KEY
supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
supabase secrets set ALLOWED_ORIGIN=https://trexiznub.github.io

supabase functions deploy api
supabase functions deploy collect
```

Keep the `CRON_SECRET` value; you need it once below. To see it again, set a new one.

Optional secrets: `ANTHROPIC_MODEL` (default `claude-haiku-5-5`), `CLASSIFY_PER_RUN` (default 20 articles per run), `DAILY_AI_CALLS_PER_IP` (default 40).

## Check it works

```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/api/health

# run the collector once by hand (takes up to two minutes)
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/collect -H "x-cron-secret: YOUR_CRON_SECRET"
```

The second command returns counts: companies searched, articles inserted, classified and kept. The six sample companies are pre-loaded; each run covers five companies, so run it twice to cover them all.

## Schedule it hourly

In the Supabase dashboard open **SQL Editor** and run this once, with your values filled in:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'esg-collect', '7 * * * *',
  $$ select net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/collect',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
       body := '{}'::jsonb,
       timeout_milliseconds := 150000
     ) $$
);
```

To stop it: `select cron.unschedule('esg-collect');`

## Connect the website

1. On GitHub: repository **Settings → Secrets and variables → Actions → Variables → New repository variable**
   Name `VITE_API_BASE_URL`, value `https://YOUR_PROJECT_REF.supabase.co/functions/v1/api`
2. **Actions → Deploy to GitHub Pages → Run workflow**.

The site then shows "Live data" instead of "Demo mode". If the backend is ever unreachable it falls back to demo mode on its own.

## Add RSS feeds (optional)

```sql
insert into rss_feeds (url) values ('https://example.com/business/rss.xml');
```

The collector reads up to five feeds per run and keeps items whose title names a watched company.

## Things to know

- **Headlines only.** GDELT returns the title, URL, domain and the time it first saw the article, not the body. Classification is from the headline, so confidence is lower, and the "published" date is GDELT's first-seen time. The publisher shown is the site's domain.
- **Cost control.** Each new article is one short Claude call. `CLASSIFY_PER_RUN` caps calls per hour; the public AI routes are limited per IP per day.
- **No sign-in.** Each browser gets a random workspace id and saves its watchlist and notes under it. That is separation, not security: add Supabase Auth before storing anything sensitive.
- **Free-tier pausing.** Supabase pauses inactive free projects; the hourly job normally keeps it active.
- **Scores will need tuning.** The severity weights live in the frontend (`src/lib/model.ts`) and were set against synthetic data.
