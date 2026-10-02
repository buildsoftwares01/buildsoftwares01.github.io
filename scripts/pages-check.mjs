import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf' };
let mount = '/';
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    assert(pathname.startsWith(mount));
    let file = resolve(root, pathname.slice(mount.length) || '.');
    assert(file === root || file.startsWith(root + sep));
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const prefix of ['/', '/Birthday/']) {
    mount = prefix;
    const base = `http://127.0.0.1:${server.address().port}${prefix}`;
    const page = await browser.newPage(prefix === '/Birthday/' ? { viewport: { width: 390, height: 844 } } : {});
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => failures.push(request.url()));
    await page.clock.install({ time: new Date('2026-10-02T08:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-02T08:00:01Z'));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.locator('.hero-art img').evaluate(img => img.complete && img.naturalWidth > 0));
    const friends = page.locator('.safari-friend');
    const homes = page.locator('.safari-home');
    assert.equal(await friends.count(), 4);
    assert.deepEqual(await homes.evaluateAll(homes => homes.map(home => home.dataset.state)), ['walk', 'eat', 'sleep', 'play']);
    assert.equal(await page.locator('.safari-friends').evaluate(el => getComputedStyle(el).position), 'absolute');
    await page.mouse.move(200, 0);
    await page.clock.runFor(32);
    const start = await friends.first().getAttribute('style');
    await page.clock.runFor(1250);
    assert.notEqual(await friends.first().getAttribute('style'), start, 'Walking follows a local circular path');
    await page.clock.runFor(8750);
    assert.equal(await homes.first().getAttribute('data-state'), 'eat');
    await page.clock.runFor(6000);
    assert.equal(await homes.first().getAttribute('data-state'), 'sleep');
    assert.equal(await friends.first().locator('.safari-sleep-eyes').evaluate(el => getComputedStyle(el).display), 'block');
    await page.clock.runFor(8500);
    assert.equal(await homes.first().getAttribute('data-state'), 'play');
    await page.clock.runFor(6500);
    assert.equal(await homes.first().getAttribute('data-state'), 'walk', 'Routine repeats');
    await page.evaluate(() => document.querySelector('#motion-toggle').click());
    const beforePause = await friends.first().getAttribute('style');
    await page.clock.runFor(12000);
    assert.equal(await friends.first().getAttribute('style'), beforePause, 'Pause freezes position and routine');
    const anchorBefore = await homes.first().evaluate(home => home.getBoundingClientRect().top + scrollY);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
    const anchorAfter = await homes.first().evaluate(home => home.getBoundingClientRect().top + scrollY);
    assert(Math.abs(anchorBefore - anchorAfter) < .01, 'Home stays in its document spot while scrolling');
    assert((await homes.first().boundingBox()).y < 0, 'Top animal scrolls out of the viewport');
    await page.evaluate(() => document.querySelector('#motion-toggle').click());
    for (let i = 0; i < 4; i++) {
      const friend = friends.nth(i);
      await friend.scrollIntoViewIfNeeded();
      const bounds = await friend.boundingBox();
      const size = page.viewportSize().width > 760 ? 56 : 48;
      assert(Math.abs(bounds.width - size) < .01);
      assert(Math.abs(bounds.height - size) < .01);
      assert(bounds.x >= 0 && bounds.x + size <= page.viewportSize().width);
      await friend.click();
      assert.equal(await friend.getAttribute('data-gesture'), 'boo');
      assert.equal(await friend.locator('.safari-surprise').evaluate(el => getComputedStyle(el).display), 'block');
      await page.clock.runFor(336);
      // Browser CSS animations use the rendering clock, not the mocked JS clock.
      await new Promise(resolve => setTimeout(resolve, 336));
      assert(Number(await friend.locator('.safari-boo').evaluate(el => getComputedStyle(el).opacity)) > .9);
      const mainTop = await page.locator('#main').evaluate(el => el.getBoundingClientRect().top);
      assert((await friend.locator('.safari-boo').boundingBox()).y >= mainTop, 'Surprise bubble is not clipped by its layer');
      assert((await friend.locator('.safari-friend-art').boundingBox()).y >= mainTop, 'Bouncing animal is not clipped by its layer');
      if (i === 0) await page.screenshot({ path: `test-results/safari-boo-${prefix === '/' ? 'desktop' : 'mobile'}.png` });
      await page.clock.runFor(880);
      assert.equal(await friend.getAttribute('data-gesture'), null, 'Surprise ends and the routine resumes');
      await friend.evaluate(el => el.blur());
    }
    await page.screenshot({ path: `test-results/safari-bottom-${prefix === '/' ? 'desktop' : 'mobile'}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await friends.first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await friends.first().getAttribute('data-gesture'), 'quiet');
    assert.equal(await friends.first().locator('.safari-friend-art').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.clock.runFor(1200);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => { document.activeElement.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.clock.runFor(32);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await page.screenshot({ path: `test-results/safari-${prefix === '/' ? 'desktop' : 'mobile'}.png` });
    await page.clock.resume();
    for (const game of ['taptaptap', 'hextris', 'ohhi', 'flappy']) {
      let releaseScript;
      const scriptGate = new Promise(resolve => { releaseScript = resolve; });
      const scriptPattern = `**/games/${game}/**/*.js`;
      await page.route(scriptPattern, async route => { await scriptGate; await route.continue(); });
      const loaded = page.waitForEvent('framenavigated', frame => frame.url() === `${base}games/${game}/index.html`);
      await page.locator(`[data-game="${game}"]`).click();
      await page.locator('.game-loading').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#game-frame-container').getAttribute('aria-busy'), 'true');
      assert(await page.locator('iframe').evaluate(frame => frame.inert));
      // An unrelated window must not be able to dismiss the loading hero.
      await page.evaluate(() => window.postMessage({ type: 'invitation:game-ready' }, '*'));
      assert(await page.locator('.game-loading').isVisible());
      if (game === 'taptaptap' && prefix === '/Birthday/') {
        await page.screenshot({ path: 'test-results/game-loading-mobile.png' });
      }
      releaseScript();
      const frame = await loaded;
      await frame.waitForLoadState('networkidle');
      await page.locator('.game-loading').waitFor({ state: 'detached' });
      assert.equal(await page.locator('#game-frame-container').getAttribute('aria-busy'), null);
      assert.equal(await page.locator('iframe').evaluate(frame => frame.inert), false);
      await page.unroute(scriptPattern);
      assert(frame, `${prefix}: ${game} loaded under the correct path`);
      assert(await page.locator('iframe').isVisible());
      assert(await frame.locator('body').evaluate(body => body.children.length > 0));
      if (game === 'taptaptap') {
        await page.locator('#restart-game').click();
        await page.locator('.game-loading').waitFor({ state: 'visible' });
        await page.locator('.game-loading').waitFor({ state: 'detached' });
        await page.locator('#restart-game').click();
        await page.locator('.game-loading').waitFor({ state: 'visible' });
      }
      await page.locator('#close-game').click();
      await page.waitForFunction(() => !document.querySelector('iframe'));
    }
    await page.locator('a[href="./credits.html"]').click();
    await page.waitForLoadState('networkidle');
    assert.equal(page.url(), `${base}credits.html`);
    const links = await page.locator('a').evaluateAll(links => links.map(link => link.href));
    for (const url of links.filter(url => url.startsWith(new URL(base).origin))) {
      assert(url.startsWith(base), `Link escapes repository path: ${url}`);
      const response = await page.request.get(url);
      assert(response.ok(), `Broken credits link: ${url}`);
    }
    await page.getByRole('link', { name: '← Back to the invitation' }).click();
    assert.equal(page.url(), base);
    assert.deepEqual(failures, [], `${prefix}: no missing assets or browser errors`);
    await page.close();
    console.log(`${prefix}: invitation, fonts, games, credits and source downloads passed`);
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
