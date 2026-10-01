import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { validateName, validScore } from '../leaderboard-policy.js';

export const origin = 'https://buildsoftwares01.github.io';
export const mf = new Miniflare(convertV4MiniflareOptions({
  modulesRoot: resolve('.'),
  modules: await Promise.all(['cloudflare/worker.js', 'leaderboard-policy.js'].map(async path => ({
    type: 'ESModule', path: resolve(path), contents: await readFile(path, 'utf8'),
  }))),
  compatibilityDate: '2026-09-30', d1Databases: ['DB'],
  bindings: { ALLOWED_ORIGINS: origin },
}));
export const db = await mf.getD1Database('DB');
const schema = await readFile('cloudflare/migrations/0001_leaderboards.sql', 'utf8');
const migrate = () => db.batch(schema.split(';').map(s => s.trim()).filter(Boolean).map(sql => db.prepare(sql)));
await migrate(); await migrate(); // repeat without deleting data
export async function rpc(method, params) {
  const response = await mf.dispatchFetch(`https://leaderboard.test/api/${method}`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.message); error.status = response.status; throw error; }
  return data;
}
export async function ageRun(id, milliseconds = 60000) {
  await db.prepare('UPDATE runs SET started_at = ? WHERE id = ?').bind(Date.now() - milliseconds, id).run();
}
async function start(player, game = 'flappy', board = 0) {
  const run = randomUUID();
  await rpc('leaderboard_start', { p_player: player, p_run: run, p_game: game, p_board: board });
  await ageRun(run);
  return run;
}
const submit = (player, run, name, score) => rpc('leaderboard_submit', { p_player: player, p_run: run, p_name: name, p_score: score });

