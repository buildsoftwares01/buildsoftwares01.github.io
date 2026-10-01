# Shared game leaderboards

GitHub Pages hosts the static invitation and browser games. A Cloudflare Worker validates results and D1 stores rankings shared by every guest. Until the Worker URL is configured, games work and rankings are shown as unavailable.

## Cloudflare setup

No paid plan, domain purchase, DNS transfer, or browser API key is required. Use a Cloudflare account with Workers Free; usage remains subject to Cloudflare's free quotas.

1. Create or sign in to your account at https://dash.cloudflare.com/.
2. In a terminal in this project, run `npm run cloudflare:login`. A browser opens Cloudflare's authorization page; approve Wrangler there. Keep passwords, tokens and recovery codes private. Run `npm run cloudflare:whoami` to confirm the correct account. If you belong to multiple accounts, set `account_id` in `cloudflare/wrangler.jsonc` to the intended account ID.
3. Run `npm run cloudflare:db:create`. Copy the returned **database_id** into the existing D1 binding in `cloudflare/wrangler.jsonc`, replacing the all-zero placeholder. The database ID is not a secret. If the name already exists, select that database in the dashboard and use its ID instead of creating a duplicate.
4. Run `npm run cloudflare:db:migrate` to create tables, then `npm run cloudflare:deploy` to deploy the Worker. If Cloudflare asks you to choose a workers.dev subdomain, follow its prompt/dashboard instructions. These commands use your locally stored Wrangler authorization.
5. Copy the deployed HTTPS URL, for example `https://vihaan-leaderboard.your-subdomain.workers.dev`, into `url` in `leaderboard-config.js` without a trailing slash. This URL is public and is the only backend setting the browser needs. Opening its `/health` path should show `ok: true`.
6. Run the checks below, then commit/push the site configuration to deploy GitHub Pages. Finish a game, save a nickname, and check that result from another device.

The configured allowed origin is `https://buildsoftwares01.github.io`. If the invitation domain changes, update `ALLOWED_ORIGINS` in `cloudflare/wrangler.jsonc` and redeploy. The frontend currently accepts standard HTTPS workers.dev URLs; using a custom Worker domain requires updating its URL validation and the invitation CSP.

For local Worker development, first run `npx wrangler d1 migrations apply vihaan-leaderboard --local --config cloudflare/wrangler.jsonc`, then `npm run cloudflare:dev`. Local data stays separate from the remote database. Automated tests create their own temporary database.

The GitHub workflow deploys the static site only. Worker or moderation changes require `npm run cloudflare:deploy`; database changes require a new migration and `npm run cloudflare:db:migrate`. Never commit Wrangler authorization files, `.dev.vars`, or API tokens. No Cloudflare GitHub secret is needed for this manual backend deployment.

Official documentation: [Wrangler login](https://developers.cloudflare.com/workers/wrangler/commands/general/), [D1 setup](https://developers.cloudflare.com/d1/get-started/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Ranking and identity

- Tap Tap Tap, Hextris and Safari Flyer: highest completed-round score wins. Zero is a valid arcade score.
- 0h h1: lowest completed-puzzle time wins, with separate 4×4, 6×6, 8×8 and 10×10 boards. Hints are allowed. Tutorials and unfinished puzzles do not submit. The timer includes time spent away from the puzzle.
- The top 20 entries are displayed. Equal scores share a dense rank (1, 1, 2); earlier achievements appear first within ties. Submission returns your rank even outside the top 20.
- One best entry per browser identity and board. Worse/equal results retain the earlier best and its nickname. Names are not verified identities and can be duplicated. Different devices/browsers are separate entries; clearing browser storage also creates a new identity. No guest needs an account.
- The random browser identifier is a bearer capability: it stays in local storage and is sent only to the backend. Leaderboard responses never disclose it or round tokens. If local storage is blocked, identity lasts for the page session.
- Submitting is optional. The guest sees that their chosen nickname and score will be public before saving. Restarting discards an unsaved result. Results expire two hours after round start.

## Name checks and maintenance

The browser and Worker independently validate 2–20 character names with at least two letters. Latin letters (including supported accents), digits, spaces, hyphens and apostrophes are accepted. Markup, invisible characters and unsupported character sets are rejected. The filter normalizes case, accents, repeated letters, separators, common number substitutions and numeric padding. It covers a curated set of English, French and regional insults/slurs. Short words use whole-word checks to reduce accidental rejection of ordinary names such as Cassandra and Scunthorpe.

No automated word list can catch every language, spelling trick or offensive phrase, and some legitimate names can be rejected. Guests can choose another nickname. Expand `leaderboard-policy.js` when needed, then redeploy the Worker and rebuild the site. Existing entries that fail the updated Worker filter are excluded from public rankings. The browser also checks returned names and renders text without HTML injection.

The owner can inspect entries from Cloudflare dashboard under **Storage & databases → D1 → vihaan-leaderboard → Console**:

```sql
select game, board, name, score, achieved_at
from scores
order by achieved_at desc;
```

To remove an inappropriate entry, use the exact nickname/game/board in the private table (or use its player UUID after inspection):

```sql
delete from scores
where game = 'flappy' and board = 0 and name = 'EXACT NICKNAME';
```

Deleting a score does not ban its author. Scores remain until the host deletes them. To clear the party's rankings after the event, the owner may run `DELETE FROM scores; DELETE FROM runs;`. A daily Worker cron deletes round tokens older than a day. Hosting and Cloudflare providers may retain request logs.

## Boundaries and verification

Scores come from browser games, so a determined guest can forge them. Source-window checks, one-use round tokens, server score bounds, expiry and per-identity request limits prevent common mistakes/replays; they do not prove gameplay or prevent someone creating new anonymous identities. These boards are suitable for a casual party, not prizes or a secure competition. Authentication and server-verified gameplay would be needed for stronger controls. Backend rate limits are 120 new rounds/hour and 12 submissions/minute per browser identity.

Only three API operations expose access to the private D1 binding. The Worker applies name moderation even if browser JavaScript is bypassed. Atomic database transactions and idempotent submissions protect against concurrent requests, lost responses and double clicks. CORS allows the invitation origin, but is not authentication. Games retain their opaque sandbox and no-network CSP; only the parent connects to the Worker.

Tests use Miniflare's local Cloudflare runtime and D1 emulator. Browser API requests are routed through that Worker; they do not contact a hosted database. Run `npm test`, `npm run test:leaderboards`, `npm run cloudflare:check`, `npm run build`, and `npm run test:pages`. The final hosted connection still needs a two-device live check after deployment.
