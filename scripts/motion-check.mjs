import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#animation-mode').inputValue(), 'gentle');
  assert.equal(await page.locator('h1 em').getAttribute('role'), null, 'Gentle text adds no inactive tab stops');
  await page.locator('h1 em').click();
  assert.equal(await page.locator('.accent-comic-burst').count(), 0);
  await page.locator('#animation-mode').selectOption('full');
  assert.equal(await page.locator('h1 em').getAttribute('role'), 'button');
  await page.locator('h1 em').focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('.accent-comic-burst').count() > 0, 'Full-mode text reacts to keyboard activation');
  await page.locator('#animation-mode').selectOption('gentle');
  assert.equal(await page.locator('h1 em').getAttribute('tabindex'), null);
  assert.equal(await page.locator('.accent-comic-burst').count(), 0);
  await page.locator('#animation-mode').selectOption('full');
  await page.locator('.site-header [data-rsvp]').click();
  await page.waitForFunction(() => document.body.classList.contains('motion-dialog'));
  assert.equal(await page.locator('.safari-stop').first().getAttribute('data-paused'), 'true', 'Dialog pauses animal movement');
  await page.locator('#close-rsvp').click();
  await page.waitForFunction(() => !document.body.classList.contains('motion-dialog'));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: no horizontal overflow`);
    // Sample the entire loop: every phrase must be fully visible at some point.
    const phrasesSeen = await page.locator('.ticker-track').evaluate(track => {
      const animation = track.getAnimations()[0];
      animation.pause();
      const windowRect = track.parentElement.getBoundingClientRect();
      const phrases = [...track.firstElementChild.querySelectorAll('span')];
      const seen = new Set();
      for (let time = 0; time < 34000; time += 100) {
        animation.currentTime = time;
        phrases.forEach((phrase, index) => {
          const rect = phrase.getBoundingClientRect();
          if (rect.left >= windowRect.left && rect.right <= windowRect.right) seen.add(index);
        });
      }
      animation.currentTime = 0;
      animation.play();
      return seen.size;
    });
    assert.equal(phrasesSeen, 4, `${width}px: every ribbon phrase scrolls into view`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#animation-mode').selectOption('off');
  assert(await page.locator('.safari-stop').first().getAttribute('data-paused') === 'true');
  await page.locator('#animation-mode').selectOption('full');
  assert(await page.locator('.ticker-track').evaluate(el => getComputedStyle(el).animationPlayState === 'running'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#animation-mode:disabled').waitFor({ state: 'visible' });
  assert(await page.locator('#animation-mode').isDisabled());
  assert.equal(await page.locator('#animation-mode').inputValue(), 'off');
  assert(await page.locator('.ticker-track').evaluate(el => getComputedStyle(el).animationName === 'none'));
  assert(await page.locator('.ticker-group').first().evaluate(group => {
    const visible = group.parentElement.parentElement.getBoundingClientRect();
    return [...group.querySelectorAll('span')].every(el => {
      const rect = el.getBoundingClientRect();
      return rect.left >= visible.left && rect.right <= visible.right && rect.top >= visible.top && rect.bottom <= visible.bottom;
    });
  }), 'Reduced motion shows every phrase without scrolling');
  for (const [name, width, height] of [['mobile', 390, 844], ['desktop', 1440, 1000]]) {
    const preview = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await preview.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
    await preview.evaluate(() => document.fonts.ready);
    await preview.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    await preview.screenshot({ path: `test-results/${name}-hero.png` });
    await preview.close();
  }
  assert.deepEqual(errors, []);
  console.log('Responsive layouts, complete ribbon loop, pause/resume and reduced motion passed.');
} finally { await browser.close(); }
