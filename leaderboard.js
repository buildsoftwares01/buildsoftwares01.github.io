import { createLeaderboardAPI } from './leaderboard-api.js';
import { validBoard, validScore, validateName, formatScore } from './leaderboard-policy.js';

export function setupLeaderboards({ gameDialog, getGame, getFrame }) {
  const $ = selector => document.querySelector(selector);
  const api = createLeaderboardAPI();
  const dialog = $('#leaderboard-dialog');
  const gameSelect = $('#leaderboard-game');
  const boardSelect = $('#leaderboard-board');
  const form = $('#score-form');
  const nameInput = $('#score-name');
  const status = $('#leaderboard-status');
  const error = $('#score-error');
  const save = $('#save-score');
  let run = null, pending = null, requestVersion = 0, submitting = false;
  const selection = () => ({ game: gameSelect.value, board: gameSelect.value === 'ohhi' ? Number(boardSelect.value) : 0 });
  const matches = result => result && result.game === gameSelect.value && result.board === selection().board;

  function renderForm() {
    form.hidden = !matches(pending);
    if (!form.hidden) {
      $('#score-result').textContent = `You finished with ${formatScore(pending.game, pending.score)}!`;
      save.disabled = !api.ready || submitting || pending.saved;
      save.textContent = pending.saved ? 'Score saved ✓' : submitting ? 'Saving…' : 'Save my score';
      nameInput.disabled = pending.saved || submitting;
    }
  }
  async function refresh() {
    const version = ++requestVersion;
    const { game, board } = selection();
    $('#leaderboard-board-label').hidden = game !== 'ohhi';
    $('#leaderboard-rules').textContent = game === 'ohhi'
      ? 'Fastest solved puzzle wins, with a separate ranking for each size. Hints are allowed; tutorials do not count.'
      : 'Highest score wins. Your best result on this browser appears on the board. Equal scores share a rank.';
    renderForm();
    $('#leaderboard-rows').replaceChildren();
    $('#leaderboard-table').hidden = true;
    if (!api.ready) {
      status.textContent = 'Shared rankings are not available yet. You can still enjoy every game.';
      return;
    }
    status.textContent = 'Loading the latest scores…';
    try {
      const rows = await api.list(game, board);
      if (version !== requestVersion) return;
      if (!Array.isArray(rows) || rows.some(row => !Number.isInteger(row.rank) || row.rank < 1 || !validScore(game, board, row.score) || validateName(row.name).error)) throw new Error('Rankings are temporarily unavailable. Please try again.');
      for (const row of rows.slice(0, 20)) {
        const tr = document.createElement('tr');
        for (const text of [String(row.rank), row.name, formatScore(game, row.score)]) {
          const td = document.createElement('td'); td.textContent = text; tr.append(td);
        }
        $('#leaderboard-rows').append(tr);
      }
      $('#leaderboard-table').hidden = rows.length === 0;
      status.textContent = rows.length ? 'Top 20 adventurers · updated just now' : 'No scores yet. Be the first adventurer on the board!';
    } catch (cause) {
      if (version === requestVersion) status.textContent = cause.message;
    }
  }
  function open(game, board = 0) {
    gameSelect.value = game;
    boardSelect.value = String(board || 4);
    if (!dialog.open) dialog.showModal();
    void refresh();
  }
  $('#open-leaderboards').addEventListener('click', () => open('taptaptap'));
  $('#game-leaderboard').addEventListener('click', () => open(getGame(), pending?.game === getGame() ? pending.board : 0));
  $('#close-leaderboard').addEventListener('click', () => dialog.close());
  $('#skip-score').addEventListener('click', () => dialog.close());
  $('#refresh-leaderboard').addEventListener('click', refresh);
  gameSelect.addEventListener('change', () => { error.textContent = ''; void refresh(); });
  boardSelect.addEventListener('change', () => { error.textContent = ''; void refresh(); });
  nameInput.addEventListener('input', () => { error.textContent = ''; nameInput.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !matches(pending) || pending.saved || !api.ready) return;
    const checked = validateName(nameInput.value);
    if (checked.error) {
      error.textContent = checked.error; nameInput.setAttribute('aria-invalid', 'true'); nameInput.focus(); return;
    }
    const result = pending;
    submitting = true; error.textContent = ''; renderForm();
    try {
      // Await the start request so very short rounds cannot race its database insert.
      const started = await result.started;
      if (started.error) throw new Error('The leaderboard was offline when this round began. Please play again to rank a score.');
      const saved = await api.submit(result, checked.name);
      result.saved = true;
      if (pending === result && matches(result)) {
        error.textContent = `Saved! Your best result ranks #${saved.rank}. ${saved.improved ? 'Lovely playing!' : 'Your earlier best stays on the board.'}`;
        await refresh();
      }
    } catch (cause) {
      if (pending === result) error.textContent = cause.message;
    } finally { submitting = false; renderForm(); }
  });
  window.addEventListener('message', event => {
    const data = event.data;
    if (!gameDialog.open || event.source !== getFrame()?.contentWindow || !data || data.channel !== 'vihaan-score-v1' ||
        data.game !== getGame() || !validBoard(data.game, data.board) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.run)) return;
    if (data.type === 'start') {
      if (run?.run === data.run) return;
      run = { game: data.game, board: data.board, run: data.run };
      run.started = api.ready ? api.start(run).then(() => ({}), error => ({ error })) : Promise.resolve({ error: true });
      pending = null; error.textContent = ''; renderForm();
    } else if (data.type === 'finish' && run?.run === data.run && !pending && validScore(data.game, data.board, data.score)) {
      pending = { ...run, score: data.score, saved: false };
      nameInput.value = ''; error.textContent = ''; nameInput.removeAttribute('aria-invalid');
      open(data.game, data.board);
    }
  });
  return {
    reset() { run = null; pending = null; ++requestVersion; if (dialog.open) dialog.close(); },
  };
}
