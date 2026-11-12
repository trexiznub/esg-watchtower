# Backend API contract

The frontend calls these endpoints under `VITE_API_BASE_URL`. All bodies are JSON. The backend owns every secret (news API keys, AI provider key, database service-role key) and should authenticate the caller and restrict CORS to the GitHub Pages origin.

## GET /health

`200` with any JSON body means the backend is available. Anything else puts the app in demo mode.

## POST /news/discover

Request:

```json
{ "companies": [{ "id": "infosys", "name": "Infosys", "ticker": "INFY" }], "days": 90 }
```

Response:

```json
{
  "incidents": [
    {
      "id": "INC-2026-0042",
      "companyId": "infosys",
      "pillar": "G",
      "sub": "Data privacy",
      "stories": [
        {
          "id": "INC-2026-0042-N1",
          "headline": "Original headline exactly as published",
          "publisher": "Publisher name",
          "url": "https://publisher.example/article",
          "date": "2026-11-03T08:30:00Z",
          "stage": "investigation",
          "summary": "Short AI summary in the model's own words.",
          "impact": "Potential business impact.",
          "rationale": "Why the stage and scores were chosen.",
          "confidence": 84,
          "factors": {
            "magnitude": 70, "scale": 60, "regulatory": 75, "reputational": 65,
            "financial": 50, "recurrence": 12, "credibility": 80
          }
        }
      ]
    }
  ]
}
```

- `companyId` must be an id the frontend sent.
- `pillar` is `E`, `S` or `G`; `sub` is one of the subcategories in `src/lib/model.ts`.
- `stage` is `allegation`, `investigation`, `confirmed` or `resolved`.
- `date` is an ISO string or epoch milliseconds.
- Factors are integers 0–100. The frontend recomputes severity from them.
- Several stories in one incident form its timeline. Records that fail validation are ignored.
- Return only real articles with their real URLs. Never synthesise headlines, sources or dates.

## POST /ai/classify

Request:

```json
{
  "company": { "id": "itc", "name": "ITC", "industry": "FMCG" },
  "headline": "…", "publisher": "…", "url": "https://…", "date": "2026-11-10T12:00:00Z",
  "text": "Article body, at most 12,000 characters"
}
```

Response:

```json
{
  "esg_relevant": true,
  "pillar": "E", "subcategory": "Pollution", "stage": "investigation",
  "magnitude": 68, "scale": 60, "regulatory": 78, "reputational": 62, "financial": 52,
  "source_credibility": 80, "confidence": 86,
  "summary": "At most 45 words.", "business_impact": "At most 40 words.", "rationale": "At most 40 words."
}
```

Prompt guidance for the LLM call: classify only from what the article states, do not treat negative coverage as proof, and distinguish allegation, investigation, confirmed violation and resolved.

## POST /ai/summarise (optional)

Request `{ "facts": { … } }` with the digest figures. Response `{ "text": "Executive summary of at most 90 words." }`.

## GET /workspace and PUT /workspace

Loads and saves the signed-in user's workspace: the `Workspace` type in `src/lib/types.ts` (theme, watchlist, incident overrides with notes and statuses, submitted articles, RSS feeds, preferences). `GET` returns `404` when the user has none yet.

## Suggested tables

```
companies       (id, name, ticker, sector, industry, hq)
workspaces      (user_id, payload jsonb, updated_at)
articles        (id, company_id, url UNIQUE, headline, publisher, published_at,
                 summary, pillar, subcategory, stage, factors jsonb, confidence, incident_id)
incidents       (id, company_id, pillar, subcategory, detected_at)
reports         (id, user_id, period_start, period_end, payload jsonb, sent_at)
```

## Scheduled jobs (backend only)

- Hourly: collect news for all watched companies, de-duplicate by canonical URL, classify new articles.
- Weekly, on each user's chosen day: build the digest and send it by email.
