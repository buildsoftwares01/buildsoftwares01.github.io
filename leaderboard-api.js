import { leaderboardConfig } from './leaderboard-config.js';

export function createLeaderboardAPI(config = leaderboardConfig) {
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  let player;
  function playerId() {
    if (player) return player;
    try { player = localStorage.getItem('vihaan-leaderboard-player'); } catch { /* Session-only identity when storage is blocked. */ }
    if (!/^[0-9a-f-]{36}$/.test(player || '')) player = crypto.randomUUID();
    try { localStorage.setItem('vihaan-leaderboard-player', player); } catch { /* Playing remains available. */ }
    return player;
  }
  async function rpc(method, params) {
    if (!ready) throw new Error('Shared rankings are not available yet. You can still enjoy every game.');
    let response;
    try {
      response = await fetch(`${config.url}/rest/v1/rpc/${method}`, {
        method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(params), signal: AbortSignal.timeout(12000), credentials: 'omit',
      });
    } catch { throw new Error('Could not connect. Check your connection and try again.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const messages = {
        invalid_name: 'Please choose a different, family-friendly name.',
        rate_limit: 'Lots of adventures! Please wait a minute before trying again.',
        expired_run: 'This result has expired. Play again to set a new score.',
        invalid_score: 'This result could not be ranked. Please try another game.',
        invalid_run: 'This result could not be ranked. Please try another game.',
      };
      throw new Error(messages[data?.message] || 'Rankings are temporarily unavailable. Please try again.');
    }
    return data;
  }
  return {
    ready,
    list: (game, board) => rpc('leaderboard_list', { p_game: game, p_board: board }),
    start: run => rpc('leaderboard_start', { p_player: playerId(), p_run: run.run, p_game: run.game, p_board: run.board }),
    submit: (run, name) => rpc('leaderboard_submit', { p_player: playerId(), p_run: run.run, p_name: name, p_score: run.score }),
  };
}
