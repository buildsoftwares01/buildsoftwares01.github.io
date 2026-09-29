// Only run lifecycle messages leave the sandbox. Names and network access stay in the parent.
(() => {
  let current = null;
  function send(type, extra) {
    // Sandboxed frames have an opaque origin; the parent verifies event.source.
    parent.postMessage({ channel: 'vihaan-score-v1', type, ...current, ...extra }, '*');
  }
  window.invitationScore = {
    start(game, board = 0) {
      current = { game, board, run: crypto.randomUUID() };
      send('start');
    },
    finish(score) {
      if (!current) return;
      send('finish', { score });
      current = null;
    },
    cancel() { current = null; },
  };
})();
