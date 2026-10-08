import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const sections = [['Invitation', '#main'], ['Celebration', '#celebration'], ['Venue', '#venue'], ['RSVP', '#rsvp'], ['Kids corner', '#kids-corner'], ['Gaming', '#games']];
await mkdir('test-results', { recursive: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    const nav = page.locator('.site-header .section-nav');
    assert.equal(await nav.getByRole('link').count(), 6);
    assert.equal(await page.locator('#kids-corner .safari-friend').count(), 5);
    assert.equal(await page.locator('#kids-corner .activity-card').count(), 4);
    assert.equal(await page.locator('#games [data-game]').count(), 4);

    async function checkPage() {
      assert(await nav.locator('a').evaluateAll(links => links.every(link => {
        const rect = link.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth && rect.width >= 44 && rect.height >= 44 && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === link;
      })), `${width}px: all top links stay visible and tappable`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: no horizontal overflow`);
      assert(await page.locator('#main > section').evaluateAll(elements => elements.length === 6 && elements.every((el, i) => {
        const rect = el.getBoundingClientRect();
        return !el.hidden && rect.height > 0 && (i === 0 || rect.top >= elements[i - 1].getBoundingClientRect().bottom);
      })), 'Every section stays in the same continuous document');
    }
    async function checkAnchor(hash) {
      await page.waitForFunction(hash => {
        const target = document.querySelector(hash).getBoundingClientRect();
        const header = document.querySelector('.site-header').getBoundingClientRect();
        return target.top >= header.bottom - 1 && target.top <= header.bottom + 24;
      }, hash);
      await page.waitForFunction(hash => document.querySelector('.section-nav a[aria-current]')?.hash === hash, hash);
    }
    await checkPage();
    if (width === 390) await page.screenshot({ path: 'test-results/navbar-phone-invitation.png' });
    for (const [label, hash] of sections.slice(1)) {
      await nav.getByRole('link', { name: label, exact: true }).focus();
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash, hash);
      assert.equal(await page.evaluate(() => document.activeElement.id), hash.slice(1));
      await checkAnchor(hash);
      await checkPage();
      assert.equal(await nav.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'location');
      if (hash === '#kids-corner') await page.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.painted === 'true'));
      if ((width === 390 || width === 1440) && ['#kids-corner', '#games'].includes(hash)) {
        await page.screenshot({ path: `test-results/navbar-${width}-${hash.slice(1)}.png` });
      }
    }
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.goBack();
    await checkAnchor('#kids-corner');
    await page.goForward();
    await checkAnchor('#games');
    await page.locator('[data-game="taptaptap"]').click();
    assert(await page.locator('#game-dialog').isVisible());
    await page.locator('.game-tabs').getByRole('link', { name: 'Kids corner', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !document.querySelector('#game-frame-container iframe'));
    await checkAnchor('#kids-corner');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'kids-corner');
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), pageHeight, 'Section navigation never changes page length');

    // Ordinary scrolling updates the navbar without selecting or hiding a page.
    for (const hash of ['#rsvp', '#kids-corner', '#games']) {
      await page.locator(hash).evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await checkAnchor(hash);
      await checkPage();
    }
    await nav.getByRole('link', { name: 'Invitation', exact: true }).click();
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.waitForFunction(() => document.querySelector('#mobile-actions').hidden);
    await page.setViewportSize({ width: 844, height: 390 });
    await checkPage();
    assert.deepEqual(errors, []);
    await page.close();
  }
  for (const hash of ['#venue', '#kids-corner', '#games']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(base + hash);
    await page.waitForFunction(hash => {
      const rect = document.querySelector(hash).getBoundingClientRect();
      return rect.top >= document.querySelector('.site-header').getBoundingClientRect().bottom - 1 && rect.top < innerHeight;
    }, hash);
    assert(await page.locator('#main > section').evaluateAll(elements => elements.every(el => !el.hidden && el.getBoundingClientRect().height > 0)), 'Direct links retain all sections');
    await page.close();
  }
  const plain = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await plain.goto(base);
  for (const label of ['Kids corner', 'Gaming', 'Invitation']) {
    await plain.locator('.site-header .section-nav').getByRole('link', { name: label, exact: true }).click();
    assert(await plain.locator('#main > section').evaluateAll(elements => elements.every(el => !el.hidden && el.getBoundingClientRect().height > 0)), 'Native navigation keeps all sections visible without JavaScript');
  }
  await plain.close();
  console.log('Single-page sections, sticky navbar, anchor offsets, keyboard focus, scroll tracking, history, direct links and game exits passed on phones, desktop and landscape.');
} finally { await browser.close(); }
