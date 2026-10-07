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
    const tabs = page.locator('.page-tabs');
    assert.equal(await page.locator('.brand-icon').count(), 0, 'Brand has a clear name without the duplicate initial');
    assert.equal(await page.locator('#kids-corner .safari-friend').count(), 5);
    assert.equal(await page.locator('#kids-corner .activity-card').count(), 4);
    assert.equal(await page.locator('#kids-corner [data-game]').count(), 0);
    assert.equal(await page.locator('#games [data-game]').count(), 4);
    assert.equal(await page.locator('#games .activity-card').count(), 0);

    async function checkTabs() {
      assert(await tabs.locator('a').evaluateAll(links => links.every(link => {
        const rect = link.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44 && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === link;
      })), `${width}px: all three tabs remain visible and tappable`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: no overflow`);
    }
    await checkTabs();
    if (width === 390) await page.screenshot({ path: 'test-results/navigation-phone-hero.png' });
    for (const target of ['#celebration', '#venue', '#rsvp', '#kids-corner', '#games', '.site-footer']) {
      await page.locator(target).scrollIntoViewIfNeeded();
      await checkTabs();
    }
    for (const [label, target] of [['Kids corner', '#kids-corner'], ['Gaming', '#games'], ['Invitation', '#main']]) {
      const link = tabs.getByRole('link', { name: label, exact: true });
      await link.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(({ target }) => document.querySelector('.page-tabs [aria-current]')?.hash === target, { target });
      const landing = await page.locator(target).evaluate(section => ({ top: section.getBoundingClientRect().top, focused: document.activeElement === section }));
      const bar = await tabs.boundingBox();
      assert(landing.top >= bar.y + bar.height - 1 && landing.top < bar.y + bar.height + 40, 'Jump heading is below the sticky bar');
      assert(landing.focused, 'Keyboard jumps move focus to the destination');
      await checkTabs();
      if (width === 390 && target !== '#main') await page.screenshot({ path: `test-results/navigation-phone-${target.slice(1)}.png` });
    }
    await tabs.getByRole('link', { name: 'Gaming', exact: true }).click();
    await page.locator('[data-game="taptaptap"]').click();
    assert(await page.locator('#game-dialog').isVisible());
    assert(await page.locator('.dialog-tabs').isVisible(), 'Section shortcuts stay available inside games');
    await page.locator('.dialog-tabs').getByRole('link', { name: 'Kids corner', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !document.querySelector('#game-frame-container iframe'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'kids-corner');
    await checkTabs();
    if (width === 1440) await page.screenshot({ path: 'test-results/navigation-desktop-kids.png' });
    assert.deepEqual(errors, []);
    await page.close();
  }
  // Native links also jump correctly when JavaScript is unavailable.
  const plain = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await plain.goto(base);
  await plain.locator('.page-tabs').getByRole('link', { name: 'Gaming', exact: true }).click();
  assert.equal(new URL(plain.url()).hash, '#games');
  assert((await plain.locator('#gaming-title').boundingBox()).y > 60);
  await plain.close();
  console.log('Persistent navigation, keyboard jumps, play grouping, game exits and no-JavaScript links passed at 320, 390, 768 and 1440px.');
} finally {
  await browser.close();
}
