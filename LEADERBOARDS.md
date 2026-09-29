# Shared game leaderboards

GitHub Pages hosts the invitation. Supabase PostgreSQL stores shared results. Until configured, games work and the leaderboard explains that shared rankings are unavailable. Nothing is silently saved as a device-only substitute.

## Connect the database

1. Sign in at https://supabase.com/dashboard and create a project (or use a project you already own). Keep its database password private.
2. Open **SQL Editor → New query**, paste the complete contents of `supabase/leaderboard.sql`, and run it. This creates a private schema and exactly three public RPC functions; it can be rerun without deleting scores. The `unaccent` extension is expected in the standard `extensions` schema.
3. From the project's Connect/API settings, copy its project URL and **publishable** key (`sb_publishable_…`). These two values are public browser configuration. Never provide the database password, secret key or service-role key.
4. Put those values into `leaderboard-config.js` as `url` and `publishableKey`. The URL must be the HTTPS project origin, such as `https://your-project.supabase.co`, with no trailing slash. The client intentionally rejects secret keys and unsupported endpoints.
5. Run `npm test`, `npm run test:leaderboards`, `npm run build`, and `npm run test:pages`. Push/deploy the site. Finish one game and save a test nickname, then open the leaderboard on another device to verify the hosted connection.

No extra Supabase Auth, Realtime or Storage setup is needed. Keep `invitation_private` out of the Data API exposed schemas. Use the default exposed `public` schema for the three RPC functions. Public table access is never granted.

Documentation: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [database functions](https://supabase.com/docs/guides/database/functions), [database access controls](https://supabase.com/docs/guides/database/row-level-security).

## Ranking and identity

- Tap Tap Tap, Hextris and Safari Flyer: highest completed-round score wins. Zero is a valid arcade score.
- 0h h1: lowest completed-puzzle time wins, with separate 4×4, 6×6, 8×8 and 10×10 boards. Hints are allowed. Tutorials and unfinished puzzles do not submit. The timer includes time spent away from the puzzle.
- The top 20 entries are displayed. Equal scores share a dense rank (1, 1, 2); earlier achievements appear first within ties. Submission returns your rank even outside the top 20.
- One best entry per browser identity and board. Worse/equal results retain the earlier best and its nickname. Names are not verified identities and can be duplicated. Different devices/browsers are separate entries; clearing browser storage also creates a new identity. No guest needs an account.
- The random browser identifier is a bearer capability: it stays in local storage and is sent only to the backend. Leaderboard responses never disclose it or round tokens. If local storage is blocked, identity lasts for the page session.
- Submitting is optional. The guest sees that their chosen nickname and score will be public before saving. Restarting discards an unsaved result. Results expire two hours after round start.

## Name checks and maintenance

The browser and database independently validate 2–20 character names with at least two letters. Latin letters (including supported accents), digits, spaces, hyphens and apostrophes are accepted. Markup, invisible characters and unsupported character sets are rejected. The filter normalizes case, accents, repeated letters, separators, common number substitutions and numeric padding. It covers a curated set of English, French and regional insults/slurs. Short words use whole-word checks to reduce accidental rejection of ordinary names such as Cassandra and Scunthorpe.

No automated word list can catch every language, spelling trick or offensive phrase, and some legitimate names can be rejected. Guests can choose another nickname. Expand `leaderboard-policy.js` when needed, then run `npm run leaderboards:sql` and rerun `supabase/leaderboard.sql`. Existing entries that fail the updated database filter are excluded from public rankings. The browser also checks returned names and renders text without HTML injection.

The owner can inspect entries from Supabase's SQL editor:

```sql
select game, board, name, score, achieved_at
from invitation_private.scores
order by achieved_at desc;
```

To remove an inappropriate entry, use the exact nickname/game/board in the private table (or use its player UUID after inspection):

```sql
delete from invitation_private.scores
where game = 'flappy' and board = 0 and name = 'EXACT NICKNAME';
```

Deleting a score does not ban its author. Scores remain until the host deletes them. To clear the party's rankings after the event, the owner may run `truncate invitation_private.scores, invitation_private.runs;`. Round tokens older than a day are pruned when a new round begins; if play stops, the host can clear them manually. Hosting/Supabase providers may retain request logs.

## Boundaries and verification

Scores come from browser games, so a determined guest can forge them. Source-window checks, one-use round tokens, database score bounds, expiry and per-identity request limits prevent common mistakes/replays; they do not prove gameplay or prevent someone creating new anonymous identities. These boards are suitable for a casual party, not prizes or a secure competition. Authentication and server-verified gameplay would be needed for stronger controls. Backend rate limits are 120 new rounds/hour and 12 submissions/minute per browser identity.

Only narrowly scoped `SECURITY DEFINER` functions expose access, with an empty search path and explicit execute grants. Tables live in a private schema with RLS enabled and no anonymous policies/grants. The server applies name moderation even if JavaScript is bypassed. Idempotent submissions protect against lost responses and double clicks. Games retain their opaque sandbox and no-network CSP; only the parent connects to Supabase.

Tests use PGlite (real PostgreSQL in WebAssembly) and a temporary local browser server. The browser API requests are routed to that test database; they do not contact a hosted project. Hosted credentials, API exposure and service availability still require the final two-device live check in step 5.
