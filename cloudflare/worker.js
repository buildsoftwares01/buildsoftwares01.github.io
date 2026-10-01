import { validateName, validBoard, validScore } from '../leaderboard-policy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOUR = 3600000;
class APIError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new APIError(message, status); };
function identity(player, run) {
  if (typeof player !== 'string' || typeof run !== 'string' || !UUID.test(player) || !UUID.test(run)) fail('invalid_run');
}
function board(game, size) { if (!validBoard(game, size)) fail('invalid_run'); }

async function start(db, { p_player: player, p_run: run, p_game: game, p_board: size }) {
  identity(player, run); board(game, size);
  const now = Date.now();
  // The limit check and insert are one SQL statement, preventing concurrent-limit races.
  const results = await db.batch([
    db.prepare(`INSERT INTO runs(id, player, game, board, started_at)
      SELECT ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM runs WHERE player = ? AND started_at > ?) < 120
      ON CONFLICT(id) DO NOTHING`).bind(run, player, game, size, now, player, now - HOUR),
    db.prepare('SELECT player, game, board FROM runs WHERE id = ?').bind(run),
  ]);
  const existing = results[1].results[0];
  if (!existing) fail('rate_limit', 429);
  if (existing.player !== player || existing.game !== game || existing.board !== size) fail('invalid_run');
  return run;
}

async function list(db, { p_game: game, p_board: size }) {
  board(game, size);
  // Re-check stored names after denylist changes. Hidden rows never contribute to rank.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { results } = await db.prepare(`SELECT player, name, score, dense_rank() OVER (ORDER BY sort_score) AS rank
      FROM scores WHERE game = ? AND board = ? AND hidden = 0
      ORDER BY sort_score, achieved_at, player LIMIT 20`).bind(game, size).all();
    const blocked = results.filter(row => validateName(row.name).error);
    if (!blocked.length) return results.map(({ rank, name, score }) => ({ rank, name, score }));
    await db.batch(blocked.map(row => db.prepare('UPDATE scores SET hidden = 1 WHERE player = ? AND game = ? AND board = ? AND name = ?').bind(row.player, game, size, row.name)));
  }
  fail('unavailable', 503);
}

async function submit(db, { p_player: player, p_run: run, p_name: input, p_score: score }) {
  identity(player, run);
  if (typeof input !== 'string' || input.length > 100) fail('invalid_name');
  const checked = validateName(input);
  if (checked.error) fail('invalid_name');
  const name = checked.name;
  const existing = await db.prepare('SELECT * FROM runs WHERE id = ? AND player = ?').bind(run, player).first();
  if (!existing) fail('invalid_run');
  const now = Date.now();
  if (existing.started_at < now - 2 * HOUR) fail('expired_run');
  if (!validScore(existing.game, existing.board, score)) fail('invalid_score');
  const elapsed = now - existing.started_at;
  if (existing.submitted_at === null && (elapsed < 500 ||
      (existing.game === 'ohhi' && score > elapsed + 15000) ||
      (existing.game === 'flappy' && score > elapsed / 500 + 2))) fail('invalid_score');
  const sortScore = existing.game === 'ohhi' ? score : -score;
  // D1 batch is a transaction. Only an unsubmitted run can claim its result; the
  // following insert reads that claimed result, not unchecked request fields.
  const results = await db.batch([
    db.prepare(`UPDATE runs SET submitted_at = ?, submitted_name = ?, submitted_score = ?,
      improved = NOT EXISTS (SELECT 1 FROM scores WHERE player = runs.player AND game = runs.game AND board = runs.board AND hidden = 0 AND sort_score <= ?)
      WHERE id = ? AND player = ? AND submitted_at IS NULL
      AND (SELECT count(*) FROM runs WHERE player = ? AND submitted_at > ?) < 12`).bind(now, name, score, sortScore, run, player, player, now - 60000),
    db.prepare(`INSERT INTO scores(player, game, board, name, score, sort_score, achieved_at)
      SELECT player, game, board, submitted_name, submitted_score,
        CASE WHEN game = 'ohhi' THEN submitted_score ELSE -submitted_score END, submitted_at
      FROM runs WHERE id = ? AND player = ? AND submitted_name = ? AND submitted_score = ? AND submitted_at IS NOT NULL
      ON CONFLICT(player, game, board) DO UPDATE SET name = excluded.name, score = excluded.score,
        sort_score = excluded.sort_score, achieved_at = excluded.achieved_at, hidden = 0
      WHERE excluded.sort_score < scores.sort_score OR scores.hidden = 1`).bind(run, player, name, score),
    db.prepare('SELECT submitted_at, submitted_name, submitted_score, improved FROM runs WHERE id = ? AND player = ?').bind(run, player),
    db.prepare(`SELECT s.score, 1 + (SELECT count(DISTINCT better.sort_score) FROM scores better
      WHERE better.game = s.game AND better.board = s.board AND better.hidden = 0 AND better.sort_score < s.sort_score) AS rank
      FROM scores s WHERE s.player = ? AND s.game = ? AND s.board = ? AND s.hidden = 0`).bind(player, existing.game, existing.board),
  ]);
  const savedRun = results[2].results[0];
  if (!savedRun || savedRun.submitted_at === null) fail('rate_limit', 429);
  if (savedRun.submitted_name !== name || savedRun.submitted_score !== score) fail('invalid_run', 409);
  const best = results[3].results[0];
  if (!best) fail('invalid_run');
  return { rank: best.rank, score: best.score, improved: Boolean(savedRun.improved) };
}

async function readBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail('invalid_request', 415);
  if (!request.body) fail('invalid_request');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2048) { await reader.cancel(); fail('invalid_request', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('invalid_request'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('invalid_request');
  return body;
}

const handlers = { leaderboard_start: start, leaderboard_list: list, leaderboard_submit: submit };
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
    if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health' && request.method === 'GET') {
        await env.DB.prepare('SELECT 1 FROM scores LIMIT 1').first();
        return respond({ ok: true, service: 'vihaan-leaderboard', storage: 'd1' });
      }
      if (!origin || !allowed.includes(origin)) fail('origin_not_allowed', 403);
      const method = url.pathname.match(/^\/api\/(leaderboard_start|leaderboard_list|leaderboard_submit)$/)?.[1];
      if (!method) fail('not_found', 404);
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
      }
      if (request.method !== 'POST') fail('method_not_allowed', 405);
      return respond(await handlers[method](env.DB, await readBody(request)));
    } catch (error) {
      if (error instanceof APIError) return respond({ message: error.message }, error.status);
      // Never expose database errors or log names, request bodies or player tokens.
      console.error('Leaderboard storage request failed.');
      return respond({ message: 'unavailable' }, 503);
    }
  },
  async scheduled(_controller, env) {
    await env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(Date.now() - 86400000).run();
  },
};
