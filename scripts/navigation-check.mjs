import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    const tabs = page.locator('.site-header .section-nav');
    assert.equal(await tabs.getByRole('link').count(), 6);
    assert.equal(await page.locator('#kids-corner').isVisible(), false);
    assert.equal(await page.locator('#games').isVisible(), false);
    assert.equal(await page.locator('#kids-corner .safari-friend').count(), 5);
    assert.equal(await page.locator('#kids-corner .activity-card').count(), 4);
    assert.equal(await page.locator('#games [data-game]').count(), 4);

    async function checkTabs() {
      assert(await tabs.locator('a').evaluateAll(links => links.every(link => {
        const rect = link.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth && rect.width >= 44 && rect.height >= 44 && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === link;
      })), `${width}px: all top links stay visible and tappable`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: no horizontal overflow`);
    }
    await checkTabs();
    for (const [label, hash] of [['Celebration', '#celebration'], ['Venue', '#venue'], ['RSVP', '#rsvp']]) {
      await tabs.getByRole('link', { name: label, exact: true }).click();
      assert.equal(new URL(page.url()).hash, hash);
      assert.equal(await page.evaluate(() => document.activeElement.id), hash.slice(1));
      assert(await page.locator(hash).evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom), 'Anchors clear the sticky header');
      await checkTabs();
    }
    await tabs.getByRole('link', { name: 'Invitation', exact: true }).click();
    assert.equal(await page.evaluate(() => scrollY), 0);
    if (width === 390) await page.screenshot({ path: 'test-results/navbar-phone-invitation.png' });
    for (const target of ['#celebration', '#venue', '#rsvp', '.site-footer']) {
      await page.locator(target).scrollIntoViewIfNeeded();
      await checkTabs();
    }
    await page.waitForFunction(() => !document.querySelector('#mobile-actions').hidden);
    const invitationHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const invitationScroll = await page.evaluate(() => scrollY);
    for (const [label, target, view, other] of [['Kids corner', '#kids-corner', 'kids', '#games'], ['Gaming', '#games', 'gaming', '#kids-corner']]) {
      await tabs.getByRole('link', { name: label, exact: true }).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('body').getAttribute('data-view'), view);
      assert(await page.locator(target).isVisible());
      assert.equal(await page.locator(other).isVisible(), false);
      assert.equal(await page.locator('.hero').isVisible(), false, 'Invitation is a separate view');
      assert.equal(await page.evaluate(() => document.activeElement.id), target.slice(1));
      assert.equal(await page.evaluate(() => scrollY), 0, 'New corners open at the top');
      assert.equal(await tabs.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
      await checkTabs();
      if (view === 'kids') await page.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.painted === 'true'));
      if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/navbar-${width}-${view}.png` });
    }
    await page.locator('[data-game="taptaptap"]').click();
    assert(await page.locator('#game-dialog').isVisible());
    assert(await page.locator('.game-tabs').isVisible());
    await page.locator('.game-tabs').getByRole('link', { name: 'Kids corner', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !document.querySelector('#game-frame-container iframe'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'kids-corner');
    await page.locator('#kids-corner .corner-back').click();
    assert(await page.locator('.hero').isVisible());
    await page.waitForFunction(() => !document.querySelector('#mobile-actions').hidden);
    assert.equal(await page.evaluate(() => scrollY), invitationScroll, 'Returning restores the invitation reading position');
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), invitationHeight, 'Play content never contributes to invitation length');
    await page.goBack();
    await page.waitForFunction(() => document.body.dataset.view === 'kids');
    assert(await page.locator('#kids-corner').isVisible());
    await page.goForward();
    await page.waitForFunction(() => document.body.dataset.view === 'invitation');
    await tabs.getByRole('link', { name: 'Gaming', exact: true }).click();
    await page.locator('[data-game="taptaptap"]').click();
    await page.goBack();
    await page.waitForFunction(() => document.body.dataset.view === 'invitation' && !document.querySelector('#game-dialog').open && !document.querySelector('iframe'));
    await checkTabs();
    await tabs.getByRole('link', { name: 'Kids corner', exact: true }).click();
    await tabs.getByRole('link', { name: 'Venue', exact: true }).click();
    assert(await page.locator('#venue').isVisible(), 'Invitation sections open from corners');
    assert.equal(await page.locator('#kids-corner').isVisible(), false);
    await checkTabs();
    await page.setViewportSize({ width: 844, height: 390 });
    await checkTabs();
    assert.deepEqual(errors, []);
    await page.close();
  }
  for (const [hash, visible, hidden] of [['#kids-corner', '#kids-corner', '#games'], ['#games', '#games', '#kids-corner']]) {
    const deep = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await deep.goto(base + hash);
    assert(await deep.locator(visible).isVisible(), 'Direct links open the requested view');
    assert.equal(await deep.locator(hidden).isVisible(), false);
    assert.equal(await deep.locator('.hero').isVisible(), false);
    await deep.close();
  }
  const plain = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await plain.goto(base);
  assert.equal(await plain.locator('#games').isVisible(), false);
  await plain.locator('.site-header .section-nav').getByRole('link', { name: 'Gaming', exact: true }).click();
  assert(await plain.locator('#games').isVisible());
  assert.equal(await plain.locator('.hero').isVisible(), false);
  await plain.locator('#games .corner-back').click();
  assert(await plain.locator('.hero').isVisible());
  assert.equal(await plain.locator('#games').isVisible(), false);
  await plain.close();
  console.log('Sticky top navigation, separate views, keyboard focus, reading position, history, direct links and game exits passed on phones, desktop and landscape.');
} finally { await browser.close(); }
