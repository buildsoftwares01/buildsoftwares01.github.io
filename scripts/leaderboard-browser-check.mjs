import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { createServer } from 'vite';
import { pg, rpc, ageRun } from './leaderboard-db-check.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  let offline = false, submissions = 0;
  const failures = [];
  async function newGuest(mobile = false) {
    const context = await browser.newContext(mobile ? { ...devices['iPhone 13'], reducedMotion: 'reduce' } : { reducedMotion: 'reduce' });
    await context.route('**/leaderboard-config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `export const leaderboardConfig = { url: 'https://test.supabase.co', publishableKey: 'sb_publishable_test' };` }));
    await context.route('https://test.supabase.co/rest/v1/rpc/*', async route => {
      if (offline) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      const method = new URL(route.request().url()).pathname.split('/').pop();
      const params = route.request().postDataJSON();
      assert(['leaderboard_start','leaderboard_list','leaderboard_submit'].includes(method));
      try {
        const rows = await rpc(method, params);
        if (method === 'leaderboard_start') await ageRun(params.p_run);
        if (method === 'leaderboard_submit') submissions++;
        const data = method === 'leaderboard_list' ? rows : rows[0][method];
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      } catch (error) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: error.message }) });
      }
    });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(base);
    return { page, context };
  }
  const { page, context } = await newGuest(true);
  async function open(game) {
    const loaded = page.waitForEvent('framenavigated', frame => frame.url().includes(`/games/${game}/`));
    await page.locator(`[data-game="${game}"]`).tap();
    const frame = await loaded;
    await frame.waitForLoadState('load');
    return frame;
  }
  async function save(name) {
    await page.locator('#score-form').waitFor({ state: 'visible' });
    await page.locator('#score-name').fill(name);
    await page.locator('#save-score').click();
    await page.waitForFunction(() => document.querySelector('#save-score').textContent === 'Score saved ✓');
    assert.match(await page.locator('#score-error').textContent(), /ranks #/);
  }
  const tap = await open('taptaptap');
  // Forged parent-window messages must not create a score form.
  await page.evaluate(() => window.postMessage({ channel: 'vihaan-score-v1', type: 'finish', game: 'taptaptap', board: 0, run: crypto.randomUUID(), score: 99999 }, '*'));
  assert.equal(await page.locator('#leaderboard-dialog').evaluate(el => el.open), false);
  await tap.locator('#newGameBtn').tap();
  await tap.locator('#tutPgStartGameBtn').tap();
  await tap.locator('#gameSpace .good-circle').first().tap();
  const tapScore = await tap.evaluate(() => gameEngine.score);
  assert(tapScore > 0);
  await tap.evaluate(() => gameEngine.timesUp());
  await page.locator('#score-form').waitFor({ state: 'visible' });
  assert((await page.locator('#score-result').textContent()).includes(String(tapScore)));
  await page.locator('#score-name').fill('f u c k');
  await page.locator('#save-score').tap();
  assert.match(await page.locator('#score-error').textContent(), /family-friendly/);
  assert.equal(submissions, 0);
  // A failed request leaves the score and name intact for retry.
  offline = true;
  await page.locator('#score-name').fill('Safari Sam');
  await page.locator('#save-score').tap();
  await page.waitForFunction(() => document.querySelector('#score-error').textContent.includes('temporarily unavailable'));
  assert.equal(await page.locator('#score-name').inputValue(), 'Safari Sam');
  offline = false;
  await save('Safari Sam');
  await page.setViewportSize({ width: 320, height: 720 });
  assert.equal(await page.locator('#leaderboard-dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/leaderboard-mobile.png' });
  await page.locator('#close-leaderboard').tap();
  await page.locator('#restart-game').tap();
  await page.locator('#game-leaderboard').tap();
  assert.equal(await page.locator('#score-form').isVisible(), false, 'Restart discards old submission');
  await page.locator('#close-leaderboard').tap();
  await page.locator('#close-game').tap();

  const flappy = await open('flappy');
  await flappy.locator('#flyarea').tap({ position: { x: 100, y: 180 } });
  await save('Bird Buddy'); // real collision ends the round and opens the form
  await page.locator('#close-leaderboard').tap();
  await page.locator('#close-game').tap();

  const hex = await open('hextris');
  await hex.locator('#startBtn').tap();
  await hex.evaluate(() => { score = 42; const original = isInfringing; isInfringing = () => { isInfringing = original; return true; }; });
  await save('Hex Hero');
  await page.locator('#close-leaderboard').tap();
  // Exercise the game's own replay, which uses a different init path.
  await hex.waitForFunction(() => canRestart && gameState === 2);
  await page.screenshot({ path: 'test-results/hextris-score-mobile.png' });
  await hex.locator('#restart').tap();
  await hex.waitForFunction(() => gameState === 1);
  await hex.evaluate(() => { score = 51; const original = isInfringing; isInfringing = () => { isInfringing = original; return true; }; });
  await save('Hex Hero');
  await page.locator('#close-leaderboard').tap();
  await page.locator('#close-game').tap();

  const logic = await open('ohhi');
  await logic.waitForFunction(() => typeof Game !== 'undefined' && Game.startGame);
  const generated = await logic.evaluate(() => Levels.create(4));
  assert.equal(generated.full.length, 16);
  assert.equal(generated.empty.length, 16);
  assert(Number.isFinite(generated.quality), 'Fallback puzzle generation reports valid quality');
  await logic.evaluate(() => {
    const full = [1,1,2,2,2,1,2,1,2,2,1,1,1,2,1,2];
    Game.startGame({ size: 4, full, empty: full.map((v, i) => i === 0 ? 0 : v), isTutorial: true });
    Game.grid.tile(0,0).value = 1; Game.checkForLevelComplete();
  });
  assert.equal(await page.locator('#leaderboard-dialog').evaluate(el => el.open), false, 'Tutorial never submits');
  await logic.evaluate(() => {
    const full = [1,1,2,2,2,1,2,1,2,2,1,1,1,2,1,2];
    Game.startGame({ size: 4, full, empty: full.map((v, i) => i === 0 ? 0 : v) });
    window.testStartedAt = performance.now();
  });
  await logic.waitForFunction(() => performance.now() - window.testStartedAt > 1100);
  await logic.evaluate(() => { Game.grid.tile(0,0).value = 1; Game.checkForLevelComplete(); });
  await save('Logic Lion');
  assert.equal(await page.locator('#leaderboard-board').inputValue(), '4');
  await page.locator('#leaderboard-board').selectOption('6');
  await page.waitForFunction(() => document.querySelector('#leaderboard-status').textContent.startsWith('No scores'));
  assert.equal(await page.locator('#score-form').isVisible(), false);
  await page.locator('#close-leaderboard').tap();
  await page.locator('#close-game').tap();

  const second = await newGuest();
  await second.page.locator('#open-leaderboards').click();
  await second.page.getByRole('cell', { name: 'Safari Sam' }).waitFor();
  assert.equal(await second.page.locator('#score-form').isVisible(), false);
  await second.page.screenshot({ path: 'test-results/leaderboard-desktop.png' });
  await second.context.close();
  await context.close();
  assert.deepEqual(failures, []);
  console.log('Browser + PostgreSQL: all game finishes, replay, tutorial exclusion, moderation, retry, mobile layout and cross-guest rankings passed.');
} finally { await browser?.close(); await server.close(); await pg.close(); }
