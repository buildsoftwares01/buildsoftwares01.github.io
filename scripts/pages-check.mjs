import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
    assert.equal(await friends.count(), 5);
    assert.deepEqual(await page.locator('#main > section').evaluateAll(sections => sections.map(section => section.querySelectorAll('.safari-home').length)), [1, 1, 1, 1, 1], 'Exactly one animal belongs to each section');
    assert.equal(await page.locator('.safari-stop').count(), 5);
    assert.equal(await homes.evaluateAll(homes => new Set(homes.map(home => home.dataset.animal)).size), 5, 'Five different illustrated animals');
    await page.waitForFunction(() => document.querySelector('.safari-home').dataset.renderer === '2d');
    assert.deepEqual(await homes.evaluateAll(homes => homes.map(home => home.dataset.state)), Array.from({ length: 5 }, (_, i) => ['walk', 'eat', 'sleep', 'play'][i % 4]));
    assert.equal(await page.locator('.safari-friends').first().evaluate(el => getComputedStyle(el).position), 'absolute');
    await page.mouse.move(200, 0);
    await page.clock.runFor(32);
    const pixels = async friend => createHash('sha256').update(await friend.locator('canvas').evaluate(canvas => canvas.toDataURL())).digest('hex');
    const start = await pixels(friends.first());
    await page.clock.runFor(1250);
    assert.notEqual(await pixels(friends.first()), start, '2D sprite walking changes the rendered pose');
    await page.clock.runFor(8750);
    assert.equal(await homes.first().getAttribute('data-state'), 'eat');
    await page.clock.runFor(6000);
    assert.equal(await homes.first().getAttribute('data-state'), 'sleep');
    assert.notEqual(await pixels(friends.first()), start, 'Sleeping has a different illustrated pose');
    await page.screenshot({ path: `test-results/safari-2d-sleep-${prefix === '/' ? 'desktop' : 'mobile'}.png` });
    await page.clock.runFor(8500);
    assert.equal(await homes.first().getAttribute('data-state'), 'play');
    await page.clock.runFor(6500);
    assert.equal(await homes.first().getAttribute('data-state'), 'walk', 'Routine repeats');
    await page.evaluate(() => document.querySelector('#motion-toggle').click());
    const beforePause = await pixels(friends.first());
    await page.clock.runFor(12000);
    assert.equal(await pixels(friends.first()), beforePause, 'Pause freezes 2D animation and routine');
    const anchorBefore = await homes.first().evaluate(home => home.getBoundingClientRect().top + scrollY);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
    const anchorAfter = await homes.first().evaluate(home => home.getBoundingClientRect().top + scrollY);
    assert(Math.abs(anchorBefore - anchorAfter) < .01, 'Home stays in its document spot while scrolling');
    assert((await homes.first().boundingBox()).y < 0, 'Top animal scrolls out of the viewport');
    await page.evaluate(() => document.querySelector('#motion-toggle').click());
    for (let i = 0; i < 5; i++) {
      const friend = friends.nth(i);
      await friend.scrollIntoViewIfNeeded();
      await page.waitForFunction(i => document.querySelectorAll('.safari-home')[i].dataset.renderer === '2d', i);
      const bounds = await friend.boundingBox();
      assert(bounds.width >= 120 && bounds.height >= 120, 'Large stable touch target');
      assert(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width);
      const beforeTap = await pixels(friend);
      await friend.click();
      assert.equal(await friend.getAttribute('data-gesture'), 'boo');

      await page.clock.runFor(336);
      // Browser CSS animations use the rendering clock, not the mocked JS clock.
      await new Promise(resolve => setTimeout(resolve, 336));
      assert(Number(await friend.locator('.safari-boo').evaluate(el => getComputedStyle(el).opacity)) > .9);
      assert.notEqual(await pixels(friend), beforeTap, 'Tap produces an animated 2D leap');
      assert(await friend.locator('canvas').evaluate(canvas => {
        const row = canvas.getContext('2d').getImageData(0, 0, canvas.width, 1).data;
        return row.every((value, index) => index % 4 !== 3 || value < 128);
      }), 'The leap keeps the animal head and ears inside the canvas');
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
    assert.equal(await friends.first().locator('.safari-boo').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.clock.runFor(1200);
    const reducedPose = await pixels(friends.first());
    await page.clock.runFor(5000);
    assert.equal(await pixels(friends.first()), reducedPose, 'Reduced motion freezes 2D rendering');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => { document.activeElement.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.clock.runFor(32);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await page.screenshot({ path: `test-results/safari-${prefix === '/' ? 'desktop' : 'mobile'}.png` });
    if (prefix === '/Birthday/') {
      await page.setViewportSize({ width: 320, height: 740 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px has no overflow');
      for (const home of await homes.all()) {
        const box = await home.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= 320, 'All animals fit on a narrow phone');
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.clock.resume();
    if (prefix === '/') {
      const gallery = await browser.newPage({ viewport: { width: 1400, height: 850 } });
      gallery.on('pageerror', error => failures.push(error.message));
      await gallery.goto(base, { waitUntil: 'networkidle' });
      await gallery.evaluate(() => {
        document.body.classList.add('motion-paused');
        for (const child of document.body.children) if (child.id !== 'main') child.style.display = 'none';
        const main = document.querySelector('#main');
        main.style.display = 'grid'; main.style.gridTemplateColumns = '1fr 1fr';
        for (const child of main.children) {
          if (!child.classList.contains('safari-section')) child.style.display = 'none';
          else {
            child.style.cssText = 'display:block;position:relative;width:100%;height:180px;min-height:0;padding:0;margin:0;background:transparent;opacity:1;transform:none;transition:none';
            for (const content of child.children) if (!content.classList.contains('safari-stop')) content.style.display = 'none';
          }
        }
      });
      await gallery.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.renderer === '2d'));
      await gallery.screenshot({ path: 'test-results/safari-2d-cast.png' });
      // IntersectionObserver follows real rendering frames, so test it without a mocked clock.
      await gallery.setViewportSize({ width: 1400, height: 300 });
      await gallery.evaluate(() => document.body.classList.remove('motion-paused'));
      await gallery.waitForFunction(() => document.querySelectorAll('.safari-home')[4].dataset.visible === 'false');
      const hidden = gallery.locator('.safari-friend').last();
      const active = gallery.locator('.safari-friend').first();
      const hiddenPose = await pixels(hidden), activePose = await pixels(active);
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.equal(await pixels(hidden), hiddenPose, 'Offscreen 2D animation stops');
      assert.notEqual(await pixels(active), activePose, 'Visible 2D animation continues');
      await gallery.close();
      const fallback = await browser.newPage();
      await fallback.route('**/assets/animals/*.webp', route => route.abort());
      await fallback.goto(base, { waitUntil: 'networkidle' });
      await fallback.waitForFunction(() => document.querySelector('.safari-home').dataset.renderer === 'fallback');
      await fallback.locator('.safari-friend').first().click();
      assert.equal(await fallback.locator('.safari-friend').first().getAttribute('data-gesture'), 'boo', 'Missing-art fallback remains interactive');
      await fallback.close();
    }
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
