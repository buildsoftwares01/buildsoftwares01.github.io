import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const cases = [
  { name: 'phone', options: { ...devices['iPhone 13'], reducedMotion: 'no-preference' } },
  { name: 'desktop', options: { viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' } },
  { name: 'reduced', options: { ...devices['iPhone 13'], reducedMotion: 'reduce' } },
];
try {
  for (const test of cases) {
    const context = await browser.newContext(test.options);
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) { external.push(url.href); return route.abort(); }
      return route.continue();
    });
    await page.goto(base + '#kids-corner');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-play-animal]')].every(canvas => canvas.dataset.art === 'ready'));
    await page.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.renderer === '2d'));
    const activate = locator => test.options.hasTouch ? locator.tap() : locator.click();
    await page.locator('#little-playground').scrollIntoViewIfNeeded();
    assert(await page.locator('#little-playground').isVisible());
    assert.equal(await page.locator('[data-game]').count(), 4, 'All original games remain available');

    const balloon = page.locator('.balloon-button').first();
    await activate(balloon);
    assert(await balloon.isDisabled(), 'A balloon cannot start overlapping bursts');
    assert((await page.locator('#balloon-status').textContent()).includes('shower of stars'));
    if (test.name === 'reduced') assert.equal(await page.locator('.party-confetti').count(), 0);
    else assert(await page.locator('.party-confetti').count() > 0, 'Balloon releases stars');
    await page.waitForFunction(() => !document.querySelector('.balloon-button').disabled);
    await activate(balloon);
    await page.waitForFunction(() => !document.querySelector('.balloon-button').disabled);
    await page.waitForFunction(() => !document.querySelector('.party-confetti'));

    await activate(page.locator('#birthday-candle'));
    assert(await page.locator('#birthday-candle').isDisabled());
    assert.equal(await page.locator('.candle-flame').isVisible(), false);
    assert((await page.locator('#wish-status').textContent()).includes('Happy birthday, Vihaan'));
    if (test.name === 'reduced') assert.equal(await page.locator('.party-confetti').count(), 0);
    await page.screenshot({ path: `test-results/play-wish-${test.name}.png` });
    await activate(page.locator('#relight-candle'));
    assert(await page.locator('.candle-flame').isVisible());
    assert(await page.locator('#birthday-candle').isEnabled());
    assert.equal(await page.locator('#relight-candle').isVisible(), false);
    await page.locator('#birthday-candle').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.candle-flame').isVisible(), false, 'Candle works by keyboard');
    await activate(page.locator('#relight-candle'));
    await page.waitForFunction(() => !document.querySelector('.party-confetti'));

    await activate(page.locator('#feed-giraffe'));
    assert((await page.locator('#feed-status').textContent()).includes('First pick a leaf'));
    await activate(page.locator('#pick-leaf'));
    assert.equal(await page.locator('#pick-leaf').getAttribute('aria-pressed'), 'true');
    await activate(page.locator('#feed-giraffe'));
    assert((await page.locator('#feed-status').textContent()).includes('Yum!'));
    assert(await page.locator('#pick-leaf').isDisabled());
    if (test.name === 'reduced') assert.equal(await page.locator('.leaf-flight').count(), 0);
    await page.waitForFunction(() => !document.querySelector('#pick-leaf').disabled);
    assert.equal(await page.locator('#pick-leaf').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.leaf-flight').count(), 0, 'Flying leaf is removed');
    await activate(page.locator('#pick-leaf'));
    await activate(page.locator('#feed-giraffe'));
    await page.waitForFunction(() => !document.querySelector('#pick-leaf').disabled);

    const bushes = page.locator('.seek-bush');
    await activate(bushes.first());
    assert((await page.locator('#seek-status').textContent()).includes('Found 1 of 5'));
    await activate(bushes.first());
    assert.equal(await page.locator('.is-collected').count(), 1, 'Finding an animal twice does not duplicate progress');
    for (let i = 1; i < 5; i++) await activate(bushes.nth(i));
    assert.equal(await page.locator('.is-collected').count(), 5);
    assert((await page.locator('#seek-status').textContent()).includes('all five'));
    assert(await page.locator('#replay-seek').isVisible());
    if (test.name === 'reduced') assert.equal(await page.locator('.party-confetti').count(), 0);
    await page.screenshot({ path: `test-results/play-found-${test.name}.png` });
    await activate(page.locator('#replay-seek'));
    assert.equal(await page.locator('.is-found,.is-collected').count(), 0);
    assert((await page.locator('#seek-status').textContent()).includes('Found 0 of 5'));
    assert.equal(await bushes.first().getAttribute('aria-pressed'), 'false');

    if (test.name === 'desktop') {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: playground has no overflow`);
        for (const control of await page.locator('.balloon-button,#birthday-candle,#pick-leaf,#feed-giraffe,.seek-bush').all()) {
          const bounds = await control.boundingBox();
          assert(bounds.width >= 44 && bounds.height >= 44, `${width}px: child controls have large touch targets`);
        }
      }
      await activate(balloon);
      await page.locator('#motion-toggle').click();
      await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
      assert.equal(await page.locator('.party-confetti').count(), 0, 'Pausing clears active particle effects');
      await page.locator('#motion-toggle').click();
      await page.waitForFunction(() => !document.body.classList.contains('motion-paused'));
    }
    await page.waitForFunction(() => !document.querySelector('.party-confetti'));
    await page.locator('#little-playground').screenshot({ path: `test-results/playground-${test.name}.png` });
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0, 'Play progress stays in memory');
    assert.deepEqual(external, [], 'Activities make no external requests');
    assert.deepEqual(errors, [], 'No browser or content-policy errors');
    await context.close();
    console.log(`${test.name}: balloons, candle/replay, feeding, hide-and-seek/replay, keyboard and privacy passed`);
  }
} finally { await browser.close(); }
