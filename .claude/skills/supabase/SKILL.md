---
name: supabase
description: >-
  Inspect and query this project's Supabase database directly (service-role,
  bypasses RLS). Use when debugging data-layer issues, checking real row state,
  or verifying a migration/service change against live data — e.g. "why aren't
  connections building", "is this material parsed", "show me the quizzes for
  user X", "what's actually in the answers table". Read-only by default; confirm
  before any write/delete.
---

# Supabase (this project)

Talk to the live database instead of guessing. Credentials come from the
project `.env`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (bypasses Row-Level Security — full read/write)

## Run a query

A ready helper lives next to this file: `query.mjs`. It loads `.env`, creates a
service-role client, and runs an async function you pass inline. Run it from the
project root:

```bash
node .claude/skills/supabase/query.mjs "
  const { data } = await db.from('study_materials')
    .select('id, title, parsing_status')
    .eq('user_id', '<uuid>')
  console.table(data)
"
```

`db` (the Supabase client) and `console` are in scope. Keep selects narrow —
`parsed_content` can be megabytes per row; select it only when needed and slice
before printing.

### Standalone scripts

If you write your own `.mjs` in the scratchpad, resolve the SDK against the
project's `node_modules` (a scratchpad file won't find bare specifiers):

```js
import { createRequire } from 'node:module'
const require = createRequire('/home/Skripls/Repository/Personal/ai-study-assistant/')
const { createClient } = require('@supabase/supabase-js')
```

## Schema map

Canonical DDL: `supabase/schema.sql`; migrations in `supabase/migrations/`.
Key tables and the gotchas that bite:

- `study_materials` — `parsing_status` ∈ `pending|processing|completed|failed`;
  `parsed_content` (TEXT, nullable, can be huge). Graph/quiz features only use
  rows where `parsing_status='completed'` AND `parsed_content` is non-null.
- `material_tags` — tags live here, NOT on the material row. `GraphService.getGraph`
  reads tags from this table.
- `material_connections` — graph edges. `UNIQUE(material_id_1, material_id_2)`
  with `CHECK (material_id_1 < material_id_2)`. Written by `GraphService.analyzeConnections`
  (triggered only by the "Analyze Connections" button → `POST /api/graph/analyze`).
- `quizzes` / `questions` / `answers` — `answers` has `UNIQUE(quiz_id, question_id)`.

## Safety

- Service role bypasses RLS: every user's rows are visible and writable. Always
  scope by `user_id` when a query is meant to be per-user.
- Default to read-only. Before any `insert`/`update`/`upsert`/`delete`, state
  what you're about to change and confirm with the user first.
- Don't print secrets or full `parsed_content` dumps into the conversation.
