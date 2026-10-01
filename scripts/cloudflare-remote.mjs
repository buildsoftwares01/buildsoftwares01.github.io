// Keep an unconfigured project from accidentally creating or targeting remote resources.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const config = JSON.parse(await readFile('cloudflare/wrangler.jsonc', 'utf8'));
const id = config.d1_databases?.[0]?.database_id;
if (!/^[0-9a-f-]{36}$/i.test(id || '') || id === '00000000-0000-0000-0000-000000000000') {
  console.error('First run npm run cloudflare:db:create, then put its database_id into cloudflare/wrangler.jsonc. See LEADERBOARDS.md.');
  process.exit(1);
}
const commands = {
  migrate: ['d1', 'migrations', 'apply', 'vihaan-leaderboard', '--remote'],
  deploy: ['deploy'],
};
const args = commands[process.argv[2]];
if (!args) throw new Error('Expected migrate or deploy');
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args, '--config', 'cloudflare/wrangler.jsonc'], { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
