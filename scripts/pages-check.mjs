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
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.locator('.hero-art img').evaluate(img => img.complete && img.naturalWidth > 0));
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
