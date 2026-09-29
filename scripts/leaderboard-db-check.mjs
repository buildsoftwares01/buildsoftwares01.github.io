import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { validateName, validScore } from '../leaderboard-policy.js';

export const pg = new PGlite({ extensions: { unaccent } });
await pg.exec('create role anon; create role authenticated;');
await pg.exec(await readFile('supabase/leaderboard.sql', 'utf8'));
// Applying setup twice must preserve existing data and permissions.
await pg.exec(await readFile('supabase/leaderboard.sql', 'utf8'));
export async function rpc(method, params) {
  const keys = Object.keys(params);
  await pg.exec('set role anon');
  try {
    return (await pg.query(`select * from public.${method}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')})`, Object.values(params))).rows;
  } finally { await pg.exec('reset role'); }
}
export async function ageRun(id, age = '1 minute') {
  await pg.query('update invitation_private.runs set started_at = clock_timestamp() - $2::interval where id = $1', [id, age]);
}
export async function start(player, game = 'flappy', board = 0) {
  const id = randomUUID();
  await rpc('leaderboard_start', { p_player: player, p_run: id, p_game: game, p_board: board });
  await ageRun(id);
  return id;
}
export async function submit(player, run, name, score) {
  return (await rpc('leaderboard_submit', { p_player: player, p_run: run, p_name: name, p_score: score }))[0].leaderboard_submit;
}

if (process.argv[1]?.endsWith('leaderboard-db-check.mjs')) {
  try {
    const accepted = ['Madhav', 'Urvashee', 'Vihaan', 'Élodie', "O'Neil", 'Jean-Luc', 'Cassandra', 'Scunthorpe', 'Connor', 'Safari Sam', 'Zoë', 'Sam 23'];
    const rejected = ['', 'A', '123', 'a'.repeat(21), '<script>', 'FuCk', 'f u c k', 'f-u-c-k', 'fuuuck', 'fúck', 'fuck123', 'sh1t', 's h i t', 'sh1t123', '123shit', 's h 1 t123', 'shit23', 'pédé', 'fcuk', 'b1tch', 'p u t a i n', 'salope', 'gogot', 'n1gg3r', 'f\u200buck', 'fаck', 'name\nother'];
    for (const name of [...accepted, ...rejected]) {
      const client = validateName(name);
      const db = (await pg.query('select invitation_private.clean_name($1) as name', [name])).rows[0].name;
      assert.equal(Boolean(client.name), accepted.includes(name), `Browser moderation: ${JSON.stringify(name)}`);
      assert.equal(db, client.name || null, `Database moderation: ${JSON.stringify(name)}`);
    }
    assert(!validScore('ohhi', 4, 0));
    assert(!validScore('ohhi', 0, 10000));
    assert(!validScore('flappy', 0, Infinity));
    await pg.exec('set role anon');
    await assert.rejects(pg.query('select * from invitation_private.scores'), /permission denied/);
    await assert.rejects(pg.query("insert into invitation_private.scores values (gen_random_uuid(),'flappy',0,'Sam',5,now())"), /permission denied/);
    await assert.rejects(pg.query("select invitation_private.clean_name('Sam')"), /permission denied/);
    await pg.exec('reset role');
    const player = randomUUID(), other = randomUUID();
    const run = await start(player);
    await assert.rejects(submit(player, run, 'f u c k', 10), /invalid_name/);
    await assert.rejects(submit(other, run, 'Sam', 10), /invalid_run/);
    await assert.rejects(submit(player, run, 'Sam', -1), /invalid_score/);
    let saved = await submit(player, run, 'Sam', 10);
    assert.equal(saved.rank, 1); assert.equal(saved.improved, true);
    await submit(player, run, 'Sam', 10); // safe retry
    await assert.rejects(submit(player, run, 'Sam', 11), /invalid_run/);
    saved = await submit(player, await start(player), 'Sam', 5);
    assert.equal(saved.score, 10); assert.equal(saved.improved, false);
    await submit(other, await start(other), 'Alex', 10);
    const third = randomUUID(); await submit(third, await start(third), 'Jo', 8);
    let board = await rpc('leaderboard_list', { p_game: 'flappy', p_board: 0 });
    assert.deepEqual(board.map(r => [Number(r.rank), r.score]), [[1,10],[1,10],[2,8]]);
    assert.deepEqual(Object.keys(board[0]).sort(), ['name','rank','score'], 'Never expose player or run tokens');
    await submit(player, await start(player, 'ohhi', 4), 'Sam', 30000);
    saved = await submit(player, await start(player, 'ohhi', 4), 'Sam', 20000);
    assert.equal(saved.score, 20000);
    await submit(other, await start(other, 'ohhi', 6), 'Alex', 10000);
    board = await rpc('leaderboard_list', { p_game: 'ohhi', p_board: 4 });
    assert.equal(board.length, 1); assert.equal(board[0].score, 20000);
    const expired = await start(player); await ageRun(expired, '3 hours');
    await assert.rejects(submit(player, expired, 'Sam', 4), /expired_run/);
    const impossible = await start(player, 'ohhi', 8);
    await assert.rejects(submit(player, impossible, 'Sam', 0), /invalid_score/);
    await assert.rejects(submit(player, impossible, 'Sam', 500000), /invalid_score/);
    const spammer = randomUUID();
    await pg.query("insert into invitation_private.runs(id,player,game,board) select gen_random_uuid(),$1,'flappy',0 from generate_series(1,120)", [spammer]);
    await assert.rejects(start(spammer), /rate_limit/);
    console.log('PostgreSQL: moderation parity, permissions, ownership, retries, best scores, ties, board sizes, expiry and rate limits passed.');
  } finally { await pg.close(); }
}