if (process.argv[1]?.endsWith('leaderboard-worker-check.mjs')) {
  try {
    const health = await mf.dispatchFetch('https://leaderboard.test/health');
    assert.equal(health.status, 200); assert.equal((await health.json()).storage, 'd1');
    const preflight = await mf.dispatchFetch('https://leaderboard.test/api/leaderboard_submit', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
    for (const requestOrigin of ['https://unrelated.example', 'null', '']) {
      const response = await mf.dispatchFetch('https://leaderboard.test/api/leaderboard_list', { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 403); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
    const huge = await mf.dispatchFetch('https://leaderboard.test/api/leaderboard_submit', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'x'.repeat(3000) }) });
    assert.equal(huge.status, 413);
    for (const body of ['{bad json', 'null', '[]']) {
      const response = await mf.dispatchFetch('https://leaderboard.test/api/leaderboard_submit', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body });
      assert.equal(response.status, 400);
    }
    const unknown = await mf.dispatchFetch('https://leaderboard.test/scores', { headers: { Origin: origin } });
    assert.equal(unknown.status, 404, 'Database tables have no public route');
    const accepted = ['Madhav', 'Urvashee', 'Vihaan', 'Élodie', "O'Neil", 'Jean-Luc', 'Cassandra', 'Scunthorpe', 'Connor', 'Safari Sam', 'Zoë', 'Sam 23'];
    const rejected = ['', 'A', '123', 'a'.repeat(21), '<script>', 'FuCk', 'f u c k', 'f-u-c-k', 'fuuuck', 'fúck', 'fuck123', 'sh1t', 's h i t', 'sh1t123', '123shit', 's h 1 t123', 'shit23', 'pédé', 'fcuk', 'b1tch', 'p u t a i n', 'salope', 'gogot', 'n1gg3r', 'f\u200buck', 'fаck', 'name\nother'];
    const moderationPlayer = randomUUID(), moderationRun = await start(moderationPlayer);
    for (const name of rejected) {
      assert(validateName(name).error, `Client moderation: ${JSON.stringify(name)}`);
      await assert.rejects(submit(moderationPlayer, moderationRun, name, 10), /invalid_name/, `Worker rejects bypassing client filter: ${name}`);
    }
    for (const name of accepted) {
      const player = randomUUID();
      assert.equal(validateName(name).name, name);
      await submit(player, await start(player, 'taptaptap'), name, 13);
    }
    assert(!validScore('ohhi', 4, 0)); assert(!validScore('ohhi', 0, 10000)); assert(!validScore('flappy', 0, Infinity));
    await assert.rejects(rpc('leaderboard_start', { p_player: randomUUID(), p_run: randomUUID(), p_game: 'unknown', p_board: 0 }), /invalid_run/);
    const player = randomUUID(), other = randomUUID();
    const run = await start(player);
    await assert.rejects(submit(other, run, 'Sam', 10), /invalid_run/);
    await assert.rejects(submit(player, run, 'Sam', -1), /invalid_score/);
    await assert.rejects(submit(player, run, 'Sam', 10.5), /invalid_score/);
    let saved = await submit(player, run, 'Sam', 10);
    assert.equal(saved.rank, 1); assert.equal(saved.improved, true);
    assert.deepEqual(await submit(player, run, 'Sam', 10), saved, 'Retry is idempotent');
    await assert.rejects(submit(player, run, 'Sam', 11), /invalid_run/);
    saved = await submit(player, await start(player), 'Sam', 5);
    assert.equal(saved.score, 10); assert.equal(saved.improved, false);
    await submit(other, await start(other), 'Alex', 10);
    const third = randomUUID(); await submit(third, await start(third), 'Jo', 8);
    let rows = await rpc('leaderboard_list', { p_game: 'flappy', p_board: 0 });
    assert.deepEqual(rows.map(r => [r.rank, r.score]), [[1,10],[1,10],[2,8]]);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['name','rank','score'], 'No player or round tokens in public responses');
    await submit(player, await start(player, 'ohhi', 4), 'Sam', 30000);
    saved = await submit(player, await start(player, 'ohhi', 4), 'Sam', 20000);
    assert.equal(saved.score, 20000);
    await submit(other, await start(other, 'ohhi', 6), 'Alex', 10000);
    rows = await rpc('leaderboard_list', { p_game: 'ohhi', p_board: 4 });
    assert.equal(rows.length, 1); assert.equal(rows[0].score, 20000);
    const expired = await start(player); await ageRun(expired, 3 * 3600000);
    await assert.rejects(submit(player, expired, 'Sam', 4), /expired_run/);
    const impossible = await start(player, 'ohhi', 8);
    await assert.rejects(submit(player, impossible, 'Sam', 0), /invalid_score/);
    await assert.rejects(submit(player, impossible, 'Sam', 500000), /invalid_score/);
    const concurrentPlayer = randomUUID(), concurrentRun = await start(concurrentPlayer, 'hextris');
    const raced = await Promise.allSettled([submit(concurrentPlayer, concurrentRun, 'One', 20), submit(concurrentPlayer, concurrentRun, 'Two', 30)]);
    assert.equal(raced.filter(r => r.status === 'fulfilled').length, 1, 'One concurrent claim wins');
    assert.equal(raced.filter(r => r.status === 'rejected').length, 1);
    const high = await start(concurrentPlayer, 'hextris'), low = await start(concurrentPlayer, 'hextris');
    await Promise.all([submit(concurrentPlayer, high, 'Hero', 100), submit(concurrentPlayer, low, 'Hero', 50)]);
    rows = await rpc('leaderboard_list', { p_game: 'hextris', p_board: 0 });
    assert.equal(rows[0].score, 100, 'Concurrent rounds retain the best score');
    // Simulate an old entry which became blocked by a later moderation update.
    await db.prepare("UPDATE scores SET name = 'f u c k' WHERE player = ?").bind(concurrentPlayer).run();
    assert.deepEqual(await rpc('leaderboard_list', { p_game: 'hextris', p_board: 0 }), []);
    const spammer = randomUUID();
    await db.batch(Array.from({ length: 120 }, () => db.prepare("INSERT INTO runs(id,player,game,board,started_at) VALUES(?,?,'flappy',0,?)").bind(randomUUID(), spammer, Date.now())));
    await assert.rejects(start(spammer), /rate_limit/);
    const fastPlayer = randomUUID();
    for (let i = 0; i < 12; i++) await submit(fastPlayer, await start(fastPlayer), 'Guest', i);
    await assert.rejects(submit(fastPlayer, await start(fastPlayer), 'Guest', 13), /rate_limit/);
    console.log('Cloudflare Worker + D1: CORS, request limits, name moderation, ownership, concurrent retries, best scores, ties, board sizes, expiry and rate limits passed.');
  } finally { await mf.dispose(); }
}
